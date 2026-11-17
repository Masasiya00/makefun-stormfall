// The STORMFALL palette: one coherent set. Every colour in the game comes from here, so
// the island, the storm, the combatants and the HUD always read as one scene.
export const PALETTE = {
  backdrop: '#0a0f1a',
  grass: '#2f6b3a',
  grassDark: '#26592f',
  grassLight: '#3a7d46',
  sand: '#c9a86a',
  sandEdge: '#a8874f',
  water: '#1d4e6b',
  waterDeep: '#123a52',
  tree: '#1d4a26',
  treeTop: '#2f7a3d',
  rock: '#6b7280',
  rockDark: '#4b5563',
  wall: '#8a7a5a',
  wallTop: '#b09a6d',
  crate: '#b45309',
  crateEdge: '#92400e',
  storm: '#a855f7',
  stormDeep: '#7c3aed',
  stormTint: 'rgba(124, 58, 237, 0.28)',
  zone: '#e9d5ff',
  player: '#4de8ff',
  playerCore: '#e8fbff',
  bot: '#ff9a3d',
  bullet: '#ffe9a8',
  enemyBullet: '#ffb03d',
  lootWeapon: '#ffd75e',
  medkit: '#4ade80',
  shield: '#60a5fa',
  ammo: '#fbbf24',
  text: '#eef4ff',
  muted: '#9aa3b5',
  panel: 'rgba(8, 13, 26, 0.85)',
  panelEdge: '#2a3a5e',
  accent: '#4de8ff',
  danger: '#ff4d5e',
  gold: '#ffd75e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

/** Where the best placement is kept between visits (this browser only). */
export const BEST_KEY = 'stormfall.best';
