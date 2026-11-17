// The whole game state in one factory, so the loop (main.js) and the screenshot stager
// (shots.js) build exactly the same world. Pools are pre-allocated here: bullets and
// particles are reused, never allocated per frame, which keeps the frame rate steady.
import { WORLD, PLAYER } from './config.js';
import { createIsland } from './map.js';
import { createStorm } from './storm.js';

export const MAX_PARTICLES = 320;
export const MAX_BULLETS = 128;

function makeParticle() {
  return { alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff', drag: 0 };
}
function makeBullet() {
  return { alive: false, x: 0, y: 0, vx: 0, vy: 0, radius: 4, damage: 0, range: 0, traveled: 0, owner: null, color: '#ffe9a8', fromPlayer: false };
}

export function createFighter(name, color, x, y, isPlayer) {
  return {
    name,
    color,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    angle: 0,
    hp: PLAYER.hpMax,
    shield: 0,
    alive: true,
    isPlayer: !!isPlayer,
    // Weapons: two slots; every fighter carries a pistol sidearm (infinite reserve),
    // so no one is ever unarmed — a dry rifle falls back to the pistol, and the
    // match always ends. Looted weapons go in slot 1.
    slots: ['pistol', null],
    slot: 0,
    ammo: { pistol: Infinity, scattergun: 0, rifle: 0, longshot: 0 },
    fireTimer: 0,
    reloadTimer: 0,
    reloading: false,
    invuln: 0,
    stamina: PLAYER.staminaMax,
    sprinting: false,
    dropping: false,
    dropTimer: 0,
    dropFromX: 0,
    dropFromY: 0,
    dropToX: 0,
    dropToY: 0,
    kills: 0,
    wobble: 0,
    hurtFlash: 0,
    smoke: 0,
    smokeCooldown: 0,
    calloutTimer: 0,
    // Bot brains only.
    brain: null,
    thinkTimer: 0,
    target: null,
    roamX: 0,
    roamY: 0,
  };
}

export function createState(random) {
  const particles = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) particles.push(makeParticle());
  const bullets = [];
  for (let i = 0; i < MAX_BULLETS; i += 1) bullets.push(makeBullet());
  const island = createIsland(random);
  const player = createFighter('You', '#4de8ff', WORLD.width / 2, WORLD.height / 2, true);
  return {
    random,
    island,
    time: 0,
    screen: 'title',
    storm: createStorm(random),
    player,
    bots: [],
    loot: [],
    crates: island.crates,
    bullets,
    particles,
    particleCursor: 0,
    smokes: [],
    texts: [],
    feed: [],
    kills: 0,
    alive: 12,
    placement: 12,
    won: false,
    over: null,
    best: 0,
    shakeMag: 0,
    shakeX: 0,
    shakeY: 0,
    flash: 0,
    flashColor: '#ffffff',
    banner: null,
    stormWarned: 0,
    camera: { x: WORLD.width / 2, y: WORLD.height / 2 },
    titleDrift: 0,
    muted: false,
  };
}
