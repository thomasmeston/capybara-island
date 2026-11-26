import * as THREE from 'three';
import { plantTropical, type PalmTree } from './Foliage';
import { PUDDLE } from '../island/places';
import {
  GRID_SEGMENTS,
  GROUND_COLOR,
  ISLAND_HALF,
  PLAY_RADIUS,
  SURFACE_NAME,
  Surface,
  type SurfaceId,
  WATER_Y,
  groundSurface,
  heightAt,
  travelSurface,
} from '../island/shape';

export interface GroundSample {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  ground: SurfaceId;
  travel: SurfaceId;
  depth: number;
  label: string;
}

const UP = new THREE.Vector3(0, 1, 0);

export class Island {
  readonly group = new THREE.Group();
  readonly ground: THREE.Mesh;
  readonly reeds: THREE.Object3D[] = [];
  readonly pads: THREE.Object3D[] = [];
  readonly palms: PalmTree[] = [];
  private readonly crowns: THREE.Object3D[] = [];
  private readonly waveTime: Array<{ value: number }> = [];

  private readonly raycaster = new THREE.Raycaster();
  private readonly down = new THREE.Vector3(0, -1, 0);
  private readonly origin = new THREE.Vector3();
  private readonly surfaceAttr: THREE.BufferAttribute;

  constructor() {
    this.ground = this.buildGround();
    this.surfaceAttr = this.ground.geometry.getAttribute('surfaceId') as THREE.BufferAttribute;
    this.group.add(this.ground);
    this.group.add(this.buildSea());
    this.group.add(this.buildPondWater());
    this.addReeds();
    this.addPads();
    const tropical = plantTropical(this.group);
    this.crowns.push(...tropical.sway);
    this.palms.push(...tropical.palms);
  }

  sample(x: number, z: number): GroundSample | null {
    this.origin.set(x, 24, z);
    this.raycaster.set(this.origin, this.down);
    const hits = this.raycaster.intersectObject(this.ground, false);
    const hit = hits[0];
    if (!hit || !hit.face) return null;

    const point = hit.point.clone();
    const normal = hit.face.normal.clone().transformDirection(this.ground.matrixWorld);
    if (normal.dot(UP) < 0) normal.negate();
    normal.normalize();

    const ground = this.surfaceOnFace(hit);
    const depth = WATER_Y - point.y;
    const travel = travelSurface(point.y, ground);
    return {
      point,
      normal,
      ground,
      travel,
      depth,
      label: SURFACE_NAME[travel],
    };
  }

  update(time: number, dt = 0): void {
    for (let i = 0; i < this.reeds.length; i++) {
      const reed = this.reeds[i];
      if (!reed) continue;
      const sway = Math.sin(time * 1.3 + i * 0.7) * (reed.userData.rustle ? 0.28 : 0.12);
      reed.rotation.z = sway;
      reed.rotation.x = Math.cos(time * 1.1 + i) * 0.05;
    }
    for (let i = 0; i < this.pads.length; i++) {
      const pad = this.pads[i];
      if (!pad) continue;
      pad.position.y = WATER_Y + 0.04 + Math.sin(time * 0.8 + i) * 0.015;
    }
    for (let i = 0; i < this.crowns.length; i++) {
      const crown = this.crowns[i];
      if (!crown) continue;
      const phase = Number(crown.userData.sway) || i;
      crown.rotation.z = Math.sin(time * 0.7 + phase) * 0.045;
      crown.rotation.x = Math.cos(time * 0.55 + phase) * 0.03;
    }
    for (const clock of this.waveTime) clock.value = time;
    if (dt > 0) {
      for (const palm of this.palms) palm.update(dt);
    }
  }

  private surfaceOnFace(hit: THREE.Intersection): SurfaceId {
    const face = hit.face;
    if (!face) return Surface.Mud;
    const geometry = this.ground.geometry;
    const position = geometry.getAttribute('position');
    const local = this.ground.worldToLocal(hit.point.clone());
    const a = new THREE.Vector3().fromBufferAttribute(position, face.a);
    const b = new THREE.Vector3().fromBufferAttribute(position, face.b);
    const c = new THREE.Vector3().fromBufferAttribute(position, face.c);
    const bary = barycentric(local, a, b, c);
    const id =
      this.surfaceAttr.getX(face.a) * bary.x +
      this.surfaceAttr.getX(face.b) * bary.y +
      this.surfaceAttr.getX(face.c) * bary.z;
    return Math.round(id) as SurfaceId;
  }

  private buildGround(): THREE.Mesh {
    const n = GRID_SEGMENTS;
    const half = ISLAND_HALF;
    const stride = n + 1;
    const positions = new Float32Array(stride * stride * 3);
    const colors = new Float32Array(stride * stride * 3);
    const surfaceIds = new Float32Array(stride * stride);
    let v = 0;
    for (let iz = 0; iz <= n; iz++) {
      for (let ix = 0; ix <= n; ix++) {
        const x = -half + (ix / n) * half * 2;
        const z = -half + (iz / n) * half * 2;
        const y = heightAt(x, z);
        const id = groundSurface(y);
        const color = tint(x, z, id, GROUND_COLOR[id] ?? GROUND_COLOR[Surface.Mud]);
        const o = v * 3;
        positions[o] = x;
        positions[o + 1] = y;
        positions[o + 2] = z;
        colors[o] = color?.r ?? 0.5;
        colors[o + 1] = color?.g ?? 0.5;
        colors[o + 2] = color?.b ?? 0.4;
        surfaceIds[v] = id;
        v++;
      }
    }
    const indices: number[] = [];
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const a = iz * stride + ix;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('surfaceId', new THREE.BufferAttribute(surfaceIds, 1));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.92,
      metalness: 0,
    });
    attachGroundDetail(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    return mesh;
  }

  private buildSea(): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(260, 260, 90, 90);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({
      color: 0x6ea8c8,
      roughness: 0.28,
      metalness: 0.04,
    });
    this.waveTime.push(attachWaves(material, 0.16));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = -0.12;
    mesh.receiveShadow = true;
    return mesh;
  }

  /** Pond surface follows the grid, so the waterline meets the bowl instead of a hard circle. */
  private buildPondWater(): THREE.Mesh {
    const n = GRID_SEGMENTS;
    const half = ISLAND_HALF;
    const positions: number[] = [];
    const colors: number[] = [];
    const cell = (ix: number, iz: number) => {
      const x = -half + (ix / n) * half * 2;
      const z = -half + (iz / n) * half * 2;
      return { x, z, y: heightAt(x, z) };
    };
    const push = (x: number, z: number, groundY: number) => {
      positions.push(x, WATER_Y + 0.02, z);
      const t = THREE.MathUtils.clamp((WATER_Y - groundY) / 1.6, 0, 1);
      colors.push(
        THREE.MathUtils.lerp(0.78, 0.22, t),
        THREE.MathUtils.lerp(0.9, 0.55, t),
        THREE.MathUtils.lerp(0.93, 0.68, t),
      );
    };
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const a = cell(ix, iz);
        const b = cell(ix + 1, iz);
        const c = cell(ix, iz + 1);
        const d = cell(ix + 1, iz + 1);
        const midR = Math.hypot((a.x + d.x) * 0.5, (a.z + d.z) * 0.5);
        if (midR > PLAY_RADIUS) continue;
        const lowest = Math.min(a.y, b.y, c.y, d.y);
        if (lowest > WATER_Y + 0.05) continue;
        push(a.x, a.z, a.y);
        push(c.x, c.z, c.y);
        push(b.x, b.z, b.y);
        push(b.x, b.z, b.y);
        push(c.x, c.z, c.y);
        push(d.x, d.z, d.y);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      roughness: 0.12,
      metalness: 0.06,
      depthWrite: false,
    });
    this.waveTime.push(attachWaves(material, 0.045));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 2;
    return mesh;
  }

  private addReeds(): void {
    const material = new THREE.MeshStandardMaterial({
      color: 0x6e9a4e,
      flatShading: true,
      roughness: 0.8,
    });
    const spots: Array<[number, number]> = [];
    for (let i = 0; i < 70; i++) {
      const angle = (i / 70) * Math.PI * 2 + (i % 4) * 0.15;
      const radius = 8.1 + (i % 6) * 0.42;
      spots.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
    }
    for (let i = 0; i < 24; i++) {
      spots.push([8 + (i % 8) * 1.6, 8 + ((i * 3) % 5) - 2]);
    }
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      spots.push([Math.cos(angle) * (3.2 + (i % 3)), 18 + Math.sin(angle) * (2.4 + (i % 2))]);
    }
    spots.forEach(([x, z], i) => this.plantReed(x, z, i, material));
  }

  private plantReed(x: number, z: number, i: number, material: THREE.Material): void {
    const y = heightAt(x, z);
    const depth = WATER_Y - y;
    if (depth < 0.05 || depth > 0.42) return;
    const height = 0.7 + (i % 5) * 0.12;
    const reed = new THREE.Mesh(new THREE.ConeGeometry(0.06, height, 5), material);
    reed.position.set(x, y + height * 0.5, z);
    reed.castShadow = true;
    reed.userData.rustle = Math.hypot(x - PUDDLE.x, z - PUDDLE.z) < 3.4;
    this.reeds.push(reed);
    this.group.add(reed);
  }

  private addPads(): void {
    const material = new THREE.MeshStandardMaterial({
      color: 0x7da36a,
      flatShading: true,
      roughness: 0.7,
    });
    for (let i = 0; i < 7; i++) {
      const angle = i * 1.3 + 0.4;
      const radius = 3.2 + (i % 3) * 1.1;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius * 0.85;
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.42 + (i % 3) * 0.08, 7), material);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(x, WATER_Y + 0.04, z);
      this.pads.push(pad);
      this.group.add(pad);
    }
  }

}

function tint(
  x: number,
  z: number,
  id: SurfaceId,
  color: { r: number; g: number; b: number } | undefined,
): { r: number; g: number; b: number } {
  const base = color ?? { r: 0.5, g: 0.45, b: 0.35 };
  let { r, g, b } = base;
  if (id === Surface.Grass && x < -8) {
    r += 0.07;
    g += 0.03;
  }
  if (id === Surface.Grass && z > 6) {
    g -= 0.05;
    r -= 0.03;
  }
  if (id === Surface.Sand && x > 10) {
    r += 0.04;
    g += 0.05;
  }
  if (id === Surface.Mud && z > 10) {
    r -= 0.04;
    g -= 0.03;
    b -= 0.02;
  }
  const speckle = hash(x * 0.41, z * 0.37);
  if (speckle > 0.78 && (id === Surface.Grass || id === Surface.Sand)) {
    r = r * 0.62 + 0.28;
    g = g * 0.55 + 0.2;
    b = b * 0.6 + 0.12;
  }
  return {
    r: THREE.MathUtils.clamp(r, 0, 1),
    g: THREE.MathUtils.clamp(g, 0, 1),
    b: THREE.MathUtils.clamp(b, 0, 1),
  };
}

function hash(x: number, z: number): number {
  const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

const GRASS_TILE = new URL('../textures/grass.jpg', import.meta.url).href;
const SAND_TILE = new URL('../textures/sand.jpg', import.meta.url).href;

/** Poly Haven CC0 grass_ground and coast_sand_03, softened so they only grain the vertex colors. */
function attachGroundDetail(material: THREE.MeshStandardMaterial): void {
  if (typeof document === 'undefined') return;
  const ready = { value: 0 };
  const seen = { grass: false, sand: false };
  const mark = (tex: THREE.Texture, slot: 'grass' | 'sand') => {
    tex.colorSpace = THREE.LinearSRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    seen[slot] = true;
    if (seen.grass && seen.sand) ready.value = 1;
  };
  const grass = new THREE.TextureLoader().load(GRASS_TILE, (tex) => mark(tex, 'grass'));
  const sand = new THREE.TextureLoader().load(SAND_TILE, (tex) => mark(tex, 'sand'));
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGrass = { value: grass };
    shader.uniforms.uSand = { value: sand };
    shader.uniforms.uReady = ready;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float surfaceId;
        varying float vSurface;
        varying vec2 vGroundUv;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vSurface = surfaceId;
        vGroundUv = position.xz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uGrass;
        uniform sampler2D uSand;
        uniform float uReady;
        varying float vSurface;
        varying vec2 vGroundUv;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 grassDetail = texture2D(uGrass, vGroundUv * 0.09).rgb;
        vec3 sandDetail = texture2D(uSand, vGroundUv * 0.14).rgb;
        float sandMix = smoothstep(0.35, 1.15, vSurface);
        vec3 detail = mix(grassDetail, sandDetail, sandMix);
        if (vSurface > 1.5) detail *= vec3(0.9, 0.86, 0.8);
        diffuseColor.rgb *= mix(vec3(1.0), detail, uReady * 0.78);`,
      );
  };
  material.customProgramCacheKey = () => 'ground-detail';
}

function attachWaves(material: THREE.MeshStandardMaterial, amplitude: number): { value: number } {
  const clock = { value: 0 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = clock;
    shader.uniforms.uAmp = { value: amplitude };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uAmp;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float waveA = sin(position.x * 1.15 + uTime * 1.4);
        float waveB = sin(position.z * 0.85 + position.x * 0.35 + uTime * 0.9);
        transformed.y += (waveA * 0.65 + waveB * 0.45) * uAmp;`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        objectNormal = normalize(vec3(
          -cos(position.x * 1.15 + uTime * 1.4) * 1.15 * uAmp * 5.0,
          1.0,
          -cos(position.z * 0.85 + position.x * 0.35 + uTime * 0.9) * 0.85 * uAmp * 5.0
        ));`,
      );
  };
  material.customProgramCacheKey = () => `waves-${amplitude}`;
  return clock;
}

function barycentric(
  p: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
): THREE.Vector3 {
  const v0 = b.clone().sub(a);
  const v1 = c.clone().sub(a);
  const v2 = p.clone().sub(a);
  const d00 = v0.dot(v0);
  const d01 = v0.dot(v1);
  const d11 = v1.dot(v1);
  const d20 = v2.dot(v0);
  const d21 = v2.dot(v1);
  const denom = d00 * d11 - d01 * d01 || 1;
  const v = (d11 * d20 - d01 * d21) / denom;
  const w = (d00 * d21 - d01 * d20) / denom;
  const u = 1 - v - w;
  return new THREE.Vector3(u, v, w);
}
