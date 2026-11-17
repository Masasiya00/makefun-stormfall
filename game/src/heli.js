// Helicopters and supply drops. Every so often a helicopter crosses the island
// (ambient — it cannot be shot down) and drops one supply crate on a parachute.
// The crate lands with a thud and dust, then behaves like a loot crate with better
// contents. A "SUPPLY DROP INCOMING" toast and a gold minimap marker announce it.
import { WORLD, HELI } from './config.js';
import { range } from './random.js';
import { burst, floatText } from './particles.js';
import { sfx } from './audio.js';

/** Advance the helicopter clock: spawn one when the timer runs out. */
export function updateHeli(state, dt) {
  if (state.heli) {
    const h = state.heli;
    h.t += dt;
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    h.rotor += dt;
    // Rotor sound: a low whump whose volume follows the distance to the player.
    h.soundTimer -= dt;
    if (h.soundTimer <= 0) {
      h.soundTimer = 0.45;
      const d = Math.hypot(state.player.x - h.x, state.player.y - h.y);
      sfx.rotor(Math.max(0, 1 - d / 900));
    }
    // Drop the crate halfway across.
    if (!h.dropped && h.t / h.duration >= HELI.dropAt) {
      h.dropped = true;
      state.drops.push({
        x: h.x,
        y: h.y,
        fall: 0,
        landed: false,
        bob: 0,
      });
      state.supplyToast = { text: 'SUPPLY DROP INCOMING', t: 3.5, maxT: 3.5 };
      sfx.supplyWarn();
    }
    // Off the far edge: gone, clock resets for the next one.
    if (h.t >= h.duration) {
      state.heli = null;
      state.heliTimer = range(state.random, HELI.nextMin, HELI.nextMax);
    }
    return;
  }
  state.heliTimer -= dt;
  if (state.heliTimer <= 0) {
    // A straight crossing: enter one edge, leave the opposite, slightly diagonal.
    const horizontal = state.random() < 0.5;
    const fromLeft = state.random() < 0.5;
    const fromTop = state.random() < 0.5;
    let x;
    let y;
    let vx;
    let vy;
    if (horizontal) {
      x = fromLeft ? -80 : WORLD.width + 80;
      y = range(state.random, 200, WORLD.height - 200);
      vx = (fromLeft ? 1 : -1) * HELI.speed;
      vy = range(state.random, -30, 30);
    } else {
      x = range(state.random, 200, WORLD.width - 200);
      y = fromTop ? -80 : WORLD.height + 80;
      vx = range(state.random, -30, 30);
      vy = (fromTop ? 1 : -1) * HELI.speed;
    }
    const duration = (horizontal ? WORLD.width + 160 : WORLD.height + 160) / HELI.speed;
    state.heli = { x, y, vx, vy, t: 0, duration, dropped: false, rotor: 0, soundTimer: 0 };
  }
}

/** Falling crates: parachute down, land with a thud + dust, then sit as a supply
 * crate (a loot crate with better contents) until someone breaks it open. */
export function updateDrops(state, dt) {
  for (let i = state.drops.length - 1; i >= 0; i -= 1) {
    const d = state.drops[i];
    d.bob += dt;
    if (!d.landed) {
      d.fall += dt;
      d.y += HELI.crateFall * dt;
      // Drift a little with the wind while it falls.
      d.x += state.wind.x * 0.4 * dt;
      if (d.fall > 2.2) {
        d.landed = true;
        burst(state, d.x, d.y, '#c9a86a', 12, 150, 0.6, 4);
        burst(state, d.x, d.y, '#f8fafc', 6, 100, 0.4, 3);
        sfx.explosion();
        // A landed drop becomes a loot crate (hp 3) with supply contents.
        state.crates.push({ x: d.x, y: d.y, hp: 3, alive: true, supply: true });
        state.drops.splice(i, 1);
      }
    }
  }
  if (state.supplyToast) {
    state.supplyToast.t -= dt;
    if (state.supplyToast.t <= 0) state.supplyToast = null;
  }
}

/** Draw the helicopter (shadow, body, tail, spinning rotor blur) and falling crates. */
export function drawHeli(ctx, state) {
  const h = state.heli;
  if (h) {
    const angle = Math.atan2(h.vy, h.vx);
    ctx.save();
    // Ground shadow, offset down-right (the sun is high, the chopper is high).
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(h.x + 26, h.y + 34, 34, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(h.x, h.y);
    ctx.rotate(angle);
    // Rotor blur: two crossing translucent discs, spinning with the rotor phase.
    ctx.save();
    ctx.rotate(h.rotor * 9);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(-46, -3, 92, 6);
    ctx.fillRect(-3, -46, 6, 92);
    ctx.restore();
    // Tail boom + body + cockpit.
    ctx.fillStyle = '#374151';
    ctx.fillRect(-34, -4, 26, 8);
    ctx.fillStyle = '#4b5563';
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.ellipse(14, 0, 9, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(186, 230, 253, 0.9)';
    ctx.beginPath();
    ctx.ellipse(16, 0, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Falling supply crates: canopy + crate, swaying gently.
  for (const d of state.drops) {
    const sway = Math.sin(d.bob * 2.4) * 10;
    ctx.save();
    ctx.translate(d.x + sway, d.y);
    // Parachute canopy.
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(0, -34, 22, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-20, -34);
    ctx.lineTo(-8, -8);
    ctx.moveTo(20, -34);
    ctx.lineTo(8, -8);
    ctx.moveTo(0, -56);
    ctx.lineTo(0, -8);
    ctx.stroke();
    // The crate itself.
    ctx.fillStyle = '#92400e';
    ctx.fillRect(-14, -10, 28, 28);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-11, -7, 22, 22);
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.strokeRect(-11, -7, 22, 22);
    ctx.fillStyle = '#78350f';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SUPPLY', 0, -14);
    ctx.restore();
  }
}
