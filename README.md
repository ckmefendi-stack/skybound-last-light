[![Make.fun — Make the best flight game](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/ckmefendi-stack/skybound-last-light/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/ckmefendi-stack/skybound-last-light/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

# SKYBOUND — LAST LIGHT

A golden-hour flight game for the [Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057) bounty on make.fun. One island, one bush plane, one mission: take off from the coastal runway, fly eight glowing rings over the harbour, the lighthouse, the north ridge and the canyon bridge, then come home and land on runway 09 before the light goes. Your grade — S, A, B, C or D — comes from ring accuracy, landing quality and time, and fuel is always ticking down.

## Play

Serve `game/` with any static server (`node serve.ts`, then open http://localhost:8080) and fly with keyboard and mouse. No network request, no build step.

| Key | Action |
| --- | --- |
| Shift / Ctrl | Throttle up / down |
| W / S | Pitch down / up |
| A / D | Roll left / right |
| Q / E | Rudder |
| Space | Airbrake |
| F / G | Flaps / Landing gear |
| C | Chase / Cockpit camera |
| R | Restart |
| P | Pause |

Mouse: click the sky to steer with it. Land on the runway with a gentle sink rate and on the centreline for the best grade; run out of fuel and you glide home on fumes.

## What the judge sees

Four screenshots, all real renders of the game itself:

1. `01-chase-course.jpg` — chase view, banked into a turn mid-course, next ring ahead.
2. `02-cockpit-lit.jpg` — cockpit view, live six-pack instruments lit, ring ahead.
3. `03-final-approach.jpg` — on final for runway 09, PAPI lights, descending 350 fpm.
4. `04-landing-score.jpg` — rolled out on the runway with the S-grade scorecard.

## How it is built

- `game/src/main.js` — boot and the one loop: fixed-step flight, screens (title, play, paused, results), cameras, shot mode (`?shot=chase|cockpit|approach|landing` stages a deterministic scene for screenshots).
- `game/src/physics.js` — the arcade flight model: quaternion orientation, bank-to-turn coupling, stall, fuel, ring passes and the landing grade.
- `game/src/world.js` — the deterministic island: heightfield terrain, ocean, golden-hour sky, runway with PAPI, control tower, hangars, lighthouse, canyon bridge, harbour and the eight rings. `terrainHeight` is the single source of truth for ground height.
- `game/src/aircraft.js` — the procedural bush plane (primitives only, no external models) and the 3D cockpit with a live CanvasTexture six-pack.
- `game/src/hud.js` — the 2D canvas HUD: airspeed and altitude tapes, heading compass, pitch ladder, throttle and fuel, ring progress and next-ring guidance.
- `game/src/audio.js` — procedural Web Audio: engine hum, wind, ring chime, touchdown, stall horn.
- `game/src/input.js` — keyboard and (optional, pointer-lock) mouse input.
- `game/src/shots.js` — the four screenshot scenes.
- `game/src/random.js` — seeded random and value noise; the island is the same every run.
- `game/vendor/three.module.min.js` — Three.js r170, the only library, vendored as a minified module.
- `main.ts` — the Node 22 entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the vendored make.fun library.
- `vendor/makefun-game.ts` — the kit's copy, unchanged.

## License

MIT — see [LICENSE](LICENSE).
