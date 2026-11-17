// Particles, floating score texts and screen shake. Particles live in a fixed pool that is
// allocated once: spawning reuses a dead slot (the oldest when the pool is full), so the game
// never allocates per frame and the frame rate stays flat even in a big explosion.
import { MAX_PARTICLES } from './state.js';

export function burst(state, x, y, color, count, speed, life, size) {
  for (let i = 0; i < count; i += 1) {
    const p = state.particles[state.particleCursor];
    state.particleCursor = (state.particleCursor + 1) % MAX_PARTICLES;
    const a = state.random() * Math.PI * 2;
    const v = speed * (0.3 + state.random() * 0.7);
    p.alive = true;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * v;
    p.vy = Math.sin(a) * v;
    p.life = life * (0.5 + state.random() * 0.5);
    p.maxLife = life;
    p.size = size * (0.5 + state.random() * 0.5);
    p.color = color;
    p.drag = 3.2;
  }
}

export function trail(state, x, y, color) {
  const p = state.particles[state.particleCursor];
  state.particleCursor = (state.particleCursor + 1) % MAX_PARTICLES;
  p.alive = true;
  p.x = x;
  p.y = y;
  p.vx = 0;
  p.vy = 0;
  p.life = 0.28;
  p.maxLife = 0.28;
  p.size = 3.5;
  p.color = color;
  p.drag = 0;
}

export function floatText(state, x, y, text, color) {
  if (state.texts.length > 24) state.texts.shift();
  state.texts.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
}

export function addShake(state, magnitude) {
  state.shakeMag = Math.min(16, state.shakeMag + magnitude);
}

export function updateParticles(state, dt) {
  for (const p of state.particles) {
    if (!p.alive) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.alive = false;
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const d = Math.max(0, 1 - p.drag * dt);
    p.vx *= d;
    p.vy *= d;
  }
  for (let i = state.texts.length - 1; i >= 0; i -= 1) {
    const t = state.texts[i];
    t.life -= dt;
    t.y -= 34 * dt;
    if (t.life <= 0) state.texts.splice(i, 1);
  }
  for (let i = state.feed.length - 1; i >= 0; i -= 1) {
    state.feed[i].t += dt;
    if (state.feed[i].t > (state.feed[i].ttl || 6)) state.feed.splice(i, 1);
  }
  // The weapon-pickup toast (HUD, bottom-left) fades on its own.
  if (state.pickupToast) {
    state.pickupToast.t -= dt;
    if (state.pickupToast.t <= 0) state.pickupToast = null;
  }
  state.shakeMag = Math.max(0, state.shakeMag - 34 * dt);
  if (state.shakeMag > 0) {
    state.shakeX = (state.random() * 2 - 1) * state.shakeMag;
    state.shakeY = (state.random() * 2 - 1) * state.shakeMag;
  } else {
    state.shakeX = 0;
    state.shakeY = 0;
  }
}

export function drawParticles(ctx, state) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of state.particles) {
    if (!p.alive) continue;
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  for (const t of state.texts) {
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
    // A dark outline keeps the text readable over any terrain and stops bold gold
    // text from bleeding into a garbled banner against bright grass.
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();
}
