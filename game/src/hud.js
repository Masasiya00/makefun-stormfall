// All drawing of the world, the HUD and the screens. The world is painted in layers
// (terrain, storm, loot, crates, fighters, bullets, particles), the HUD sits on top in
// screen space, and the title / pause / victory / eliminated screens are panels over a
// dimmed world. The camera follows the player; the world is bigger than the viewport.
import { WORLD, VIEW, PLAYER, WEAPONS, STORM_PHASES } from './config.js';
import { PALETTE, FONT, FONT_MONO } from './palette.js';
import { drawPlayer, drawFighterBody } from './player.js';
import { drawBots } from './bots.js';
import { drawParticles } from './particles.js';
import { drawSmoke } from './smoke.js';
import { zoneAt, ZONES } from './map.js';
import { stormTimer } from './storm.js';
import { currentWeapon, currentWeaponId } from './weapons.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

export function drawWorld(ctx, state) {
  // Terrain: one pre-rendered image of the whole island.
  ctx.drawImage(state.island.terrain, 0, 0);
  drawStorm(ctx, state);
  drawLoot(ctx, state);
  drawCrates(ctx, state);
  drawBots(ctx, state);
  drawPlayer(ctx, state);
  drawSmoke(ctx, state);
  drawBullets(ctx, state);
  drawParticles(ctx, state);
}

/** The storm: a purple tint outside the safe circle, with a bright animated edge. */
function drawStorm(ctx, state) {
  const s = state.storm;
  ctx.save();
  // Tint everything outside the safe circle.
  ctx.beginPath();
  ctx.rect(0, 0, WORLD.width, WORLD.height);
  ctx.arc(s.cx, s.cy, s.radius, 0, Math.PI * 2, true);
  ctx.fillStyle = PALETTE.stormTint;
  ctx.fill();
  // The wall itself: two rings, the outer one pulsing.
  const pulse = 0.5 + 0.3 * Math.sin(state.time * 3);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.35 * pulse;
  ctx.strokeStyle = PALETTE.storm;
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.arc(s.cx, s.cy, s.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = PALETTE.zone;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(s.cx, s.cy, s.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawLoot(ctx, state) {
  const t = state.time;
  for (const item of state.loot) {
    if (!item.alive) continue;
    const bob = Math.sin(item.bob) * 2;
    const x = item.x;
    const y = item.y + bob;
    ctx.save();
    ctx.translate(x, y);
    if (item.kind === 'weapon') {
      const def = WEAPONS[item.id];
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 8, 16, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Gun glyph: a small barrel + body, coloured by weapon.
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(-11, -3, 22, 6);
      ctx.fillStyle = def.color;
      ctx.fillRect(6, -2, 9, 4);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(def.name.toUpperCase(), 0, -14);
    } else if (item.kind === 'medkit') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-9, -9, 18, 18);
      ctx.fillStyle = PALETTE.medkit;
      ctx.fillRect(-9, -9, 18, 18);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2.5, -6, 5, 12);
      ctx.fillRect(-6, -2.5, 12, 5);
    } else if (item.kind === 'shield') {
      ctx.fillStyle = PALETTE.shield;
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(9, -5);
      ctx.lineTo(9, 3);
      ctx.quadraticCurveTo(9, 10, 0, 13);
      ctx.quadraticCurveTo(-9, 10, -9, 3);
      ctx.lineTo(-9, -5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('S', 0, 5);
    } else if (item.kind === 'ammo') {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-9, -7, 18, 14);
      ctx.fillStyle = PALETTE.ammo;
      ctx.fillRect(-9, -7, 18, 5);
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(-6, -1, 3, 6);
      ctx.fillRect(-1, -1, 3, 6);
      ctx.fillRect(4, -1, 3, 6);
    } else if (item.kind === 'smoke') {
      ctx.fillStyle = '#6b7280';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d1d5db';
      ctx.beginPath();
      ctx.arc(-3, -3, 5, 0, Math.PI * 2);
      ctx.arc(4, 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Q', 0, -15);
    }
    ctx.restore();
  }
}

function drawCrates(ctx, state) {
  for (const crate of state.crates) {
    if (!crate.alive) continue;
    ctx.save();
    ctx.translate(crate.x, crate.y);
    ctx.fillStyle = PALETTE.crateEdge;
    ctx.fillRect(-20, -20, 40, 40);
    ctx.fillStyle = PALETTE.crate;
    ctx.fillRect(-17, -17, 34, 34);
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-17, -17);
    ctx.lineTo(17, 17);
    ctx.moveTo(17, -17);
    ctx.lineTo(-17, 17);
    ctx.stroke();
    ctx.fillStyle = '#ffd75e';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOOT', 0, -24);
    ctx.restore();
  }
}

function drawBullets(ctx, state) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const b of state.bullets) {
    if (!b.alive) continue;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function bar(ctx, x, y, w, h, pct, color, bg) {
  ctx.fillStyle = bg || 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, pct)), h);
}

function panel(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = PALETTE.panel;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function centreText(ctx, text, x, y, font, color) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** The HUD: health + shield + stamina, alive + zone timer, kill feed, weapons, minimap. */
export function drawHUD(ctx, state) {
  const p = state.player;
  const s = state.storm;
  // Top-left: health, shield, stamina.
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = '700 13px ' + FONT;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('YOU', 20, 26);
  bar(ctx, 20, 34, 220, 16, p.hp / PLAYER.hpMax, p.hp > 50 ? '#4ade80' : p.hp > 25 ? '#fbbf24' : '#ef4444');
  ctx.font = '700 12px ' + FONT_MONO;
  ctx.fillStyle = '#0b1020';
  ctx.fillText(Math.ceil(p.hp) + ' HP', 26, 46);
  bar(ctx, 20, 54, 220, 9, p.shield / PLAYER.shieldMax, '#60a5fa');
  ctx.font = '700 10px ' + FONT;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('SHIELD ' + Math.ceil(p.shield), 20, 76);
  bar(ctx, 20, 82, 120, 5, p.stamina / PLAYER.staminaMax, '#4de8ff');
  ctx.fillText('SPRINT', 146, 87);
  ctx.restore();

  // Top-centre: alive count + zone timer + the named place the player is standing in.
  const alive = state.alive;
  const timer = stormTimer(state);
  const phaseLabel = s.mode === 'shrink' ? 'STORM CLOSING' : 'ZONE SHRINKS IN';
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '800 30px ' + FONT;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(alive + ' ALIVE', 640, 38);
  ctx.font = '700 15px ' + FONT;
  ctx.fillStyle = s.mode === 'shrink' ? PALETTE.danger : PALETTE.zone;
  const timerText = s.mode === 'shrink' ? 'STORM CLOSING' : phaseLabel + '  ' + Math.ceil(timer) + 's';
  ctx.fillText(timerText + '  ·  PHASE ' + Math.min(s.phase + 1, STORM_PHASES.length), 640, 60);
  const zone = zoneAt(p.x, p.y);
  ctx.font = '700 13px ' + FONT;
  ctx.fillStyle = '#d8b4fe';
  ctx.fillText('⌖  ' + (zone ? zone.name.toUpperCase() : 'OPEN GROUND'), 640, 84);
  ctx.restore();

  // Top-right: kill feed (newest first).
  ctx.save();
  ctx.textAlign = 'right';
  ctx.font = '700 13px ' + FONT;
  state.feed.forEach((line, i) => {
    ctx.globalAlpha = Math.max(0.35, 1 - line.t / 6);
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, 1260, 30 + i * 20);
  });
  ctx.restore();

  // Bottom-left: weapon slots + ammo.
  const def = currentWeapon(p);
  ctx.save();
  ctx.textAlign = 'left';
  for (let i = 0; i < 2; i += 1) {
    const id = p.slots[i];
    const x = 20 + i * 132;
    const y = 716;
    const active = p.slot === i;
    ctx.fillStyle = active ? 'rgba(77, 232, 255, 0.25)' : PALETTE.panel;
    ctx.strokeStyle = active ? PALETTE.accent : PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, 122, 56, 8);
    ctx.fill();
    ctx.stroke();
    ctx.font = '700 11px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText((i + 1) + '  ' + (id ? WEAPONS[id].name.toUpperCase() : 'EMPTY'), x + 10, y + 18);
    if (id) {
      const mag = p['mag_' + id] ?? WEAPONS[id].mag;
      ctx.font = '800 20px ' + FONT_MONO;
      ctx.fillStyle = PALETTE.text;
      const reserve = WEAPONS[id].reserve === Infinity ? '∞' : String(p.ammo[id] || 0);
      ctx.fillText(mag + ' / ' + reserve, x + 10, y + 44);
      if (p.reloading && active) {
        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = PALETTE.gold;
        ctx.fillText('RELOADING…', x + 78, y + 44);
      }
    }
  }
  ctx.font = '700 12px ' + FONT;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('KILLS  ' + state.kills + '   ·   SMOKE  ×' + p.smoke + '   ·   SCORE  ' + (state.kills * 100), 20, 700);
  ctx.restore();

  drawMinimap(ctx, state);
}

/** Small map, bottom-right: island, storm, safe zone, player and bots. */
function drawMinimap(ctx, state) {
  const mw = 170;
  const mh = 128;
  const mx = 1280 - mw - 20;
  const my = 800 - mh - 20;
  const sx = mw / WORLD.width;
  const sy = mh / WORLD.height;
  ctx.save();
  ctx.fillStyle = 'rgba(8, 13, 26, 0.8)';
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(mx, my, mw, mh, 8);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  // Island.
  ctx.fillStyle = '#2f6b3a';
  ctx.beginPath();
  ctx.ellipse(mx + mw / 2, my + mh / 2, mw / 2 - 4, mh / 2 - 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Storm tint outside the safe zone.
  const s = state.storm;
  ctx.fillStyle = 'rgba(124, 58, 237, 0.55)';
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.arc(mx + s.cx * sx, my + s.cy * sy, s.radius * sx, 0, Math.PI * 2, true);
  ctx.fill();
  ctx.strokeStyle = '#e9d5ff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(mx + s.cx * sx, my + s.cy * sy, s.radius * sx, 0, Math.PI * 2);
  ctx.stroke();
  // Named places as dots, so the minimap reads as a map of places, not a blank disc.
  for (const z of ZONES) {
    ctx.fillStyle = 'rgba(233, 213, 255, 0.75)';
    ctx.beginPath();
    ctx.arc(mx + z.x * sx, my + z.y * sy, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Bots as orange dots, player as a cyan dot with a ring.
  for (const b of state.bots) {
    if (!b.alive) continue;
    ctx.fillStyle = '#ff9a3d';
    ctx.beginPath();
    ctx.arc(mx + b.x * sx, my + b.y * sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const p = state.player;
  if (p.alive) {
    ctx.fillStyle = '#4de8ff';
    ctx.beginPath();
    ctx.arc(mx + p.x * sx, my + p.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx + p.x * sx, my + p.y * sy, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Damage flash + low-health pulse, drawn over the viewport in screen space. */
export function drawOverlay(ctx, state) {
  if (state.flash > 0.01) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.5, state.flash);
    ctx.fillStyle = state.flashColor;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.restore();
  }
  const p = state.player;
  if (state.screen === SCREEN_PLAY && p.alive && p.hp <= 30) {
    const a = 0.10 + 0.08 * Math.sin(state.time * 5);
    ctx.save();
    ctx.strokeStyle = `rgba(255, 77, 94, ${a})`;
    ctx.lineWidth = 26;
    ctx.strokeRect(0, 0, VIEW.width, VIEW.height);
    ctx.restore();
  }
  if (state.banner) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, state.banner.t);
    centreText(ctx, state.banner.text, 640, 120, '800 34px ' + FONT, state.banner.color || PALETTE.gold);
    ctx.restore();
  }
}

export function drawTitle(ctx, state, best) {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 8, 16, 0.62)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  centreText(ctx, 'STORMFALL', 640, 190, '900 92px ' + FONT, '#e9d5ff');
  centreText(ctx, 'a top-down battle royale', 640, 232, '500 26px ' + FONT, PALETTE.muted);
  centreText(ctx, '12 drop in. One walks out.', 640, 268, '700 19px ' + FONT, PALETTE.gold);
  panel(ctx, 380, 300, 520, 282);
  const rows = [
    ['WASD / arrows', 'move'],
    ['Mouse', 'aim — hold click to fire'],
    ['E', 'pick up weapon'],
    ['Q', 'smoke bomb (blocks sight)'],
    ['R', 'reload'],
    ['1 / 2', 'switch weapon'],
    ['SHIFT', 'sprint (stamina)'],
    ['P / ESC', 'pause    ·    M mute'],
  ];
  ctx.save();
  ctx.textAlign = 'left';
  rows.forEach((row, i) => {
    const y = 336 + i * 30;
    ctx.font = '700 16px ' + FONT_MONO;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(row[0], 410, y);
    ctx.font = '500 16px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(row[1], 580, y);
  });
  ctx.restore();
  centreText(ctx, 'Loot weapons. Outrun the storm. Be the last one standing.', 640, 596, '500 18px ' + FONT, PALETTE.text);
  centreText(ctx, 'CLICK  or  press  SPACE  to drop in', 640, 646, '800 24px ' + FONT, PALETTE.gold);
  if (best > 0) centreText(ctx, 'Best placement: #' + best, 640, 690, '700 15px ' + FONT, PALETTE.muted);
  ctx.restore();
}

export function drawPaused(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 8, 16, 0.6)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  centreText(ctx, 'PAUSED', 640, 330, '900 64px ' + FONT, PALETTE.text);
  centreText(ctx, 'P / ESC or click to resume', 640, 380, '500 20px ' + FONT, PALETTE.muted);
  centreText(ctx, 'WASD move · Mouse aim · E pickup · R reload · 1/2 weapons · SHIFT sprint', 640, 420, '500 16px ' + FONT, PALETTE.muted);
  ctx.restore();
}

export function drawVictory(ctx, state) {
  const over = state.over;
  ctx.save();
  ctx.fillStyle = 'rgba(20, 16, 4, 0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  centreText(ctx, 'LAST ONE STANDING', 640, 220, '900 64px ' + FONT, PALETTE.gold);
  centreText(ctx, 'the storm falls. you remain.', 640, 262, '500 22px ' + FONT, PALETTE.muted);
  panel(ctx, 440, 300, 400, 254);
  const rows = [
    ['PLACEMENT', '#1  of  12'],
    ['ELIMINATIONS', String(over.kills)],
    ['SCORE', String(over.score)],
    ['SURVIVED', over.time + 's'],
    ['BEST', over.isNewBest ? '#1 — NEW BEST!' : '#' + over.best],
  ];
  ctx.save();
  rows.forEach((row, i) => {
    const y = 344 + i * 44;
    ctx.font = '700 16px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.textAlign = 'left';
    ctx.fillText(row[0], 470, y);
    ctx.font = '800 22px ' + FONT_MONO;
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'right';
    ctx.fillText(row[1], 810, y);
  });
  ctx.restore();
  centreText(ctx, 'R  or  click  to drop in again', 640, 580, '800 22px ' + FONT, PALETTE.gold);
  ctx.restore();
}

export function drawEliminated(ctx, state) {
  const over = state.over;
  ctx.save();
  ctx.fillStyle = 'rgba(16, 4, 8, 0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  centreText(ctx, 'ELIMINATED', 640, 220, '900 64px ' + FONT, PALETTE.danger);
  centreText(ctx, 'the island claims another', 640, 262, '500 22px ' + FONT, PALETTE.muted);
  panel(ctx, 440, 300, 400, 254);
  const rows = [
    ['PLACEMENT', '#' + over.placement + '  of  12'],
    ['ELIMINATIONS', String(over.kills)],
    ['SCORE', String(over.score)],
    ['SURVIVED', over.time + 's'],
    ['BEST', '#' + over.best],
  ];
  ctx.save();
  rows.forEach((row, i) => {
    const y = 344 + i * 44;
    ctx.font = '700 16px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.textAlign = 'left';
    ctx.fillText(row[0], 470, y);
    ctx.font = '800 22px ' + FONT_MONO;
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'right';
    ctx.fillText(row[1], 810, y);
  });
  ctx.restore();
  centreText(ctx, 'R  or  click  to drop in again', 640, 580, '800 22px ' + FONT, PALETTE.gold);
  ctx.restore();
}
