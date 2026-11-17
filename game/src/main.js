// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The
// game moves between five screens: title, play, paused, victory and eliminated. Twelve drop
// in; the last one standing wins.
//
// ?seed=N fixes the pattern. ?shot=start|play|storm|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
// window.__stormfall.snapshot() reports the live state for automated playtests.
import { WORLD, VIEW, STEP, PLAYER } from './config.js';
import { PALETTE, BEST_KEY } from './palette.js';
import { createRandom } from './random.js';
import { createState } from './state.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_MUTE } from './input.js';
import { updatePlayer, startDrop } from './player.js';
import { spawnBots, updateBots } from './bots.js';
import { updateBullets, pushRadio } from './bullets.js';
import { spawnLoot, updateLoot } from './loot.js';
import { updateSmoke } from './smoke.js';
import { updateStorm } from './storm.js';
import { zoneAt, separateFighters } from './map.js';
import { updateParticles } from './particles.js';
import { unlockAudio, setMuted, isMuted, sfx } from './audio.js';
import { drawWorld, drawHUD, drawOverlay, drawTitle, drawPaused, drawVictory, drawEliminated, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER } from './hud.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const ctx = canvas.getContext('2d');
const state = createState(createRandom(seed));
const input = createInput(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best placement then lasts this visit only.
  }
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
}

// Size the canvas at boot (both modes): without this the canvas stays at its 300x150
// default and the browser stretches it, which zooms and clips everything.
window.addEventListener('resize', resize);
resize();

/** The camera follows the player, clamped so the 1280x800 viewport never leaves the
 * island. On the title it drifts slowly around the centre for the attract background. */
function updateCamera() {
  const p = state.player;
  let cx = p.x;
  let cy = p.y;
  if (state.screen === SCREEN_TITLE) {
    const a = state.titleDrift * 0.12;
    cx = WORLD.width / 2 + Math.cos(a) * 170;
    cy = WORLD.height / 2 + Math.sin(a * 0.8) * 120;
  }
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  state.camera.x = Math.max(VIEW.width / 2, Math.min(WORLD.width - VIEW.width / 2, cx));
  state.camera.y = Math.max(VIEW.height / 2, Math.min(WORLD.height - VIEW.height / 2, cy));
  state.camera.scale = scale;
  state.camera.ox = (window.innerWidth - VIEW.width * scale) / 2;
  state.camera.oy = (window.innerHeight - VIEW.height * scale) / 2;
}

function render() {
  updateCamera();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const s = state.camera.scale * dpr;
  const ox = state.camera.ox * dpr;
  const oy = state.camera.oy * dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = PALETTE.backdrop;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // World: the viewport's centre is the camera's centre, plus screen shake.
  const wx = ox + (VIEW.width / 2 - state.camera.x) * s + state.shakeX * s;
  const wy = oy + (VIEW.height / 2 - state.camera.y) * s + state.shakeY * s;
  ctx.setTransform(s, 0, 0, s, wx, wy);
  drawWorld(ctx, state);
  // HUD and screens live in the logical 1280x800 viewport.
  ctx.setTransform(s, 0, 0, s, ox, oy);
  if (state.screen === SCREEN_PLAY || state.screen === SCREEN_PAUSED) drawHUD(ctx, state);
  drawOverlay(ctx, state);
  if (state.screen === SCREEN_TITLE) drawTitle(ctx, state, state.best);
  else if (state.screen === SCREEN_PAUSED) drawPaused(ctx);
  else if (state.screen === SCREEN_OVER) {
    if (state.won) drawVictory(ctx, state);
    else drawEliminated(ctx, state);
  }
}

function announce(message) {
  status.textContent = message;
}

/** The match score: 100 per elimination, plus a placement bonus (500 for the win). */
function matchScore(kills, won, placement) {
  return kills * 100 + (won ? 500 : (12 - placement) * 50);
}

/** The match is over: victory (last one standing) or eliminated (a placement of 12). */
function endGame(won) {
  state.won = won;
  state.screen = SCREEN_OVER;
  const placement = won ? 1 : state.placement;
  const isNewBest = placement < state.best || state.best === 0;
  if (isNewBest) {
    state.best = placement;
    saveBest(state.best);
  }
  state.over = {
    placement,
    kills: state.player.kills,
    score: matchScore(state.player.kills, won, placement),
    time: Math.round(state.time),
    best: state.best,
    isNewBest,
  };
  if (won) sfx.victory();
  else sfx.defeat();
  announce(won ? `Victory! Last one standing. ${state.player.kills} eliminations.` : `Eliminated. Placement #${placement} of 12. ${state.player.kills} eliminations.`);
}

/** One fixed step of the world (used by the loop and by the screenshot stager). `actions`
 * is the frame's one-shot input, given to the first step only so a pickup/reload fires
 * exactly once. */
function stepWorld(actions) {
  state.time += STEP;
  state.flash = Math.max(0, state.flash - STEP * 1.8);
  if (state.banner) {
    state.banner.t -= STEP;
    if (state.banner.t <= 0) state.banner = null;
  }
  if (state.screen === SCREEN_TITLE) {
    // Attract mode: the island lives — bots loot, roam and skirmish behind the title.
    state.titleDrift += STEP;
    updateBots(state, STEP);
    separateFighters(state);
    updateBullets(state, STEP);
    updateLoot(state, STEP);
    updateSmoke(state, STEP);
    updateParticles(state, STEP);
    return;
  }
  if (state.screen !== SCREEN_PLAY) return;
  updatePlayer(state, STEP, input, actions);
  updateBots(state, STEP);
  separateFighters(state);
  updateBullets(state, STEP);
  updateLoot(state, STEP);
  updateSmoke(state, STEP);
  const stormEvent = updateStorm(state, STEP);
  if (stormEvent === 'shrink-start') {
    state.banner = { text: 'THE STORM IS CLOSING', t: 2.2, color: '#ff4d5e' };
    sfx.stormWarn();
    const alive = state.bots.filter((b) => b.alive);
    if (alive.length > 0) {
      const bot = alive[Math.floor(state.random() * alive.length)];
      const z = zoneAt(state.storm.cx, state.storm.cy);
      pushRadio(state, bot.name + ': storm closing, rotating to ' + (z ? z.name : 'the zone'));
    }
  } else if (stormEvent === 'phase') {
    state.banner = { text: 'ZONE SHRUNK — PHASE ' + Math.min(state.storm.phase + 1, 5), t: 2.2, color: '#e9d5ff' };
  }
  updateParticles(state, STEP);
  // Win / lose.
  if (!state.player.alive) {
    endGame(false);
  } else if (state.bots.every((b) => !b.alive)) {
    endGame(true);
  }
}

function snapshot() {
  const p = state.player;
  return {
    phase: state.screen,
    won: state.won,
    placement: state.placement,
    alive: state.alive,
    kills: state.kills,
    hp: Math.round(p.hp),
    shield: Math.round(p.shield),
    weapon: p.slots[p.slot],
    ammo: p['mag_' + p.slots[p.slot]] ?? 0,
    smoke: p.smoke,
    zone: (zoneAt(p.x, p.y) || {}).name || null,
    feed: state.feed.map((f) => f.text),
    stormPhase: state.storm.phase + 1,
    stormRadius: Math.round(state.storm.radius),
    stormCx: Math.round(state.storm.cx),
    stormCy: Math.round(state.storm.cy),
    stormMode: state.storm.mode,
    playerPos: [Math.round(p.x), Math.round(p.y)],
    botsAlive: state.bots.filter((b) => b.alive).length,
    time: Math.round(state.time * 100) / 100,
    muted: isMuted(),
  };
}
window.__stormfall = { snapshot };

function runShot(name) {
  const scene = stageShot(name, state, input, stepWorld);
  state.screen = scene.screen;
  if (scene.screen === SCREEN_OVER) {
    const won = !!scene.won;
    state.won = won;
    state.placement = won ? 1 : state.placement;
    const placement = won ? 1 : state.placement;
    const isNewBest = placement < state.best || state.best === 0;
    if (isNewBest) state.best = placement;
    state.over = {
      placement,
      kills: state.player.kills,
      score: matchScore(state.player.kills, won, placement),
      time: Math.round(state.time),
      best: state.best,
      isNewBest,
    };
  }
  let painted = 0;
  function paint() {
    render();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  state.best = readBest();
  // A living island behind the title: loot on the ground, bots already skirmishing.
  spawnLoot(state);
  spawnBots(state);
  let accumulator = 0;
  let last = performance.now();
  // One-shot presses accumulate here until a step or a screen transition consumes them:
  // taking them eagerly in the frame and dropping them when no fixed step runs that frame
  // would lose a pickup/reload pressed between steps, which reads as input lag.
  let pendingActions = 0;

  function startGame() {
    unlockAudio();
    const keepBest = state.best;
    const fresh = createState(createRandom(Math.floor(Math.random() * 4294967296)));
    Object.assign(state, fresh);
    state.best = keepBest;
    spawnLoot(state);
    const r = state.random;
    const tx = WORLD.width / 2 + (r() * 2 - 1) * 260;
    const ty = WORLD.height / 2 + (r() * 2 - 1) * 200;
    spawnBots(state, tx, ty);
    startDrop(state, tx, ty);
    state.screen = SCREEN_PLAY;
    accumulator = 0;
    announce('Dropped in. 12 combatants. Last one standing wins.');
  }

  // Consumes the bits it acts on; returns true on a screen transition (which eats the rest,
  // so a Space that starts the game cannot also fire on the first frame).
  function handleActions() {
    if (pendingActions & ACTION_MUTE) {
      pendingActions &= ~ACTION_MUTE;
      setMuted(!isMuted());
      announce(isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (state.screen === SCREEN_TITLE || state.screen === SCREEN_OVER) {
      if (pendingActions & ACTION_CONFIRM) {
        pendingActions = 0;
        startGame();
        return true;
      }
    } else if (state.screen === SCREEN_PLAY) {
      if (pendingActions & ACTION_PAUSE) {
        pendingActions = 0;
        state.screen = SCREEN_PAUSED;
        announce('Paused.');
        return true;
      }
    } else if (state.screen === SCREEN_PAUSED) {
      if (pendingActions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        pendingActions = 0;
        state.screen = SCREEN_PLAY;
        announce('Playing.');
        return true;
      }
    }
    return false;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    pendingActions |= input.takeActions();
    handleActions();
    if (state.screen === SCREEN_TITLE || state.screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP && (state.screen === SCREEN_TITLE || state.screen === SCREEN_PLAY)) {
        stepWorld(first ? pendingActions : 0);
        if (first) pendingActions = 0;
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    render();
  }

  // Leaving the tab pauses a running game rather than letting bots hunt unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === SCREEN_PLAY) {
      state.screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Stormfall. Click or press Space to drop in.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
