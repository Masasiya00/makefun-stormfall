// Every tuning number in one place. The island is a fixed 1600x1200 world; the camera
// follows the player and the renderer shows a 1280x800 viewport of it, so no rule below
// depends on the screen size.
import { PALETTE } from './palette.js';

export const WORLD = { width: 1600, height: 1200 };
export const VIEW = { width: 1280, height: 800 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 15,
  accel: 2800,
  maxSpeed: 330,
  sprintMult: 1.45,
  friction: 7,
  sprintDrain: 22,
  sprintRegen: 14,
  staminaMax: 100,
  hpMax: 100,
  shieldMax: 100,
  dropTime: 1.4,
  invulnerable: 1.5,
  pickupRadius: 52,
  knockback: 260,
};

/** Weapons: damage per hit, shots per second, magazine, reload seconds, spread (radians),
 * bullet speed, range, and how many rounds a pickup gives. Pistol has infinite reserve. */
export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 14, fireRate: 3.2, mag: 12, reload: 1.1, spread: 0.045, speed: 720, range: 520, reserve: Infinity, pickupAmmo: 0, color: '#ffd75e', auto: false, kick: 90 },
  scattergun: { name: 'Scattergun', damage: 11, pellets: 6, fireRate: 1.1, mag: 5, reload: 1.9, spread: 0.22, speed: 640, range: 300, reserve: 40, pickupAmmo: 10, color: '#ff9a3d', auto: false, kick: 190 },
  rifle: { name: 'Rifle', damage: 12, fireRate: 7.5, mag: 30, reload: 1.6, spread: 0.07, speed: 880, range: 640, reserve: 120, pickupAmmo: 30, color: '#4de8ff', auto: true, kick: 60 },
  longshot: { name: 'Longshot', damage: 46, fireRate: 0.85, mag: 5, reload: 2.4, spread: 0.008, speed: 1200, range: 900, reserve: 25, pickupAmmo: 5, color: '#c95bff', auto: false, kick: 260 },
};

export const WEAPON_ORDER = ['pistol', 'scattergun', 'rifle', 'longshot'];

/** Storm phases: wait seconds before the shrink, shrink seconds, target radius, and the
 * damage per second outside the safe zone during (and after) that phase. */
export const STORM_PHASES = [
  { wait: 22, shrink: 0, radius: 980, dps: 0 },
  { wait: 16, shrink: 15, radius: 560, dps: 1 },
  { wait: 14, shrink: 12, radius: 360, dps: 2 },
  { wait: 12, shrink: 10, radius: 190, dps: 5 },
  { wait: 10, shrink: 8, radius: 70, dps: 8 },
];

export const BOT_NAMES = ['Vex', 'Rook', 'Nova', 'Juno', 'Kite', 'Moss', 'Pike', 'Sable', 'Tess', 'Wren', 'Ash'];

export const BOT_COLORS = ['#ff9a3d', '#ff5d73', '#c95bff', '#ffd75e', '#ff7a59', '#f472b6', '#fb7185', '#fbbf24', '#e879f9', '#fdba74', '#fca5a5'];

export const LOOT = {
  weaponsOnGround: 14,
  crates: 6,
  medkits: 6,
  shieldCells: 6,
  ammoBoxes: 8,
  smokeBombs: 5,
};

/** Smoke: a thrown canister that blooms into a cloud bots cannot see through. */
export const SMOKE = {
  maxCarry: 3,
  radius: 95,
  life: 6,
  throwDist: 150,
};

export const CRATE = { radius: 20, hp: 3 };

export { PALETTE };
