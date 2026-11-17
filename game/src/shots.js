// The screenshot scenes behind ?shot=start|play|storm|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (loot the nearest weapon, hunt the nearest bot, run for the zone, pick up when close),
// so the frame is what a short game really looks like and the same seed always gives the
// same frame. No wall-clock anywhere: the pilot and the world both run on the fixed step.
import { WORLD, STEP, WEAPONS } from './config.js';
import { ACTION_PICKUP, ACTION_RELOAD, ACTION_SMOKE } from './input.js';
import { currentWeapon, currentWeaponId } from './weapons.js';
import { spawnLoot, nearestWeapon } from './loot.js';
import { nearestVehicle, spawnVehicles } from './vehicles.js';
import { spawnBots } from './bots.js';
import { startDrop } from './player.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './hud.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 18;
/** Preferred fight distance per weapon: a scattergun wants to be close, a longshot far.
 * Kiting at a rifle's distance with a scattergun means never landing a shot. */
const FIGHT_RANGE = {
  pistol: [180, 320],
  scattergun: [100, 220],
  rifle: [280, 420],
  longshot: [400, 600],
};

/** Aim at a moving foe with a lead: the bullet takes foeD / bulletSpeed seconds to get
 * there, so aim where the foe will be, not where it is. Without this the autopilot's
 * shots trail every moving bot and almost never land. */
function aimAt(state, input, foe, def) {
  const d = Math.hypot(foe.x - state.player.x, foe.y - state.player.y);
  const lead = def ? d / def.speed : 0;
  input.setAimWorld(foe.x + foe.vx * lead, foe.y + foe.vy * lead);
}
/** The storm shot freezes mid-shrink (phase 2 closes at 53-65s): the purple wall is
 * visibly moving and the banner reads STORM CLOSING. A real moment, not a pose. */
const STORM_SECONDS = 58;
/** The end shot plays one real match to its real end (win or lose), however long it
 * takes, up to this cap. No gearing, no teleporting, no posing. */
const END_SECONDS = 300;

/** Drop the player and bots into a fresh match (loot, vehicles, bots, drop-in). */
function beginMatch(state) {
  spawnLoot(state);
  spawnVehicles(state);
  const r = state.random;
  const tx = WORLD.width / 2 + (r() * 2 - 1) * 260;
  const ty = WORLD.height / 2 + (r() * 2 - 1) * 200;
  spawnBots(state, tx, ty);
  startDrop(state, tx, ty);
}

/** The autopilot's move/aim/fire for one step. `aggressive` (the end shot's final fight)
 * chases the nearest bot and fires at any range instead of kiting and retreating. */
function autopilot(state, input, aggressive) {
  const p = state.player;
  if (!p.alive) {
    input.setMove(0, 0);
    input.setFiring(false);
    return;
  }
  if (p.dropping) {
    input.setMove(0, 0);
    input.setFiring(false);
    return;
  }
  const storm = state.storm;
  const distToEdge = storm.radius - Math.hypot(p.x - storm.cx, p.y - storm.cy);
  const outside = distToEdge < 0;
  // Sprint is off unless a branch below turns it on (the aggressive chase).
  input.setSprinting(null);

  // Nearest living bot.
  let foe = null;
  let foeD = Infinity;
  for (const b of state.bots) {
    if (!b.alive) continue;
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d < foeD) {
      foeD = d;
      foe = b;
    }
  }
  const def = currentWeapon(p);
  const armed = def !== null && currentWeaponId(p) !== 'pistol';
  const weakWeapon = !armed;

  // Goal: the storm first, then survival, then a fight, then loot. Hurt always wins
  // over aggression: a dying fighter that keeps charging in is a dead fighter.
  let gx = storm.cx;
  let gy = storm.cy;
  let wantFire = false;
  const hurt = p.hp < 60;
  if (outside || (storm.mode === 'shrink' && distToEdge < 90)) {
    gx = storm.cx;
    gy = storm.cy;
  } else if (hurt) {
    // Hurt: break off the fight, grab a medkit, or at least open distance. Throw
    // smoke to cover the retreat when a foe is close.
    if (p.smoke > 0 && foe && foeD < 300) {
      input.queueAction(ACTION_SMOKE);
    }
    let med = null;
    let medD = Infinity;
    for (const item of state.loot) {
      if (!item.alive || item.kind !== 'medkit') continue;
      const d = Math.hypot(item.x - p.x, item.y - p.y);
      if (d < medD) {
        medD = d;
        med = item;
      }
    }
    if (med) {
      gx = med.x;
      gy = med.y;
    } else if (foe) {
      // No medkit: run away from the foe, toward the zone.
      gx = p.x + (p.x - foe.x);
      gy = p.y + (p.y - foe.y);
    }
  } else if (aggressive && foe) {
    // Final fight: close in and finish it. Sprint to catch a runner — the last bot
    // will not stand still for a duel. No kiting, no retreat — unless outnumbered.
    input.setSprinting(true);
    let closeFoes = 0;
    for (const b of state.bots) {
      if (b.alive && Math.hypot(b.x - p.x, b.y - p.y) < 420) closeFoes += 1;
    }
    if (closeFoes >= 2) {
      gx = storm.cx;
      gy = storm.cy;
      aimAt(state, input, foe, def);
      wantFire = foeD < 300;
    } else {
      gx = foe.x;
      gy = foe.y;
      aimAt(state, input, foe, def);
      wantFire = !!def && foeD < Math.min(def.range, 520);
    }
  } else if (foe && foeD < 430 && def) {
    // Fight: aim at the foe, strafe sideways to dodge, fire in range. Kite at the
    // weapon's preferred distance — close for a scattergun, far for a longshot.
    // Outnumbered (2+ bots close): fall back toward the zone instead of fighting.
    let closeFoes = 0;
    for (const b of state.bots) {
      if (b.alive && Math.hypot(b.x - p.x, b.y - p.y) < 420) closeFoes += 1;
    }
    if (closeFoes >= 2) {
      gx = storm.cx;
      gy = storm.cy;
      aimAt(state, input, foe, def);
      wantFire = foeD < 300;
    } else {
      aimAt(state, input, foe, def);
      wantFire = foeD < Math.min(def.range, 460);
      const side = Math.sin(state.time * 2.2) > 0 ? 1 : -1;
      const px = -(foe.y - p.y);
      const py = foe.x - p.x;
      const pl = Math.hypot(px, py) || 1;
      const [lo, hi] = FIGHT_RANGE[currentWeaponId(p)] || [200, 400];
      const approach = foeD > hi ? 0.8 : foeD < lo ? -0.9 : 0;
      gx = p.x + (px / pl) * side * 140 + (foe.x - p.x) * approach;
      gy = p.y + (py / pl) * side * 140 + (foe.y - p.y) * approach;
    }
  } else if (weakWeapon) {
    const w = nearestWeapon(state, p, 800);
    if (w) {
      gx = w.x;
      gy = w.y;
    } else if (foe) {
      gx = foe.x;
      gy = foe.y;
    }
  } else if (p.hp < 70) {
    // Bruised: top up with a medkit when one is near, else keep hunting.
    let med = null;
    let medD = Infinity;
    for (const item of state.loot) {
      if (!item.alive || item.kind !== 'medkit') continue;
      const d = Math.hypot(item.x - p.x, item.y - p.y);
      if (d < medD) {
        medD = d;
        med = item;
      }
    }
    if (med && medD < 500) {
      gx = med.x;
      gy = med.y;
    } else if (foe) {
      gx = foe.x;
      gy = foe.y;
      aimAt(state, input, foe, def);
    }
  } else if (foe) {
    gx = foe.x;
    gy = foe.y;
    aimAt(state, input, foe, def);
  }
  // Keep inside the island and drift toward the middle near the edges.
  if (p.x < 150 || p.x > WORLD.width - 150 || p.y < 150 || p.y > WORLD.height - 150) {
    gx = WORLD.width / 2;
    gy = WORLD.height / 2;
  }
  input.setMove(gx - p.x, gy - p.y);
  if (!foe || foeD >= 430) {
    input.setAimWorld(gx, gy);
  }
  input.setFiring(wantFire);
  // A vehicle on the way is worth mounting: drive it toward the goal instead of
  // walking. (This is a real play choice, not staging — the pilot only takes a car
  // it actually passes.) Once mounted, the same move vector steers the vehicle.
  if (!p.vehicle) {
    const veh = nearestVehicle(state, p, 200);
    if (veh) {
      input.setMove(veh.x - p.x, veh.y - p.y);
      if (Math.hypot(veh.x - p.x, veh.y - p.y) < 66) input.queueAction(ACTION_PICKUP);
    }
  }
  // Pick up a weapon underfoot; reload when the magazine is dry. (While mounted,
  // E is the exit key, so the pilot never queues a pickup from the driver's seat.)
  const near = !p.vehicle ? nearestWeapon(state, p, 56) : null;
  if (near) input.queueAction(ACTION_PICKUP);
  const mag = def ? p['mag_' + currentWeaponId(p)] ?? WEAPONS[currentWeaponId(p)].mag : 0;
  if (def && mag <= 0 && !p.reloading) input.queueAction(ACTION_RELOAD);
}

/**
 * Set `state` to the named scene (start, play, storm or end; any other name is start) and
 * return the screen to draw over it. `step` is main.js's single fixed-step function, given
 * the frame's one-shot input each call.
 */
export function stageShot(name, state, input, step) {
  if (name === 'play' || name === 'storm' || name === 'end') {
    // The world only advances the play rules while the screen is 'play' — set it before
    // stepping, or the loop runs the title attract branch and nothing spawns or fights.
    state.screen = SCREEN_PLAY;
    beginMatch(state);
    if (name === 'end') {
      // One real match to its real end: survive the early game (loot, position), then
      // hunt the survivors down. Win or lose, the frame is what actually happened.
      for (let i = 0; i < END_SECONDS / STEP; i += 1) {
        if (!state.player.alive) break;
        if (state.bots.every((b) => !b.alive)) break;
        autopilot(state, input, state.time > 30);
        step(input.takeActions());
      }
    } else {
      const limit = name === 'play' ? PLAY_SECONDS : STORM_SECONDS;
      for (let i = 0; i < limit / STEP; i += 1) {
        if (!state.player.alive) break;
        autopilot(state, input);
        step(input.takeActions());
      }
    }
    const over = !state.player.alive;
    const won = state.player.alive && state.bots.every((b) => !b.alive);
    return { screen: over || won ? SCREEN_OVER : SCREEN_PLAY, won };
  }
  // Title: an attract mode — bots loot and skirmish across a living island behind the panel.
  state.screen = SCREEN_TITLE;
  spawnLoot(state);
  spawnVehicles(state);
  spawnBots(state);
  state.player.invuln = 999;
  for (let i = 0; i < START_SECONDS / STEP; i += 1) step(0);
  state.player.invuln = 0;
  return { screen: SCREEN_TITLE };
}
