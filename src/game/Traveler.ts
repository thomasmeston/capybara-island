import * as THREE from 'three';
import { PLAY_RADIUS, SURFACE_SPEED, Surface, WATER_Y } from '../island/shape';
import { Locomotion } from './capybara/Locomotion';
import { buildCapybara, SWIM_SINK } from './capybara/Rig';
import type { AudioBus } from './AudioBus';
import type { MoveInput } from './Input';
import type { IsoCamera } from './IsoCamera';
import type { GroundSample, Island } from './Island';
import { Splashes } from './Splashes';

const UP = new THREE.Vector3(0, 1, 0);
const WALK_SPEED = 1.75;
const TROT_SPEED = 3.5;

/**
 * The player capybara. Movement is kinematic. The gait, hop, and foot plant
 * live on Locomotion. In swim depth the body sits on the waterline.
 */
export class Traveler {
  readonly group = new THREE.Group();
  readonly position = new THREE.Vector3(0, 0, -15);
  sample: GroundSample | null = null;

  private readonly velocity = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private readonly heading = new THREE.Quaternion();
  private readonly tilt = new THREE.Quaternion();
  private readonly yaw = new THREE.Quaternion();
  private readonly locomotion: Locomotion;

  constructor(
    private readonly island: Island,
    audio: AudioBus,
  ) {
    const parts = buildCapybara(this.group);
    const splashes = new Splashes(island.group);
    this.locomotion = new Locomotion(parts, this.group, island, audio, splashes);
    this.snapToGround();
  }

  get gait(): string {
    return this.locomotion.gait;
  }

  private snapToGround(): void {
    const sample = this.island.sample(this.position.x, this.position.z);
    if (!sample) return;
    this.sample = sample;
    this.applyHeight(sample);
  }

  update(dt: number, input: MoveInput, camera: IsoCamera): void {
    const travel = this.sample?.travel ?? Surface.Grass;
    const speedScale = SURFACE_SPEED[travel];
    const speed = (input.hurry ? TROT_SPEED : WALK_SPEED) * speedScale;
    this.desired
      .set(0, 0, 0)
      .addScaledVector(camera.right, input.x)
      .addScaledVector(camera.forward, input.z);
    if (this.desired.lengthSq() > 1) this.desired.normalize();
    this.desired.multiplyScalar(speed);

    const rate = this.desired.lengthSq() > 0.01 ? 3.1 : 2.1;
    const k = 1 - Math.exp(-rate * dt);
    this.velocity.lerp(this.desired, k);

    const nextX = this.position.x + this.velocity.x * dt;
    const nextZ = this.position.z + this.velocity.z * dt;
    const radius = Math.hypot(nextX, nextZ);
    const clamped = radius > PLAY_RADIUS ? PLAY_RADIUS / radius : 1;
    const x = nextX * clamped;
    const z = nextZ * clamped;
    const sample = this.island.sample(x, z);
    if (!sample) {
      this.velocity.set(0, 0, 0);
      return;
    }
    this.position.x = x;
    this.position.z = z;
    this.sample = sample;
    this.group.position.set(x, this.position.y, z);
    this.face(sample, dt);
    this.locomotion.prepare(dt, this.velocity, input.hurry, input.hop, sample.travel);
    this.face(sample, dt);
    this.locomotion.finish(dt, sample.travel);
    this.applyHeight(sample);
  }

  private face(sample: GroundSample, dt: number): void {
    if (sample.travel === Surface.Swim) this.tilt.identity();
    else {
      const upright = new THREE.Quaternion().setFromUnitVectors(UP, sample.normal);
      this.tilt.slerp(upright, 1 - Math.exp(-5 * dt));
    }
    this.yaw.setFromAxisAngle(UP, this.locomotion.yaw);
    this.heading.copy(this.tilt).multiply(this.yaw);
    this.group.quaternion.copy(this.heading);
  }

  private applyHeight(sample: GroundSample): void {
    const bob = sample.travel === Surface.Swim ? Math.sin(performance.now() * 0.003) * 0.015 : 0;
    if (sample.travel === Surface.Swim) this.position.y = WATER_Y - SWIM_SINK + bob;
    else this.position.y = sample.point.y;
    this.position.y += this.locomotion.lift;
    this.group.position.copy(this.position);
  }
}
