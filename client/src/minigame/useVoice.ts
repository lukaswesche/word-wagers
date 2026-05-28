import { useCallback, useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────
// Voice input hook
//
// Audited & rewritten to fix:
//  - InvalidStateError crashes when start() called on a running instance
//  - Aggressive auto-restart loops that fired hundreds of times/sec on errors
//  - No explicit permission prompt: now exposes ensurePermission() so the UI
//    can show a clear "Enable microphone" button before the game starts
//  - Permission state cached in localStorage so we don't keep asking
//  - Clean teardown on unmount (abort + null all handlers) prevents stale
//    onend callbacks firing into unmounted components
// ─────────────────────────────────────────────────────────────────────────

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

// ─────── Permission state caching ───────

const PERM_KEY = 'mg:voice-permission';
type PermState = 'unknown' | 'granted' | 'denied' | 'prompt';

function loadCachedPermission(): PermState {
  try {
    const v = localStorage.getItem(PERM_KEY);
    if (v === 'granted' || v === 'denied' || v === 'prompt') return v;
  } catch { /* ignore */ }
  return 'unknown';
}

function saveCachedPermission(state: PermState) {
  try { localStorage.setItem(PERM_KEY, state); } catch { /* ignore */ }
}

// Query the browser's permission API (when supported) to get accurate state
async function queryMicPermission(): Promise<PermState> {
  try {
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (status.state === 'granted') return 'granted';
      if (status.state === 'denied') return 'denied';
      if (status.state === 'prompt') return 'prompt';
    }
  } catch { /* permissions API may throw on unsupported names */ }
  return loadCachedPermission();
}

// ─────── Hook ───────

export type UseVoiceResult = {
  supported: boolean;
  permission: PermState;
  listening: boolean;
  items: string[];
  interim: string;
  ensurePermission: () => Promise<PermState>;
  start: () => void;
  stop: () => void;
  reset: () => void;
  pushItem: (s: string) => void;
  error: string | null;
};

export function useVoice(): UseVoiceResult {
  const supported = isVoiceSupported();
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListeningRef = useRef(false);
  const restartCountRef = useRef(0);
  const restartTimerRef = useRef<number | null>(null);
  const unmountedRef = useRef(false);
  const [listening, setListening] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<PermState>(() =>
    supported ? loadCachedPermission() : 'denied'
  );

  // Update permission state from browser on mount
  useEffect(() => {
    if (!supported) return;
    queryMicPermission().then(p => {
      if (unmountedRef.current) return;
      if (p !== 'unknown') {
        setPermission(p);
        saveCachedPermission(p);
      }
    });
  }, [supported]);

  const splitPhrase = useCallback((phrase: string): string[] => {
    // Split on natural list separators. Server-side fuzzy matching handles
    // any joined-too-fast utterances via greedy multi-word matching.
    return phrase
      .split(/,|\band\b|\bthen\b|\balso\b|\bnext\b|;|\n|\.\s|\?\s|!\s/i)
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

  const teardown = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    const rec = recRef.current;
    if (rec) {
      rec.onstart = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try { rec.abort(); } catch { /* noop */ }
      recRef.current = null;
    }
    setListening(false);
  }, []);

  const attach = useCallback((rec: SpeechRecognitionLike) => {
    rec.onstart = () => {
      if (unmountedRef.current) return;
      setListening(true);
      setError(null);
      setPermission('granted');
      saveCachedPermission('granted');
    };
    rec.onresult = (e) => {
      if (unmountedRef.current) return;
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
      if (unmountedRef.current) return;
      const code = ev.error ?? 'unknown';
      // 'no-speech' fires constantly in silence; ignore.
      // 'aborted' fires on manual stop.
      if (code === 'no-speech' || code === 'aborted') return;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setError('Microphone permission denied. Use the text input.');
        setPermission('denied');
        saveCachedPermission('denied');
        wantListeningRef.current = false;
      } else if (code === 'audio-capture') {
        setError('No microphone found. Use the text input.');
        wantListeningRef.current = false;
      } else if (code === 'network') {
        setError('Voice network error. Try text input.');
        wantListeningRef.current = false;
      } else {
        // Don't show every transient error to the user; just log
        console.warn('[voice]', code);
      }
    };
    rec.onend = () => {
      if (unmountedRef.current) return;
      setListening(false);
      setInterim('');
      // Auto-restart with backoff to avoid runaway loops
      if (wantListeningRef.current && restartCountRef.current < 20) {
        restartCountRef.current += 1;
        const delay = Math.min(150 + restartCountRef.current * 50, 1000);
        if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = window.setTimeout(() => {
          restartTimerRef.current = null;
          if (!wantListeningRef.current || unmountedRef.current) return;
          try { rec.start(); }
          catch (e) {
            // InvalidStateError → already started; just leave it alone.
            if (!/already started|InvalidState/i.test(String(e))) console.warn('[voice restart]', e);
          }
        }, delay);
      } else if (restartCountRef.current >= 20) {
        setError('Voice recognition stopped. Switch to text input.');
      }
    };
  }, [splitPhrase]);

  // Explicit permission gate — call this from a user click to trigger
  // the browser permission prompt without committing to a long listening session.
  const ensurePermission = useCallback(async (): Promise<PermState> => {
    if (!supported) return 'denied';
    // If already granted, we're done
    const cached = await queryMicPermission();
    if (cached === 'granted') { setPermission('granted'); return 'granted'; }
    if (cached === 'denied') { setPermission('denied'); return 'denied'; }
    // Trigger prompt by attempting getUserMedia (more reliable than SpeechRecognition for permission)
    try {
      if (navigator?.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Immediately stop the tracks — we don't need the stream, just the permission
        stream.getTracks().forEach(t => t.stop());
        setPermission('granted');
        saveCachedPermission('granted');
        return 'granted';
      }
    } catch (e) {
      const msg = String(e);
      if (/NotAllowed|denied/i.test(msg)) {
        setPermission('denied');
        saveCachedPermission('denied');
        return 'denied';
      }
      setError(`Mic error: ${msg}`);
    }
    return 'prompt';
  }, [supported]);

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
      const msg = String(e);
      // Already started — fine, leave it
      if (/already started|InvalidState/i.test(msg)) return;
      // NotAllowedError → permission denied at the system level
      if (/NotAllowed/i.test(msg)) {
        setError('Microphone permission denied. Use the text input.');
        setPermission('denied');
        saveCachedPermission('denied');
        wantListeningRef.current = false;
        return;
      }
      setError(msg);
    }
  }, [supported, createInstance, attach]);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
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

  // Clean teardown on unmount — prevents stale onend handlers re-firing
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      wantListeningRef.current = false;
      teardown();
    };
  }, [teardown]);

  return { supported, permission, listening, items, interim, ensurePermission, start, stop, reset, pushItem, error };
}
