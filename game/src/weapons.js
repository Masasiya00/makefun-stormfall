// Weapons: definitions live in config.js; here is firing, reloading and swapping. A
// fighter holds two slots; slot 0 starts as a pistol. Ammo is per weapon type; the pistol
// never runs dry, the rest do. All fire goes through the shared bullet pool.
import { WEAPONS } from './config.js';
import { burst, spawnCasing, addShake } from './particles.js';
import { sfx } from './audio.js';

export function weaponDef(id) {
  return WEAPONS[id];
}

export function currentWeapon(fighter) {
  const id = fighter.slots[fighter.slot];
  return id ? WEAPONS[id] : null;
}

export function currentWeaponId(fighter) {
  return fighter.slots[fighter.slot];
}

/** Give a fighter a weapon: fill an empty slot, else replace the current slot (dropping
 * the old one as loot is the caller's job). Returns the replaced weapon id or null. */
export function giveWeapon(fighter, id) {
  if (fighter.slots[0] === id || fighter.slots[1] === id) return null;
  if (!fighter.slots[0]) {
    fighter.slots[0] = id;
    fighter.slot = 0;
    fighter.reloadTimer = 0;
    fighter.reloading = false;
    return null;
  }
  if (!fighter.slots[1]) {
    fighter.slots[1] = id;
    fighter.slot = 1;
    fighter.reloadTimer = 0;
    fighter.reloading = false;
    return null;
  }
  const replaced = fighter.slots[fighter.slot];
  fighter.slots[fighter.slot] = id;
  fighter.reloadTimer = 0;
  fighter.reloading = false;
  return replaced;
}

/** Add reserve ammo for a weapon (pistol is infinite, so nothing to add). */
export function giveAmmo(fighter, id, amount) {
  if (id === 'pistol') return;
  fighter.ammo[id] = Math.min(WEAPONS[id].reserve, (fighter.ammo[id] || 0) + amount);
}

/** Start a reload if the magazine is not full and reserve ammo exists. */
export function startReload(fighter) {
  const def = currentWeapon(fighter);
  if (!def || fighter.reloading) return;
  const id = currentWeaponId(fighter);
  const mag = fighter['mag_' + id] ?? def.mag;
  if (mag >= def.mag) return;
  if (def.reserve !== Infinity && (fighter.ammo[id] || 0) <= 0) return;
  fighter.reloading = true;
  fighter.reloadTimer = def.reload;
}

/** Finish a reload: move reserve rounds into the magazine. */
export function finishReload(fighter) {
  const def = currentWeapon(fighter);
  if (!def) return;
  const id = currentWeaponId(fighter);
  const mag = fighter['mag_' + id] ?? def.mag;
  const need = def.mag - mag;
  if (need <= 0) return;
  if (def.reserve === Infinity) {
    fighter['mag_' + id] = def.mag;
  } else {
    const take = Math.min(need, fighter.ammo[id] || 0);
    fighter['mag_' + id] = mag + take;
    fighter.ammo[id] = (fighter.ammo[id] || 0) - take;
  }
}

/** Fire one trigger pull: spawn pellets into the bullet pool. Returns true if a shot left.
 * A dry weapon falls back to the pistol sidearm first, so a fighter is never stuck
 * with an empty gun in the final zone — the match always ends. */
export function tryFire(state, fighter, angle) {
  switchToSidearm(fighter);
  const def = currentWeapon(fighter);
  if (!def || fighter.reloading || fighter.fireTimer > 0) return false;
  const id = currentWeaponId(fighter);
  let mag = fighter['mag_' + id];
  if (mag === undefined) {
    mag = def.mag;
    fighter['mag_' + id] = mag;
  }
  if (mag <= 0) {
    startReload(fighter);
    return false;
  }
  fighter['mag_' + id] = mag - 1;
  fighter.fireTimer = 1 / def.fireRate;
  const pellets = def.pellets || 1;
  // Aim bloom: rapid fire widens the spread, so holding the trigger is a choice,
  // not a free laser. Bloom decays in the fighter's step (player.js / bots.js).
  const spread = def.spread * (1 + (fighter.bloom || 0));
  fighter.bloom = Math.min(1.2, (fighter.bloom || 0) + (def.auto ? 0.09 : 0.16));
  for (let i = 0; i < pellets; i += 1) {
    const a = angle + (state.random() * 2 - 1) * spread;
    const b = spawnBullet(state, fighter);
    if (!b) break;
    const mx = fighter.x + Math.cos(angle) * (fighter.radius + 6);
    const my = fighter.y + Math.sin(angle) * (fighter.radius + 6);
    b.x = mx;
    b.y = my;
    b.vx = Math.cos(a) * def.speed;
    b.vy = Math.sin(a) * def.speed;
    b.radius = id === 'longshot' ? 5 : 4;
    b.damage = def.damage;
    b.range = def.range;
    b.traveled = 0;
    b.owner = fighter;
    b.fromPlayer = fighter.isPlayer;
    b.color = def.color;
    b.alive = true;
    b.px = mx;
    b.py = my;
  }
  // Recoil kick, muzzle flash, shell casing, sound. The flash is a short-lived
  // pre-rendered glow at the muzzle (no shadowBlur in the hot loop); the casing
  // ejects sideways and bounces off the ground.
  fighter.vx -= Math.cos(angle) * def.kick * 0.12;
  fighter.vy -= Math.sin(angle) * def.kick * 0.12;
  const mx = fighter.x + Math.cos(angle) * (fighter.radius + 8);
  const my = fighter.y + Math.sin(angle) * (fighter.radius + 8);
  burst(state, mx, my, def.color, 3, 120, 0.14, 3);
  burst(state, mx, my, '#ffffff', 1, 60, 0.06, 13);
  spawnCasing(state, fighter.x, fighter.y, angle);
  if (fighter.isPlayer) {
    addShake(state, 1.6);
    sfx.shoot(id);
  }
  return true;
}

/** True when the current weapon has no rounds left anywhere (mag + reserve both 0). */
export function weaponDry(fighter) {
  const id = currentWeaponId(fighter);
  if (!id) return false;
  const def = WEAPONS[id];
  if (def.reserve === Infinity) return false;
  return (fighter['mag_' + id] ?? def.mag) <= 0 && (fighter.ammo[id] || 0) <= 0;
}

/** Switch to the pistol sidearm when the current weapon is dry. Returns true on a switch. */
export function switchToSidearm(fighter) {
  if (!weaponDry(fighter)) return false;
  for (let i = 0; i < fighter.slots.length; i += 1) {
    if (fighter.slots[i] === 'pistol') {
      fighter.slot = i;
      fighter.reloading = false;
      fighter.reloadTimer = 0;
      return true;
    }
  }
  return false;
}

function spawnBullet(state, fighter) {
  for (const b of state.bullets) {
    if (!b.alive) return b;
  }
  return null;
}
