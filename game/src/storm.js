// The storm: a safe zone that shrinks in phases. Each phase waits, then the circle
// closes toward a new (slightly drifted) centre over a few seconds. Outside the zone a
// fighter takes damage per second that grows with the phase. All times run on the fixed
// step, never the wall clock.
import { WORLD, STORM_PHASES } from './config.js';
import { range } from './random.js';

export function createStorm(random) {
  return {
    phase: 0,
    // 'wait' counts down, then 'shrink' runs, then the next phase begins.
    mode: 'wait',
    timer: STORM_PHASES[0].wait,
    cx: WORLD.width / 2,
    cy: WORLD.height / 2,
    radius: STORM_PHASES[0].radius,
    fromCx: WORLD.width / 2,
    fromCy: WORLD.height / 2,
    fromRadius: STORM_PHASES[0].radius,
    toCx: WORLD.width / 2,
    toCy: WORLD.height / 2,
    toRadius: STORM_PHASES[0].radius,
    shrinkT: 0,
    shrinkDur: 1,
    dps: 0,
    random,
  };
}

/** Advance the storm one fixed step. Returns 'shrink-start' / 'phase' on transitions. */
export function updateStorm(state, dt) {
  const s = state.storm;
  if (s.phase >= STORM_PHASES.length) return null;
  const def = STORM_PHASES[s.phase];
  if (s.mode === 'wait') {
    s.timer -= dt;
    if (s.timer <= 0) {
      if (s.phase + 1 >= STORM_PHASES.length) {
        s.mode = 'done';
        return null;
      }
      const next = STORM_PHASES[s.phase + 1];
      s.fromCx = s.cx;
      s.fromCy = s.cy;
      s.fromRadius = s.radius;
      // The damage rate is the new phase's from the moment its zone starts closing:
      // standing outside a shrinking zone must hurt right away, not only after it lands.
      s.dps = next.dps;
      // The next centre drifts toward the island centre by up to 140, staying on the island.
      const nx = s.cx + range(s.random, -140, 140) * 0.6 + (WORLD.width / 2 - s.cx) * 0.15;
      const ny = s.cy + range(s.random, -140, 140) * 0.6 + (WORLD.height / 2 - s.cy) * 0.15;
      s.toCx = Math.max(140, Math.min(WORLD.width - 140, nx));
      s.toCy = Math.max(140, Math.min(WORLD.height - 140, ny));
      s.toRadius = next.radius;
      s.shrinkDur = Math.max(1, next.shrink);
      s.shrinkT = 0;
      s.mode = 'shrink';
      return 'shrink-start';
    }
    return null;
  }
  if (s.mode === 'shrink') {
    s.shrinkT += dt;
    const p = Math.min(1, s.shrinkT / s.shrinkDur);
    // Ease the close: fast at first, gentle at the end.
    const e = 1 - (1 - p) * (1 - p);
    s.cx = s.fromCx + (s.toCx - s.fromCx) * e;
    s.cy = s.fromCy + (s.toCy - s.fromCy) * e;
    s.radius = s.fromRadius + (s.toRadius - s.fromRadius) * e;
    if (p >= 1) {
      s.phase += 1;
      s.dps = STORM_PHASES[s.phase].dps;
      s.mode = 'wait';
      s.timer = STORM_PHASES[s.phase].wait;
      return 'phase';
    }
  }
  return null;
}

/** Seconds until the current phase's shrink begins (or 0 while shrinking). */
export function stormTimer(state) {
  const s = state.storm;
  if (s.mode === 'wait') return Math.max(0, s.timer);
  return 0;
}

/** True when a point is outside the safe zone. */
export function outsideStorm(state, x, y) {
  const s = state.storm;
  return Math.hypot(x - s.cx, y - s.cy) > s.radius;
}
