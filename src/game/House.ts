import * as THREE from 'three';
import { heightAt } from '../island/shape';
import type { Friend } from './Friend';

const REACH = 1.85;

/** A stake, then the house that friend asked for. */
export class FriendHouse {
  readonly group = new THREE.Group();
  private readonly home = new THREE.Group();
  private readonly stake: THREE.Object3D;
  private readonly at: { x: number; z: number };
  private pop = 1;

  constructor(parent: THREE.Object3D, friend: Friend, already: boolean) {
    this.at = friend.houseAt;
    const y = Math.max(heightAt(this.at.x, this.at.z), 0.04);
    this.group.position.set(this.at.x, y, this.at.z);

    this.stake = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 0.55, 5),
      new THREE.MeshStandardMaterial({ color: 0x8a623c, flatShading: true, roughness: 0.85 }),
    );
    this.stake.position.y = 0.28;
    this.stake.castShadow = true;
    this.home.add(buildHome(friend.id));
    this.group.add(this.stake, this.home);
    parent.add(this.group);
    if (already) this.show(true);
    else this.home.visible = false;
  }

  near(x: number, z: number): boolean {
    if (!this.group.visible) return false;
    return Math.hypot(x - this.at.x, z - this.at.z) < REACH;
  }

  setPresent(on: boolean): void {
    this.group.visible = on;
  }

  show(instant: boolean): void {
    this.home.visible = true;
    this.stake.visible = false;
    if (instant) {
      this.home.scale.setScalar(1);
      this.pop = 1;
      return;
    }
    this.home.scale.setScalar(0.05);
    this.pop = 0;
  }

  update(dt: number): void {
    if (this.pop >= 1) return;
    this.pop = Math.min(1, this.pop + dt * 2.2);
    const bounce = this.pop + Math.sin(this.pop * Math.PI) * 0.08;
    this.home.scale.setScalar(bounce);
  }
}

function buildHome(id: string): THREE.Object3D {
  if (id === 'moss') return mossHome();
  if (id === 'bean') return beanHome();
  if (id === 'nap') return napHome();
  return puddleHome();
}

function woodMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0xc4a06a, flatShading: true, roughness: 0.82 });
}

const ROOF = new THREE.MeshStandardMaterial({ color: 0x8d4e32, flatShading: true, roughness: 0.84 });
const GLASS = new THREE.MeshStandardMaterial({
  color: 0xc5e4f5,
  flatShading: true,
  roughness: 0.2,
  metalness: 0.05,
});
const STONE = new THREE.MeshStandardMaterial({ color: 0x9aa094, flatShading: true, roughness: 0.92 });
const LEAF = new THREE.MeshStandardMaterial({ color: 0x3f6b32, flatShading: true, roughness: 0.85 });

function puddleHome(): THREE.Group {
  const home = cottage(0x6e8f4a, 'round');
  const step = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 8),
    new THREE.MeshStandardMaterial({ color: 0x7eaa58, flatShading: true, roughness: 0.7, side: THREE.DoubleSide }),
  );
  step.rotation.x = -Math.PI / 2;
  step.position.set(0, 0.06, 1.7);
  home.add(step);
  return home;
}

function mossHome(): THREE.Group {
  const home = cottage(0x6e8f4a, 'rect');
  for (const [x, z, rot] of [
    [0, 0.1, 0.2],
    [0.55, -0.15, -0.5],
    [-0.5, 0.2, 0.7],
    [0.15, 0.45, 0.1],
  ] as Array<[number, number, number]>) {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.7), LEAF);
    // Lie on the pitched roof: ridge near 2.12, falling about 0.52 per unit of depth.
    pad.position.set(x, 2.18 - Math.abs(z) * 0.52, z);
    pad.rotation.x = z >= 0 ? 0.48 : -0.48;
    pad.rotation.y = rot * 0.4;
    pad.castShadow = true;
    home.add(pad);
  }
  const stone = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.14, 0.62), STONE);
  stone.position.set(0.2, 0.08, 1.85);
  stone.castShadow = true;
  home.add(stone);
  return home;
}

function beanHome(): THREE.Group {
  const home = cottage(0xc47a4a, 'rect');
  home.scale.setScalar(0.86);
  const table = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.08, 1.05),
    new THREE.MeshStandardMaterial({ color: 0x8d5a32, flatShading: true, roughness: 0.75 }),
  );
  top.position.y = 0.72;
  top.castShadow = true;
  table.add(top);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x6b4632, flatShading: true, roughness: 0.8 });
  for (const [x, z] of [
    [-0.7, -0.38],
    [0.7, -0.38],
    [-0.7, 0.38],
    [0.7, 0.38],
  ] as Array<[number, number]>) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), legMat);
    leg.position.set(x, 0.35, z);
    table.add(leg);
  }
  table.position.set(2.15, 0, 0.15);
  home.add(table);
  return home;
}

function napHome(): THREE.Group {
  const home = new THREE.Group();
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.1, 1.9),
    new THREE.MeshStandardMaterial({ color: 0xb08968, flatShading: true, roughness: 0.86 }),
  );
  deck.position.y = 0.08;
  deck.castShadow = true;
  deck.receiveShadow = true;
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6b4632, flatShading: true, roughness: 0.85 });
  for (const [x, z] of [
    [-1.15, -0.7],
    [1.15, -0.7],
    [-1.15, 0.7],
    [1.15, 0.7],
  ] as Array<[number, number]>) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.85, 5), postMat);
    post.position.set(x, 1.0, z);
    post.castShadow = true;
    home.add(post);
  }
  const cloth = new THREE.MeshStandardMaterial({ color: 0x2f4a38, flatShading: true, roughness: 0.9 });
  for (const side of [-1, 1]) {
    const slope = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.06, 1.25), cloth);
    slope.position.set(0, 2.15, side * 0.45);
    slope.rotation.x = side * 0.35;
    slope.castShadow = true;
    home.add(slope);
  }
  const sling = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.05, 0.7),
    new THREE.MeshStandardMaterial({ color: 0xc4a06a, flatShading: true, roughness: 0.7 }),
  );
  sling.position.set(0, 0.72, 0);
  sling.rotation.z = -0.06;
  sling.castShadow = true;
  home.add(deck, sling);
  return home;
}

/** Walls, a pitched roof, a door, and a window. The wish decides the door and the roof color. */
function cottage(roofColor: number, door: 'round' | 'rect'): THREE.Group {
  const home = new THREE.Group();
  const width = 2.35;
  const depth = 2.05;
  const wallH = 1.45;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(width, wallH, depth), woodMat());
  wall.position.y = wallH / 2;
  wall.castShadow = true;
  wall.receiveShadow = true;

  const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, flatShading: true, roughness: 0.84 });
  for (const side of [-1, 1]) {
    const slope = new THREE.Mesh(new THREE.BoxGeometry(width + 0.45, 0.1, 1.35), roofMat);
    slope.position.set(0, wallH + 0.36, side * 0.48);
    slope.rotation.x = side * 0.48;
    slope.castShadow = true;
    home.add(slope);
  }
  // Fill the two gable triangles under the roof.
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-depth / 2, 0);
  gableShape.lineTo(depth / 2, 0);
  gableShape.lineTo(0, 0.64);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: width, bevelEnabled: false });
  gableGeo.translate(0, 0, -width / 2);
  gableGeo.rotateY(Math.PI / 2);
  const gable = new THREE.Mesh(gableGeo, woodMat());
  gable.position.y = wallH;
  gable.castShadow = true;
  home.add(gable);

  const front = depth / 2 + 0.04;
  let doorMesh: THREE.Mesh;
  if (door === 'round') {
    doorMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.92, 14),
      new THREE.MeshStandardMaterial({ color: 0x8d5a32, flatShading: true, roughness: 0.75 }),
    );
    doorMesh.rotation.x = Math.PI / 2;
    doorMesh.position.set(0, 0.5, front);
  } else {
    doorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.95, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x8d5a32, flatShading: true, roughness: 0.75 }),
    );
    doorMesh.position.set(0, 0.5, front);
  }
  doorMesh.castShadow = true;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 4), STONE);
  knob.position.set(0.18, 0.5, front + 0.06);

  const window = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 0.46), GLASS);
  window.position.set(width / 2 + 0.02, 0.85, 0);

  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.55, 0.28), ROOF);
  chimney.position.set(-0.7, wallH + 0.7, -0.35);
  chimney.castShadow = true;

  home.add(wall, doorMesh, knob, window, chimney);
  return home;
}
