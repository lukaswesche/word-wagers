// Synthesized Jackbox-style sound effects via Web Audio API — no audio files needed.

export type SoundName =
  | 'join'         // player joins a team
  | 'phase'        // phase transition whoosh
  | 'bid_raise'    // bid placed / raised
  | 'challenge'    // challenge declared
  | 'tile_pick'    // board tile selected
  | 'tile_deselect'// board tile deselected
  | 'hint_reveal'  // hint shown to guessers
  | 'win'          // winner fanfare
  | 'lose'         // loser sad trombone
  | 'taunt'        // taunt overlay slam
  | 'timer_warn'   // countdown tick ≤10 s
  | 'submit';      // guesses submitted

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & { __ww_ctx?: AudioContext };
  if (!w.__ww_ctx) {
    try { w.__ww_ctx = new AudioContext(); } catch { return null; }
  }
  return w.__ww_ctx;
}

function resume(ctx: AudioContext) {
  if (ctx.state === 'suspended') ctx.resume();
}

function tone(
  ctx: AudioContext,
  freq: number,
  type: OscillatorType,
  vol: number,
  at: number,
  dur: number,
  endFreq?: number,
) {
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.connect(g);
  g.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (endFreq !== undefined)
    osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 10), at + dur);
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

function noise(ctx: AudioContext, vol: number, at: number, dur: number, bpFreq = 1000) {
  const buf  = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++)
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = bpFreq;
  bp.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(bp); bp.connect(g); g.connect(ctx.destination);
  src.start(at); src.stop(at + dur + 0.02);
}

const SOUNDS: Record<SoundName, (ctx: AudioContext) => void> = {
  join(ctx) {
    const t = ctx.currentTime;
    tone(ctx, 440, 'sine', 0.14, t,        0.10);
    tone(ctx, 550, 'sine', 0.14, t + 0.09, 0.10);
    tone(ctx, 660, 'sine', 0.18, t + 0.18, 0.18);
  },

  phase(ctx) {
    const t = ctx.currentTime;
    [220, 330, 440, 660].forEach((f, i) =>
      tone(ctx, f, i < 3 ? 'sine' : 'triangle', 0.10 + i * 0.03, t + i * 0.09, 0.18 + i * 0.02)
    );
    noise(ctx, 0.06, t, 0.38, 1200);
  },

  bid_raise(ctx) {
    const t = ctx.currentTime;
    tone(ctx, 320, 'square', 0.09, t,        0.06, 460);
    tone(ctx, 460, 'square', 0.11, t + 0.05, 0.08, 580);
  },

  challenge(ctx) {
    const t = ctx.currentTime;
    tone(ctx, 180, 'sawtooth', 0.18, t,        0.08);
    tone(ctx, 155, 'sawtooth', 0.18, t + 0.07, 0.08);
    tone(ctx, 120, 'sawtooth', 0.20, t + 0.14, 0.18, 60);
    noise(ctx, 0.14, t, 0.14);
  },

  tile_pick(ctx) {
    const t = ctx.currentTime;
    tone(ctx, 1100, 'sine', 0.13, t, 0.07, 800);
  },

  tile_deselect(ctx) {
    const t = ctx.currentTime;
    tone(ctx, 600, 'sine', 0.10, t, 0.07, 400);
  },

  hint_reveal(ctx) {
    const t = ctx.currentTime;
    [261, 329, 392, 523, 659, 784, 1046].forEach((f, i) =>
      tone(ctx, f, 'triangle', 0.13 + i * 0.01, t + i * 0.065, 0.20 + i * 0.02)
    );
  },

  win(ctx) {
    const t = ctx.currentTime;
    [523, 659, 784].forEach((f, i) =>
      tone(ctx, f, 'triangle', 0.12, t + i * 0.10, 0.22)
    );
    for (let i = 0; i < 3; i++)
      tone(ctx, 1320 + i * 220, 'sine', 0.04, t + 0.22 + i * 0.06, 0.14);
  },

  lose(ctx) {
    const t = ctx.currentTime;
    [349, 311, 261, 196].forEach((f, i) =>
      tone(ctx, f, 'sawtooth', 0.13, t + i * 0.20, 0.30)
    );
  },

  taunt(ctx) {
    const t = ctx.currentTime;
    // Impact
    tone(ctx, 80, 'sawtooth', 0.32, t, 0.14, 30);
    noise(ctx, 0.22, t, 0.18);
    // Alarm pulses
    for (let i = 0; i < 5; i++) {
      tone(ctx, 880, 'square', 0.16, t + 0.18 + i * 0.14, 0.07);
      tone(ctx, 660, 'square', 0.12, t + 0.24 + i * 0.14, 0.05);
    }
  },

  timer_warn(ctx) {
    const t = ctx.currentTime;
    tone(ctx, 1200, 'square', 0.07, t, 0.04);
  },

  submit(ctx) {
    const t = ctx.currentTime;
    tone(ctx, 400, 'sine',     0.13, t,        0.08, 620);
    tone(ctx, 620, 'sine',     0.13, t + 0.07, 0.10, 840);
    tone(ctx, 840, 'triangle', 0.16, t + 0.15, 0.22);
  },
};

export function playSound(name: SoundName) {
  const ctx = getCtx();
  if (!ctx) return;
  resume(ctx);
  try { SOUNDS[name](ctx); } catch { /* ignore */ }
}

export function vibrate(pattern: number | number[] = [80, 60, 120, 60, 200]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}
