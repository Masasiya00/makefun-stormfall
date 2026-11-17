// The player: WASD movement with acceleration and friction, Shift sprint on stamina,
// drop-in glide at the start, weapon switching (1/2), reload (R), pickup (E), and storm
// damage over time. One-shot presses arrive as ACTION_* flags, accumulated by the loop
// until a step consumes them, so a press between steps is never lost.
import { WORLD, PLAYER, TERRAIN } from './config.js';
import { moveFighter, terrainAt } from './map.js';
import { outsideStorm } from './storm.js';
import { currentWeapon, currentWeaponId, startReload, finishReload, tryFire } from './weapons.js';
import { takeNearestWeapon } from './loot.js';
import { throwSmoke } from './smoke.js';
import { damageFighter } from './bullets.js';
import { driveVehicle, toggleVehicle, collideVehicles } from './vehicles.js';
import { floatText, burst } from './particles.js';
import { sfx } from './audio.js';
import { ACTION_RELOAD, ACTION_PICKUP, ACTION_SLOT1, ACTION_SLOT2, ACTION_SMOKE } from './input.js';

/** The drop-in glide: the player descends from the sky edge to the landing spot. */
export function startDrop(state, toX, toY) {
  const p = state.player;
  const a = state.random() * Math.PI * 2;
  p.dropFromX = WORLD.width / 2 + Math.cos(a) * 620;
  p.dropFromY = WORLD.height / 2 + Math.sin(a) * 480;
  p.dropFromX = Math.max(80, Math.min(WORLD.width - 80, p.dropFromX));
  p.dropFromY = Math.max(80, Math.min(WORLD.height - 80, p.dropFromY));
  p.dropToX = toX;
  p.dropToY = toY;
  p.x = p.dropFromX;
  p.y = p.dropFromY;
  p.dropping = true;
  p.dropTimer = 0;
  // Spawn protection lasts past the landing so a bot cannot spawn-camp the drop.
  p.invuln = PLAYER.dropTime + 2.0;
}

/** One fixed step of the player. `actions` is the frame's one-shot input. */
export function updatePlayer(state, dt, input, actions) {
  const p = state.player;
  if (!p.alive) return;
  p.wobble += dt;
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.fireTimer = Math.max(0, p.fireTimer - dt);
  // Aim bloom decays when not firing (a burst, then a pause, is accurate again).
  p.bloom = Math.max(0, (p.bloom || 0) - dt * 1.6);

  // Drop-in: glide toward the landing spot, no control, no fire.
  if (p.dropping) {
    p.dropTimer += dt;
    const t = Math.min(1, p.dropTimer / PLAYER.dropTime);
    const e = t * t * (3 - 2 * t);
    p.x = p.dropFromX + (p.dropToX - p.dropFromX) * e;
    p.y = p.dropFromY + (p.dropToY - p.dropFromY) * e;
    if (t >= 1) {
      p.dropping = false;
      floatText(state, p.x, p.y - 30, 'DROPPED IN', '#4de8ff');
    }
    return;
  }

  // Aim follows the mouse (in world coordinates, via the camera).
  const aim = input.aimWorld(state.camera);
  p.angle = Math.atan2(aim.y - p.y, aim.x - p.x);

  // Driving: the vehicle steers instead of the legs. E gets out; firing still works
  // from the driver's seat (a drive-by is fair game — the driver is exposed).
  if (p.vehicle) {
    if (actions & ACTION_PICKUP) toggleVehicle(state, p);
    if (p.vehicle) {
      driveVehicle(state, p, dt, input);
      if (actions & ACTION_SMOKE) throwSmoke(state, p);
      // Fire from the driver's seat.
      const def = currentWeapon(p);
      if (def) {
        const wantFire = def.auto ? input.isFiring() : input.consumeFireEdge();
        if (wantFire) {
          if (tryFire(state, p, p.angle)) {
            // Fired.
          } else if (p['mag_' + currentWeaponId(p)] <= 0 && !p.reloading) {
            startReload(p);
          }
        }
      }
      if (p.reloading) {
        p.reloadTimer -= dt;
        if (p.reloadTimer <= 0) {
          p.reloading = false;
          finishReload(p);
          sfx.reload();
        }
      }
    }
    // Storm damage over time outside the safe zone (drivers are not exempt).
    if (outsideStorm(state, p.x, p.y) && state.storm.dps > 0) {
      const before = p.hp + p.shield;
      damageFighter(state, p, state.storm.dps * dt, null);
      if (Math.floor(before) !== Math.floor(p.hp + p.shield) && p.alive) {
        sfx.stormHit();
      }
    }
    return;
  }

  // Move: acceleration toward the held direction, friction when idle. Shift sprints.
  const move = input.move();
  const wantSprint = input.isSprinting() && (move.x !== 0 || move.y !== 0) && p.stamina > 1;
  p.sprinting = wantSprint;
  if (wantSprint) {
    p.stamina = Math.max(0, p.stamina - PLAYER.sprintDrain * dt);
  } else {
    p.stamina = Math.min(PLAYER.staminaMax, p.stamina + PLAYER.sprintRegen * dt);
  }
  // Sand slows a fighter down; tall grass does not, it hides instead.
  const ground = terrainAt(state.island, p.x, p.y);
  const groundMult = ground === 'sand' ? TERRAIN.sandSlow : 1;
  const speed = PLAYER.maxSpeed * (wantSprint ? PLAYER.sprintMult : 1) * groundMult;
  p.vx += move.x * PLAYER.accel * dt;
  p.vy += move.y * PLAYER.accel * dt;
  const damp = Math.max(0, 1 - PLAYER.friction * dt);
  p.vx *= damp;
  p.vy *= damp;
  const v = Math.hypot(p.vx, p.vy);
  if (v > speed) {
    p.vx = (p.vx / v) * speed;
    p.vy = (p.vy / v) * speed;
  }
  moveFighter(state.island, p, p.vx * dt, p.vy * dt);
  collideVehicles(state, p);
  p.x = Math.max(60, Math.min(WORLD.width - 60, p.x));
  p.y = Math.max(60, Math.min(WORLD.height - 60, p.y));

  // Footsteps: a soft thud and a dust puff on sand, paced by speed.
  if (v > 60) {
    p.stepTimer -= dt * (v / PLAYER.maxSpeed);
    if (p.stepTimer <= 0) {
      p.stepTimer = 0.34;
      sfx.step(ground);
      if (ground === 'sand') {
        burst(state, p.x, p.y + 10, '#c9a86a', 1, 30, 0.45, 3);
      }
    }
  }

  // One-shot actions. E mounts a nearby vehicle first (a car is worth more than
  // the rifle lying under it); otherwise it picks up the nearest weapon.
  if (actions & ACTION_RELOAD) startReload(p);
  if (actions & ACTION_PICKUP) {
    if (!toggleVehicle(state, p)) takeNearestWeapon(state, p);
  }
  if (actions & ACTION_SMOKE) throwSmoke(state, p);
  if (actions & ACTION_SLOT1 && p.slots[0]) {
    p.slot = 0;
    p.reloading = false;
    p.reloadTimer = 0;
  }
  if (actions & ACTION_SLOT2 && p.slots[1]) {
    p.slot = 1;
    p.reloading = false;
    p.reloadTimer = 0;
  }

  // Reload progress.
  if (p.reloading) {
    p.reloadTimer -= dt;
    if (p.reloadTimer <= 0) {
      p.reloading = false;
      finishReload(p);
      sfx.reload();
    }
  }

  // Fire while held (auto weapons) or on click (semi-auto handled by the input edge).
  const def = currentWeapon(p);
  if (def) {
    const wantFire = def.auto ? input.isFiring() : input.consumeFireEdge();
    if (wantFire) {
      if (tryFire(state, p, p.angle)) {
        // Fired.
      } else if (p['mag_' + currentWeaponId(p)] <= 0 && !p.reloading) {
        startReload(p);
      }
    }
  }

  // Storm damage over time outside the safe zone.
  if (outsideStorm(state, p.x, p.y) && state.storm.dps > 0) {
    const before = p.hp + p.shield;
    damageFighter(state, p, state.storm.dps * dt, null);
    if (Math.floor(before) !== Math.floor(p.hp + p.shield) && p.alive) {
      sfx.stormHit();
    }
    if (!p.alive) {
      // The storm got the last hit: the feed already says "by the storm".
    }
  }
}

export function drawPlayer(ctx, state) {
  const p = state.player;
  if (!p.alive) return;
  drawFighterBody(ctx, p, state.time);
}

/** Shared fighter rendering: glow, directional body, gun barrel, health bar, name. */
export function drawFighterBody(ctx, f, time) {
  const bob = Math.sin(f.wobble * 6) * 1.5;
  ctx.save();
  ctx.translate(f.x, f.y + bob * 0.3);
  // Glow.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = f.dropping ? 0.25 : 0.5;
  ctx.fillStyle = f.color;
  ctx.beginPath();
  ctx.arc(0, 0, f.radius + 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Parachute ring while dropping.
  if (f.dropping) {
    ctx.save();
    ctx.strokeStyle = f.color;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -10, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-14, -24);
    ctx.lineTo(0, 0);
    ctx.lineTo(14, -24);
    ctx.stroke();
    ctx.restore();
  }
  // Body: a directional wedge with a bright core.
  ctx.save();
  ctx.rotate(f.angle);
  ctx.fillStyle = f.color;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -12);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-10, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(2, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  // Gun barrel.
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(8, -2.5, 18, 5);
  ctx.restore();
  // Hurt flash.
  if (f.hurtFlash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.7, f.hurtFlash * 2.4);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, f.radius + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Health bar above (bots and the player alike).
  const w = 36;
  const pct = Math.max(0, f.hp / PLAYER.hpMax);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(-w / 2, -f.radius - 14, w, 5);
  ctx.fillStyle = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#fbbf24' : '#ef4444';
  ctx.fillRect(-w / 2, -f.radius - 14, w * pct, 5);
  if (f.shield > 0) {
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(-w / 2, -f.radius - 19, w * (f.shield / PLAYER.shieldMax), 3);
  }
  // Name (dark outline first, so it never bleeds into a bright label or the HUD).
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(f.name, 0, -f.radius - 24);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText(f.name, 0, -f.radius - 24);
  ctx.restore();
}
