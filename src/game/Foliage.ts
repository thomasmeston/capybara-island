import * as THREE from 'three';
import { heightAt } from '../island/shape';

const trunkMat = new THREE.MeshStandardMaterial({
  color: 0xc4a06a,
  flatShading: true,
  roughness: 0.86,
});
const barkMat = new THREE.MeshStandardMaterial({
  color: 0x8d6244,
  flatShading: true,
  roughness: 0.9,
});
const frondMat = new THREE.MeshStandardMaterial({
  color: 0x2f8a45,
  flatShading: true,
  roughness: 0.78,
  side: THREE.DoubleSide,
});
const leafMat = new THREE.MeshStandardMaterial({
  color: 0x3e9a52,
  flatShading: true,
  roughness: 0.8,
  side: THREE.DoubleSide,
});
const deepLeafMat = new THREE.MeshStandardMaterial({
  color: 0x246b3a,
  flatShading: true,
  roughness: 0.82,
  side: THREE.DoubleSide,
});
const shrubMat = new THREE.MeshStandardMaterial({
  color: 0x3f7d46,
  flatShading: true,
  roughness: 0.84,
});
const flowerMat = new THREE.MeshStandardMaterial({
  color: 0xe87898,
  flatShading: true,
  roughness: 0.6,
});
const coconutMat = new THREE.MeshStandardMaterial({
  color: 0x6b4a32,
  flatShading: true,
  roughness: 0.8,
});

const trunkGeo = new THREE.CylinderGeometry(0.13, 0.22, 1, 6);
const leafGeo = leafBlade(1.45, 0.28);
const broadGeo = leafBlade(1.2, 0.42);
const bananaGeo = leafBlade(1.65, 0.38);
const fernBlade = leafBlade(0.62, 0.12);
const shrubGeo = new THREE.IcosahedronGeometry(0.38, 0);
const tuftGeo = new THREE.ConeGeometry(0.035, 0.32, 3);
const nutGeo = new THREE.IcosahedronGeometry(0.125, 0);
const rockMat = new THREE.MeshStandardMaterial({
  color: 0x9a9388,
  flatShading: true,
  roughness: 0.92,
});
const woodMat = new THREE.MeshStandardMaterial({
  color: 0x7a5a3a,
  flatShading: true,
  roughness: 0.9,
});
const rockGeo = new THREE.DodecahedronGeometry(0.42, 0);
const logGeo = new THREE.CylinderGeometry(0.1, 0.12, 1.4, 5);
const dirtMat = new THREE.MeshStandardMaterial({
  color: 0x6b5340,
  flatShading: true,
  roughness: 1,
});
const tuftMat = new THREE.MeshStandardMaterial({
  color: 0x4e8a3e,
  flatShading: true,
  roughness: 0.86,
});
const tuftDeep = new THREE.MeshStandardMaterial({
  color: 0x2f6a34,
  flatShading: true,
  roughness: 0.88,
});
const beachMat = new THREE.MeshStandardMaterial({
  color: 0x8a9a58,
  flatShading: true,
  roughness: 0.86,
});

const SPAWN = new THREE.Vector2(0, -15);

export interface PalmTree {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly height: number;
  readonly count: number;
  readonly neededFriends: number;
  harvested: boolean;
  /** Hide coconuts immediately (e.g. restored from save). */
  setHarvested(): void;
  /** Detach coconuts and animate them falling toward the ground. */
  harvest(): void;
  update(dt: number): void;
}

export interface TropicalResult {
  sway: THREE.Object3D[];
  palms: PalmTree[];
}

/** Palms, shade trees, banana plants, ferns, and shrubs. Crowns sway; palms hold harvestable coconuts. */
export function plantTropical(parent: THREE.Group): TropicalResult {
  const sway: THREE.Object3D[] = [];
  const palmList: PalmTree[] = [];

  const palms: Array<[number, number, number, number]> = [
    [-9.2, -16.4, 3.6, 0.22],
    [-3.4, -18.2, 1.75, -0.12],
    [6.2, -16.8, 2.55, 0.16],
    [9.4, -13.6, 1.65, 0.08],
    [-13.5, -11.4, 4.6, -0.18],
    [12.6, -17.2, 1.85, 0.14],
    [-6.4, -10.6, 2.4, 0.18],
  ];
  for (const [x, z, height, lean] of palms) {
    if (!onDryGround(x, z, 0.72)) continue;
    const built = palm(x, z, height, lean, sway, parent);
    parent.add(built.group);
    palmList.push(built.tree);
  }

  parent.add(shadeTree(-11.2, -13.2, 1.15, sway));
  parent.add(shadeTree(10.4, -15.4, 0.92, sway));

  parent.add(banana(-7.4, -18.6, sway));
  parent.add(banana(4.8, -12.2, sway));
  parent.add(banana(-15.2, -15.5, sway));

  const shrubs: Array<[number, number, number]> = [
    [-5.5, -13.2, 0.7],
    [3.2, -16.4, 0.85],
    [8.6, -11.4, 0.65],
    [-12.4, -16.8, 0.9],
    [14.2, -14.2, 0.6],
    [-2.4, -11.2, 0.55],
    [6.8, -18.8, 0.75],
    [-16.2, -9.4, 0.7],
    [1.8, -19.4, 0.5],
    [15.5, -10.6, 0.62],
  ];
  for (const [x, z, scale] of shrubs) {
    if (!onDryGround(x, z, 0.4)) continue;
    parent.add(shrub(x, z, scale, sway));
  }

  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2 + 0.3;
    const radius = 12.4 + (i % 3) * 0.7;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = heightAt(x, z);
    if (y < 0.28 || y > 0.85) continue;
    if (tooCloseToSpawn(x, z)) continue;
    parent.add(fern(x, z, sway));
  }

  scatterFurther(parent, sway, palmList);
  scatterWild(parent, sway, palmList);
  return { sway, palms: palmList };
}

function scatterFurther(parent: THREE.Group, sway: THREE.Object3D[], palmList: PalmTree[]): void {
  const grove: Array<[number, number, number, number]> = [
    [-18.5, -4.2, 3.8, 0.1],
    [-14.2, -1.5, 1.8, -0.16],
    [-20.4, -8.6, 5.5, 0.08],
    [-12.6, 2.4, 2.6, 0.2],
    [22.4, -16.5, 4.7, -0.1],
    [26.2, -8.4, 1.7, 0.14],
  ];
  for (const [x, z, height, lean] of grove) {
    if (!onDryGround(x, z, 0.75)) continue;
    const built = palm(x, z, height, lean, sway, parent);
    parent.add(built.group);
    palmList.push(built.tree);
  }

  const shades: Array<[number, number, number]> = [
    [-18.2, 4.5, 1.05],
    [21.5, -18.2, 0.9],
    [-6.5, 12.4, 1.1],
  ];
  for (const [x, z, scale] of shades) {
    if (!onDryGround(x, z, 0.55)) continue;
    parent.add(shadeTree(x, z, scale, sway));
  }

  for (const [x, z] of [
    [16.5, -18.4],
    [18.2, -16.2],
    [-22.4, -12.6],
  ] as Array<[number, number]>) {
    if (!onDryGround(x, z, 0.6)) continue;
    parent.add(banana(x, z, sway));
  }

  for (let i = 0; i < 10; i++) {
    const x = -2 + (i % 5) * 1.8;
    const z = 13.5 + Math.floor(i / 5) * 1.6;
    const y = heightAt(x, z);
    if (y < 0.25 || y > 0.9 || tooCloseToSpawn(x, z)) continue;
    parent.add(fern(x, z, sway));
  }

  for (const [x, z, scale] of [
    [22.2, 0.4, 0.8],
    [24.5, 3.6, 0.7],
    [-21.4, 12.2, 0.75],
  ] as Array<[number, number, number]>) {
    if (!onDryGround(x, z, 0.25)) continue;
    parent.add(shrub(x, z, scale, sway));
  }

  for (const [x, z, scale] of [
    [-22.5, 11.4, 1.1],
    [25.4, -6.2, 0.85],
    [9.4, 14.8, 0.7],
    [18.6, -6.5, 0.6],
  ] as Array<[number, number, number]>) {
    if (heightAt(x, z) < 0.2 || tooCloseToSpawn(x, z)) continue;
    parent.add(rock(x, z, scale));
  }

  for (const [x, z, yaw] of [
    [18.2, -3.6, 0.4],
    [23.6, 2.2, 1.2],
  ] as Array<[number, number, number]>) {
    if (heightAt(x, z) < 0.2 || heightAt(x, z) > 0.85) continue;
    parent.add(driftwood(x, z, yaw));
  }

  const ridge: Array<[number, number, number, number]> = [
    [3.2, 26.4, 5.6, 0.1],
    [7.6, 23.2, 2.75, -0.14],
    [-24.6, 8.2, 4.5, 0.12],
    [-28.4, 2.4, 3.4, -0.08],
    [27.2, -17.4, 5.4, 0.14],
    [16.8, -28.6, 1.9, -0.1],
  ];
  for (const [x, z, height, lean] of ridge) {
    if (!onDryGround(x, z, 0.7)) continue;
    const built = palm(x, z, height, lean, sway, parent);
    parent.add(built.group);
    palmList.push(built.tree);
  }

  for (const [x, z, scale] of [
    [5.4, 28.6, 1.05],
    [-20.4, 14.8, 0.95],
    [30.2, -14.2, 0.85],
    [20.4, -26.8, 0.8],
  ] as Array<[number, number, number]>) {
    if (!onDryGround(x, z, 0.55)) continue;
    parent.add(shadeTree(x, z, scale, sway));
  }

  for (const [x, z] of [
    [1.4, 24.2],
    [9.2, 26.8],
    [-16.4, 18.2],
    [-22.8, 12.4],
    [24.6, -21.4],
    [18.4, -24.6],
    [31.2, -18.8],
    [-32.4, 6.2],
  ] as Array<[number, number]>) {
    if (heightAt(x, z) < 0.35 || blocked(x, z)) continue;
    parent.add(pebbleCluster(x, z, 0.9 + hash(x, z) * 0.4));
  }
}

const KEEP_CLEAR: Array<[number, number, number]> = [
  [0, -15, 3.2],
  [7.6, 7.8, 3],
  [9.4, 6.4, 3.2],
  [-17.2, 3.4, 2.6],
  [-15.4, 1.6, 3.2],
  [26.6, -7.2, 2.6],
  [24.4, -8.4, 3.2],
  [-21.2, 13.2, 3],
  [-19.2, 11.4, 3.4],
  [11.2, 1, 2.2],
  [-6, 12, 1.8],
  [18, 9, 1.8],
  [22, 1, 1.8],
  [-14, -8, 1.8],
  [-8, -10, 1.8],
  [22, -12, 1.8],
  [18, -16, 1.8],
  [6, 16, 1.8],
  [-16, 14, 1.8],
];

function scatterWild(parent: THREE.Group, sway: THREE.Object3D[], palmList: PalmTree[]): void {
  for (let gx = -36; gx <= 36; gx += 2.6) {
    for (let gz = -36; gz <= 36; gz += 2.6) {
      const jx = gx + (hash(gx, gz) - 0.5) * 1.8;
      const jz = gz + (hash(gz, gx) - 0.5) * 1.8;
      if (Math.hypot(jx, jz) > 37) continue;
      const y = heightAt(jx, jz);
      if (y < 0.2 || blocked(jx, jz)) continue;
      const roll = hash(jx + 3.1, jz - 1.7);
      if (roll < 0.34 && y > 0.28) parent.add(grassTuft(jx, jz, y < 0.72));
      else if (roll < 0.44 && y > 0.3) parent.add(pebbleCluster(jx, jz, 0.7 + roll));
      else if (roll < 0.52 && y > 0.32) parent.add(rock(jx, jz, 0.5 + roll));
      else if (roll < 0.58 && y > 0.28) parent.add(dirtMound(jx, jz, 0.65 + roll));
      else if (roll < 0.66 && y > 0.4) parent.add(fern(jx, jz, sway));
      else if (roll < 0.72 && y > 0.48) parent.add(shrub(jx, jz, 0.42 + roll * 0.35, sway));
      else if (roll > 0.96 && y > 0.8) {
        const tier = hash(jx - 5.2, jz + 2.9);
        const h = 1.65 + tier * 3.85;
        const built = palm(jx, jz, h, (roll - 0.5) * 0.24, sway, parent);
        parent.add(built.group);
        palmList.push(built.tree);
      } else if (roll > 0.92 && y > 0.85) parent.add(shadeTree(jx, jz, 0.72, sway));
    }
  }
}

function blocked(x: number, z: number): boolean {
  if (tooCloseToSpawn(x, z)) return true;
  for (const [px, pz, radius] of KEEP_CLEAR) {
    if (Math.hypot(x - px, z - pz) < radius) return true;
  }
  return false;
}

function hash(x: number, z: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function grassTuft(x: number, z: number, beach = false): THREE.Group {
  const tuft = new THREE.Group();
  tuft.position.set(x, heightAt(x, z), z);
  if (beach) tuft.scale.setScalar(0.72);
  for (let i = 0; i < 5; i++) {
    const blade = new THREE.Mesh(tuftGeo, beach ? beachMat : i % 2 === 0 ? tuftMat : tuftDeep);
    blade.position.set((i - 2) * 0.05, 0.14, (i % 2) * 0.04);
    blade.rotation.z = (i - 2) * 0.18;
    blade.rotation.y = i;
    tuft.add(blade);
  }
  return tuft;
}

function pebbleCluster(x: number, z: number, scale: number): THREE.Group {
  const cluster = new THREE.Group();
  cluster.position.set(x, heightAt(x, z), z);
  for (let i = 0; i < 3; i++) {
    const stone = new THREE.Mesh(rockGeo, rockMat);
    const size = scale * (0.28 + i * 0.1);
    stone.scale.set(size, size * 0.42, size * 0.75);
    stone.position.set((i - 1) * 0.32, 0.03, (i % 2) * 0.18);
    stone.rotation.y = i * 1.4;
    stone.castShadow = true;
    cluster.add(stone);
  }
  return cluster;
}

function dirtMound(x: number, z: number, scale: number): THREE.Mesh {
  const mound = new THREE.Mesh(shrubGeo, dirtMat);
  mound.scale.set(scale * 1.3, scale * 0.32, scale);
  mound.position.set(x, heightAt(x, z) + 0.04, z);
  mound.castShadow = true;
  mound.receiveShadow = true;
  return mound;
}

function leafBlade(length: number, width: number): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(width, length * 0.2, width * 0.55, length * 0.72, 0, length);
  shape.bezierCurveTo(-width * 0.55, length * 0.72, -width, length * 0.2, 0, 0);
  const geometry = new THREE.ShapeGeometry(shape, 4);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

function rock(x: number, z: number, scale: number): THREE.Mesh {
  const mesh = new THREE.Mesh(rockGeo, rockMat);
  mesh.scale.set(scale, scale * 0.55, scale * 0.85);
  mesh.position.set(x, heightAt(x, z) + 0.06 * scale, z);
  mesh.rotation.y = x * 0.3;
  mesh.castShadow = true;
  return mesh;
}

function driftwood(x: number, z: number, yaw: number): THREE.Mesh {
  const log = new THREE.Mesh(logGeo, woodMat);
  log.position.set(x, heightAt(x, z) + 0.1, z);
  log.rotation.z = Math.PI / 2;
  log.rotation.y = yaw;
  log.castShadow = true;
  return log;
}

function onDryGround(x: number, z: number, minY: number): boolean {
  if (tooCloseToSpawn(x, z)) return false;
  return heightAt(x, z) >= minY;
}

function tooCloseToSpawn(x: number, z: number): boolean {
  return Math.hypot(x - SPAWN.x, z - SPAWN.y) < 2.4;
}

function friendsNeededFor(height: number): number {
  if (height < 2.1) return 0;
  if (height < 3.1) return 1;
  if (height < 4.2) return 2;
  if (height < 5.15) return 3;
  return 4;
}

function bunchSizeFor(height: number, x: number, z: number): number {
  const tier = friendsNeededFor(height);
  const extra = hash(x * 1.7, z * 2.3) > 0.5 ? 1 : 0;
  return Math.min(6, Math.max(2, 2 + tier + extra));
}

interface FallingNut {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

function palm(
  x: number,
  z: number,
  height: number,
  lean: number,
  sway: THREE.Object3D[],
  worldParent: THREE.Group,
): { group: THREE.Group; tree: PalmTree } {
  const palmGroup = new THREE.Group();
  const baseY = heightAt(x, z);
  palmGroup.position.set(x, baseY, z);
  palmGroup.rotation.y = x * 0.4 + z;

  const parts = height > 4.2 ? 6 : height > 2.8 ? 5 : 4;
  const segH = height / parts;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < parts; i++) {
    const seg = new THREE.Mesh(trunkGeo, trunkMat);
    const t = i / (parts - 1);
    const girth = (1.15 + Math.min(0.35, (height - 2) * 0.08)) * (1 - t * 0.45);
    seg.scale.set(girth, segH, girth);
    seg.position.set(cx, cy + segH * 0.5, 0);
    seg.rotation.z = lean * (0.22 + t * 0.3);
    seg.castShadow = true;
    palmGroup.add(seg);
    cx += Math.sin(lean) * segH * 0.24;
    cy += segH * 0.94;
  }

  const crown = new THREE.Group();
  crown.position.set(cx, cy, 0);
  crown.userData.sway = lean + x;
  const frondScale = 0.88 + Math.min(0.35, (height - 1.6) * 0.08);
  for (let i = 0; i < 8; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / 8) * Math.PI * 2;
    const frond = new THREE.Mesh(leafGeo, i % 2 === 0 ? frondMat : deepLeafMat);
    frond.rotation.x = 0.7 + (i % 3) * 0.12;
    frond.scale.setScalar(frondScale);
    frond.castShadow = true;
    pivot.add(frond);
    crown.add(pivot);
  }

  const count = bunchSizeFor(height, x, z);
  const neededFriends = friendsNeededFor(height);
  const nuts: THREE.Mesh[] = [];
  for (let i = 0; i < count; i++) {
    const nut = new THREE.Mesh(nutGeo, coconutMat);
    const angle = (i / count) * Math.PI * 2;
    const ring = i % 2 === 0 ? 0.16 : 0.22;
    const drop = i % 2 === 0 ? -0.1 : -0.22;
    nut.position.set(Math.cos(angle) * ring, drop, Math.sin(angle) * ring);
    nut.castShadow = true;
    crown.add(nut);
    nuts.push(nut);
  }
  palmGroup.add(crown);
  sway.push(crown);

  const falling: FallingNut[] = [];
  const tree: PalmTree = {
    id: `palm_${Math.round(x * 10)}_${Math.round(z * 10)}`,
    x,
    z,
    height,
    count,
    neededFriends,
    harvested: false,
    setHarvested() {
      this.harvested = true;
      for (const nut of nuts) nut.visible = false;
    },
    harvest() {
      if (this.harvested) return;
      this.harvested = true;
      crown.updateWorldMatrix(true, false);
      nuts.forEach((nut, idx) => {
        const pos = new THREE.Vector3();
        nut.getWorldPosition(pos);
        worldParent.worldToLocal(pos);
        nut.removeFromParent();
        nut.position.copy(pos);
        worldParent.add(nut);
        const a = (idx / Math.max(1, nuts.length)) * Math.PI * 2;
        falling.push({
          mesh: nut,
          vel: new THREE.Vector3(Math.cos(a) * 1.1, 1.6 + (idx % 2) * 0.4, Math.sin(a) * 1.1),
          life: 0.75,
        });
      });
    },
    update(dt: number) {
      if (falling.length === 0) return;
      for (let i = falling.length - 1; i >= 0; i--) {
        const item = falling[i];
        if (!item) continue;
        item.life -= dt;
        item.vel.y -= 9.5 * dt;
        item.mesh.position.addScaledVector(item.vel, dt);
        item.mesh.rotation.x += dt * 5;
        item.mesh.rotation.z += dt * 4;
        if (item.life < 0.22) {
          item.mesh.scale.setScalar(Math.max(0.01, item.life / 0.22));
        }
        if (item.life <= 0) {
          item.mesh.visible = false;
          item.mesh.removeFromParent();
          falling.splice(i, 1);
        }
      }
    },
  };

  return { group: palmGroup, tree };
}

function shadeTree(x: number, z: number, scale: number, sway: THREE.Object3D[]): THREE.Group {
  const tree = new THREE.Group();
  tree.position.set(x, heightAt(x, z), z);
  const trunk = new THREE.Mesh(trunkGeo, barkMat);
  trunk.scale.set(1.8 * scale, 1.55 * scale, 1.8 * scale);
  trunk.position.y = 0.75 * scale;
  trunk.castShadow = true;
  const flare = new THREE.Mesh(trunkGeo, barkMat);
  flare.scale.set(2.4 * scale, 0.35 * scale, 2.4 * scale);
  flare.position.y = 0.16 * scale;
  tree.add(trunk, flare);

  const crown = new THREE.Group();
  crown.position.y = 1.7 * scale;
  crown.userData.sway = x;
  for (let i = 0; i < 8; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / 8) * Math.PI * 2;
    const leaf = new THREE.Mesh(broadGeo, i % 2 === 0 ? leafMat : deepLeafMat);
    leaf.rotation.x = 0.35 + (i % 3) * 0.18;
    leaf.scale.setScalar(scale);
    leaf.castShadow = true;
    pivot.add(leaf);
    crown.add(pivot);
  }
  const under = new THREE.Group();
  under.position.y = 1.35 * scale;
  for (let i = 0; i < 5; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / 5) * Math.PI * 2 + 0.4;
    const leaf = new THREE.Mesh(broadGeo, deepLeafMat);
    leaf.rotation.x = 0.9;
    leaf.scale.setScalar(scale * 0.75);
    pivot.add(leaf);
    under.add(pivot);
  }
  tree.add(crown, under);
  sway.push(crown);
  return tree;
}

function banana(x: number, z: number, sway: THREE.Object3D[]): THREE.Group {
  const plant = new THREE.Group();
  plant.position.set(x, heightAt(x, z), z);
  const stem = new THREE.Mesh(trunkGeo, leafMat);
  stem.scale.set(1.35, 0.95, 1.35);
  stem.position.y = 0.48;
  stem.castShadow = true;
  plant.add(stem);

  const crown = new THREE.Group();
  crown.position.y = 0.95;
  crown.userData.sway = z;
  for (let i = 0; i < 5; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / 5) * Math.PI * 2 + 0.2;
    const leaf = new THREE.Mesh(bananaGeo, i % 2 === 0 ? leafMat : frondMat);
    leaf.rotation.x = 0.95;
    leaf.castShadow = true;
    pivot.add(leaf);
    crown.add(pivot);
  }
  plant.add(crown);
  sway.push(crown);
  return plant;
}

function shrub(x: number, z: number, scale: number, sway: THREE.Object3D[]): THREE.Group {
  const bush = new THREE.Group();
  bush.position.set(x, heightAt(x, z), z);
  bush.userData.sway = x + z;
  const spots = [
    [0, 0.28, 0],
    [0.28, 0.2, 0.12],
    [-0.22, 0.18, -0.16],
  ];
  for (const [sx, sy, sz] of spots) {
    const puff = new THREE.Mesh(shrubGeo, shrubMat);
    puff.position.set(sx * scale, sy * scale, sz * scale);
    puff.scale.setScalar(scale);
    puff.castShadow = true;
    bush.add(puff);
  }
  if (scale > 0.65) {
    const flower = new THREE.Mesh(nutGeo, flowerMat);
    flower.scale.setScalar(1.3);
    flower.position.set(0.1 * scale, 0.55 * scale, 0.15 * scale);
    bush.add(flower);
  }
  sway.push(bush);
  return bush;
}

function fern(x: number, z: number, sway: THREE.Object3D[]): THREE.Group {
  const plant = new THREE.Group();
  plant.position.set(x, heightAt(x, z), z);
  plant.userData.sway = x * 0.5;
  for (let i = 0; i < 5; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / 5) * Math.PI * 2;
    const blade = new THREE.Mesh(fernBlade, deepLeafMat);
    blade.rotation.x = 1.05;
    blade.castShadow = true;
    pivot.add(blade);
    plant.add(pivot);
  }
  sway.push(plant);
  return plant;
}
