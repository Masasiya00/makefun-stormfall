// Keyboard and pointer input. Held keys give a move direction; the mouse gives an aim
// point (converted to world coordinates through the camera); one-shot presses (start,
// restart, pause, reload, pickup, weapon slots, mute) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost and never counted twice.
// Firing is a held mouse button; semi-auto weapons also take a per-click edge.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RELOAD = 8;
export const ACTION_PICKUP = 16;
export const ACTION_SLOT1 = 32;
export const ACTION_SLOT2 = 64;
export const ACTION_SMOKE = 128;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter', 'Space']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RELOAD = new Set(['KeyR']);
const PICKUP = new Set(['KeyE']);
const SLOT1 = new Set(['Digit1']);
const SLOT2 = new Set(['Digit2']);
const SMOKE = new Set(['KeyQ']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  // Mouse in screen pixels; aimWorld converts it with the camera.
  let mouseX = 640;
  let mouseY = 400;
  let firing = false;
  let fireEdge = false;
  /** A forced move vector (the screenshot autopilot); null means read the keys. */
  let forcedMove = null;
  /** A forced sprint (the screenshot autopilot); null means read the Shift key. */
  let forcedSprint = null;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      keys.add(event.code);
      event.preventDefault();
    }
    if (SPRINT.has(event.code)) {
      keys.add(event.code);
      event.preventDefault();
    }
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
    }
    if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    }
    if (RELOAD.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RELOAD;
    }
    if (PICKUP.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PICKUP;
    }
    if (SLOT1.has(event.code)) {
      if (!event.repeat) actions |= ACTION_SLOT1;
    }
    if (SLOT2.has(event.code)) {
      if (!event.repeat) actions |= ACTION_SLOT2;
    }
    if (SMOKE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_SMOKE;
    }
    if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.clear();
    firing = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    if (event.button === 0) {
      firing = true;
      fireEdge = true;
      actions |= ACTION_CONFIRM;
    }
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) firing = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Normalised move vector from WASD / arrows (or the autopilot's forced vector). */
    move() {
      if (forcedMove) return forcedMove;
      const x = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
      const y = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
      const len = Math.hypot(x, y);
      return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
    },
    /** Whether Shift is held (sprint). */
    isSprinting() {
      if (forcedSprint !== null) return forcedSprint;
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    /** The mouse aim point in world coordinates, through the camera. The camera carries
     * its centre (x, y) plus the CSS-pixel scale and origin of the 1280x800 viewport, so
     * a screen point converts to the world in one step. The autopilot's stored world
     * point, when set, wins outright. */
    aimWorld(camera) {
      if (this._aimWorld) return this._aimWorld;
      return {
        x: camera.x + (mouseX - camera.ox) / camera.scale - 640,
        y: camera.y + (mouseY - camera.oy) / camera.scale - 400,
      };
    },
    /** Set the aim point in world coordinates (used by the screenshot autopilot). */
    setAimWorld(x, y) {
      mouseX = 640;
      mouseY = 400;
      // Stored as a world point; aimWorld reads it back through the camera.
      this._aimWorld = { x, y };
    },
    /** Whether the fire button is held. */
    isFiring() {
      return firing;
    },
    /** One per-click edge for semi-auto weapons; consumed on read. */
    consumeFireEdge() {
      const e = fireEdge;
      fireEdge = false;
      return e;
    },
    /** Force the move vector (used by the screenshot autopilot); pass null to read the keys. */
    setMove(x, y) {
      if (x === null || y === null) {
        forcedMove = null;
        return;
      }
      const len = Math.hypot(x, y);
      forcedMove = len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
    },
    /** Force sprint on/off (used by the screenshot autopilot); pass null to read Shift. */
    setSprinting(value) {
      forcedSprint = value;
    },
    /** Set the aim point in screen pixels (used by the screenshot autopilot). */
    setAim(x, y) {
      mouseX = x;
      mouseY = y;
      this._aimWorld = null;
    },
    /** Hold or release fire (used by the screenshot autopilot). */
    setFiring(value) {
      firing = value;
      if (value) fireEdge = true;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Queue a one-shot action (used by the screenshot autopilot). */
    queueAction(flag) {
      actions |= flag;
    },
    /** The stored world aim point, if the autopilot set one; null otherwise. */
    _aimWorld: null,
  };
}
