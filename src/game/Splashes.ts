import * as THREE from 'three';

interface Drop {
  mesh: THREE.Mesh;
  life: number;
  velocity: number;
}

/** Short-lived water drops when a foot plants in the shallows or a hop lands wet. */
export class Splashes {
  private readonly drops: Drop[] = [];
  private readonly geo = new THREE.SphereGeometry(0.06, 5, 4);
  private readonly mat = new THREE.MeshBasicMaterial({
    color: 0xe7f7ff,
    transparent: true,
    opacity: 0.85,
  });

  constructor(parent: THREE.Object3D) {
    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(this.geo, this.mat.clone());
      mesh.visible = false;
      mesh.frustumCulled = false;
      parent.add(mesh);
      this.drops.push({ mesh, life: 0, velocity: 0 });
    }
  }

  burst(x: number, y: number, z: number, scale = 1): void {
    let made = 0;
    for (const drop of this.drops) {
      if (drop.life > 0 || made >= 4) continue;
      drop.life = 0.28 + made * 0.04;
      drop.velocity = 0.8 + made * 0.25;
      drop.mesh.visible = true;
      drop.mesh.position.set(x + (made - 1.5) * 0.05, y + 0.04, z + (made % 2) * 0.06);
      drop.mesh.scale.setScalar(0.4 * scale);
      const material = drop.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = 0.8;
      made++;
    }
  }

  update(dt: number): void {
    for (const drop of this.drops) {
      if (drop.life <= 0) continue;
      drop.life -= dt;
      drop.mesh.position.y += drop.velocity * dt;
      drop.velocity -= dt * 2.2;
      const material = drop.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, drop.life * 2.4);
      if (drop.life <= 0) drop.mesh.visible = false;
    }
  }
}
