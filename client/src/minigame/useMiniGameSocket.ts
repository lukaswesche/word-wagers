import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from '../socket';
import { getOrCreatePlayerId } from '../playerId';

export type MGItemStatus = 'valid' | 'invalid' | 'duplicate';

export type MGJudgedItem = { raw: string; status: MGItemStatus };

export type MGPhase =
  | 'waiting'
  | 'reveal'
  | 'bidding'
  | 'bidReveal'
  | 'performing'
  | 'result'
  | 'matchOver'
  | 'paused';

export type MGRoundRecord = {
  categoryId: string;
  short: string;
  bids: { [playerId: string]: number };
  results: { [playerId: string]: { validCount: number; pct: number; judged: MGJudgedItem[] } };
  winnerId: string;
};

export type MGPerformingState = {
  byPlayer: { [playerId: string]: { validCount: number; judged: MGJudgedItem[]; done: boolean } };
};

export type MGSnapshot = {
  code: string;
  phase: MGPhase;
  players: { id: string; name: string; connected: boolean }[];
  category: { id: string; short: string; prompt: string } | null;
  bids: { [playerId: string]: number };
  performing: MGPerformingState | null;
  history: MGRoundRecord[];
  scores: { [playerId: string]: number };
  bestOf: number;
  winsNeeded: number;
  phaseStartedAt: number;
  phaseDurationMs: number;
  serverTime: number;
};

type Ack<T = void> = T extends void
  ? { ok: true } | { ok: false; error: string }
  : ({ ok: true } & T) | { ok: false; error: string };

export type UseMiniGameSocket = {
  myId: string;
  state: MGSnapshot | null;
  error: string | null;
  connected: boolean;
  create: (name: string) => Promise<{ ok: true; code: string } | { ok: false; error: string }>;
  join: (code: string, name: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  leave: () => void;
  placeBid: (count: number) => void;
  pushItem: (item: string) => void;
  pushItems: (items: string[]) => void;
  performDone: () => void;
  nextRound: () => void;
  rematch: () => void;
};

export function useMiniGameSocket(): UseMiniGameSocket {
  const myIdRef = useRef<string>(getOrCreatePlayerId());
  const [state, setState] = useState<MGSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      // Identify ourselves so other socket events that need playerId can work
      socket.emit('hello', { playerId: myIdRef.current });
    };
    const onDisconnect = () => setConnected(false);
    const onState = (s: MGSnapshot) => setState(s);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('mg-state', onState);
    if (!socket.connected) socket.connect();
    else onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('mg-state', onState);
    };
  }, []);

  const create = useCallback((name: string) => {
    return new Promise<{ ok: true; code: string } | { ok: false; error: string }>((resolve) => {
      socket.emit('mg-create', { playerId: myIdRef.current, name }, (res: Ack<{ code: string; playerId: string }>) => {
        if (!res.ok) { setError(res.error); resolve(res); return; }
        setError(null);
        resolve({ ok: true, code: res.code });
      });
    });
  }, []);

  const join = useCallback((code: string, name: string) => {
    return new Promise<{ ok: true } | { ok: false; error: string }>((resolve) => {
      socket.emit('mg-join', { code: code.toUpperCase(), playerId: myIdRef.current, name }, (res: Ack<{ playerId: string }>) => {
        if (!res.ok) { setError(res.error); resolve(res); return; }
        setError(null);
        resolve({ ok: true });
      });
    });
  }, []);

  const leave = useCallback(() => {
    socket.emit('mg-leave', {});
    setState(null);
  }, []);

  const placeBid = useCallback((count: number) => { socket.emit('mg-bid', { count }); }, []);
  const pushItem = useCallback((item: string) => { socket.emit('mg-perform-item', { item }); }, []);
  const pushItems = useCallback((items: string[]) => {
    if (!items.length) return;
    socket.emit('mg-perform-batch', { items });
  }, []);
  const performDone = useCallback(() => { socket.emit('mg-perform-done', {}); }, []);
  const nextRound = useCallback(() => { socket.emit('mg-next-round', {}); }, []);
  const rematch = useCallback(() => { socket.emit('mg-rematch', {}); }, []);

  return {
    myId: myIdRef.current,
    state,
    error,
    connected,
    create, join, leave,
    placeBid, pushItem, pushItems, performDone, nextRound, rematch,
  };
}
