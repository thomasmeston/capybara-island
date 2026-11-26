import { Surface, heightAt } from '../src/island/shape';
import { PUDDLE } from '../src/island/places';
import { Island } from '../src/game/Island';

const island = new Island();

function expect(name: string, ok: boolean, detail: string): void {
  if (!ok) {
    console.error(`FAIL ${name}: ${detail}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok ${name}: ${detail}`);
}

const shelf = island.sample(0, -15);
expect(
  'grass shelf',
  !!shelf && shelf.travel === Surface.Grass && shelf.point.y > 0.7,
  shelf ? `y=${shelf.point.y.toFixed(2)} ${shelf.label}` : 'miss',
);

const shore = island.sample(11.2, 1);
expect(
  'bank is walkable',
  !!shore && shore.point.y > -0.2 && shore.normal.y > 0.4,
  shore ? `y=${shore.point.y.toFixed(2)} ${shore.label} ny=${shore.normal.y.toFixed(2)}` : 'miss',
);

const pond = island.sample(0, 0);
expect(
  'pond swim',
  !!pond && pond.travel === Surface.Swim && pond.depth > 0.8,
  pond ? `y=${pond.point.y.toFixed(2)} depth=${pond.depth.toFixed(2)} ${pond.label}` : 'miss',
);

let missed = 0;
for (let i = 0; i <= 20; i++) {
  const t = i / 20;
  const z = -15 + t * 15;
  const sample = island.sample(0, z);
  if (!sample) missed++;
}
expect('shelf to pond center', missed === 0, `${missed} misses along z`);

const authored = heightAt(0, 0);
const meshDelta = pond ? Math.abs(pond.point.y - authored) : 99;
expect('raycast matches the bowl', meshDelta < 0.35, `delta ${meshDelta.toFixed(3)}`);

const meadow = island.sample(-16, -6);
expect(
  'west meadow',
  !!meadow && meadow.travel === Surface.Grass && meadow.point.y > 0.9,
  meadow ? `y=${meadow.point.y.toFixed(2)} ${meadow.label}` : 'miss',
);

const channel = island.sample(14, 8);
expect(
  'east channel wades',
  !!channel && channel.travel === Surface.Shallows,
  channel ? `y=${channel.point.y.toFixed(2)} ${channel.label}` : 'miss',
);

const hide = island.sample(PUDDLE.x, PUDDLE.z);
expect(
  'puddle waits in the shallows',
  !!hide && hide.travel === Surface.Shallows && hide.depth > 0.05 && hide.depth < 0.45,
  hide ? `y=${hide.point.y.toFixed(2)} depth=${hide.depth.toFixed(2)} ${hide.label}` : 'miss',
);

if (process.exitCode) {
  process.exit(process.exitCode);
}
