// Bullets: one fixed pool, reused. A bullet flies until it runs out of range, hits an
// obstacle, or hits a fighter. Damage goes to shield first, then health. Killing a bot
// (or the player) is reported back so the kill feed and placement stay honest.
import { PLAYER } from './config.js';
import { segmentBlocked } from './map.js';
import { burst, floatText, addShake } from './particles.js';
import { dropLoot, breakCrate } from './loot.js';
import { bulletHitsVehicle, damageVehicle } from './vehicles.js';
import { sfx } from './audio.js';

/** Damage falloff: full damage inside 30% of the weapon's range, fading to half
 * at 90% of range. A longshot keeps its punch far out; a scattergun does not. */
export function falloff(damage, traveled, range) {
  if (traveled < range * 0.3) return damage;
  if (traveled >= range * 0.9) return damage * 0.5;
  const t = (traveled - range * 0.3) / (range * 0.6);
  return damage * (1 - 0.5 * t);
}

export function updateBullets(state, dt) {
  for (const b of state.bullets) {
    if (!b.alive) continue;
    b.px = b.x;
    b.py = b.y;
    const nx = b.x + b.vx * dt;
    const ny = b.y + b.vy * dt;
    b.traveled += Math.hypot(b.vx * dt, b.vy * dt);
    if (b.traveled >= b.range) {
      b.alive = false;
      continue;
    }
    if (segmentBlocked(state.island, b.x, b.y, nx, ny)) {
      burst(state, nx, ny, '#9ca3af', 4, 90, 0.25, 2.5);
      b.alive = false;
      continue;
    }
    b.x = nx;
    b.y = ny;
    // Vehicles stop bullets too (and their drivers take a share of the hit).
    const vehicle = bulletHitsVehicle(state, b.px, b.py, b.x, b.y);
    if (vehicle) {
      damageVehicle(state, vehicle, falloff(b.damage, b.traveled, b.range), b.owner);
      b.alive = false;
      continue;
    }
    // Crates stop bullets too.
    let stopped = false;
    for (const crate of state.crates) {
      if (!crate.alive) continue;
      if (Math.hypot(b.x - crate.x, b.y - crate.y) < 22 + b.radius) {
        crate.hp -= 1;
        burst(state, b.x, b.y, '#b45309', 5, 120, 0.3, 3);
        if (crate.hp <= 0) {
          breakCrate(state, crate);
          if (b.fromPlayer) sfx.crate();
        }
        b.alive = false;
        stopped = true;
        break;
      }
    }
    if (stopped) continue;
    // Fighters: anyone but the owner.
    const targets = [state.player, ...state.bots];
    for (const f of targets) {
      if (!f.alive || f === b.owner || f.dropping || f.invuln > 0) continue;
      if (Math.hypot(b.x - f.x, b.y - f.y) > f.radius + b.radius) continue;
      const dealt = damageFighter(state, f, falloff(b.damage, b.traveled, b.range), b.owner);
      burst(state, b.x, b.y, f.isPlayer ? '#4de8ff' : '#ff5d73', 6, 160, 0.3, 3);
      // The player's hit, confirmed: a crosshair hitmarker plus the damage number.
      if (b.fromPlayer) {
        state.hitmark = { x: b.x, y: b.y, t: 0.22, maxT: 0.22 };
        if (dealt > 0) floatText(state, f.x, f.y - 30, '-' + Math.round(dealt), '#ffd75e');
      }
      b.alive = false;
      break;
    }
  }
}

/** Apply damage to a fighter (shield first). `from` is the shooter, for the kill feed.
 * Bots are tuned for the human: a bot's shot lands softer (x0.6 on the player, x0.45
 * on another bot), so a fight the player walks into is winnable instead of a laser
 * show, and the bots do not slaughter each other in the first minute — the match
 * should last past the storm's middle phases. Returns the damage actually dealt
 * (after the bot scaling), so the hit feedback can show an honest number. */
export function damageFighter(state, fighter, amount, from) {
  if (!fighter.alive) return 0;
  if (from && !from.isPlayer) {
    amount *= fighter.isPlayer ? 0.6 : 0.45;
  }
  const dealt = amount;
  let left = amount;
  if (fighter.shield > 0) {
    const absorbed = Math.min(fighter.shield, left);
    fighter.shield -= absorbed;
    left -= absorbed;
  }
  fighter.hp -= left;
  fighter.hurtFlash = 0.25;
  if (fighter.isPlayer) {
    addShake(state, 5);
    state.flash = 0.28;
    state.flashColor = '#ff4d5e';
    sfx.hurt();
  } else if (from && from.isPlayer) {
    sfx.hit();
  }
  if (fighter.hp <= 0) {
    fighter.hp = 0;
    fighter.alive = false;
    eliminateFighter(state, fighter, from);
  }
  return dealt;
}

/** A fighter goes down: feed, placement, loot drop, particles, and (for the player) the end. */
export function eliminateFighter(state, fighter, from) {
  const killer = from && from !== fighter ? from : null;
  if (killer) killer.kills += 1;
  if (fighter.isPlayer) {
    state.kills = fighter.kills;
  } else if (killer && killer.isPlayer) {
    state.kills = killer.kills;
  }
  burst(state, fighter.x, fighter.y, fighter.color, 22, 300, 0.7, 5);
  burst(state, fighter.x, fighter.y, '#ffffff', 8, 180, 0.4, 3);
  const name = fighter.isPlayer ? 'You' : fighter.name;
  const by = killer ? (killer.isPlayer ? 'You' : killer.name) : 'the storm';
  // A kill from far out is a longshot: it earns a tag in the feed.
  const dist = killer ? Math.hypot(killer.x - fighter.x, killer.y - fighter.y) : 0;
  const tag = killer && dist > 350 ? ' — LONGSHOT' : '';
  pushFeed(state, `${name} eliminated by ${by}${tag}`, killer && killer.isPlayer ? '#ffd75e' : '#ff8fa3');
  if (tag && killer && killer.isPlayer) {
    floatText(state, fighter.x, fighter.y - 30, 'LONGSHOT!', '#ffd75e');
  }
  if (killer && killer.isPlayer) {
    floatText(state, fighter.x, fighter.y - 30, 'ELIMINATED', '#ffd75e');
    sfx.elim();
    // Hit-stop: the sim freezes for a beat on the kill, so it lands heavy.
    state.hitStop = 0.045;
  }
  dropLoot(state, fighter);
  state.alive = 1 + state.bots.filter((b) => b.alive).length;
  if (fighter.isPlayer) {
    state.placement = state.alive + 1;
  }
}

/** Add a line to the kill feed (newest first, at most 6 kept). */
export function pushFeed(state, text, color) {
  state.feed.unshift({ text, color: color || '#eef4ff', t: 0, ttl: 8 });
  if (state.feed.length > 6) state.feed.pop();
}

/** A radio callout on the same feed (cyan, shorter life): bot comms, not a kill. */
export function pushRadio(state, text) {
  state.feed.unshift({ text, color: '#7dd3fc', t: 0, ttl: 6 });
  if (state.feed.length > 6) state.feed.pop();
}

export { PLAYER };
