import * as THREE from 'three';
import { Surface, type SurfaceId } from '../../island/shape';
import type { Island } from '../Island';
import type { AudioBus } from '../AudioBus';
import { Footprints } from '../Footprints';
import type { Splashes } from '../Splashes';
import { buildClips } from './Clips';
import { plantFeet } from './FootIk';
import { hopHeight } from './Poses';
import { LEGS, type CapybaraParts, type LegId } from './Rig';

const JUMP_TIME = 0.5;
const WALK_PHASE: Record<LegId, number> = { BL: 0, FL: 0.25, BR: 0.5, FR: 0.75 };
const TROT_PHASE: Record<LegId, number> = { FL: 0, BR: 0, FR: 0.5, BL: 0.5 };

type ClipName = 'idle' | 'loaf' | 'walk' | 'trot' | 'wade' | 'swim';
const CLIP_NAMES: ClipName[] = ['idle', 'loaf', 'walk', 'trot', 'wade', 'swim'];

export class Locomotion {
  gait = 'idle';
  /** Extra root height for the hop, or the swim-surface bob. */
  lift = 0;
  yaw = 0;
  private speed = 0;

  private readonly mixer: THREE.AnimationMixer;
  private readonly actions: Record<ClipName, THREE.AnimationAction>;
  private readonly jumpAction: THREE.AnimationAction;
  private readonly weights: Record<ClipName, number> = {
    idle: 1,
    loaf: 0,
    walk: 0,
    trot: 0,
    wade: 0,
    swim: 0,
  };
  private readonly stance: Record<LegId, number> = { FL: 1, FR: 1, BL: 1, BR: 1 };
  private readonly prevStance: Record<LegId, number> = { FL: 1, FR: 1, BL: 1, BR: 1 };
  private lead = 0;
  private jumpT = -1;
  private idleTime = 0;
  private paddleTime = 0;
  private landPlayed = false;
  private blink = 0;
  private readonly clock = new THREE.Clock();
  private readonly footprints: Footprints;

  constructor(
    private readonly parts: CapybaraParts,
    private readonly root: THREE.Object3D,
    private readonly island: Island,
    private readonly audio: AudioBus,
    private readonly splashes: Splashes,
  ) {
    this.footprints = new Footprints(island.group);
    const clips = buildClips(parts);
    this.mixer = new THREE.AnimationMixer(root);
    this.actions = {
      idle: this.mixer.clipAction(clips.idle),
      loaf: this.mixer.clipAction(clips.loaf),
      walk: this.mixer.clipAction(clips.walk),
      trot: this.mixer.clipAction(clips.trot),
      wade: this.mixer.clipAction(clips.wade),
      swim: this.mixer.clipAction(clips.swim),
    };
    for (const name of CLIP_NAMES) {
      this.actions[name].play();
      this.actions[name].weight = name === 'idle' ? 1 : 0;
    }
    this.jumpAction = this.mixer.clipAction(clips.jump);
    this.jumpAction.setLoop(THREE.LoopOnce, 1);
    this.jumpAction.clampWhenFinished = true;
    this.jumpAction.timeScale = 0;
    this.jumpAction.play();
    this.clock.start();
  }

  prepare(dt: number, velocity: THREE.Vector3, hurry: boolean, hopPressed: boolean, travel: SurfaceId): void {
    const time = this.clock.getElapsedTime();
    const speed = Math.hypot(velocity.x, velocity.z);
    this.speed = speed;
    this.updateJump(dt, hopPressed, travel);
    this.updateWeights(dt, speed, hurry, travel);
    this.updateYaw(dt, velocity, speed);
    this.applyActions(speed, travel);
    this.mixer.update(dt);
    this.applyHead(time, speed);
  }

  finish(dt: number, travel: SurfaceId): void {
    this.applyStance(dt, travel);
    this.plant(travel);
    this.tickBlink(dt);
    this.splashes.update(dt);
  }

  private updateJump(dt: number, hopPressed: boolean, travel: SurfaceId): void {
    if (hopPressed && this.jumpT < 0) {
      this.jumpT = 0;
      this.landPlayed = false;
      this.audio.hop(travel);
      if (travel === Surface.Shallows || travel === Surface.Swim) {
        this.splashes.burst(this.root.position.x, this.root.position.y, this.root.position.z, 1.4);
      }
    }
    if (this.jumpT < 0) {
      this.lift = THREE.MathUtils.damp(this.lift, 0, 8, dt);
      return;
    }
    this.jumpT += dt;
    const phase = Math.min(1, this.jumpT / JUMP_TIME);
    this.lift = hopHeight(phase, travel === Surface.Swim);
    if (!this.landPlayed && phase >= 0.8 && travel !== Surface.Swim) {
      this.landPlayed = true;
      this.audio.land(travel);
      if (travel === Surface.Shallows) {
        this.splashes.burst(this.root.position.x, this.root.position.y, this.root.position.z, 1.2);
      }
    }
    if (this.jumpT >= JUMP_TIME) this.jumpT = -1;
  }

  private updateWeights(dt: number, speed: number, hurry: boolean, travel: SurfaceId): void {
    const moving = speed > 0.35;
    const targets: Record<ClipName, number> = {
      idle: 0,
      loaf: 0,
      walk: 0,
      trot: 0,
      wade: 0,
      swim: 0,
    };
    if (travel === Surface.Swim) {
      targets.swim = 1;
      this.idleTime = 0;
    } else if (travel === Surface.Shallows) {
      targets[moving ? 'wade' : 'idle'] = 1;
      this.idleTime = 0;
    } else if (!moving) {
      this.idleTime += dt;
      const loaf = this.idleTime > 0.7 ? 1 : 0;
      targets.loaf = loaf;
      targets.idle = 1 - loaf;
    } else {
      this.idleTime = 0;
      targets[hurry && speed > 1.5 ? 'trot' : 'walk'] = 1;
    }
    for (const name of CLIP_NAMES) {
      this.weights[name] = THREE.MathUtils.damp(this.weights[name], targets[name], 7, dt);
    }

    if (this.jumpT >= 0 && travel !== Surface.Swim) this.gait = 'hop';
    else if (targets.swim === 1) this.gait = moving ? 'swim' : 'float';
    else if (targets.wade === 1) this.gait = 'wade';
    else if (targets.trot === 1) this.gait = 'trot';
    else if (targets.walk === 1) this.gait = 'walk';
    else if (targets.loaf === 1) this.gait = 'loaf';
    else this.gait = 'idle';
  }

  private updateYaw(dt: number, velocity: THREE.Vector3, speed: number): void {
    if (speed > 0.3) {
      const desired = Math.atan2(velocity.x, velocity.z);
      const diff = Math.atan2(Math.sin(desired - this.yaw), Math.cos(desired - this.yaw));
      this.yaw += diff * (1 - Math.exp(-3.2 * dt));
      const remain = Math.atan2(Math.sin(desired - this.yaw), Math.cos(desired - this.yaw));
      const leadTarget = THREE.MathUtils.clamp(remain * 1.2, -0.6, 0.6);
      this.lead = THREE.MathUtils.damp(this.lead, leadTarget, 8, dt);
    } else {
      this.lead = THREE.MathUtils.damp(this.lead, 0, 4, dt);
    }
  }

  private applyActions(speed: number, travel: SurfaceId): void {
    const jumping = this.jumpT >= 0 && travel !== Surface.Swim;
    const jumpW = jumping ? 1 : 0;
    const remain = jumping ? 0 : 1;
    let sum = 0;
    for (const name of CLIP_NAMES) sum += this.weights[name];
    for (const name of CLIP_NAMES) {
      this.actions[name].weight = sum > 0 ? (this.weights[name] / sum) * remain : 0;
    }
    this.jumpAction.weight = jumpW;
    this.jumpAction.time = Math.max(this.jumpT, 0);
    this.actions.walk.timeScale = THREE.MathUtils.clamp(speed / 1.65, 0.5, 1.7);
    this.actions.trot.timeScale = THREE.MathUtils.clamp(speed / 3.1, 0.65, 1.55);
    this.actions.wade.timeScale = THREE.MathUtils.clamp(speed / 1.15, 0.45, 1.5);
    this.actions.swim.timeScale = THREE.MathUtils.clamp(speed / 1.25, 0.4, 1.45);
  }

  private applyHead(time: number, speed: number): void {
    const look = speed < 0.35 ? Math.sin(time * 0.6) * 0.1 : 0;
    this.parts.spineYaw.rotation.set(0, this.lead * 0.35, 0);
    this.parts.headYaw.rotation.set(0, this.lead * 0.5 + look, 0);
    if (speed < 0.35) {
      for (const ear of this.parts.ears) {
        ear.rotation.z = Math.sin(time * 2.4 + ear.position.x) * 0.18;
      }
    }
    const takingOff = this.jumpT >= 0 && this.jumpT < 0.1;
    const landing = this.jumpT > 0.38 && this.jumpT < 0.52;
    const squash = takingOff || landing ? 1 : 0;
    const air = Math.max(0, Math.min(1, this.lift / 0.22));
    this.parts.body.scale.set(
      1 + squash * 0.12 - air * 0.05,
      1 - squash * 0.16 + air * 0.08,
      1 + squash * 0.04,
    );
  }

  private applyStance(dt: number, travel: SurfaceId): void {
    this.paddleTime += dt;
    if (travel === Surface.Swim && this.speed > 0.3 && this.paddleTime > 0.42) {
      this.paddleTime = 0;
      this.audio.paddle();
      this.splashes.burst(this.root.position.x, this.root.position.y + 0.2, this.root.position.z, 0.7);
    }
    for (const id of LEGS) this.prevStance[id] = this.stance[id];
    const stepping = this.speed > 0.35 && travel !== Surface.Swim;
    this.root.updateMatrixWorld(true);
    if (!stepping) {
      for (const id of LEGS) this.stance[id] = 1;
      return;
    }
    const trot = this.weights.trot >= this.weights.walk && this.weights.trot >= this.weights.wade;
    const action = trot ? this.actions.trot : this.weights.wade > this.weights.walk ? this.actions.wade : this.actions.walk;
    const offsets = trot ? TROT_PHASE : WALK_PHASE;
    const duration = action.getClip().duration || 1;
    const phase = (action.time % duration) / duration;
    for (const id of LEGS) {
      const local = (phase + offsets[id]) % 1;
      this.stance[id] = plantAmount(local);
      if (this.prevStance[id] < 0.7 && this.stance[id] >= 0.7) {
        const foot = new THREE.Vector3();
        this.parts.feet[id].getWorldPosition(foot);
        this.audio.step(travel);
        if (travel === Surface.Shallows) this.splashes.burst(foot.x, foot.y, foot.z, 0.8);
        const ground = this.island.sample(foot.x, foot.z);
        if (ground) this.footprints.stamp(ground.point, ground.normal, this.yaw, ground.travel);
      }
    }
  }

  private plant(travel: SurfaceId): void {
    const stepping = this.speed > 0.35 && travel !== Surface.Swim;
    const airborne = this.lift > 0.04 && travel !== Surface.Swim;
    if (!stepping || airborne) return;
    plantFeet(this.parts, this.island, this.root, this.stance, 0.3);
  }

  private tickBlink(dt: number): void {
    this.blink += dt;
    const shut = this.blink % 3.4 < 0.12;
    for (const eye of this.parts.eyes) eye.scale.y = shut ? 0.15 : 1;
  }
}

function plantAmount(phase: number): number {
  if (phase < 0.48) return 1;
  if (phase < 0.64) return (0.64 - phase) / 0.16;
  if (phase > 0.92) return (phase - 0.92) / 0.08;
  return 0;
}
