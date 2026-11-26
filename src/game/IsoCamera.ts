import * as THREE from 'three';

/** Half-height of the ortho view, in world units. Smaller sits closer to the player. */
const FRUSTUM = 6.4;

/** Fixed isometric follow. The angle never goes free. Lag lets a turn read as weight. */
export class IsoCamera {
  readonly camera: THREE.OrthographicCamera;
  private readonly offset = new THREE.Vector3(16, 14, 16);
  private readonly target = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  readonly forward = new THREE.Vector3();
  readonly right = new THREE.Vector3();
  private glance: THREE.Vector3 | null = null;
  private glanceLeft = 0;

  constructor(aspect: number) {
    this.camera = new THREE.OrthographicCamera(
      -FRUSTUM * aspect,
      FRUSTUM * aspect,
      FRUSTUM,
      -FRUSTUM,
      0.1,
      180,
    );
    this.lookFrom(new THREE.Vector3(0, 0, -12));
  }

  resize(aspect: number): void {
    this.camera.left = -FRUSTUM * aspect;
    this.camera.right = FRUSTUM * aspect;
    this.camera.top = FRUSTUM;
    this.camera.bottom = -FRUSTUM;
    this.camera.updateProjectionMatrix();
  }

  /** Pan the view onto a world point, then drift back to the player. */
  glanceAt(point: THREE.Vector3, hold = 3.2): void {
    this.glance = point.clone();
    this.glanceLeft = hold;
  }

  cancelGlance(): void {
    this.glance = null;
    this.glanceLeft = 0;
  }

  follow(focus: THREE.Vector3, dt: number, lift: number): void {
    if (this.glance && this.glanceLeft > 0) {
      this.glanceLeft -= dt;
      this.desired.copy(this.glance);
      if (this.glanceLeft <= 0) this.glance = null;
    } else {
      this.desired.copy(focus);
      this.desired.y += 0.4 + lift;
    }
    const rate = this.glance ? 2.4 : 4;
    const k = 1 - Math.exp(-rate * dt);
    this.target.lerp(this.desired, k);
    this.lookFrom(this.target);
  }

  private lookFrom(focus: THREE.Vector3): void {
    this.camera.position.copy(focus).add(this.offset);
    this.camera.lookAt(focus);
    this.camera.updateMatrixWorld();
    const e = this.camera.matrixWorld.elements;
    this.right.set(e[0], 0, e[2]);
    if (this.right.lengthSq() < 1e-6) this.right.set(1, 0, 0);
    this.right.normalize();
    this.forward.set(-e[8], 0, -e[10]);
    if (this.forward.lengthSq() < 1e-6) this.forward.set(0, 0, -1);
    this.forward.normalize();
  }
}
