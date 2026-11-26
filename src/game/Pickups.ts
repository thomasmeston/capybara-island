import * as THREE from 'three';
import { heightAt } from '../island/shape';
import { ITEMS, type ItemDef } from './items';
import type { Pocket } from './Pocket';

const REACH = 1.7;

/** World pickups. A taken item leaves the island and stays in the pocket. */
export class Pickups {
  private readonly meshes = new Map<string, THREE.Object3D>();
  private carry: THREE.Object3D | null = null;
  private carryLeft = 0;

  constructor(
    parent: THREE.Object3D,
    private readonly pocket: Pocket,
    private readonly head: THREE.Object3D | null,
  ) {
    for (const item of ITEMS) {
      const mesh = prop(item.icon);
      const y = heightAt(item.x, item.z);
      mesh.position.set(item.x, Math.max(y, 0.02) + 0.12, item.z);
      mesh.userData.baseY = mesh.position.y;
      parent.add(mesh);
      this.meshes.set(item.id, mesh);
    }
    this.refresh();
  }

  /** Hide finds that are pocketed, already built, or still waiting on Nap. */
  refresh(): void {
    const napReady =
      this.pocket.isHoused('puddle') && this.pocket.isHoused('moss') && this.pocket.isHoused('bean');
    for (const item of ITEMS) {
      const mesh = this.meshes.get(item.id);
      if (!mesh) continue;
      const spent = item.wish !== null && this.pocket.isHoused(item.wish);
      const waiting = item.wish === 'nap' && !napReady;
      mesh.visible = !this.pocket.has(item.id) && !spent && !waiting;
    }
  }

  nearest(x: number, z: number): ItemDef | null {
    let found: ItemDef | null = null;
    let best = REACH;
    for (const item of ITEMS) {
      const mesh = this.meshes.get(item.id);
      if (!mesh?.visible) continue;
      const distance = Math.hypot(x - mesh.position.x, z - mesh.position.z);
      if (distance < best) {
        best = distance;
        found = item;
      }
    }
    return found;
  }

  take(item: ItemDef): void {
    const mesh = this.meshes.get(item.id);
    if (mesh) mesh.visible = false;
    this.pocket.add(item.id);
    this.hold(item.icon);
  }

  update(time: number, dt: number): void {
    for (const mesh of this.meshes.values()) {
      if (!mesh.visible) continue;
      const base = mesh.userData.baseY as number;
      mesh.position.y = base + Math.sin(time * 2 + mesh.position.x) * 0.06;
      mesh.rotation.y = time * 0.6;
    }
    if (!this.carry) return;
    this.carryLeft -= dt;
    if (this.carryLeft <= 0) {
      this.carry.removeFromParent();
      this.carry = null;
    }
  }

  private hold(kind: string): void {
    if (!this.head) return;
    this.carry?.removeFromParent();
    const mesh = prop(kind);
    mesh.scale.multiplyScalar(0.55);
    mesh.position.set(0, 0.02, 0.22);
    this.head.add(mesh);
    this.carry = mesh;
    this.carryLeft = 1.3;
  }
}

function prop(kind: string): THREE.Object3D {
  if (kind === 'door') {
    const door = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.34, 10),
      new THREE.MeshStandardMaterial({ color: 0x8d5a32, flatShading: true, roughness: 0.8 }),
    );
    door.castShadow = true;
    return door;
  }
  if (kind === 'lily') {
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 8),
      new THREE.MeshStandardMaterial({ color: 0x6e9a4e, flatShading: true, roughness: 0.7, side: THREE.DoubleSide }),
    );
    pad.geometry.rotateX(-Math.PI / 2);
    pad.castShadow = true;
    return pad;
  }
  if (kind === 'leaf') {
    const leaf = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.05, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x3f6b32, flatShading: true, roughness: 0.8 }),
    );
    leaf.castShadow = true;
    return leaf;
  }
  if (kind === 'stone') {
    const stone = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.08, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x9aa094, flatShading: true, roughness: 0.9 }),
    );
    stone.castShadow = true;
    return stone;
  }
  if (kind === 'hut') {
    const hut = new THREE.Group();
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.18, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xc4a06a, flatShading: true, roughness: 0.8 }),
    );
    wall.position.y = 0.09;
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.05, 0.26),
      new THREE.MeshStandardMaterial({ color: 0xc47a4a, flatShading: true, roughness: 0.8 }),
    );
    roof.position.y = 0.2;
    hut.add(wall, roof);
    return hut;
  }
  if (kind === 'table') {
    const table = new THREE.Group();
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.04, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x8d5a32, flatShading: true, roughness: 0.75 }),
    );
    top.position.y = 0.16;
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.16, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x6b4632, flatShading: true, roughness: 0.8 }),
    );
    leg.position.y = 0.08;
    table.add(top, leg);
    return table;
  }
  if (kind === 'hammock') {
    const cloth = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.04, 0.16),
      new THREE.MeshStandardMaterial({ color: 0xc4a06a, flatShading: true, roughness: 0.7 }),
    );
    cloth.rotation.z = -0.15;
    cloth.castShadow = true;
    return cloth;
  }
  if (kind === 'cloth') {
    const shade = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.03, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x2f4a38, flatShading: true, roughness: 0.9 }),
    );
    shade.castShadow = true;
    return shade;
  }
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0xf3e2c4, flatShading: true, roughness: 0.6 }),
  );
  shell.scale.set(1.2, 0.7, 0.9);
  shell.castShadow = true;
  return shell;
}
