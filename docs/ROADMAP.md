# Capybara Island — roadmap

**By Meryl Meston.** Design lives in [DESIGN.md](DESIGN.md). Phase 5 is playable: four houses, and Nap only after the other three. `npm run dev`.

This is a side project beside HiOrbit, Stillpoint, and Dust Devil. It does not replace that work.

## Phases

**0 — Write the plan into the repo.** Done when `README.md`, `docs/DESIGN.md`, and `docs/ROADMAP.md` are in the repo and credit Meryl. No engine.

**1 — The island.** Scaffold Vite, TypeScript, Three.js, and Howler. One ground from a grass shelf to a pond bowl, with sand, mud, reeds, a water surface, and tropical cover: palms, shade trees, banana plants, ferns, and shrubs. A sampler for height, slope, surface, and depth, from a raycast on the mesh. Isometric camera. A stand-in body exists so you can travel the bowl. `npm run dev` and `npm run build` both work.

**2 — The gait.** Done as a code-built bone rig, not a Blender file yet. Clips for idle, loaf, walk, trot, wade, swim, and a cute jump are sampled from pose functions. Walk eases in and out. The head leads a turn. Feet plant on the slope while a leg is down. Shallows slow the body and splash. Swim depth sits the torso on the waterline. Idle settles into a loaf. Space is a low tuck on land, a plop in the shallows, and a surface bob while swimming. Landing returns to the gait you were in. Surface sounds are generated tones. A Blender GLB can replace the rig later if the bone names match (`hips`, `spine`, `head`, `thighFL`, `shinFL`, `footFL`, and the other three legs). Houses and dialogue wait.

**3 — Find and talk.** Done. Puddle wades in the reeds of the east channel, given away by a ripple and reeds that rustle harder. You wade in to reach them. E or a click opens lines from `src/data/friends.json`. After the last line, the wish card stays pinned with the round door and lily pad step still unchecked. The pocket and the house wait. The island is larger than the first bowl: west meadow, east channel, north cove, sandy spits, more tropical cover, rocks, and driftwood. The original pond, grass shelf, and bank check stay where they were.

**4 — Pocket and Puddle’s house.** Done. Three finds: a round door on the far bank, a lily pad in the channel, and a stray shell on the sand that Puddle did not ask for. Each one shows in the pocket with a name and an icon. The wish card checks the door and the pad from the pocket. At the stake in the reeds, E spends those two, the house pops in, Puddle sits on the bank, and the shell stays. `localStorage` key `capybara-island` restores the house and the pocket.

**5 — The other three.** Done. Moss sits under the west shade tree and wants a leafy roof and a reading stone. Bean waits behind a crate on the southeast sand and wants a tiny house and a big table. Nap, the hammock, and the shade cloth stay hidden until those three are home. Then Nap appears in a new shade. Each move-in changes the island: a path worn into the grass, a flower line, then a deeper shade. Friends sit, and Puddle keeps a short wade until the house is up. You still have to hear a wish before that stake will build. The shell stays.

**6 — Island life.** Hero polish on the mesh if the silhouette needs it. Four houses in Blender. A short music bed. A house-complete beat: a chime, laundry on the line. The gait is already in. This pass adds the room around it.

GitHub Pages and an itch zip, copied from the Dust Devil / Stillpoint scripts, wait until phase 4 is fun. Discord notify is not wired for this repo until Thomas asks.

## How we’ll know a phase is done

- **Phase 1.** You can go from the grass down the bank and across the pond without falling through, and the waterline sits on the bowl.
- **Phase 3.** You can wade to Puddle in the reeds, hear the lines, and see the wish card stay up with both items unchecked. The meadow, channel, cove, and sand read as different ground. The shelf, the bank, and the pond swim still pass `npm run check:island`.
- **Phase 4.** A new player can wade to Puddle, hear the wish, and see every pickup in the pocket, including one item Puddle did not ask for. The wish card matches the pocket. Building spends only Puddle’s items. Reload shows the house and whatever is still in the pocket.
- **Phase 5.** Four houses, four personalities, Nap only after the others.

Verification, once there is a build, is `npm run build` plus playing in the browser. No Playwright unless Thomas asks.

## Risks

- A stiff glide fails the game even if the wish loop is correct. Phase 2 is the gate. The hop is allowed to be cuter than the walk. It stays a low plop. If it starts clearing banks or standing in for a path, the island needs a slope.
- Foot IK is the part Three.js will not set up for you. If a week of the two-bone plant still looks wrong on the bank, move the character to Godot 4.6 before building houses. Do not add a physics engine to fix the feet.
- Realistic timing on a chunky low-poly mesh is the target. Fine fur, muscle simulation, and a photoreal pond fight the *Goose Game* / *Donut County* read.
- Swim hides the legs. Show the waterline, the shorter paddle in the shallows, and the wake, and keep the back in frame.
- The large version of *Animal Crossing* is out of scope. If a feature is outside “move through the island, find, ask, see it in the pocket, build, they move in,” it waits. The pocket shows items. It does not become a shop, a sort puzzle, or a crafting grid.
- Dialogue stays in Meryl’s words. JSON is there so lines can change without code changes.

## Cast reminder

| Order | Friend | Hide | Wish |
| --- | --- | --- | --- |
| 1 | Puddle | Reeds in the shallows | Round door and a lily pad step |
| 2 | Moss | Under a wide-leaf shade tree | Leafy roof and a flat reading stone |
| 3 | Bean | Behind a snack crate on the sand | Tiny house and a big table |
| 4 | Nap | Shade that appears after the other three are home | A hammock house |
