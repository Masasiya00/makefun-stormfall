// The 11 bots: they drop in, loot, roam, hunt the nearest enemy and flee the storm.
// Each bot re-thinks every 0.4 s (a reaction time a human can beat), aims with a seeded
// error, and fights other bots as well as the player — so the alive count falls on its
// own and the kill feed tells a real story. Bots also talk: tactical callouts (loot,
// contact, storm rotation) go to the radio feed, named and placed, so the match reads
// like a squad game, not a silent arena.
import { WORLD, PLAYER, BOT_NAMES, BOT_COLORS, WEAPONS } from './config.js';
import { createFighter } from './state.js';
import { moveFighter, zoneAt } from './map.js';
import { outsideStorm } from './storm.js';
import { currentWeapon, currentWeaponId, startReload, finishReload, tryFire } from './weapons.js';
import { nearestWeapon, takeNearestWeapon } from './loot.js';
import { damageFighter, pushRadio } from './bullets.js';
import { throwSmoke, smokeBlocks } from './smoke.js';
import { drawFighterBody } from './player.js';
import { range } from './random.js';

const THINK_INTERVAL = 0.6;
const HUNT_RANGE = 400;
const LOOT_RANGE = 700;

export function spawnBots(state, avoidX, avoidY) {
  const r = state.random;
  for (let i = 0; i < BOT_NAMES.length; i += 1) {
    // Bots never drop on top of the player: keep them clear of the landing spot.
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 30; tries += 1) {
      x = range(r, 140, WORLD.width - 140);
      y = range(r, 140, WORLD.height - 140);
      if (avoidX === undefined || Math.hypot(x - avoidX, y - avoidY) >= 420) break;
    }
    const bot = createFighter(BOT_NAMES[i], BOT_COLORS[i], x, y, false);
    bot.brain = 'loot';
    bot.thinkTimer = r() * THINK_INTERVAL;
    bot.roamX = x;
    bot.roamY = y;
    state.bots.push(bot);
    // Bots drop in like the player: a short glide from above.
    bot.dropping = true;
    bot.dropTimer = 0;
    bot.dropFromX = x;
    bot.dropFromY = Math.max(80, y - 260);
    bot.dropToX = x;
    bot.dropToY = y;
    bot.invuln = 1.2;
  }
}

/** Nearest living enemy of a fighter (the player counts as an enemy for bots).
 * Smoke breaks line of sight: a target behind a cloud is not a target at all. */
function nearestEnemy(state, me) {
  let best = null;
  let bestD = Infinity;
  const targets = [state.player, ...state.bots];
  for (const t of targets) {
    if (!t.alive || t === me || t.dropping) continue;
    if (smokeBlocks(state, me.x, me.y, t.x, t.y)) continue;
    const d = Math.hypot(t.x - me.x, t.y - me.y);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best ? { target: best, dist: bestD } : null;
}

/** A bot's tactical callout on the radio feed, rate-limited per bot so the feed
 * stays readable. `zoneName` is the place the callout is about. */
function say(state, bot, text) {
  if (bot.calloutTimer > 0) return;
  bot.calloutTimer = 8 + state.random() * 6;
  pushRadio(state, bot.name + ': ' + text);
}

/** The place name for a point, for callouts ("at Ember Docks", "near Glass Field"). */
function placeAt(x, y) {
  const z = zoneAt(x, y);
  return z ? z.name : 'open ground';
}

export function updateBots(state, dt) {
  for (const bot of state.bots) {
    if (!bot.alive) continue;
    bot.wobble += dt;
    bot.hurtFlash = Math.max(0, bot.hurtFlash - dt);
    bot.invuln = Math.max(0, bot.invuln - dt);
    bot.fireTimer = Math.max(0, bot.fireTimer - dt);
    bot.calloutTimer = Math.max(0, bot.calloutTimer - dt);
    bot.smokeCooldown = Math.max(0, bot.smokeCooldown - dt);

    // Drop-in glide.
    if (bot.dropping) {
      bot.dropTimer += dt;
      const t = Math.min(1, bot.dropTimer / PLAYER.dropTime);
      const e = t * t * (3 - 2 * t);
      bot.x = bot.dropFromX + (bot.dropToX - bot.dropFromX) * e;
      bot.y = bot.dropFromY + (bot.dropToY - bot.dropFromY) * e;
      if (t >= 1) bot.dropping = false;
      continue;
    }

    // Storm damage.
    if (outsideStorm(state, bot.x, bot.y) && state.storm.dps > 0) {
      damageFighter(state, bot, state.storm.dps * dt, null);
      if (!bot.alive) continue;
    }

    // Think: pick a goal every 0.4 s.
    bot.thinkTimer -= dt;
    if (bot.thinkTimer <= 0) {
      bot.thinkTimer = THINK_INTERVAL;
      think(state, bot);
    }

    // Smoke breaks the hunt now, not at the next think: a bot that keeps running at a
    // target it can no longer see walks straight through the cloud and re-acquires it.
    // Drop the hunt the frame the sight line dies, and re-think immediately.
    if (bot.brain === 'hunt' && bot.target && bot.target.alive && smokeBlocks(state, bot.x, bot.y, bot.target.x, bot.target.y)) {
      bot.brain = 'loot';
      bot.target = null;
      bot.thinkTimer = 0;
    }

    // Steer toward the goal.
    let gx = bot.roamX;
    let gy = bot.roamY;
    if (bot.brain === 'flee') {
      gx = state.storm.cx;
      gy = state.storm.cy;
    } else if (bot.brain === 'hunt' && bot.target && bot.target.alive) {
      // Hold a fighting distance (~200px): close in when far, back off when too
      // close. A hunt is a gunfight at range, not a point-blank execution — at 30px
      // the aim error means nothing and a bot dies in two seconds.
      const td = Math.hypot(bot.target.x - bot.x, bot.target.y - bot.y);
      if (td > 240) {
        gx = bot.target.x;
        gy = bot.target.y;
      } else if (td < 160) {
        gx = bot.x + (bot.x - bot.target.x);
        gy = bot.y + (bot.y - bot.target.y);
      } else {
        gx = bot.x;
        gy = bot.y;
      }
    } else if (bot.brain === 'loot' && bot.target) {
      gx = bot.target.x;
      gy = bot.target.y;
    }
    const dx = gx - bot.x;
    const dy = gy - bot.y;
    const d = Math.hypot(dx, dy);
    const speed = PLAYER.maxSpeed * 0.86;
    if (d > 8) {
      bot.vx += (dx / d) * PLAYER.accel * 0.8 * dt;
      bot.vy += (dy / d) * PLAYER.accel * 0.8 * dt;
    }
    const damp = Math.max(0, 1 - PLAYER.friction * dt);
    bot.vx *= damp;
    bot.vy *= damp;
    const v = Math.hypot(bot.vx, bot.vy);
    if (v > speed) {
      bot.vx = (bot.vx / v) * speed;
      bot.vy = (bot.vy / v) * speed;
    }
    moveFighter(state.island, bot, bot.vx * dt, bot.vy * dt);
    bot.x = Math.max(60, Math.min(WORLD.width - 60, bot.x));
    bot.y = Math.max(60, Math.min(WORLD.height - 60, bot.y));

    // Aim: at the hunted enemy, else along the move direction.
    if (bot.brain === 'hunt' && bot.target && bot.target.alive) {
      bot.angle = Math.atan2(bot.target.y - bot.y, bot.target.x - bot.x);
    } else if (v > 20) {
      bot.angle = Math.atan2(bot.vy, bot.vx);
    }

    // Reload.
    if (bot.reloading) {
      bot.reloadTimer -= dt;
      if (bot.reloadTimer <= 0) {
        bot.reloading = false;
        finishReload(bot);
      }
    }

    // Pick up a weapon underfoot; a good pickup is worth a callout.
    if (bot.brain === 'loot') {
      const got = takeNearestWeapon(state, bot);
      if (got && state.random() < 0.5) {
        say(state, bot, 'got a ' + WEAPONS[got].name + ' at ' + placeAt(bot.x, bot.y));
      }
    }

    // Hurt and holding smoke: throw it between self and the hunter, then break off.
    if (bot.hp < 40 && bot.smoke > 0 && bot.smokeCooldown <= 0 && bot.target && bot.target.alive) {
      bot.angle = Math.atan2(bot.target.y - bot.y, bot.target.x - bot.x);
      if (throwSmoke(state, bot)) {
        bot.smokeCooldown = 8;
        bot.brain = 'flee';
        bot.target = null;
      }
    }

    // Fire at the hunted enemy when in range and roughly lined up.
    if (bot.brain === 'hunt' && bot.target && bot.target.alive) {
      const def = currentWeapon(bot);
      if (def) {
        const td = Math.hypot(bot.target.x - bot.x, bot.target.y - bot.y);
        if (td < Math.min(def.range, HUNT_RANGE)) {
          // Bots aim with a real error that grows at range: a distant bot misses most
          // shots, a close one is dangerous. This keeps fights winnable, not a laser show.
          const err = (state.random() * 2 - 1) * 0.28;
          if (tryFire(state, bot, bot.angle + err)) {
            // Fired.
          } else if (bot['mag_' + currentWeaponId(bot)] <= 0 && !bot.reloading) {
            startReload(bot);
          }
        }
      } else {
        // Unarmed: close in to loot instead.
        bot.brain = 'loot';
      }
    }
  }
}

/** One think step: storm first, then the nearest enemy, then the nearest loot. */
function think(state, bot) {
  // Outside the storm (or about to be): run for the zone.
  if (outsideStorm(state, bot.x, bot.y)) {
    if (bot.brain !== 'flee') {
      say(state, bot, 'storm closing, rotating to ' + placeAt(state.storm.cx, state.storm.cy));
    }
    bot.brain = 'flee';
    bot.target = null;
    return;
  }
  const storm = state.storm;
  const distToEdge = storm.radius - Math.hypot(bot.x - storm.cx, bot.y - storm.cy);
  if (storm.mode === 'shrink' && distToEdge < 120) {
    if (bot.brain !== 'flee') {
      say(state, bot, 'storm closing, rotating to ' + placeAt(state.storm.cx, state.storm.cy));
    }
    bot.brain = 'flee';
    bot.target = null;
    return;
  }
  // An enemy close enough to fight. A bot with only a pistol does not go looking for
  // a fight — it loots first. With a real weapon it hunts inside 400px; with a pistol
  // it only fights when the enemy is right on top of it. This keeps the early game a
  // loot race, not a deathmatch, so the match lasts past the first minute.
  const found = nearestEnemy(state, bot);
  const armed = currentWeapon(bot) !== null;
  const goodWeapon = currentWeaponId(bot) !== 'pistol';
  if (armed && found && (found.dist < 200 || (goodWeapon && found.dist < 300))) {
    if (bot.brain !== 'hunt') {
      const who = found.target.isPlayer ? 'you' : found.target.name;
      say(state, bot, 'contact — ' + who + ' near ' + placeAt(found.target.x, found.target.y));
    }
    bot.brain = 'hunt';
    bot.target = found.target;
    return;
  }
  // Otherwise loot: the nearest weapon, or a roam point near the zone.
  const weapon = nearestWeapon(state, bot, LOOT_RANGE);
  if (weapon) {
    bot.brain = 'loot';
    bot.target = weapon;
    return;
  }
  bot.brain = 'roam';
  bot.target = null;
  // Roam anywhere on the island, not just the centre: bots spread out, so the player
  // meets them one at a time instead of walking into a crowd.
  const a = state.random() * Math.PI * 2;
  const r = 120 + state.random() * 520;
  bot.roamX = Math.max(90, Math.min(WORLD.width - 90, WORLD.width / 2 + Math.cos(a) * r));
  bot.roamY = Math.max(90, Math.min(WORLD.height - 90, WORLD.height / 2 + Math.sin(a) * r));
  if (state.random() < 0.4) {
    say(state, bot, 'rotating to ' + placeAt(bot.roamX, bot.roamY));
  }
}

export function drawBots(ctx, state) {
  for (const bot of state.bots) {
    if (!bot.alive) continue;
    drawFighterBody(ctx, bot, state.time);
  }
}
