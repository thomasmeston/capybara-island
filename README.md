# Capybara Island

**By Meryl Meston.**

A lonely capybara lives on a quiet island. The first pleasure is the place itself: sand underfoot, mud at the bank, reeds, and a pond you can swim. Friends are hiding in that landscape. When you find one, they tell you the house they want. You gather what that house needs, it shows up in your pocket, you build the house, and they move in. The island fills up.

This is an isometric, low-poly browser game in the visual family of *Untitled Goose Game* and *Donut County*, with one idea from *Animal Crossing*: a neighbor with a personality, a stated wish, and you making their home. The player moves like a real capybara — heavy, short-legged, and fluid — including a low, cute hop.

## Status

Phase 5 is playable. Four friends, four houses, and the stray shell. Moss is under the west shade tree (a leafy roof and a reading stone wear a path into the grass). Bean is behind a crate on the southeast sand (a tiny house and a big table grow a line of flowers). Nap, the hammock, and the shade cloth appear only after those three are home, and the shade gets deeper when Nap moves in. A refresh keeps the houses, the island changes, and whatever is still in the pocket.

| Doc | What it holds |
| --- | --- |
| [docs/DESIGN.md](docs/DESIGN.md) | Habitat, gait, pocket, pillars, cast, art, architecture |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phases 0–6, done checks, risks |

## Run

```bash
npm install
npm run dev          # http://localhost:5175
npm run build        # tsc + vite build
npm run check:island # raycast from the shelf to the pond center
```

## Stack

Vite, TypeScript, Three.js, and Howler. The same family as Dust Devil and Project Stillpoint. Three.js draws the island and plays the gait clips. Locomotion blends them, plants the feet, and hops. There is no physics engine. The ground you stand on is a raycast into the island mesh. Godot 4.6 stays the fallback only if the feet still look wrong after more time on the bank.

## Controls

WASD or arrows move, camera-relative. Hold Shift to hurry. The same keys wade and swim. Space hops: a low tuck on land, a plop in the shallows, a bob while swimming. E talks, picks up, harvests coconuts, or builds when you are close, and a click on the box does the same. Once you have built a friend's house, E near them lets them hop onto your back; friends stack into a wobbly tower so you can reach taller palm trees for bigger coconut bunches. Q drops the top friend, who loafs a moment and then walks home. Your paws leave little prints in grass, sand, and mud that fade as you keep moving. I or Tab opens the pocket larger. Esc opens the menu: resume, sound, controls, restart, or a new game. The wish card has a Show me button that moves the camera to the next thing that house still needs.

The lines live in `src/data/friends.json`. Meryl can rewrite them without a code change.
