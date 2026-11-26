/** Block-out height for the island. The mesh is built from this, then play samples the mesh. */

export const WATER_Y = 0;
export const ISLAND_HALF = 48;
export const GRID_SEGMENTS = 120;
export const PLAY_RADIUS = 40;

export const Surface = {
  Grass: 0,
  Sand: 1,
  Mud: 2,
  Shallows: 3,
  Swim: 4,
} as const;

export type SurfaceId = (typeof Surface)[keyof typeof Surface];

export const SURFACE_NAME: Record<SurfaceId, string> = {
  [Surface.Grass]: 'Grass',
  [Surface.Sand]: 'Sand',
  [Surface.Mud]: 'Mud',
  [Surface.Shallows]: 'Shallows',
  [Surface.Swim]: 'Swim',
};

/** Walk speed scale. Shallows slow the body. Swim is a glide, quicker than the mud. */
export const SURFACE_SPEED: Record<SurfaceId, number> = {
  [Surface.Grass]: 1,
  [Surface.Sand]: 0.86,
  [Surface.Mud]: 0.68,
  [Surface.Shallows]: 0.58,
  [Surface.Swim]: 0.78,
};

const GRASS = { r: 0.62, g: 0.75, b: 0.42 };
const SAND = { r: 0.9, g: 0.82, b: 0.62 };
const MUD = { r: 0.55, g: 0.42, b: 0.3 };

export const GROUND_COLOR: Record<number, { r: number; g: number; b: number }> = {
  [Surface.Grass]: GRASS,
  [Surface.Sand]: SAND,
  [Surface.Mud]: MUD,
};

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Authored ground height. The pond bowl is the origin. The grass shelf is toward -Z. */
export function heightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const pond = Math.exp(-(r * r) / (2 * 6.8 * 6.8));
  const shelfMask = smoothstep(2, 16, -z);
  const inland = smoothstep(44, 16, r);
  const bowl = -2.2 * pond;
  const shelf = 1.15 * shelfMask * (1 - pond);
  const ground = 0.48 * inland;

  const meadow = Math.exp(-((x + 16) ** 2) / 90 - ((z + 6) ** 2) / 70);
  const rise = 0.7 * meadow * (1 - pond);

  const along = smoothstep(6, 12, x) * (1 - smoothstep(22, 30, x));
  const across = Math.exp(-((z - 8) ** 2) / 8);
  const channel = -0.7 * along * across * (1 - pond);

  const cove = Math.exp(-((x + 2) ** 2 + (z - 18) ** 2) / 28);
  const coveBowl = -0.95 * cove;

  const spit = Math.exp(-((x - 16) ** 2) / 40 - ((z + 12) ** 2) / 36);
  const beach = -0.28 * spit * (1 - pond);

  const ripple = Math.sin(x * 0.31 + 1.2) * Math.cos(z * 0.27) * 0.07 * inland * (1 - pond);

  const mask = inland * (1 - pond);
  const northHill = Math.exp(-((x - 4) ** 2) / 70 - ((z - 30) ** 2) / 55);
  const westHill = Math.exp(-((x + 30) ** 2) / 60 - ((z - 4) ** 2) / 80);
  const eastHill = Math.exp(-((x - 30) ** 2) / 70 - ((z + 20) ** 2) / 50);
  const southKnoll = Math.exp(-((x + 26) ** 2) / 45 - ((z + 24) ** 2) / 40);
  const northRidge = Math.exp(-((x - 8) ** 2) / 48 - ((z - 22) ** 2) / 36);
  const westShoulder = Math.exp(-((x + 18) ** 2) / 40 - ((z - 16) ** 2) / 32);
  const southDune = Math.exp(-((x - 18) ** 2) / 34 - ((z + 30) ** 2) / 28);
  const hills =
    (1.65 * northHill +
      1.4 * westHill +
      1.2 * eastHill +
      0.8 * southKnoll +
      0.85 * northRidge +
      0.7 * westShoulder +
      0.55 * southDune) *
    mask;

  let y = bowl + shelf + ground + rise + channel + coveBowl + beach + ripple + hills;
  if (r > 40) {
    const drop = smoothstep(40, 48, r);
    y = y * (1 - drop) + -0.6 * drop;
  }
  return y;
}

export function groundSurface(y: number): SurfaceId {
  if (y > 0.72) return Surface.Grass;
  if (y > 0.22) return Surface.Sand;
  return Surface.Mud;
}

/** Shallow wade starts as soon as the feet are wet. Swim once the belly would be under. */
export function travelSurface(groundY: number, ground: SurfaceId): SurfaceId {
  const depth = WATER_Y - groundY;
  if (depth > 0.48) return Surface.Swim;
  if (depth > 0.04) return Surface.Shallows;
  return ground;
}
