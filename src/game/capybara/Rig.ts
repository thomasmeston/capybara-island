import * as THREE from 'three';
import meshData from '../../data/capybara-mesh.json';

export const THIGH_LEN = 0.16;
export const SHIN_LEN = 0.13;
export const HIPS_REST = new THREE.Vector3(0, 0.4, 0);
/** How far the root sinks so the back sits on the waterline while swimming. */
export const SWIM_SINK = 0.58;

export type LegId = 'FL' | 'FR' | 'BL' | 'BR';
export const LEGS: LegId[] = ['FL', 'FR', 'BL', 'BR'];

const BASE_FUR = new THREE.MeshStandardMaterial({
  color: 0xc6864a,
  flatShading: true,
  roughness: 0.84,
});
const BASE_DARK = new THREE.MeshStandardMaterial({
  color: 0x6b4632,
  flatShading: true,
  roughness: 0.86,
});
const BOOT = new THREE.MeshStandardMaterial({
  color: 0x4e3428,
  flatShading: true,
  roughness: 0.9,
});
const NOSE = new THREE.MeshStandardMaterial({
  color: 0x1a120e,
  flatShading: true,
  roughness: 0.55,
});
const EYE = new THREE.MeshStandardMaterial({
  color: 0x2a2824,
  flatShading: true,
  roughness: 0.4,
});

export interface CapybaraParts {
  hips: THREE.Bone;
  spineYaw: THREE.Bone;
  spine: THREE.Bone;
  headYaw: THREE.Bone;
  head: THREE.Bone;
  ears: THREE.Object3D[];
  eyes: THREE.Object3D[];
  body: THREE.Object3D;
  thighs: Record<LegId, THREE.Bone>;
  shins: Record<LegId, THREE.Bone>;
  feet: Record<LegId, THREE.Bone>;
  animated: THREE.Bone[];
}

/** Fur and darker trim (snout, ears). Leave out to get the player's caramel coat. */
export interface Coat {
  fur: string;
  dark: string;
}

export function buildCapybara(parent: THREE.Group, coat?: Coat): CapybaraParts {
  const FUR = coat ? tinted(BASE_FUR, coat.fur) : BASE_FUR;
  const DARK = coat ? tinted(BASE_DARK, coat.dark) : BASE_DARK;
  const hips = bone('hips', parent, HIPS_REST.x, HIPS_REST.y, HIPS_REST.z);
  const body = new THREE.Group();
  hips.add(body);
  body.add(solid('body', FUR));

  const spineYaw = bone('spineYaw', hips, 0, 0.12, 0.22);
  const spine = bone('spine', spineYaw, 0, 0, 0);
  const headYaw = bone('headYaw', spine, 0, 0.04, 0.1);
  const head = bone('head', headYaw, 0, 0, 0);
  head.add(solid('head', FUR), solid('snout', DARK), solid('nose', NOSE));

  const eyeL = centered('eyeL', EYE);
  const eyeR = centered('eyeR', EYE);
  head.add(eyeL, eyeR);

  const earL = centered('earL', DARK);
  const earR = centered('earR', DARK);
  head.add(earL, earR);

  const thighs = {} as Record<LegId, THREE.Bone>;
  const shins = {} as Record<LegId, THREE.Bone>;
  const feet = {} as Record<LegId, THREE.Bone>;
  const sockets: Record<LegId, [number, number]> = {
    FL: [-0.16, 0.16],
    FR: [0.16, 0.16],
    BL: [-0.17, -0.26],
    BR: [0.17, -0.26],
  };
  for (const id of LEGS) {
    const [x, z] = sockets[id];
    const thigh = bone(`thigh${id}`, hips, x, -0.06, z);
    const shin = bone(`shin${id}`, thigh, 0, -THIGH_LEN, 0);
    const foot = bone(`foot${id}`, shin, 0, -SHIN_LEN, 0);
    thigh.add(solid('thigh', FUR));
    shin.add(solid('shin', BOOT));
    foot.add(solid('hoof', BOOT));
    thighs[id] = thigh;
    shins[id] = shin;
    feet[id] = foot;
  }

  const animated = [
    hips,
    spine,
    head,
    ...LEGS.flatMap((id) => [thighs[id], shins[id]]),
  ];
  return {
    hips,
    spineYaw,
    spine,
    headYaw,
    head,
    ears: [earL, earR],
    eyes: [eyeL, eyeR],
    body,
    thighs,
    shins,
    feet,
    animated,
  };
}

function tinted(base: THREE.MeshStandardMaterial, color: string): THREE.MeshStandardMaterial {
  const material = base.clone();
  material.color.set(color);
  return material;
}

function bone(name: string, parent: THREE.Object3D, x: number, y: number, z: number): THREE.Bone {
  const next = new THREE.Bone();
  next.name = name;
  next.position.set(x, y, z);
  parent.add(next);
  return next;
}

type MeshPart = { positions: number[]; indices: number[] };

const PARTS = meshData as Record<string, MeshPart>;

/** Bone-local mesh exported from Blender. Vertices stay in the bone's rest space. */
function solid(name: string, material: THREE.Material): THREE.Mesh {
  const part = PARTS[name];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
  geometry.setIndex(part.indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  return mesh;
}

/** Same mesh, but spun around its own middle so a blink or ear flop stays put. */
function centered(name: string, material: THREE.Material): THREE.Mesh {
  const mesh = solid(name, material);
  mesh.geometry.computeBoundingBox();
  const center = new THREE.Vector3();
  mesh.geometry.boundingBox?.getCenter(center);
  mesh.geometry.translate(-center.x, -center.y, -center.z);
  mesh.position.copy(center);
  return mesh;
}
