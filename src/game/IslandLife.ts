import * as THREE from 'three';
import { heightAt } from '../island/shape';
import type { Pocket } from './Pocket';

const PATH: Array<[number, number]> = [
  [-2, -13],
  [-5, -11],
  [-8, -9],
  [-11, -7],
  [-14, -5],
];

const FLOWERS: Array<[number, number]> = [
  [19, -10],
  [20, -12],
  [21, -14],
  [23, -15],
  [25, -13],
];

const NAP_SHADE = { x: -21.2, z: 13.2 };

/** The island answers each move-in: a worn path, a flower line, then a deeper shade. */
export class IslandLife {
  private readonly path: THREE.Group;
  private readonly flowers: THREE.Group;
  private readonly shade: THREE.Group;
  private readonly shadeDisc: THREE.Mesh;

  constructor(parent: THREE.Object3D) {
    this.path = new THREE.Group();
    this.path.visible = false;
    const worn = new THREE.MeshStandardMaterial({ color: 0x6d7a45, flatShading: true, roughness: 1 });
    for (const [x, z] of PATH) {
      const y = heightAt(x, z);
      if (y < 0.45) continue;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.55, 7), worn);
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(x, y + 0.04, z);
      disc.rotation.z = x * 0.4;
      this.path.add(disc);
    }

    this.flowers = new THREE.Group();
    this.flowers.visible = false;
    const colors = [0xe07a9a, 0xf2d36b, 0xf0a36a, 0xd8e7f2, 0xc4e07a];
    FLOWERS.forEach(([x, z], index) => {
      const y = heightAt(x, z);
      if (y < 0.2) return;
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.025, 0.28, 4),
        new THREE.MeshStandardMaterial({ color: 0x3f6b32, flatShading: true, roughness: 0.8 }),
      );
      stem.position.set(x, y + 0.16, z);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 5, 4),
        new THREE.MeshStandardMaterial({ color: colors[index % colors.length], flatShading: true, roughness: 0.6 }),
      );
      head.position.set(x, y + 0.34, z);
      this.flowers.add(stem, head);
    });

    this.shade = new THREE.Group();
    this.shade.visible = false;
    const shadeY = Math.max(heightAt(NAP_SHADE.x, NAP_SHADE.z), 0.05);
    this.shade.position.set(NAP_SHADE.x, shadeY, NAP_SHADE.z);
    this.shadeDisc = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 8),
      new THREE.MeshStandardMaterial({
        color: 0x1e3324,
        transparent: true,
        opacity: 0.28,
        roughness: 1,
        side: THREE.DoubleSide,
      }),
    );
    this.shadeDisc.rotation.x = -Math.PI / 2;
    this.shadeDisc.position.y = 0.03;
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 6, 4),
      new THREE.MeshStandardMaterial({ color: 0x2a4634, flatShading: true, roughness: 0.9 }),
    );
    canopy.scale.set(1.6, 0.45, 1.4);
    canopy.position.y = 2.1;
    canopy.castShadow = true;
    this.shade.add(this.shadeDisc, canopy);

    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.4, 0.48),
      new THREE.MeshStandardMaterial({ color: 0xc4a06a, flatShading: true, roughness: 0.85 }),
    );
    crate.position.set(25.6, heightAt(25.6, -6.4) + 0.22, -6.4);
    crate.castShadow = true;

    parent.add(this.path, this.flowers, this.shade, crate);
  }

  sync(pocket: Pocket): void {
    const housed = (id: string) => pocket.isHoused(id);
    this.path.visible = housed('moss');
    this.flowers.visible = housed('bean');
    const napReady = housed('puddle') && housed('moss') && housed('bean');
    this.shade.visible = napReady;
    const deep = housed('nap');
    this.shade.scale.setScalar(deep ? 1.45 : 1);
    const material = this.shadeDisc.material as THREE.MeshStandardMaterial;
    material.opacity = deep ? 0.5 : 0.28;
  }
}
