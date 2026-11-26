import * as THREE from 'three';
import friends from '../data/friends.json';
import { WATER_Y, heightAt } from '../island/shape';
import { SWIM_SINK } from './capybara/Rig';
import { buildClips } from './capybara/Clips';
import { buildCapybara, type Coat } from './capybara/Rig';

export interface FriendSpot {
  x: number;
  z: number;
}

export interface FriendDef {
  id: string;
  name: string;
  lines: string[];
  wish: string;
  itemIds: string[];
  coconuts?: number;
  hide: FriendSpot;
  house: FriendSpot;
  sit: FriendSpot;
  pose: 'wade' | 'sit';
  coat?: Coat;
  needs: string[];
}

const CAST = friends as FriendDef[];
const REST_TIME = 4;
const WALK_SPEED = 0.9;

type Errand = 'home' | 'riding' | 'resting' | 'walking';

/** One friend. Sit is a loaf. A short wade is the walk clip, slowed, for someone in the shallows. */
export class Friend {
  readonly group = new THREE.Group();
  readonly id: string;
  readonly name: string;
  readonly wish: string;
  readonly itemIds: string[];
  readonly coconutCost: number;
  readonly houseAt: FriendSpot;
  private readonly lines: string[];
  private readonly needs: string[];
  private readonly mixer: THREE.AnimationMixer;
  private readonly sit: THREE.AnimationAction;
  private readonly wade: THREE.AnimationAction | null;
  private readonly walk: THREE.AnimationAction;
  private readonly ripple: THREE.Mesh | null;
  private readonly hide: FriendSpot;
  private readonly sitAt: FriendSpot;
  private readonly startPose: 'wade' | 'sit';
  private shown = true;
  private homed = false;
  private errand: Errand = 'home';
  private restLeft = 0;

  constructor(parent: THREE.Object3D, def: FriendDef) {
    this.id = def.id;
    this.name = def.name;
    this.wish = def.wish;
    this.itemIds = def.itemIds;
    this.coconutCost = def.coconuts ?? 0;
    this.houseAt = def.house;
    this.lines = def.lines;
    this.needs = def.needs;
    this.startPose = def.pose;
    this.hide = def.hide;
    this.sitAt = def.sit;

    const parts = buildCapybara(this.group, def.coat);
    const clips = buildClips(parts);
    this.mixer = new THREE.AnimationMixer(this.group);
    this.sit = this.mixer.clipAction(clips.loaf);
    this.wade = def.pose === 'wade' ? this.mixer.clipAction(clips.wade) : null;
    this.walk = this.mixer.clipAction(clips.walk);
    this.walk.timeScale = 0.7;
    if (this.wade) {
      this.wade.timeScale = 0.4;
      this.wade.play();
    } else {
      this.sit.play();
    }

    this.group.scale.setScalar(0.92);
    const y = heightAt(def.hide.x, def.hide.z);
    this.group.position.set(def.hide.x, y, def.hide.z);
    this.group.rotation.y = Math.PI;

    if (def.pose === 'wade') {
      const ripple = new THREE.Mesh(
        new THREE.RingGeometry(0.35, 0.52, 10),
        new THREE.MeshBasicMaterial({
          color: 0xe7f6ff,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ripple.rotation.x = -Math.PI / 2;
      ripple.position.set(def.hide.x, WATER_Y + 0.05, def.hide.z);
      parent.add(ripple);
      this.ripple = ripple;
    } else {
      this.ripple = null;
    }

    parent.add(this.group);
  }

  needsMet(housed: (id: string) => boolean): boolean {
    return this.needs.every(housed);
  }

  setPresent(on: boolean): void {
    if (this.shown === on) return;
    this.shown = on;
    this.group.visible = on;
    if (this.ripple) this.ripple.visible = on && !this.homed;
  }

  /** After the house is up, they loaf outside and look back at it. */
  moveHome(): void {
    this.homed = true;
    this.settle();
  }

  get riding(): boolean {
    return this.errand === 'riding';
  }

  /** Climb onto the player's back. The Stack places them every frame. */
  startRide(): void {
    this.errand = 'riding';
    if (this.ripple) this.ripple.visible = false;
    this.play('sit');
  }

  place(position: THREE.Vector3, quaternion: THREE.Quaternion): void {
    this.group.position.copy(position);
    this.group.quaternion.copy(quaternion);
  }

  /** Hop off, loaf a moment where they land, then walk back home. */
  drop(x: number, z: number, yaw: number): void {
    this.errand = 'resting';
    this.restLeft = REST_TIME;
    this.group.position.set(x, groundY(x, z), z);
    this.group.rotation.set(0, yaw, 0);
    this.play('sit');
  }

  /** Back in their spot: the bank by the house, or where you first found them. */
  private settle(): void {
    this.errand = 'home';
    const spot = this.homed ? this.sitAt : this.hide;
    this.group.position.set(spot.x, this.homed ? Math.max(heightAt(spot.x, spot.z), 0) : heightAt(spot.x, spot.z), spot.z);
    if (this.homed) {
      this.group.rotation.set(0, Math.atan2(this.houseAt.x - spot.x, this.houseAt.z - spot.z), 0);
    } else {
      this.group.rotation.set(0, Math.PI, 0);
    }
    const wading = !this.homed && this.startPose === 'wade';
    this.play(wading ? 'wade' : 'sit');
    if (this.ripple) this.ripple.visible = wading && this.shown;
  }

  private play(mode: 'wade' | 'sit' | 'walk'): void {
    const next = mode === 'wade' ? this.wade : mode === 'walk' ? this.walk : this.sit;
    if (!next) return;
    for (const action of [this.sit, this.wade, this.walk]) {
      if (action && action !== next) action.stop();
    }
    if (!next.isRunning()) next.reset().play();
  }

  private walkHome(dt: number): void {
    const spot = this.homed ? this.sitAt : this.hide;
    const dx = spot.x - this.group.position.x;
    const dz = spot.z - this.group.position.z;
    const distance = Math.hypot(dx, dz);
    const stride = WALK_SPEED * dt;
    if (distance <= stride) {
      this.settle();
      return;
    }
    const x = this.group.position.x + (dx / distance) * stride;
    const z = this.group.position.z + (dz / distance) * stride;
    this.group.position.set(x, groundY(x, z), z);
    const want = Math.atan2(dx, dz);
    const turn = Math.atan2(Math.sin(want - this.group.rotation.y), Math.cos(want - this.group.rotation.y));
    this.group.rotation.set(0, this.group.rotation.y + turn * Math.min(1, dt * 4), 0);
  }

  distanceTo(x: number, z: number): number {
    if (!this.shown) return Infinity;
    return Math.hypot(x - this.group.position.x, z - this.group.position.z);
  }

  update(time: number, dt: number): void {
    if (!this.shown) return;
    if (this.errand === 'resting') {
      this.restLeft -= dt;
      if (this.restLeft <= 0) {
        this.errand = 'walking';
        this.play('walk');
      }
    } else if (this.errand === 'walking') {
      this.walkHome(dt);
    }
    this.mixer.update(dt);
    if (!this.ripple?.visible) return;
    const pulse = 1 + Math.sin(time * 2.2) * 0.18;
    this.ripple.scale.setScalar(pulse);
    const material = this.ripple.material as THREE.MeshBasicMaterial;
    material.opacity = 0.35 + Math.sin(time * 2.2) * 0.2;
  }

  lineCount(): number {
    return this.lines.length;
  }

  line(index: number): string {
    return this.lines[index] ?? '';
  }
}

/** Walk on land; in deep water, float with the body on the waterline. */
function groundY(x: number, z: number): number {
  return Math.max(heightAt(x, z), WATER_Y - SWIM_SINK);
}

export function createFriends(parent: THREE.Object3D): Friend[] {
  return CAST.map((def) => new Friend(parent, def));
}
