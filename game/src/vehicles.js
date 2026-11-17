// Vehicles: drivable cars and motorcycles. The player mounts with E near one,
// drives with WASD (W forward, S reverse, A/D steer), Shift boosts, E again to
// get out. A car shields its driver (half damage); a bike leaves the rider fully
// exposed but is faster. Enough bullets destroy a vehicle: it explodes, leaves a
// wreck as cover, and ejects the driver. Bots ignore vehicles (player-only) —
// they steer around a parked one like any obstacle.
import { WORLD, VEHICLES, PLAYER } from './config.js';
import { range } from './random.js';
import { collideObstacles, isColliding } from './map.js';
import { burst, floatText, addShake } from './particles.js';
import { damageFighter } from './bullets.js';
import { sfx } from './audio.js';

/** Spawn the vehicles: one car near the drop centre (so the screenshot autopilot can
 * genuinely find one), the rest near named places. Never inside an obstacle. */
export function spawnVehicles(state) {
  const r = state.random;
  const spots = [
    { kind: 'car', x: WORLD.width / 2 + 170, y: WORLD.height / 2 + 120 },
    { kind: 'car', x: 250, y: 1080 },
    { kind: 'bike', x: 1340, y: 200 },
    { kind: 'bike', x: 1180, y: 900 },
  ];
  for (const spot of spots) {
    let x = spot.x;
    let y = spot.y;
    for (let tries = 0; tries < 20; tries += 1) {
      const cx = spot.x + range(r, -60, 60);
      const cy = spot.y + range(r, -60, 60);
      if (!isColliding(state.island, cx, cy, VEHICLES[spot.kind].radius + 8)) {
        x = cx;
        y = cy;
        break;
      }
    }
    const def = VEHICLES[spot.kind];
    state.vehicles.push({
      kind: spot.kind,
      x,
      y,
      angle: r() * Math.PI * 2,
      speed: 0,
      hp: def.hp,
      maxHp: def.hp,
      alive: true,
      driver: null,
      wreck: false,
    });
  }
}

/** The nearest live, driverless vehicle within mount range of a fighter. */
export function nearestVehicle(state, fighter, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const v of state.vehicles) {
    if (!v.alive || v.driver) continue;
    const d = Math.hypot(fighter.x - v.x, fighter.y - v.y);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

/** Mount (or dismount) a vehicle. Returns the vehicle mounted, or null. */
export function toggleVehicle(state, fighter) {
  if (fighter.vehicle) {
    dismount(state, fighter);
    return null;
  }
  const v = nearestVehicle(state, fighter, VEHICLES.mountRadius);
  if (!v) return null;
  v.driver = fighter;
  fighter.vehicle = v;
  fighter.x = v.x;
  fighter.y = v.y;
  fighter.vx = 0;
  fighter.vy = 0;
  if (fighter.isPlayer) {
    state.pickupToast = { text: VEHICLES[v.kind].name.toUpperCase() + ' — SHIFT BOOST · E EXIT', t: 2.2, maxT: 2.2 };
    sfx.engineStart();
  }
  return v;
}

function dismount(state, fighter) {
  const v = fighter.vehicle;
  if (!v) return;
  v.driver = null;
  fighter.vehicle = null;
  // Step out to the side of the vehicle, clear of obstacles.
  const a = v.angle + Math.PI / 2;
  fighter.x = v.x + Math.cos(a) * (VEHICLES[v.kind].radius + 18);
  fighter.y = v.y + Math.sin(a) * (VEHICLES[v.kind].radius + 18);
  fighter.vx = 0;
  fighter.vy = 0;
  if (fighter.isPlayer) sfx.engineStop();
}

/** Drive the player's vehicle for one step (called from updatePlayer when mounted).
 * The move vector is a world-space direction (WASD, or the autopilot's goal): the
 * vehicle steers toward that heading and drives, reversing when the goal is behind. */
export function driveVehicle(state, fighter, dt, input) {
  const v = fighter.vehicle;
  if (!v || !v.alive) {
    if (fighter.vehicle) {
      fighter.vehicle = null;
      if (fighter.isPlayer) sfx.engineStop();
    }
    return;
  }
  const def = VEHICLES[v.kind];
  const move = input.move();
  const boosting = input.isSprinting();
  // Steer toward the held direction: turn the nose toward it, drive forward when it
  // is ahead, reverse when it is behind. No input means coast to a stop.
  let target = 0;
  if (move.x !== 0 || move.y !== 0) {
    const desired = Math.atan2(move.y, move.x);
    let diff = desired - v.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turnStep = def.turn * dt;
    v.angle += Math.max(-turnStep, Math.min(turnStep, diff));
    const ahead = Math.cos(diff);
    if (ahead > 0.3) target = def.speed * (boosting ? def.boostMult : 1);
    else if (ahead < -0.7) target = -def.speed * 0.45;
  }
  const accel = def.accel * dt;
  if (v.speed < target) v.speed = Math.min(target, v.speed + accel);
  else if (v.speed > target) v.speed = Math.max(target, v.speed - accel * 1.6);
  const nx = v.x + Math.cos(v.angle) * v.speed * dt;
  const ny = v.y + Math.sin(v.angle) * v.speed * dt;
  // Slide along obstacles like a fighter does (a vehicle is a big circle).
  const r = collideObstacles(state.island, nx, ny, def.radius);
  if (!r.hit) {
    v.x = nx;
    v.y = ny;
  } else {
    v.x = r.x;
    v.y = r.y;
    v.speed *= 0.4;
  }
  v.x = Math.max(70, Math.min(WORLD.width - 70, v.x));
  v.y = Math.max(70, Math.min(WORLD.height - 70, v.y));
  fighter.x = v.x;
  fighter.y = v.y;
  fighter.angle = v.angle;
  fighter.vx = Math.cos(v.angle) * v.speed;
  fighter.vy = Math.sin(v.angle) * v.speed;
  // Dust kicked up behind a moving vehicle on sand; engine hum follows speed.
  if (Math.abs(v.speed) > 60 && fighter.isPlayer) {
    sfx.engine(Math.abs(v.speed) / def.speed, boosting);
    if (state.random() < 0.35) {
      burst(state, v.x - Math.cos(v.angle) * def.radius, v.y - Math.sin(v.angle) * def.radius, '#c9a86a', 1, 40, 0.5, 3);
    }
  }
}

/** Push a fighter out of every live vehicle (bots and on-foot players walk around a
 * parked car instead of through it). The driver is skipped: they sit in it. */
export function collideVehicles(state, fighter) {
  if (fighter.vehicle) return;
  for (const v of state.vehicles) {
    if (!v.alive) continue;
    const def = VEHICLES[v.kind];
    const dx = fighter.x - v.x;
    const dy = fighter.y - v.y;
    const d = Math.hypot(dx, dy);
    const min = def.radius + fighter.radius - 4;
    if (d < min && d > 0.001) {
      const push = min - d;
      fighter.x += (dx / d) * push;
      fighter.y += (dy / d) * push;
    }
  }
}

/** True when the bullet segment hits a live vehicle; returns it (or null). */
export function bulletHitsVehicle(state, x1, y1, x2, y2) {
  for (const v of state.vehicles) {
    if (!v.alive) continue;
    const def = VEHICLES[v.kind];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((v.x - x1) * dx + (v.y - y1) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    if (Math.hypot(v.x - px, v.y - py) < def.radius) return v;
  }
  return null;
}

/** A bullet hit a vehicle: damage the vehicle, and its driver takes a share
 * (half in a car, full on a bike). Returns true when the bullet stops here. */
export function damageVehicle(state, vehicle, amount, from) {
  if (!vehicle.alive) return false;
  vehicle.hp -= amount;
  burst(state, vehicle.x, vehicle.y, '#fbbf24', 3, 120, 0.25, 3);
  const driver = vehicle.driver;
  if (driver && driver.alive) {
    const cover = VEHICLES[vehicle.kind].driverCover;
    damageFighter(state, driver, amount * (1 - cover), from);
  }
  if (vehicle.hp <= 0) destroyVehicle(state, vehicle);
  return true;
}

/** A vehicle blows up: explosion, smoke, a wreck that stays as cover, driver ejected. */
export function destroyVehicle(state, vehicle) {
  if (!vehicle.alive) return;
  vehicle.alive = false;
  burst(state, vehicle.x, vehicle.y, '#ff9a3d', 26, 380, 0.8, 5);
  burst(state, vehicle.x, vehicle.y, '#f8fafc', 10, 220, 0.5, 4);
  burst(state, vehicle.x, vehicle.y, '#1f2937', 14, 160, 1.1, 6);
  addShake(state, 10);
  sfx.explosion();
  const driver = vehicle.driver;
  if (driver) {
    driver.vehicle = null;
    vehicle.driver = null;
    driver.x = vehicle.x + 30;
    driver.y = vehicle.y + 30;
    if (driver.isPlayer) sfx.engineStop();
  }
  // The wreck stays as a solid rect (like a container) — cover, not scenery.
  const w = vehicle.kind === 'car' ? 52 : 40;
  state.island.obstacles.push({
    kind: 'wreck',
    x: vehicle.x - w / 2,
    y: vehicle.y - 18,
    w,
    h: 36,
    color: '#3f3f46',
    seed: 0,
  });
  floatText(state, vehicle.x, vehicle.y - 34, 'WRECKED!', '#ff9a3d');
}

/** Draw the vehicles (live ones with their wheels and roof; wrecks as burnt shells). */
export function drawVehicles(ctx, state) {
  for (const v of state.vehicles) {
    if (!v.alive) continue;
    const def = VEHICLES[v.kind];
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);
    if (v.kind === 'car') {
      // Shadow, body, roof, windows, wheels.
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(2, 4, 30, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = v.alive ? '#dc2626' : '#3f3f46';
      ctx.beginPath();
      ctx.roundRect(-28, -15, 56, 30, 8);
      ctx.fill();
      ctx.fillStyle = v.alive ? '#991b1b' : '#27272a';
      ctx.beginPath();
      ctx.roundRect(-12, -11, 24, 22, 5);
      ctx.fill();
      ctx.fillStyle = 'rgba(186, 230, 253, 0.85)';
      ctx.fillRect(8, -9, 8, 18);
      ctx.fillStyle = '#111827';
      ctx.fillRect(-24, -19, 12, 7);
      ctx.fillRect(-24, 12, 12, 7);
      ctx.fillRect(12, -19, 12, 7);
      ctx.fillRect(12, 12, 12, 7);
      if (v.alive) {
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.arc(28, -8, 3, 0, Math.PI * 2);
        ctx.arc(28, 8, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Bike: two wheels, frame, seat, handlebar.
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(2, 3, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(-14, 0, 8, 0, Math.PI * 2);
      ctx.arc(14, 0, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = v.alive ? '#f59e0b' : '#3f3f46';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(2, -4);
      ctx.lineTo(14, 0);
      ctx.moveTo(2, -4);
      ctx.lineTo(6, -9);
      ctx.stroke();
      ctx.fillStyle = '#111827';
      ctx.fillRect(-2, -12, 10, 4);
    }
    ctx.restore();
    // Vehicle HP bar (only when hurt, so an untouched car stays clean).
    if (v.alive && v.hp < v.maxHp) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(v.x - 22, v.y - def.radius - 12, 44, 5);
      ctx.fillStyle = v.hp > v.maxHp * 0.4 ? '#4ade80' : '#ef4444';
      ctx.fillRect(v.x - 22, v.y - def.radius - 12, 44 * Math.max(0, v.hp / v.maxHp), 5);
      ctx.restore();
    }
  }
  // Wrecks (drawn live, since they were added after the terrain was baked).
  for (const o of state.island.obstacles) {
    if (o.kind !== 'wreck') continue;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(o.x + 2, o.y + 3, o.w, o.h);
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 2;
    ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
    ctx.fillStyle = 'rgba(255, 154, 61, 0.5)';
    ctx.fillRect(o.x + 6, o.y + 6, o.w - 12, 4);
    ctx.restore();
  }
}

export { PLAYER };
