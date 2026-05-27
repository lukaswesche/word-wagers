import { useCallback, useEffect, useRef, useState } from 'react';

// Minimal typings for Web Speech API (not in lib.dom by default for SpeechRecognition).
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    0: { transcript: string };
    isFinal: boolean;
    length: number;
  }>;
};

type W = typeof window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

function getCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as W;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceSupported(): boolean {
  if (getCtor() === null) return false;
  // Browsers block microphone on non-secure origins (http://) except localhost
  if (typeof window !== 'undefined' &&
      window.location.protocol !== 'https:' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1') {
    return false;
  }
  return true;
}

export type UseVoiceResult = {
  supported: boolean;
  listening: boolean;
  items: string[];
  interim: string;
  start: () => void;
  stop: () => void;
  reset: () => void;
  pushItem: (s: string) => void;
  error: string | null;
};

/**
 * Voice input for the mini-game's perform phase.
 *
 * Notes on Web Speech API quirks (Chrome / Safari):
 *  - "continuous" mode still stops after long silences -> we auto-restart while
 *    the caller has requested listening.
 *  - Permission denied is permanent for the page; surfaced via the error field.
 *  - Each finalized segment is split on commas / "and" / "then" / semicolons.
 */
export function useVoice(): UseVoiceResult {
  const supported = isVoiceSupported();
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListeningRef = useRef(false);
  const restartCountRef = useRef(0);
  const [listening, setListening] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const splitPhrase = useCallback((phrase: string): string[] => {
    return phrase
      .split(/,|\band\b|\bthen\b|;|\n/i)
      .map(s => s.trim())
      .filter(Boolean);
  }, []);

  const createInstance = useCallback((): SpeechRecognitionLike | null => {
    const Ctor = getCtor();
    if (!Ctor) return null;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;
    return rec;
  }, []);

  const attach = useCallback((rec: SpeechRecognitionLike) => {
    rec.onstart = () => {
      setListening(true);
      setError(null);
    };
    rec.onresult = (e) => {
      let liveInterim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript;
        if (r.isFinal) {
          const parts = splitPhrase(text);
          if (parts.length) setItems(prev => [...prev, ...parts]);
        } else {
          liveInterim += text;
        }
      }
      setInterim(liveInterim);
    };
    rec.onerror = (ev) => {
      const code = ev.error ?? 'unknown';
      // 'no-speech' fires constantly in long silences; ignore.
      // 'aborted' fires on manual stop.
      if (code === 'no-speech' || code === 'aborted') return;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setError('Microphone permission denied. Use the text input.');
        wantListeningRef.current = false;
      } else if (code === 'audio-capture') {
        setError('No microphone found. Use the text input.');
        wantListeningRef.current = false;
      } else {
        setError(`Voice error: ${code}`);
      }
    };
    rec.onend = () => {
      setListening(false);
      setInterim('');
      // Auto-restart if caller still wants listening (Chrome silence stop).
      if (wantListeningRef.current && restartCountRef.current < 50) {
        restartCountRef.current += 1;
        try {
          rec.start();
        } catch {
          // start can throw if invoked too soon after stop; schedule a retry.
          setTimeout(() => {
            if (wantListeningRef.current) {
              try { rec.start(); } catch { /* give up silently */ }
            }
          }, 150);
        }
      }
    };
  }, [splitPhrase]);

  const start = useCallback(() => {
    if (!supported) {
      setError('Voice not supported in this browser. Use the text input.');
      return;
    }
    if (recRef.current && wantListeningRef.current) return;
    const rec = recRef.current ?? createInstance();
    if (!rec) return;
    if (!recRef.current) attach(rec);
    recRef.current = rec;
    wantListeningRef.current = true;
    restartCountRef.current = 0;
    try {
      rec.start();
    } catch (e) {
      // Already started -> ignore. Otherwise surface.
      const msg = String(e);
      if (!/already started/i.test(msg)) setError(msg);
    }
  }, [supported, createInstance, attach]);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    const rec = recRef.current;
    if (!rec) return;
    try { rec.stop(); } catch { /* noop */ }
  }, []);

  const reset = useCallback(() => {
    setItems([]);
    setInterim('');
    setError(null);
  }, []);

  const pushItem = useCallback((s: string) => {
    const t = s.trim();
    if (t) setItems(prev => [...prev, t]);
  }, []);

  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      const rec = recRef.current;
      if (rec) {
        try { rec.abort(); } catch { /* noop */ }
      }
    };
  }, []);

  return { supported, listening, items, interim, start, stop, reset, pushItem, error };
}
