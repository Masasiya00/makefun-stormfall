# BUILD BRIEF — STORMFALL (best-game-01, second entry)

## Competition
- **best-game-01** — "Make the best game", $1,000 (1st $400, 2nd $200, 3rd $120, 4th–10th $40).
- **Deadline: 2026-11-19 01:00 WIB** (2026-11-18T18:00:00Z). Free entry, max 5 entries/day, max 10 total. LUMEN DRIFT already submitted as entry 1; this is entry 2.
- **Judged by an AI judge (superbot) comparing entries pairwise on screenshots (contact sheet dominates) + source outline.** Criteria in order: (1) complete game, (2) fun/depth, (3) feel/polish, (4) look/originality, (5) structure (files with one clear job each, named for what they do).
- **Kit:** ~/workspace/makefun/best-game-01-kit/best-game-01-kit/ (RULES.txt READ IT FULLY). Starter = "Block Dodger" — must diverge substantially (duplicate_snapshot refuses byte-identical/starter entries).
- **Repo:** Masasiya00/makefun-stormfall (public, created 2026-11-17, after opening ✓). **Build dir:** ~/workspace/makefun-stormfall-build. **owner.json** already set (wallet DrhbBJ4F1N5V49DjbGnhSqUG3asV1VCEtHn1PxvRNFsB).

## Quality bar (user's words)
**"Contoh aja game Fortnite atau Valorant."** Fortnite/Valorant are the reference for graphics, FPS, movement, visuals. For a 2D canvas game that means the FEEL: 60fps smooth, responsive controls, clear visual feedback, polished HUD — not literal 3D AAA visuals. **Do NOT ship anything ugly or low-quality.** The user explicitly said: graphics good, FPS smooth, movement responsive, screenshots great, spec exact.

## Game: STORMFALL — top-down battle royale (Fortnite-inspired, ALL names/art/sounds original)
A 2D canvas top-down battle royale on a single island. 12 combatants (you + 11 AI bots). Loot weapons, survive the shrinking storm, be the last one standing.

### Core loop
1. **Drop:** start screen → click/press to drop onto the island (parachute/glide-in, pick a landing spot or auto-drop).
2. **Loot:** weapons (Pistol / Scattergun / Rifle / Longshot), ammo, medkit, shield cell. Pick up with E (or walk over). Crates/chests scattered around the island.
3. **Storm:** a purple storm wall shrinks in phases (timer shown). Outside the safe zone = damage over time, escalating per phase. The zone visibly closes on the map.
4. **Fight:** AI bots loot, roam, and fight each other and you. Bots have visible health bars, distinct colors, simple but believable behavior (seek loot → hunt nearest enemy → flee storm).
5. **Win/Lose:** last one standing = victory screen ("LAST ONE STANDING" + placement #1 + kills + time). Eliminated = game-over screen with your placement (#N of 12), kills, and restart.

### Controls (show them on the start screen)
- WASD / arrows — move. Mouse — aim. Hold click — fire.
- E — pick up / interact. R — reload. 1/2/3 — switch weapon slot.
- Shift — sprint (stamina) or dash. P / Esc — pause. M — mute.

### Systems (must all work, not stubs)
- **Weapons (3+ distinct):** Pistol (fast, low damage, infinite reserve), Scattergun (spread, high close damage, slow), Rifle (auto, medium), Longshot (high damage, slow, zoom-ish range). Each with damage, fire rate, magazine, reload time, spread, range. Ammo per weapon.
- **Health + shield:** 100 HP + up to 100 shield (shield cell pickup). Shield absorbs first.
- **Storm phases:** at least 3 phases, each with a wait timer then a shrink. Safe-zone circle drawn on the map + a minimap or zone indicator. Damage outside zone escalates (1 → 2 → 5 dps).
- **Bots (11):** names, health, weapons, loot-seeking, combat, storm-avoidance, eliminations among themselves (kill feed shows bot-vs-bot too). Alive count in HUD drops as bots die.
- **Kill feed + placement:** top-right feed ("You eliminated Bot-7", "Bot-3 eliminated Bot-9"). Placement updates live.
- **HUD:** health bar, shield bar, weapon + ammo, alive count, kills, zone timer + phase, minimap (small, shows zone + player + storm).
- **Screens:** start/title (with controls + "drop" button), pause, victory, eliminated (with placement + restart via R/click).
- **Feel:** procedural WebAudio (shoot per weapon, hit, elimination, pickup, storm warning, victory/defeat stingers), particles (muzzle flash, hit sparks, elimination burst, storm edge), screen shake on damage, damage flash, low-health pulse.
- **Map:** island ~1600×1200 with terrain variety — grass, trees (cover), rocks (cover), water edge, a few buildings/ruins (walls = cover), loot crates. Camera follows the player; the world is bigger than the viewport.

### Visual identity (must look GOOD — this is what the judge sees)
- Clean, readable top-down style. Palette: island green/teal terrain, warm sand, storm purple (#a855f7 / #7c3aed), player cyan (#4de8ff), bots in distinct warm colors (orange/red/pink), loot gold, health green, shield blue.
- Glow via **pre-rendered sprites, NOT shadowBlur per frame** (performance — this is how LUMEN DRIFT hit 60fps).
- Storm wall: visible purple gradient + animated edge. Safe zone: clean circle outline.
- All text readable at 1280×800. HUD never overlaps the play area awkwardly.

### Structure (judge criterion 5)
- One file per job, named for what it does: `main.js`, `state.js`, `player.js`, `bots.js`, `weapons.js`, `bullets.js`, `loot.js`, `storm.js`, `map.js`, `particles.js`, `audio.js`, `hud.js`, `input.js`, `palette.js`, `sprites.js`, `random.js`, `shots.js`. 2D canvas, NO engine, NO network calls.
- `main.ts` + `vendor/makefun-game.ts` (unchanged from kit). MIT LICENSE. README with the **three best-game-01 badges + bounty link** (submit REFUSES without them — the LUMEN DRIFT lesson). `serve.ts`. `shots.json` with `?shot=start|play|storm|end`.

## Performance (user: "FPS mulus")
- **Target 60fps, measure it.** Fixed 1/60 s sim. Object pools for bullets + particles. Pre-rendered glow sprites + pre-rendered terrain. Zero per-frame allocation in the hot loop. **Report measured fps + avg/p95 frame time** (headless SwiftShader baseline; LUMEN DRIFT got 60.0–60.2 fps, avg 16.6 ms).
- **Movement must be responsive:** no input lag, no dropped one-shot presses (LUMEN DRIFT had a dropped-input bug — one-shot presses must accumulate in `pendingActions` until a step consumes them; do NOT repeat that bug).

## Screenshots (4, 1280×800, each ≤256 KiB, real renders, 0 console errors)
1. `1-start.jpg` — title screen with controls + drop button.
2. `2-play.jpg` — mid-game: player looting/fighting, HUD, alive count, storm visible.
3. `3-storm.jpg` — storm closing (player near the storm edge, zone timer prominent, action).
4. `4-end.jpg` — victory ("LAST ONE STANDING") or eliminated screen with placement + restart.
- **View each screenshot yourself.** If one looks weak/empty/washed out, fix it before pushing (LUMEN DRIFT's builder fixed 2 weak shots; do the same).

## Verification (all green before you report)
- `node --check` on every `.js` file.
- `node main.ts` with `MAKEFUN_OUTPUT_DIR=out` succeeds, writes `dossier.json`.
- Kit check: run `node cli/makefun.mjs check --repo <build dir>` — expect 0 failed (the only "fail" allowed is `transcripts_present`, which is the parent's bundle step).
- Headless playtest (puppeteer + Chrome + SwiftShader, same path as LUMEN DRIFT): all 4 shots `__shotReady` true, snapshots show live rounds, **0 console errors, 0 page errors**. Interactive run: move, shoot, pick up a weapon, take storm damage, eliminate at least 1 bot.
- **Deterministic captures:** `?shot=...&seed=1`, `window.__shotReady`, `window.__stormfall.snapshot()` (mirror LUMEN DRIFT's shots.js pattern).
- **Do NOT commit `out/`** — add `.gitignore` (out/, node_modules/, .DS_Store).

## Push + report (do NOT submit — bundling + submit are the parent's)
- Push ALL files to **Masasiya00/makefun-stormfall** via `github.py put-file` (POSITIONAL args: owner repo repo_path local_file [--message]; git push does NOT work — the local repo has no remote). Set repo About: homepage `https://make.fun/bounty/best-game-01`, topics `makefun,ai-agents,bounties,games`, description "STORMFALL — a top-down battle royale game. Built by an AI agent for make.fun's best-game-01 bounty."
- Report: remote HEAD sha, measured FPS + frame times, playtest results (kills, storm phases verified, bots eliminated each other), 0 console errors confirmation, and any bug found + fixed.

## Lessons from LUMEN DRIFT (same competition, submitted 2026-11-17 07:39 WIB)
- `stageShot` must set `screen='play'` or the loop runs the title branch (0 kills, 0 score).
- `endGame` must be module-level if called from module-level code (not a closure inside runGame).
- Space/confirm keys: screen transitions must eat the action so a start can't also fire the ability.
- Enemy wobble / any time-based motion must use the entity's accumulated time (seeded), NOT `performance.now()` (non-determinism).
- Bundle is the parent's job; the builder's session is bundled with `--muse-usage` from muse.db.
- The local repo and the remote can diverge in sha (put-file creates API commits) — the parent reconciles with `reset --hard origin/main` before submit; make sure the FILE CONTENT you push is final.

## v2 — realistic features (added 2026-11-17, all free/procedural)
User order: "tambahin fitur kaya container, mobil, sepeda motor, lapangan, pasir, efek suara perang, helikopter terbang". All 11 added, 0 cut:
1. Containers (solid cover, 4 colour clusters, minimap squares) — map.js.
2. Drivable cars (2, ~1.8x, driver 50% damage, 150 HP) — vehicles.js.
3. Drivable motorcycles (2, ~2.2x, rider exposed, 80 HP) — vehicles.js.
4. Fields + tall grass (hides fighters, bots lose sight >180px) — map.js.
5. Sand (0.9x slow, footstep dust) — map.js + particles.js.
6. War sounds (distant shots, explosions, rotor, footsteps, engine) — audio.js.
7. Helicopters + supply drops (every ~45-60s, parachute crate, toast + minimap diamond) — heli.js.
8. Muzzle flash + tracer + shell casings — weapons.js + particles.js + hud.js.
9. Hit-stop (~40ms on kill) + hitmarker + floating damage numbers — bullets.js + hud.js + main.js.
10. Damage falloff (full <150px, 50% at 400px+) + recoil bloom + camera kick — bullets.js + weapons.js.
11. Drifting smoke (expands, wind drift, fades) — smoke.js.
Verified: node --check all 21 .js files; kit check 13 passed / 0 failed (except transcripts_present = parent's step); headless playtest 0 console + 0 page errors; FPS 60.0 (avg 16.67ms, p95 16.7ms) x3 runs; mount/drive/dismount + heli drop + smoke drift verified live in the browser; all 4 screenshots re-taken seed=1 and viewed (containers, wreck, bike, gold SUPPLY crate all visible). One pre-existing HUD defect fixed in v2: the pickup toast panel (y 672-708) overlapped the KILLS/SMOKE/SCORE line (y 700) — the line now sits at y 664.
