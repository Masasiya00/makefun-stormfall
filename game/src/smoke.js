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
    r: SMOKE.radius,
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

/** Age the clouds; dead ones leave the list. */
export function updateSmoke(state, dt) {
  for (let i = state.smokes.length - 1; i >= 0; i -= 1) {
    state.smokes[i].life -= dt;
    if (state.smokes[i].life <= 0) state.smokes.splice(i, 1);
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
    const a = Math.min(0.62, (c.life / c.maxLife) * 0.7);
    ctx.globalAlpha = a;
    // Two offset blobs per cloud so it reads as smoke, not a flat disc.
    const ox = Math.cos(c.seed * 6.28) * 22;
    const oy = Math.sin(c.seed * 6.28) * 18;
    const s = sprite.half * 2;
    ctx.drawImage(sprite.canvas, c.x - ox - s / 2, c.y - oy - s / 2, s, s);
    ctx.drawImage(sprite.canvas, c.x + ox - s / 2, c.y + oy - s / 2, s * 0.85, s * 0.85);
  }
  ctx.restore();
}
