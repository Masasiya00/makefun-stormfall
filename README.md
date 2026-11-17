[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Masasiya00/makefun-stormfall/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Masasiya00/makefun-stormfall/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# STORMFALL — a top-down battle royale game

A top-down battle royale in plain 2D canvas, built for make.fun's
`best-game-01` bounty ("Make the best game").

Twelve combatants drop onto one island. Loot weapons, outrun the shrinking
storm, and be the last one standing.

## Play

```sh
node serve.ts   # serves game/ at http://localhost:8080
```

Open the page, click to drop in, and fight:

- **WASD / arrows** — move (drive when mounted). **Mouse** — aim. **Hold click** — fire.
- **E** — pick up a weapon · mount / exit a vehicle. **Q** — smoke bomb (blocks sight). **R** — reload.
- **1 / 2** — switch weapon. **Shift** — sprint (stamina) · boost (in a vehicle). **P / Esc** — pause.
- **M** — mute.

Four weapons (Pistol, Scattergun, Rifle, Longshot), health + shield, medkits
and shield cells, smoke bombs, loot crates, a five-phase storm, 11 named bots
(Vex, Rook, Nova, Juno, Kite, Moss, Pike, Sable, Tess, Wren, Ash) that loot,
hunt, flee the storm and talk on the radio ("contact near Glass Field",
"storm closing, rotating to The Clearing") — a kill feed with weapon detail and
LONGSHOT tags, a score (100 per elimination + placement bonus), and a named
island: Ember Docks, Glass Field, Hollow Hill, Salt Market, Thornwood and The
Clearing, each shown on the terrain, the minimap and the HUD.

## Realism (v2, all procedural — no assets, no network)

- **Shipping containers** — solid cover at Ember Docks, Salt Market, Glass
  Field and Hollow Hill (block movement and bullets), in rust red, teal,
  mustard and brown; shown as grey squares on the minimap.
- **Drivable cars and motorcycles** — press E near one to mount, WASD to
  drive (cars ~1.8× run speed, bikes ~2.2×), Shift to boost, E to exit.
  Cars shield the driver (50% damage); bikes leave the rider fully exposed.
  Vehicles take damage, explode into smoke and fire, and leave a wreck that
  stays as cover. Bots shoot at vehicles, and a car can be destroyed in a
  firefight. Vehicle speed + HP shown on a bottom-centre HUD panel.
- **Fields and sand** — open fields with mown stripes and tall grass that
  hides a fighter inside it (bots lose sight beyond 180 px); sand patches
  that slow movement to 0.9× and kick up footstep dust.
- **War sounds** — all procedural WebAudio: distant gunfire rumble, explosion
  booms, a helicopter rotor that fades with distance, footsteps (different on
  grass and sand), and an engine hum while driving. M mutes everything.
- **Helicopters and supply drops** — every ~45–60 s a helicopter crosses the
  island and drops one supply crate by parachute (good weapon + medkit +
  shield + smoke). "SUPPLY DROP INCOMING" toast, gold crate, gold diamond on
  the minimap.
- **Combat feel** — muzzle flash + tracer + shell casings on every shot,
  damage falloff with range, recoil bloom, a hitmarker (X) and floating damage
  numbers on hits, and a brief hit-stop freeze on a kill.
- **Drifting smoke** — smoke clouds now expand, drift with the wind and fade
  over time, and still block bot line-of-sight.

## Structure

- `game/src/main.js` — boot, the fixed-step loop, screens, camera.
- `game/src/state.js` — the whole game state (pools pre-allocated).
- `game/src/map.js` — the island: terrain, trees, rocks, ruins, crates, containers, sand, fields, tall grass.
- `game/src/vehicles.js` — drivable cars and motorcycles (mount, drive, destroy, wreck).
- `game/src/heli.js` — ambient helicopters and parachute supply drops.
- `game/src/storm.js` — the shrinking safe zone, five phases.
- `game/src/player.js` — movement, sprint, drop-in, storm damage.
- `game/src/bots.js` — the 11 bots: loot, hunt, flee the storm.
- `game/src/weapons.js` — firing, reloading, swapping.
- `game/src/bullets.js` — the bullet pool and hits.
- `game/src/loot.js` — weapons, medkits, shield cells, ammo, crates, smoke.
- `game/src/smoke.js` — smoke clouds: thrown cover bots cannot see through.
- `game/src/particles.js` — particles, floating texts, screen shake.
- `game/src/audio.js` — procedural WebAudio sounds (no audio files).
- `game/src/hud.js` — the world renderer, HUD, minimap, all screens.
- `game/src/input.js` — keyboard + pointer input.
- `game/src/shots.js` — the deterministic screenshot scenes.
- `game/src/config.js` — every tuning number. `game/src/palette.js` — colours.
- `game/src/sprites.js` — pre-rendered glow sprites. `game/src/random.js` — seeded RNG.

## Screenshots

Deterministic captures (`?shot=start|play|storm|end&seed=1`): the title over a
living island, mid-game fighting, the storm closing, and the final result.
