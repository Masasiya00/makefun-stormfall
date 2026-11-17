// Pre-rendered glow sprites. shadowBlur on every entity every frame is the slowest thing a
// 2D canvas game can do, so each glow is painted once to a small offscreen canvas (a radial
// gradient) and blitted with 'lighter' from then on. Same neon look, a fraction of the cost.

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const cache = new Map();

/** A glow sprite for a colour: a radial gradient fading to transparent. Cached per colour+radius. */
export function glowSprite(color, radius) {
  const key = color + '|' + radius;
  let sprite = cache.get(key);
  if (sprite) return sprite;
  const [r, g, b] = hexToRgb(color);
  const size = Math.ceil(radius * 2 + 4);
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g2 = c.getContext('2d');
  const grad = g2.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, radius);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.85)`);
  grad.addColorStop(0.35, `rgba(${r},${g},${b},0.32)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  g2.fillStyle = grad;
  g2.fillRect(0, 0, size, size);
  sprite = { canvas: c, half: size / 2 };
  cache.set(key, sprite);
  return sprite;
}

/** Blit a glow sprite centred on (x, y), scaled and faded. Caller sets 'lighter' once per batch. */
export function drawGlow(ctx, sprite, x, y, scale, alpha) {
  ctx.globalAlpha = alpha;
  const s = sprite.half * 2 * scale;
  ctx.drawImage(sprite.canvas, x - s / 2, y - s / 2, s, s);
}
