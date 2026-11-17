// The island: one 1600x1200 world with grass, a sand rim, a water edge, trees and rocks
// for cover, a few ruined buildings (walls), and loot crates. The terrain is painted once
// to an offscreen canvas at boot, so the frame only blits one image — never re-paints it.
import { WORLD } from './config.js';
import { PALETTE } from './palette.js';
import { range } from './random.js';

const TREE_COUNT = 46;
const ROCK_COUNT = 22;
const BUILDING_COUNT = 4;

/** Named places on the island — the map is a place, not a blank arena. Callouts, the
 * HUD, and the terrain labels all read from this one list. */
export const ZONES = [
  { name: 'Ember Docks', x: 250, y: 950, r: 200 },
  { name: 'Glass Field', x: 1330, y: 290, r: 200 },
  { name: 'Hollow Hill', x: 280, y: 280, r: 200 },
  { name: 'Salt Market', x: 1340, y: 930, r: 200 },
  { name: 'Thornwood', x: 800, y: 170, r: 210 },
  // The Clearing's label sits below the drop point (the island centre), so the name
  // never sits under the player and the loot piling up there.
  { name: 'The Clearing', x: 800, y: 600, r: 230, lx: 800, ly: 730 },
];

/** The named zone containing (x, y), or null in the open ground between places. */
export function zoneAt(x, y) {
  for (const z of ZONES) {
    if (Math.hypot(x - z.x, y - z.y) < z.r) return z;
  }
  return null;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** A spot is clear when it is inside the island and away from every obstacle and the centre. */
function clearSpot(random, obstacles, x, y, margin) {
  if (x < 90 || x > WORLD.width - 90 || y < 90 || y > WORLD.height - 90) return false;
  for (const o of obstacles) {
    if (o.kind === 'tree' || o.kind === 'rock') {
      if (dist(x, y, o.x, o.y) < o.r + margin) return false;
    } else if (o.kind === 'wall') {
      if (x > o.x - margin && x < o.x + o.w + margin && y > o.y - margin && y < o.y + o.h + margin) return false;
    }
  }
  return true;
}

export function createIsland(random) {
  const obstacles = [];
  // Trees and rocks, kept out of the very centre so the drop zone reads clean.
  let guard = 0;
  while (obstacles.filter((o) => o.kind === 'tree').length < TREE_COUNT && guard < 900) {
    guard += 1;
    const x = range(random, 80, WORLD.width - 80);
    const y = range(random, 80, WORLD.height - 80);
    if (dist(x, y, WORLD.width / 2, WORLD.height / 2) < 190) continue;
    if (!clearSpot(random, obstacles, x, y, 26)) continue;
    obstacles.push({ kind: 'tree', x, y, r: 20 + random() * 8, seed: random() });
  }
  guard = 0;
  while (obstacles.filter((o) => o.kind === 'rock').length < ROCK_COUNT && guard < 600) {
    guard += 1;
    const x = range(random, 80, WORLD.width - 80);
    const y = range(random, 80, WORLD.height - 80);
    if (dist(x, y, WORLD.width / 2, WORLD.height / 2) < 170) continue;
    if (!clearSpot(random, obstacles, x, y, 24)) continue;
    obstacles.push({ kind: 'rock', x, y, r: 16 + random() * 12, seed: random() });
  }
  // Ruined buildings: two walls each, forming an L of cover.
  for (let i = 0; i < BUILDING_COUNT; i += 1) {
    const bx = 260 + (i % 2) * 900 + range(random, -60, 60);
    const by = 280 + Math.floor(i / 2) * 620 + range(random, -50, 50);
    const w = 150 + random() * 60;
    const h = 110 + random() * 50;
    obstacles.push({ kind: 'wall', x: bx, y: by, w, h: 16, seed: random() });
    obstacles.push({ kind: 'wall', x: bx, y: by, w: 16, h, seed: random() });
    obstacles.push({ kind: 'wall', x: bx + w - 16, y: by + h - 60, w: 16, h: 60, seed: random() });
  }
  // Loot crates, scattered but never inside an obstacle.
  const crates = [];
  guard = 0;
  while (crates.length < 6 && guard < 400) {
    guard += 1;
    const x = range(random, 120, WORLD.width - 120);
    const y = range(random, 120, WORLD.height - 120);
    if (!clearSpot(random, obstacles, x, y, 34)) continue;
    crates.push({ x, y, hp: 3, alive: true });
  }
  const terrain = paintTerrain(random, obstacles);
  return { obstacles, crates, terrain };
}

/** Paint the whole island once: water rim, sand beach, grass with patches, then the
 * obstacles (trees, rocks, walls) and the crate spots baked in. */
function paintTerrain(random, obstacles) {
  const c = document.createElement('canvas');
  c.width = WORLD.width;
  c.height = WORLD.height;
  const g = c.getContext('2d');
  // Water outside the island, then sand, then grass.
  g.fillStyle = PALETTE.waterDeep;
  g.fillRect(0, 0, WORLD.width, WORLD.height);
  g.fillStyle = PALETTE.water;
  g.beginPath();
  g.ellipse(WORLD.width / 2, WORLD.height / 2, WORLD.width / 2 - 6, WORLD.height / 2 - 6, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = PALETTE.sand;
  g.beginPath();
  g.ellipse(WORLD.width / 2, WORLD.height / 2, WORLD.width / 2 - 44, WORLD.height / 2 - 44, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = PALETTE.grass;
  g.beginPath();
  g.ellipse(WORLD.width / 2, WORLD.height / 2, WORLD.width / 2 - 78, WORLD.height / 2 - 78, 0, 0, Math.PI * 2);
  g.fill();
  // Grass patches and speckles for texture (seeded, painted once).
  for (let i = 0; i < 260; i += 1) {
    const x = range(random, 100, WORLD.width - 100);
    const y = range(random, 100, WORLD.height - 100);
    const r = 14 + random() * 46;
    g.fillStyle = random() < 0.5 ? PALETTE.grassLight : PALETTE.grassDark;
    g.globalAlpha = 0.25 + random() * 0.25;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  // Sand speckles.
  for (let i = 0; i < 120; i += 1) {
    const a = random() * Math.PI * 2;
    const rr = 1 - Math.sqrt(random());
    const x = WORLD.width / 2 + Math.cos(a) * rr * (WORLD.width / 2 - 60);
    const y = WORLD.height / 2 + Math.sin(a) * rr * (WORLD.height / 2 - 60);
    g.fillStyle = PALETTE.sandEdge;
    g.globalAlpha = 0.5;
    g.beginPath();
    g.arc(x, y, 2 + random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  // Named-place labels, baked into the terrain: a small marker and the name, faint
  // enough to read as map furniture, not UI. Kept small so a fighter or a loot label
  // standing on the place name stays readable.
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const z of ZONES) {
    const lx = z.lx ?? z.x;
    const ly = z.ly ?? z.y;
    g.globalAlpha = 0.45;
    g.fillStyle = '#f5f0e1';
    g.beginPath();
    g.arc(lx, ly - 20, 3, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 0.6;
    g.font = 'bold 18px system-ui, sans-serif';
    g.fillStyle = 'rgba(20, 40, 26, 0.5)';
    g.fillText(z.name, lx + 1, ly + 1);
    g.fillStyle = 'rgba(245, 240, 225, 0.75)';
    g.fillText(z.name, lx, ly);
  }
  g.globalAlpha = 1;
  // Obstacles baked into the terrain image.
  for (const o of obstacles) {
    if (o.kind === 'tree') {
      g.fillStyle = PALETTE.tree;
      g.beginPath();
      g.arc(o.x, o.y, o.r + 4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = PALETTE.treeTop;
      g.beginPath();
      g.arc(o.x - 3, o.y - 4, o.r - 3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#3f9e4d';
      g.beginPath();
      g.arc(o.x - 6, o.y - 8, o.r * 0.4, 0, Math.PI * 2);
      g.fill();
    } else if (o.kind === 'rock') {
      g.fillStyle = PALETTE.rockDark;
      g.beginPath();
      g.arc(o.x + 2, o.y + 3, o.r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = PALETTE.rock;
      g.beginPath();
      g.arc(o.x, o.y, o.r - 3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#9ca3af';
      g.beginPath();
      g.arc(o.x - o.r * 0.3, o.y - o.r * 0.35, o.r * 0.32, 0, Math.PI * 2);
      g.fill();
    } else if (o.kind === 'wall') {
      g.fillStyle = PALETTE.wall;
      g.fillRect(o.x, o.y, o.w, o.h);
      g.fillStyle = PALETTE.wallTop;
      g.fillRect(o.x, o.y, o.w, Math.min(5, o.h));
      g.fillRect(o.x, o.y, Math.min(5, o.w), o.h);
    }
  }
  return c;
}

/** True when a circle at (x, y) overlaps any obstacle (a pure test, no movement). */
export function isColliding(island, x, y, radius) {
  for (const o of island.obstacles) {
    if (o.kind === 'tree' || o.kind === 'rock') {
      if (Math.hypot(x - o.x, y - o.y) < o.r * 0.82 + radius) return true;
    } else if (o.kind === 'wall') {
      const cx = Math.max(o.x, Math.min(x, o.x + o.w));
      const cy = Math.max(o.y, Math.min(y, o.y + o.h));
      if (Math.hypot(x - cx, y - cy) < radius) return true;
    }
  }
  return false;
}

/** Push a circle (a fighter) out of every obstacle it overlaps. Returns true on a hit. */
export function collideObstacles(island, x, y, radius) {
  let hit = false;
  for (const o of island.obstacles) {
    if (o.kind === 'tree' || o.kind === 'rock') {
      const dx = x - o.x;
      const dy = y - o.y;
      const d = Math.hypot(dx, dy);
      const min = o.r * 0.82 + radius;
      if (d < min && d > 0.001) {
        const push = min - d;
        x += (dx / d) * push;
        y += (dy / d) * push;
        hit = true;
      }
    } else if (o.kind === 'wall') {
      const cx = Math.max(o.x, Math.min(x, o.x + o.w));
      const cy = Math.max(o.y, Math.min(y, o.y + o.h));
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d < radius) {
        if (d > 0.001) {
          x += (dx / d) * (radius - d);
          y += (dy / d) * (radius - d);
        } else {
          y -= radius;
        }
        hit = true;
      }
    }
  }
  return { x, y, hit };
}

/** Push one fighter out of another. Shared by separateFighters. */
function pushApart(a, b) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let d = Math.hypot(dx, dy);
  const min = a.radius + b.radius;
  if (d >= min) return;
  if (d < 0.001) {
    dx = 1;
    dy = 0;
    d = 1;
  }
  const push = (min - d) / 2;
  const nx = dx / d;
  const ny = dy / d;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
}

/** Keep fighters from sharing a point: two combatants on top of each other shoot past
 * each other forever, because a bullet spawns 21px out and the target is 1px away.
 * Runs after movement each step; no allocation (the fighter list is walked in place). */
export function separateFighters(state) {
  const p = state.player;
  const bots = state.bots;
  if (p.alive && !p.dropping) {
    for (const b of bots) {
      if (b.alive && !b.dropping) pushApart(p, b);
    }
  }
  for (let i = 0; i < bots.length; i += 1) {
    const a = bots[i];
    if (!a.alive || a.dropping) continue;
    for (let j = i + 1; j < bots.length; j += 1) {
      const b = bots[j];
      if (!b.alive || b.dropping) continue;
      pushApart(a, b);
    }
  }
}

/** Move a fighter by (dx, dy) with sliding: step into the move, then push out radially
 * from every overlapped obstacle (a few passes for stacked obstacles). The push-out
 * cancels only the inward part of the move, so the tangential part carries the fighter
 * along the obstacle instead of sticking in a corner. If the fighter is still overlapped
 * after the passes (a tight pocket), it stays put this step rather than clipping inside. */
export function moveFighter(island, f, dx, dy) {
  const ox = f.x;
  const oy = f.y;
  f.x += dx;
  f.y += dy;
  for (let i = 0; i < 4; i += 1) {
    const r = collideObstacles(island, f.x, f.y, f.radius);
    if (!r.hit) break;
    f.x = r.x;
    f.y = r.y;
  }
  if (isColliding(island, f.x, f.y, f.radius)) {
    f.x = ox;
    f.y = oy;
  }
}

/** True when the segment from (x1,y1) to (x2,y2) crosses an obstacle (bullets stop there). */
export function segmentBlocked(island, x1, y1, x2, y2) {
  for (const o of island.obstacles) {
    if (o.kind === 'tree' || o.kind === 'rock') {
      const r = o.r * 0.82;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len2 = dx * dx + dy * dy;
      let t = len2 > 0 ? ((o.x - x1) * dx + (o.y - y1) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      if (Math.hypot(o.x - px, o.y - py) < r) return true;
    } else if (o.kind === 'wall') {
      // Segment vs axis-aligned rect: sample the midpoint cheaply, then check overlap.
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      if (maxX < o.x || minX > o.x + o.w || maxY < o.y || minY > o.y + o.h) continue;
      // The segment's bounding box overlaps the wall: treat as blocked (bullets are fast,
      // and walls are thin, so this is the honest read at 60 steps a second).
      return true;
    }
  }
  return false;
}
