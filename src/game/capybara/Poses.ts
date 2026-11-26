import * as THREE from 'three';
import { HIPS_REST, LEGS, type CapybaraParts, type LegId } from './Rig';

export interface LegPose {
  thighX: number;
  thighZ: number;
  shinX: number;
}

export interface Pose {
  hips: THREE.Vector3;
  hipsPitch: number;
  spinePitch: number;
  spineYaw: number;
  spineRoll: number;
  headPitch: number;
  headYaw: number;
  legs: Record<LegId, LegPose>;
}

const TAU = Math.PI * 2;

export function restPose(): Pose {
  const legs = {} as Record<LegId, LegPose>;
  for (const id of LEGS) legs[id] = standLeg(id);
  return {
    hips: HIPS_REST.clone(),
    hipsPitch: 0,
    spinePitch: 0,
    spineYaw: 0,
    spineRoll: 0,
    headPitch: 0,
    headYaw: 0,
    legs,
  };
}

export function applyPose(parts: CapybaraParts, pose: Pose): void {
  parts.hips.position.copy(pose.hips);
  setEuler(parts.hips, pose.hipsPitch, 0, 0);
  setEuler(parts.spine, pose.spinePitch, pose.spineYaw, pose.spineRoll);
  setEuler(parts.head, pose.headPitch, pose.headYaw, 0);
  for (const id of LEGS) {
    const leg = pose.legs[id];
    setEuler(parts.thighs[id], leg.thighX, 0, leg.thighZ);
    setEuler(parts.shins[id], leg.shinX, 0, 0);
  }
}

export function poseIdle(phase: number): Pose {
  const pose = restPose();
  const breathe = Math.sin(phase * TAU);
  pose.spinePitch = breathe * 0.04;
  pose.hips.y += breathe * 0.008;
  pose.headPitch = 0.02 + breathe * 0.02;
  return pose;
}

export function poseLoaf(phase: number): Pose {
  const pose = poseIdle(phase);
  pose.hips.y -= 0.07;
  pose.headPitch = 0.16;
  pose.spinePitch = 0.12;
  for (const id of LEGS) {
    const left = id.endsWith('L');
    const front = id.startsWith('F');
    pose.legs[id].thighX = front ? 0.12 : -0.12;
    pose.legs[id].thighZ = left ? -0.62 : 0.62;
    pose.legs[id].shinX = front ? 1.15 : -1.1;
  }
  return pose;
}

export function poseWalk(phase: number, lift: number): Pose {
  const pose = restPose();
  const bob = Math.sin(phase * TAU * 2);
  pose.hips.y += bob * 0.018;
  pose.hips.x += Math.sin(phase * TAU) * 0.02;
  pose.spineRoll = Math.sin(phase * TAU) * 0.06;
  pose.spinePitch = 0.05;
  pose.headPitch = -0.04;
  const offsets: Record<LegId, number> = { BL: 0, FL: 0.25, BR: 0.5, FR: 0.75 };
  for (const id of LEGS) pose.legs[id] = swingLeg((phase + offsets[id]) % 1, lift);
  return pose;
}

export function poseTrot(phase: number): Pose {
  const pose = restPose();
  const bob = Math.sin(phase * TAU * 2);
  pose.hips.y += 0.02 + bob * 0.03;
  pose.spinePitch = 0.08;
  pose.headPitch = -0.08;
  const pair: Record<LegId, number> = { FL: 0, BR: 0, FR: 0.5, BL: 0.5 };
  for (const id of LEGS) pose.legs[id] = swingLeg((phase + pair[id]) % 1, 1.15);
  return pose;
}

export function poseSwim(phase: number): Pose {
  const pose = restPose();
  pose.hips.y -= 0.02;
  pose.spinePitch = -0.06 + Math.sin(phase * TAU) * 0.04;
  pose.headPitch = -0.16;
  for (const id of LEGS) {
    const offset = id.startsWith('F') ? 0 : 0.5;
    const side = id.endsWith('L') ? 0 : 0.15;
    const wave = Math.sin((phase + offset + side) * TAU);
    pose.legs[id].thighX = 0.45 + wave * 0.35;
    pose.legs[id].shinX = 0.55 + wave * 0.25;
  }
  return pose;
}

export function hopHeight(phase: number, swimming: boolean): number {
  if (phase < 0 || phase > 1) return 0;
  if (swimming) return Math.sin(phase * Math.PI) * 0.07;
  if (phase < 0.18 || phase > 0.78) return 0;
  return Math.sin(((phase - 0.18) / 0.6) * Math.PI) * 0.28;
}

export function poseJump(phase: number): Pose {
  const pose = restPose();
  const squash = phase < 0.18 ? phase / 0.18 : phase > 0.78 ? (1 - phase) / 0.22 : 0;
  const air = phase > 0.18 && phase < 0.78 ? Math.sin(((phase - 0.18) / 0.6) * Math.PI) : 0;
  pose.hips.y -= squash * 0.09;
  pose.hipsPitch = squash * 0.4 - air * 0.22;
  pose.spinePitch = squash * 0.12 - air * 0.18;
  pose.headPitch = squash * 0.2 - air * 0.55;
  for (const id of LEGS) {
    const front = id.startsWith('F');
    pose.legs[id].thighX = front ? -0.15 - air * 1.25 : 0.2 + air * 1.05;
    pose.legs[id].shinX = 0.2 + squash * 1.05 + air * 1.2;
  }
  return pose;
}

export function swingLeg(phase: number, lift: number): LegPose {
  const stance = phase < 0.6;
  const u = stance ? phase / 0.6 : (phase - 0.6) / 0.4;
  const thighX = stance ? -0.12 + u * 0.24 : 0.12 - u * 0.24;
  const raised = stance ? 0 : Math.sin(u * Math.PI);
  return {
    thighX,
    thighZ: 0,
    shinX: 0.28 + raised * 0.22 * lift,
  };
}

function standLeg(id: LegId): LegPose {
  const left = id.endsWith('L');
  const front = id.startsWith('F');
  return {
    thighX: front ? 0.08 : -0.06,
    thighZ: left ? -0.1 : 0.1,
    shinX: front ? 0.22 : -0.16,
  };
}

function setEuler(bone: THREE.Bone, x: number, y: number, z: number): void {
  bone.quaternion.setFromEuler(new THREE.Euler(x, y, z));
}
