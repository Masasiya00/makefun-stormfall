// Loot: weapons, medkits, shield cells and ammo scattered on the island, plus the crates
// that hold them. Walking over a consumable picks it up; weapons need E (or a bot's brain).
// Loot drops from a defeated fighter too, so a fight is always worth something.
import { WORLD, LOOT, WEAPON_ORDER, WEAPONS, CRATE } from './config.js';
import { range, pick } from './random.js';
import { giveWeapon, giveAmmo } from './weapons.js';
import { floatText, burst } from './particles.js';
import { sfx } from './audio.js';

function freeSpot(state, x, y) {
  if (x < 100 || x > WORLD.width - 100 || y < 100 || y > WORLD.height - 100) return false;
  for (const o of state.island.obstacles) {
    if (o.kind === 'tree' || o.kind === 'rock') {
      if (Math.hypot(x - o.x, y - o.y) < o.r + 30) return false;
    } else if (o.kind === 'wall') {
      if (x > o.x - 30 && x < o.x + o.w + 30 && y > o.y - 30 && y < o.y + o.h + 30) return false;
    }
  }
  return true;
}

function randomSpot(state) {
  for (let i = 0; i < 40; i += 1) {
    const x = range(state.random, 110, WORLD.width - 110);
    const y = range(state.random, 110, WORLD.height - 110);
    if (freeSpot(state, x, y)) return { x, y };
  }
  return { x: WORLD.width / 2, y: WORLD.height / 2 };
}

export function spawnLoot(state) {
  const r = state.random;
  // Ground weapons: rifles and scatterguns common, longshots rare.
  for (let i = 0; i < LOOT.weaponsOnGround; i += 1) {
    const roll = r();
    const id = roll < 0.42 ? 'rifle' : roll < 0.78 ? 'scattergun' : roll < 0.93 ? 'pistol' : 'longshot';
    const spot = randomSpot(state);
    state.loot.push({ kind: 'weapon', id, x: spot.x, y: spot.y, alive: true, bob: r() * Math.PI * 2 });
  }
  for (let i = 0; i < LOOT.medkits; i += 1) {
    const spot = randomSpot(state);
    state.loot.push({ kind: 'medkit', id: 'medkit', x: spot.x, y: spot.y, alive: true, bob: r() * Math.PI * 2 });
  }
  for (let i = 0; i < LOOT.shieldCells; i += 1) {
    const spot = randomSpot(state);
    state.loot.push({ kind: 'shield', id: 'shield', x: spot.x, y: spot.y, alive: true, bob: r() * Math.PI * 2 });
  }
  for (let i = 0; i < LOOT.ammoBoxes; i += 1) {
    const spot = randomSpot(state);
    const id = pick(r, ['scattergun', 'rifle', 'longshot']);
    state.loot.push({ kind: 'ammo', id, x: spot.x, y: spot.y, alive: true, bob: r() * Math.PI * 2 });
  }
  for (let i = 0; i < LOOT.smokeBombs; i += 1) {
    const spot = randomSpot(state);
    state.loot.push({ kind: 'smoke', id: 'smoke', x: spot.x, y: spot.y, alive: true, bob: r() * Math.PI * 2 });
  }
}

/** A defeated fighter drops their best weapon and some ammo where they fell. */
export function dropLoot(state, fighter) {
  const best = fighter.slots[fighter.slot] || fighter.slots[0] || fighter.slots[1];
  if (best && best !== 'pistol') {
    state.loot.push({ kind: 'weapon', id: best, x: fighter.x + 12, y: fighter.y, alive: true, bob: 0 });
  }
  if (state.random() < 0.6) {
    state.loot.push({ kind: 'medkit', id: 'medkit', x: fighter.x - 14, y: fighter.y + 8, alive: true, bob: 0 });
  }
}

/** Break a crate open: it spills a weapon and a consumable. */
export function breakCrate(state, crate) {
  crate.alive = false;
  const r = state.random;
  const id = r() < 0.5 ? 'rifle' : r() < 0.8 ? 'scattergun' : 'longshot';
  state.loot.push({ kind: 'weapon', id, x: crate.x - 26, y: crate.y, alive: true, bob: 0 });
  const kind = r() < 0.5 ? 'medkit' : 'shield';
  state.loot.push({ kind, id: kind, x: crate.x + 26, y: crate.y, alive: true, bob: 0 });
  burst(state, crate.x, crate.y, '#b45309', 14, 220, 0.5, 4);
  floatText(state, crate.x, crate.y - 24, 'CRATE!', '#ffd75e');
}

/** Walk-over pickup for consumables; weapons are picked up with E (see takeNearestWeapon). */
export function updateLoot(state, dt) {
  for (const item of state.loot) {
    if (!item.alive) continue;
    item.bob += dt * 3;
    const fighters = [state.player, ...state.bots];
    for (const f of fighters) {
      if (!f.alive || f.dropping) continue;
      if (item.kind === 'weapon') continue;
      if (Math.hypot(f.x - item.x, f.y - item.y) > 34) continue;
      if (item.kind === 'medkit') {
        if (f.hp >= 100) continue;
        f.hp = Math.min(100, f.hp + 50);
        item.alive = false;
        if (f.isPlayer) {
          floatText(state, f.x, f.y - 26, '+50 HP', '#4ade80');
          sfx.pickup();
        }
      } else if (item.kind === 'shield') {
        if (f.shield >= 100) continue;
        f.shield = Math.min(100, f.shield + 50);
        item.alive = false;
        if (f.isPlayer) {
          floatText(state, f.x, f.y - 26, '+50 SHIELD', '#60a5fa');
          sfx.pickup();
        }
      } else if (item.kind === 'ammo') {
        const def = WEAPONS[item.id];
        if (!def || def.reserve === Infinity) continue;
        if ((f.ammo[item.id] || 0) >= def.reserve) continue;
        giveAmmo(f, item.id, def.pickupAmmo);
        item.alive = false;
        if (f.isPlayer) {
          floatText(state, f.x, f.y - 26, '+' + def.pickupAmmo + ' ' + def.name.toUpperCase(), '#fbbf24');
          sfx.pickup();
        }
      } else if (item.kind === 'smoke') {
        if (f.smoke >= 3) continue;
        f.smoke += 1;
        item.alive = false;
        if (f.isPlayer) {
          floatText(state, f.x, f.y - 26, '+1 SMOKE', '#d1d5db');
          sfx.pickup();
        }
      }
    }
  }
}

/** The nearest live weapon loot within reach of a fighter (for E pickup / bot brains). */
export function nearestWeapon(state, fighter, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const item of state.loot) {
    if (!item.alive || item.kind !== 'weapon') continue;
    const d = Math.hypot(fighter.x - item.x, fighter.y - item.y);
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return best;
}

/** Pick up the nearest weapon in reach. Returns the weapon id taken, or null. */
export function takeNearestWeapon(state, fighter) {
  const item = nearestWeapon(state, fighter, 56);
  if (!item) return null;
  const replaced = giveWeapon(fighter, item.id);
  const def = WEAPONS[item.id];
  giveAmmo(fighter, item.id, def.pickupAmmo);
  // A replaced weapon drops on the ground where the fighter stands.
  if (replaced) {
    state.loot.push({ kind: 'weapon', id: replaced, x: fighter.x + 18, y: fighter.y + 10, alive: true, bob: 0 });
  }
  item.alive = false;
  if (fighter.isPlayer) {
    // A compact toast by the weapon slots (drawn in the HUD), NOT a floating banner
    // over the play area: a big gold "SCATTERGUN!" above the fighter reads as a garbled
    // banner and covers the action. The toast fades on its own in updateParticles.
    state.pickupToast = { text: def.name.toUpperCase(), t: 1.6, maxT: 1.6 };
    sfx.pickup();
  }
  return item.id;
}

export { CRATE };
