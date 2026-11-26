import * as THREE from 'three';
import { Surface, type SurfaceId } from '../island/shape';

/** How many newer prints it takes for an old one to fade out completely. */
const TRAIL = 18;
const SIZE = 0.15;
const UP = new THREE.Vector3(0, 1, 0);
const FLAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

const STRENGTH: Partial<Record<SurfaceId, number>> = {
  [Surface.Mud]: 0.6,
  [Surface.Sand]: 0.5,
  [Surface.Grass]: 0.32,
};

interface Print {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  strength: number;
}

/**
 * Little paw prints pressed into land where a foot plants. Each new print
 * ages the older ones, so the trail fades out behind you as you keep moving.
 */
export class Footprints {
  private readonly prints: Print[] = [];
  private next = 0;
  private readonly geo = new THREE.PlaneGeometry(SIZE, SIZE);
  private readonly texture = pawTexture();
  private readonly tilt = new THREE.Quaternion();
  private readonly turn = new THREE.Quaternion();

  constructor(parent: THREE.Object3D) {
    for (let i = 0; i < TRAIL + 2; i++) {
      const material = new THREE.MeshBasicMaterial({
        map: this.texture,
        color: 0x3b2a1c,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const mesh = new THREE.Mesh(this.geo, material);
      mesh.visible = false;
      mesh.renderOrder = 1;
      parent.add(mesh);
      this.prints.push({ mesh, material, age: TRAIL, strength: 0 });
    }
  }

  /** Stamp a print at a planted foot. Water and swim leave nothing. */
  stamp(point: THREE.Vector3, normal: THREE.Vector3, yaw: number, travel: SurfaceId): void {
    const strength = STRENGTH[travel];
    if (strength === undefined) return;
    for (const print of this.prints) {
      if (print.age < TRAIL) this.fade(print, print.age + 1);
    }
    const print = this.prints[this.next];
    if (!print) return;
    this.next = (this.next + 1) % this.prints.length;
    this.tilt.setFromUnitVectors(UP, normal);
    this.turn.setFromAxisAngle(UP, yaw);
    print.mesh.quaternion.copy(this.tilt).multiply(this.turn).multiply(FLAT);
    print.mesh.position.copy(point).addScaledVector(normal, 0.012);
    print.mesh.visible = true;
    print.strength = strength;
    this.fade(print, 0);
  }

  dispose(): void {
    for (const print of this.prints) {
      print.mesh.removeFromParent();
      print.material.dispose();
    }
    this.geo.dispose();
    this.texture.dispose();
  }

  private fade(print: Print, age: number): void {
    print.age = age;
    const left = 1 - age / TRAIL;
    print.material.opacity = print.strength * Math.max(0, left);
    print.mesh.visible = left > 0;
  }
}

/** A soft webbed pad with three toes, drawn once. Toes point toward +y on the canvas. */
function pawTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(32, 42, 13, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [x, y] of [
      [18, 22],
      [32, 15],
      [46, 22],
    ] as Array<[number, number]>) {
      ctx.beginPath();
      ctx.ellipse(x, y, 6, 8, (x - 32) * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
