import * as THREE from 'three';
import type { Friend } from './Friend';

/** Rider origin above the carrier's feet, so a loafed belly rests on the back. */
const BASE = 0.5;
/** Each rider up the tower sits on the one below. */
const STEP = 0.4;
/** Where a dropped friend lands, behind the carrier. */
const DROP_BACK = 0.95;
const MAX_LEAN = 0.5;

interface Rider {
  friend: Friend;
  pitch: number;
  pitchVel: number;
  roll: number;
  rollVel: number;
}

const _m = new THREE.Matrix4();
const _step = new THREE.Matrix4();
const _rot = new THREE.Matrix4();
const _euler = new THREE.Euler();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _accel = new THREE.Vector3();
const _inv = new THREE.Quaternion();

/**
 * Friends stacked on the player's back. The tower leans against your
 * acceleration on a soft spring, and each rider sways a bit more than the one below.
 */
export class Stack {
  private readonly riders: Rider[] = [];
  private readonly last = new THREE.Vector3();
  private readonly lastVel = new THREE.Vector3();
  private primed = false;

  get count(): number {
    return this.riders.length;
  }

  has(friend: Friend): boolean {
    return this.riders.some((rider) => rider.friend === friend);
  }

  add(friend: Friend): void {
    if (this.has(friend)) return;
    friend.startRide();
    this.riders.push({ friend, pitch: 0.25, pitchVel: 0, roll: 0, rollVel: 0 });
  }

  /** Take a friend off without placing them, for example when their house goes up. */
  remove(friend: Friend): void {
    const index = this.riders.findIndex((rider) => rider.friend === friend);
    if (index >= 0) this.riders.splice(index, 1);
  }

  /** Drop the top friend behind the carrier. */
  dropTop(carrier: THREE.Object3D): Friend | null {
    const rider = this.riders.pop();
    if (!rider) return null;
    const yaw = Math.atan2(
      2 * (carrier.quaternion.w * carrier.quaternion.y + carrier.quaternion.x * carrier.quaternion.z),
      1 - 2 * (carrier.quaternion.y ** 2 + carrier.quaternion.x ** 2),
    );
    const x = carrier.position.x - Math.sin(yaw) * DROP_BACK;
    const z = carrier.position.z - Math.cos(yaw) * DROP_BACK;
    rider.friend.drop(x, z, yaw);
    return rider.friend;
  }

  update(dt: number, time: number, carrier: THREE.Object3D): void {
    if (dt <= 0) return;
    if (!this.primed) {
      this.last.copy(carrier.position);
      this.primed = true;
    }
    _vel.subVectors(carrier.position, this.last).divideScalar(dt);
    _vel.y = 0;
    _accel.subVectors(_vel, this.lastVel).divideScalar(dt);
    this.last.copy(carrier.position);
    this.lastVel.copy(_vel);
    if (this.riders.length === 0) return;

    // Acceleration in the carrier's frame: +z forward, +x to its left.
    _inv.copy(carrier.quaternion).invert();
    _accel.applyQuaternion(_inv);
    const speed = _vel.length();

    carrier.updateMatrixWorld();
    _m.copy(carrier.matrixWorld);
    this.riders.forEach((rider, index) => {
      const give = 1 + index * 0.45;
      const bob = Math.sin(time * 2.4 + index * 0.9) * 0.025 * (1 + speed * 0.6);
      const targetPitch = THREE.MathUtils.clamp(-_accel.z * 0.012 * give, -MAX_LEAN, MAX_LEAN) + bob;
      const targetRoll = THREE.MathUtils.clamp(_accel.x * 0.012 * give, -MAX_LEAN, MAX_LEAN);
      rider.pitchVel += ((targetPitch - rider.pitch) * 60 - rider.pitchVel * 7) * dt;
      rider.rollVel += ((targetRoll - rider.roll) * 60 - rider.rollVel * 7) * dt;
      rider.pitch = THREE.MathUtils.clamp(rider.pitch + rider.pitchVel * dt, -MAX_LEAN, MAX_LEAN);
      rider.roll = THREE.MathUtils.clamp(rider.roll + rider.rollVel * dt, -MAX_LEAN, MAX_LEAN);

      _step.makeTranslation(0, index === 0 ? BASE : STEP, index === 0 ? -0.04 : 0);
      _rot.makeRotationFromEuler(_euler.set(rider.pitch, 0, rider.roll));
      _m.multiply(_step).multiply(_rot);
      _m.decompose(_pos, _quat, _scale);
      rider.friend.place(_pos, _quat);
    });
  }
}
