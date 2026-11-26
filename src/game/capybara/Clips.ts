import * as THREE from 'three';
import { applyPose, poseIdle, poseJump, poseLoaf, poseSwim, poseTrot, poseWalk, restPose } from './Poses';
import { HIPS_REST, type CapybaraParts } from './Rig';

export interface GaitClips {
  idle: THREE.AnimationClip;
  loaf: THREE.AnimationClip;
  walk: THREE.AnimationClip;
  trot: THREE.AnimationClip;
  wade: THREE.AnimationClip;
  swim: THREE.AnimationClip;
  jump: THREE.AnimationClip;
}

export function buildClips(parts: CapybaraParts): GaitClips {
  return {
    idle: cycle('idle', parts, 2.4, 12, poseIdle),
    loaf: cycle('loaf', parts, 2.4, 12, poseLoaf),
    walk: cycle('walk', parts, 0.84, 16, (phase) => poseWalk(phase, 1)),
    trot: cycle('trot', parts, 0.48, 12, poseTrot),
    wade: cycle('wade', parts, 0.96, 16, (phase) => poseWalk(phase, 1.45)),
    swim: cycle('swim', parts, 1.15, 14, poseSwim),
    jump: once('jump', parts, 0.5, 10, poseJump),
  };
}

function cycle(
  name: string,
  parts: CapybaraParts,
  duration: number,
  frames: number,
  poseAt: (phase: number) => ReturnType<typeof poseIdle>,
): THREE.AnimationClip {
  return capture(name, parts, duration, frames, true, poseAt);
}

function once(
  name: string,
  parts: CapybaraParts,
  duration: number,
  frames: number,
  poseAt: (phase: number) => ReturnType<typeof poseIdle>,
): THREE.AnimationClip {
  return capture(name, parts, duration, frames, false, poseAt);
}

function capture(
  name: string,
  parts: CapybaraParts,
  duration: number,
  frames: number,
  loop: boolean,
  poseAt: (phase: number) => ReturnType<typeof poseIdle>,
): THREE.AnimationClip {
  const last = loop ? frames : frames - 1;
  const times: number[] = [];
  const quats = new Map<string, number[]>();
  for (const bone of parts.animated) quats.set(bone.name, []);
  const hipPos: number[] = [];

  for (let i = 0; i <= last; i++) {
    const phase = loop ? (i === frames ? 0 : i / frames) : i / Math.max(last, 1);
    times.push((i / Math.max(loop ? frames : last, 1)) * duration);
    applyPose(parts, poseAt(phase));
    for (const bone of parts.animated) {
      const track = quats.get(bone.name);
      track?.push(bone.quaternion.x, bone.quaternion.y, bone.quaternion.z, bone.quaternion.w);
    }
    hipPos.push(parts.hips.position.x, parts.hips.position.y, parts.hips.position.z);
  }

  applyPose(parts, restPose());
  parts.hips.position.copy(HIPS_REST);

  const tracks: THREE.KeyframeTrack[] = [];
  for (const bone of parts.animated) {
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, quats.get(bone.name) ?? []));
  }
  tracks.push(new THREE.VectorKeyframeTrack('hips.position', times, hipPos));
  return new THREE.AnimationClip(name, duration, tracks);
}
