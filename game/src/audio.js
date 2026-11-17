// Procedural WebAudio sounds: every sound is synthesized from oscillators and filtered noise,
// so the game needs no audio files. The context is created on the first user gesture (browsers
// block audio before one); in headless screenshot mode it simply stays silent.

let ctx = null;
let master = null;
let muted = false;
let noiseBuffer = null;
/** The vehicle engine loop: one persistent oscillator, started on mount, stopped
 * on dismount or destruction. Its pitch follows the speed; the master gain mutes it. */
let engineOsc = null;
let engineGain = null;
let engineFilter = null;

function ensureContext() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
    const len = ctx.sampleRate * 0.5;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Call from a user gesture (start / restart) so audio is allowed. */
export function unlockAudio() {
  const c = ensureContext();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function setMuted(value) {
  muted = value;
  if (master) master.gain.value = value ? 0 : 0.32;
}
export function isMuted() {
  return muted;
}

/** Start the engine loop (called on mount). Silent until engine() sets its pitch. */
export function engineStart() {
  if (muted) return;
  const c = ensureContext();
  if (!c || !master || engineOsc) return;
  try {
    engineOsc = c.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineFilter = c.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = c.createGain();
    engineGain.gain.value = 0.045;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  } catch {
    engineOsc = null;
  }
}

/** Follow the speed (0..1) and boost: pitch and loudness rise with the throttle. */
export function engine(speed01, boosting) {
  if (muted || !engineOsc || !ctx) return;
  try {
    const target = 55 + speed01 * 75 + (boosting ? 30 : 0);
    engineOsc.frequency.setTargetAtTime(target, ctx.currentTime, 0.08);
    if (engineGain) engineGain.gain.setTargetAtTime(0.035 + speed01 * 0.035, ctx.currentTime, 0.1);
  } catch {
    // Audio is decoration; never let it break the game.
  }
}

/** Stop the engine loop (dismount or destruction). */
export function engineStop() {
  if (!engineOsc) return;
  try {
    engineOsc.stop();
  } catch {
    // Already stopped.
  }
  engineOsc = null;
  engineGain = null;
  engineFilter = null;
}

function tone(freq, dur, type, vol, slideTo) {
  if (muted) return;
  const c = ensureContext();
  if (!c || !master) return;
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), c.currentTime + dur);
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(c.currentTime + dur);
  } catch {
    // Audio is decoration; never let it break the game.
  }
}

function noise(dur, vol, filterFreq, filterType) {
  if (muted) return;
  const c = ensureContext();
  if (!c || !master || !noiseBuffer) return;
  try {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = filterType || 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
    src.stop(c.currentTime + dur);
  } catch {
    // Audio is decoration; never let it break the game.
  }
}

const SHOOT_TONES = {
  pistol: () => tone(720, 0.07, 'square', 0.10, 320),
  scattergun: () => {
    noise(0.16, 0.22, 900);
    tone(140, 0.14, 'sawtooth', 0.12, 60);
  },
  rifle: () => tone(880, 0.05, 'square', 0.08, 420),
  longshot: () => {
    noise(0.25, 0.28, 1600, 'highpass');
    tone(320, 0.22, 'sawtooth', 0.14, 70);
  },
};

export const sfx = {
  engineStart() {
    engineStart();
  },
  engine(speed01, boosting) {
    engine(speed01, boosting);
  },
  engineStop() {
    engineStop();
  },
  shoot(id) {
    (SHOOT_TONES[id] || SHOOT_TONES.pistol)();
  },
  hit() {
    tone(240, 0.06, 'sawtooth', 0.10, 150);
  },
  elim() {
    tone(523, 0.12, 'sine', 0.16, 784);
    setTimeout(() => tone(784, 0.16, 'sine', 0.16, 1046), 90);
  },
  pickup() {
    tone(880, 0.09, 'sine', 0.14, 1320);
  },
  crate() {
    noise(0.2, 0.2, 700);
    tone(330, 0.1, 'triangle', 0.14, 660);
  },
  hurt() {
    tone(180, 0.25, 'sawtooth', 0.2, 60);
    noise(0.2, 0.18, 500);
  },
  stormWarn() {
    tone(196, 0.4, 'triangle', 0.18, 147);
    setTimeout(() => tone(147, 0.4, 'triangle', 0.18, 98), 220);
  },
  stormHit() {
    tone(110, 0.2, 'sawtooth', 0.08, 70);
  },
  reload() {
    tone(520, 0.06, 'square', 0.07, 620);
    setTimeout(() => tone(620, 0.06, 'square', 0.07, 700), 120);
  },
  victory() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.18), i * 130));
  },
  defeat() {
    [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.16), i * 170));
  },
  /** A distant firefight: a muffled shot from far away, so the island sounds at war
   * even when nobody is near. Quiet, low-passed, slightly random each time. */
  distantShot() {
    noise(0.22, 0.05, 420);
    tone(90 + Math.random() * 40, 0.18, 'sawtooth', 0.04, 45);
  },
  /** A real explosion: a deep boom (low noise + a falling sub tone) for a destroyed
   * vehicle or a landed supply drop. */
  explosion() {
    noise(0.7, 0.4, 320);
    tone(90, 0.6, 'sawtooth', 0.3, 28);
    tone(55, 0.8, 'sine', 0.28, 24);
  },
  /** One helicopter rotor whump, louder the closer the chopper is (0..1). */
  rotor(close01) {
    if (close01 <= 0.02) return;
    noise(0.16, 0.03 + close01 * 0.12, 260);
    tone(42, 0.16, 'sine', 0.03 + close01 * 0.09, 36);
  },
  /** A supply drop is coming: two rising notes, so the player looks up. */
  supplyWarn() {
    tone(440, 0.12, 'triangle', 0.14, 660);
    setTimeout(() => tone(660, 0.14, 'triangle', 0.14, 880), 130);
  },
  /** A footstep: a soft filtered thud. Sand is drier and higher than grass. */
  step(surface) {
    if (surface === 'sand') noise(0.06, 0.05, 900, 'bandpass');
    else noise(0.05, 0.04, 500);
  },
};
