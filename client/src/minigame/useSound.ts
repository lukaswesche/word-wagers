import { useCallback, useEffect, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────
// Mini-game sound hook
//
// Uses Web Audio API to generate small synth tones — no asset files needed.
// Sounds are subtle and game-feel focused: every event gets a short bleep
// that reinforces the action without becoming annoying.
//
// User preference is stored in localStorage ('mg:sound') and exposed via
// `enabled` + `toggle()`.
// ─────────────────────────────────────────────────────────────────────────

export type SoundKind =
  | 'correct'    // valid answer
  | 'wrong'      // invalid answer
  | 'duplicate'  // already-said answer
  | 'bidLock'    // bid locked in
  | 'reveal'     // round reveal chime
  | 'tick'       // last-3-seconds timer urgency
  | 'roundWin'
  | 'roundLose'
  | 'matchWin'
  | 'matchLose'
  | 'skip';

const SOUND_PREF_KEY = 'mg:sound';

function loadEnabled(): boolean {
  try {
    const v = localStorage.getItem(SOUND_PREF_KEY);
    return v !== 'off'; // default on
  } catch { return true; }
}

export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const enabledRef = useRef<boolean>(loadEnabled());

  // Lazily create AudioContext (must be after a user gesture in most browsers)
  const ctx = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!ctxRef.current) {
      try {
        const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
          ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        ctxRef.current = new Ctor();
      } catch { return null; }
    }
    // Some browsers suspend the context until user gesture
    if (ctxRef.current && ctxRef.current.state === 'suspended') {
      ctxRef.current.resume().catch(() => {});
    }
    return ctxRef.current;
  }, []);

  // Play a single tone with envelope
  const tone = useCallback((freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.15) => {
    const audio = ctx();
    if (!audio || !enabledRef.current) return;
    try {
      const osc = audio.createOscillator();
      const g = audio.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.value = 0;
      const now = audio.currentTime;
      g.gain.linearRampToValueAtTime(gain, now + 0.005); // attack
      g.gain.exponentialRampToValueAtTime(0.0001, now + duration); // decay
      osc.connect(g).connect(audio.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch { /* ignore */ }
  }, [ctx]);

  // Play a small sequence
  const sequence = useCallback((notes: [number, number, OscillatorType?, number?][]) => {
    let offset = 0;
    for (const [f, d, t, g] of notes) {
      setTimeout(() => tone(f, d, t ?? 'sine', g ?? 0.15), offset);
      offset += Math.floor(d * 1000 * 0.85);
    }
  }, [tone]);

  const play = useCallback((kind: SoundKind) => {
    if (!enabledRef.current) return;
    switch (kind) {
      case 'correct':
        // Quick bright bleep
        tone(880, 0.08, 'triangle', 0.18);
        setTimeout(() => tone(1320, 0.07, 'triangle', 0.14), 50);
        break;
      case 'wrong':
        // Low buzz
        tone(160, 0.18, 'sawtooth', 0.10);
        break;
      case 'duplicate':
        // Two-tone "nope" (muted)
        tone(440, 0.06, 'sine', 0.10);
        setTimeout(() => tone(330, 0.10, 'sine', 0.10), 50);
        break;
      case 'bidLock':
        // Confirming click
        tone(660, 0.06, 'square', 0.12);
        setTimeout(() => tone(880, 0.08, 'square', 0.10), 40);
        break;
      case 'reveal':
        // Bright reveal chime
        sequence([[523, 0.12, 'triangle', 0.12], [659, 0.14, 'triangle', 0.12], [784, 0.20, 'triangle', 0.14]]);
        break;
      case 'tick':
        tone(1000, 0.04, 'square', 0.08);
        break;
      case 'roundWin':
        sequence([[660, 0.10, 'triangle', 0.16], [880, 0.10, 'triangle', 0.16], [1175, 0.22, 'triangle', 0.18]]);
        break;
      case 'roundLose':
        sequence([[440, 0.12, 'sine', 0.13], [349, 0.14, 'sine', 0.13], [262, 0.24, 'sine', 0.14]]);
        break;
      case 'matchWin':
        // Triumphant
        sequence([
          [523, 0.10, 'triangle', 0.16],
          [659, 0.10, 'triangle', 0.16],
          [784, 0.10, 'triangle', 0.16],
          [1047, 0.32, 'triangle', 0.20],
        ]);
        break;
      case 'matchLose':
        sequence([
          [392, 0.14, 'sine', 0.14],
          [349, 0.14, 'sine', 0.14],
          [294, 0.32, 'sine', 0.14],
        ]);
        break;
      case 'skip':
        // Whoosh-ish
        tone(220, 0.06, 'sawtooth', 0.10);
        setTimeout(() => tone(165, 0.12, 'sawtooth', 0.10), 60);
        break;
    }
  }, [tone, sequence]);

  const toggle = useCallback((): boolean => {
    enabledRef.current = !enabledRef.current;
    try { localStorage.setItem(SOUND_PREF_KEY, enabledRef.current ? 'on' : 'off'); } catch { /* ignore */ }
    if (enabledRef.current) tone(700, 0.10, 'triangle', 0.14);
    return enabledRef.current;
  }, [tone]);

  // Cleanup
  useEffect(() => {
    return () => {
      try { ctxRef.current?.close(); } catch { /* ignore */ }
      ctxRef.current = null;
    };
  }, []);

  return { play, toggle, isEnabled: () => enabledRef.current };
}
