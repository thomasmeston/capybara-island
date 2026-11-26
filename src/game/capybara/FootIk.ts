import * as THREE from 'three';
import type { Island } from '../Island';
import { SHIN_LEN, THIGH_LEN, type CapybaraParts, type LegId } from './Rig';

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);
const REST_AXIS = new THREE.Vector3(0, -1, 0);

const _root = new THREE.Vector3();
const _foot = new THREE.Vector3();
const _target = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _parentQ = new THREE.Quaternion();
const _invParent = new THREE.Quaternion();
const _local = new THREE.Vector3();

/**
 * Soft two-bone plant. The foot keeps the clip's horizontal step and drops
 * onto the raycasted ground. Weight is 0 in the air and while swimming.
 */
export function plantFeet(
  parts: CapybaraParts,
  island: Island,
  root: THREE.Object3D,
  stance: Record<LegId, number>,
  weight: number,
): void {
  if (weight < 0.02) return;
  root.updateMatrixWorld(true);
  const forward = FORWARD.clone().applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));

  (Object.keys(parts.feet) as LegId[]).forEach((id) => {
    const legWeight = stance[id] * weight;
    if (legWeight < 0.04) return;
    const thigh = parts.thighs[id];
    const shin = parts.shins[id];
    const foot = parts.feet[id];
    foot.getWorldPosition(_foot);
    const ground = island.sample(_foot.x, _foot.z);
    if (!ground) return;

    const clipThigh = thigh.quaternion.clone();
    const clipShin = shin.quaternion.clone();
    thigh.getWorldPosition(_root);
    _target.set(_foot.x, ground.point.y + 0.02, _foot.z);

    const front = id.startsWith('F');
    const outward = id.endsWith('L') ? -0.25 : 0.25;
    _pole.copy(_root);
    _pole.addScaledVector(forward, front ? -0.55 : 0.5);
    _pole.addScaledVector(UP, -0.2);
    _pole.x += outward;

    solveKnee(_root, _target, _pole, THIGH_LEN, SHIN_LEN, _mid);
    aim(thigh, _mid);
    thigh.updateMatrixWorld(true);
    aim(shin, _target);

    if (legWeight < 0.999) {
      const ikThigh = thigh.quaternion.clone();
      const ikShin = shin.quaternion.clone();
      thigh.quaternion.copy(clipThigh).slerp(ikThigh, legWeight);
      shin.quaternion.copy(clipShin).slerp(ikShin, legWeight);
    }
  });
}

function solveKnee(
  root: THREE.Vector3,
  target: THREE.Vector3,
  pole: THREE.Vector3,
  lenA: number,
  lenB: number,
  out: THREE.Vector3,
): void {
  _dir.subVectors(target, root);
  if (_dir.lengthSq() < 1e-8) _dir.set(0, -1, 0);
  const max = lenA + lenB - 1e-4;
  const min = Math.abs(lenA - lenB) + 1e-4;
  const dist = THREE.MathUtils.clamp(_dir.length(), min, max);
  _dir.normalize();
  const along = (dist * dist + lenA * lenA - lenB * lenB) / (2 * dist);
  const height = Math.sqrt(Math.max(0, lenA * lenA - along * along));
  const poleDir = pole.clone().sub(root);
  const alongPole = _dir.clone().multiplyScalar(poleDir.dot(_dir));
  const sideways = poleDir.sub(alongPole);
  if (sideways.lengthSq() < 1e-8) sideways.set(1, 0, 0);
  sideways.normalize();
  out.copy(root).addScaledVector(_dir, along).addScaledVector(sideways, height);
}

function aim(bone: THREE.Bone, worldPoint: THREE.Vector3): void {
  const parent = bone.parent;
  if (!parent) return;
  parent.updateWorldMatrix(true, false);
  parent.getWorldQuaternion(_parentQ);
  bone.getWorldPosition(_root);
  _local.subVectors(worldPoint, _root);
  if (_local.lengthSq() < 1e-8) return;
  _local.normalize();
  _invParent.copy(_parentQ).invert();
  _local.applyQuaternion(_invParent);
  bone.quaternion.setFromUnitVectors(REST_AXIS, _local);
}
