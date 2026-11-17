// Procedural WebAudio sounds: every sound is synthesized from oscillators and filtered noise,
// so the game needs no audio files. The context is created on the first user gesture (browsers
// block audio before one); in headless screenshot mode it simply stays silent.

let ctx = null;
let master = null;
let muted = false;
let noiseBuffer = null;

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
};
