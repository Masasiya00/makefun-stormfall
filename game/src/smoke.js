// Smoke: a thrown canister that blooms into a grey cloud no one can see through.
// Bots lose their target through smoke, so it is a real escape tool, not a visual:
// throw it (Q), break line of sight, and reposition while the other side is blind.
import { SMOKE } from './config.js';
import { glowSprite } from './sprites.js';
import { floatText, burst } from './particles.js';
import { sfx } from './audio.js';

/** Throw a smoke bomb from a fighter, landing ahead of their aim. Returns true on a throw. */
export function throwSmoke(state, fighter) {
  if (!fighter.alive || fighter.dropping || fighter.smoke <= 0) return false;
  fighter.smoke -= 1;
  const x = fighter.x + Math.cos(fighter.angle) * SMOKE.throwDist;
  const y = fighter.y + Math.sin(fighter.angle) * SMOKE.throwDist;
  state.smokes.push({
    x: Math.max(60, Math.min(1540, x)),
    y: Math.max(60, Math.min(1140, y)),
    // The cloud blooms from a tight puff to full size, drifts with the wind, and
    // thins out as it dies — a living screen, not a painted circle.
    r: SMOKE.radius * 0.55,
    rMax: SMOKE.radius * 1.35,
    vx: state.wind.x,
    vy: state.wind.y,
    life: SMOKE.life,
    maxLife: SMOKE.life,
    seed: state.random(),
  });
  burst(state, x, y, '#d1d5db', 10, 120, 0.4, 3);
  if (fighter.isPlayer) {
    floatText(state, fighter.x, fighter.y - 30, 'SMOKE!', '#d1d5db');
    sfx.pickup();
  }
  return true;
}

/** Age the clouds: they drift with the wind, expand, and fade. Dead ones leave the list. */
export function updateSmoke(state, dt) {
  for (let i = state.smokes.length - 1; i >= 0; i -= 1) {
    const c = state.smokes[i];
    c.life -= dt;
    if (c.life <= 0) {
      state.smokes.splice(i, 1);
      continue;
    }
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    // Bloom: grow toward full size over the first two seconds, then hold.
    const grow = Math.min(1, (c.maxLife - c.life) / 2);
    c.r = SMOKE.radius * 0.55 + (c.rMax - SMOKE.radius * 0.55) * grow;
  }
}

/** True when the segment from (x1,y1) to (x2,y2) passes through any smoke cloud. */
export function smokeBlocks(state, x1, y1, x2, y2) {
  for (const c of state.smokes) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((c.x - x1) * dx + (c.y - y1) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    if (Math.hypot(c.x - px, c.y - py) < c.r) return true;
  }
  return false;
}

/** Draw the clouds over the fighters (so a hidden fighter is really hidden), under the bullets. */
export function drawSmoke(ctx, state) {
  if (state.smokes.length === 0) return;
  const sprite = glowSprite('#9ca3af', SMOKE.radius);
  ctx.save();
  for (const c of state.smokes) {
    // Fade out over the last two seconds of life; full strength while blooming.
    const a = Math.min(0.62, (c.life / c.maxLife) * 0.7, Math.min(1, c.life / 2) * 0.62);
    ctx.globalAlpha = Math.max(0, a);
    // Three offset blobs per cloud, scaled to the cloud's current radius, so it
    // reads as drifting smoke, not a flat disc.
    const scale = c.r / SMOKE.radius;
    const ox = Math.cos(c.seed * 6.28) * 22 * scale;
    const oy = Math.sin(c.seed * 6.28) * 18 * scale;
    const ox2 = Math.cos(c.seed * 12.5) * 30 * scale;
    const oy2 = Math.sin(c.seed * 12.5) * 24 * scale;
    const s = sprite.half * 2 * scale;
    ctx.drawImage(sprite.canvas, c.x - ox - s / 2, c.y - oy - s / 2, s, s);
    ctx.drawImage(sprite.canvas, c.x + ox - s / 2, c.y + oy - s / 2, s * 0.85, s * 0.85);
    ctx.drawImage(sprite.canvas, c.x + ox2 - s / 2, c.y + oy2 - s / 2, s * 0.7, s * 0.7);
  }
  ctx.restore();
}
