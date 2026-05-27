/**
 * Mini-game ("Bid & Brag") 1v1 socket server.
 *
 * - Server owns the phase timer; clients render based on phaseStartedAt + duration.
 * - Disconnects keep the player's slot for RECONNECT_GRACE_MS; same playerId
 *   on `mg-rejoin` restores them and the active phase timer is unpaused.
 * - Categories loaded from data/mg-categories.json at startup (built by
 *   scripts/fetch-categories.mjs).
 */

import type { Server, Socket } from 'socket.io';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ───────────── Categories (loaded from JSON) ─────────────

type CategoryRaw = {
  id: string;
  short: string;
  prompt: string;
  answers: (string | string[])[];
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATHS = [
  path.resolve(__dirname, '../data/mg-categories.json'),
  path.resolve(__dirname, '../../data/mg-categories.json'),
];

function loadCategories(): CategoryRaw[] {
  for (const p of DATA_PATHS) {
    if (fs.existsSync(p)) {
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf8')) as CategoryRaw[];
        if (Array.isArray(data) && data.length > 0) {
          console.log(`mg: loaded ${data.length} categories from ${p}`);
          return data;
        }
      } catch (e) {
        console.warn(`mg: failed to parse ${p}`, e);
      }
    }
  }
  console.warn('mg: no category file found, falling back to seed list');
  return SEED_CATEGORIES;
}

// Fallback seed if no JSON bundle exists yet.
const SEED_CATEGORIES: CategoryRaw[] = [
  {
    id: 'pixar',
    short: 'Pixar movies',
    prompt: 'How many Pixar feature films can you name?',
    answers: [
      'Toy Story','Toy Story 2','Toy Story 3','Toy Story 4',
      "A Bug's Life",'Monsters Inc','Monsters University',
      'Finding Nemo','Finding Dory','The Incredibles','Incredibles 2',
      'Cars','Cars 2','Cars 3','Ratatouille','Wall-E','Up','Brave',
      'Inside Out','Inside Out 2','The Good Dinosaur','Coco','Onward',
      'Soul','Luca','Turning Red','Lightyear','Elemental',
    ],
  },
  {
    id: 'states',
    short: 'US states',
    prompt: 'How many US states can you name?',
    answers: [
      'Alabama','Alaska','Arizona','Arkansas','California','Colorado',
      'Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho',
      'Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana',
      'Maine','Maryland','Massachusetts','Michigan','Minnesota',
      'Mississippi','Missouri','Montana','Nebraska','Nevada',
      'New Hampshire','New Jersey','New Mexico','New York',
      'North Carolina','North Dakota','Ohio','Oklahoma','Oregon',
      'Pennsylvania','Rhode Island','South Carolina','South Dakota',
      'Tennessee','Texas','Utah','Vermont','Virginia','Washington',
      'West Virginia','Wisconsin','Wyoming',
    ],
  },
];

let CATEGORIES: CategoryRaw[] = loadCategories();

// Optional periodic reload so the build script can be re-run while the dev
// server is up. Only checks mtime; cheap.
let lastMtimeMs = 0;
function maybeReload() {
  for (const p of DATA_PATHS) {
    try {
      const st = fs.statSync(p);
      if (st.mtimeMs > lastMtimeMs) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8')) as CategoryRaw[];
        if (Array.isArray(data) && data.length > 0) {
          CATEGORIES = data;
          lastMtimeMs = st.mtimeMs;
          console.log(`mg: hot-reloaded ${data.length} categories`);
        }
      }
      return;
    } catch { /* try next */ }
  }
}

// ───────────── Judging ─────────────

function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/[.,!?'"`’]/g, '')
    .replace(/[-_/]/g, ' ')
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function variants(answer: string | string[]): string[] {
  return (Array.isArray(answer) ? answer : [answer]).map(normalize);
}

type ItemStatus = 'valid' | 'invalid' | 'duplicate';
type JudgedItem = { raw: string; status: ItemStatus };

function judgeItem(cat: CategoryRaw, raw: string, seen: Set<number>): JudgedItem {
  const n = normalize(raw);
  if (!n) return { raw, status: 'invalid' };
  for (let i = 0; i < cat.answers.length; i++) {
    if (variants(cat.answers[i]).includes(n)) {
      if (seen.has(i)) return { raw, status: 'duplicate' };
      seen.add(i);
      return { raw, status: 'valid' };
    }
  }
  return { raw, status: 'invalid' };
}

// ───────────── State ─────────────

type MGPhase =
  | 'waiting'
  | 'reveal'
  | 'bidding'
  | 'bidReveal'
  | 'performing'
  | 'result'
  | 'matchOver'
  | 'paused';

type MGPlayer = {
  playerId: string;
  socketId: string | null; // null while disconnected
  name: string;
  disconnectedAt: number | null;
};

// Per-player perform slot (both players now perform simultaneously)
type PerformSlot = { judged: JudgedItem[]; seen: Set<number>; done: boolean };

type RoundRecord = {
  categoryId: string;
  short: string;
  bids: { [playerId: string]: number };
  // per-player performance data (replaces single performerId/judged)
  results: { [playerId: string]: { validCount: number; pct: number; judged: JudgedItem[] } };
  winnerId: string;
};

type MGRoom = {
  code: string;
  hostId: string;
  players: MGPlayer[];
  phase: MGPhase;
  prePausedPhase: MGPhase | null;
  prePausedRemainingMs: number | null;
  category: CategoryRaw | null;
  bids: { [playerId: string]: number };
  // performing: both players perform simultaneously
  performing: { [playerId: string]: PerformSlot } | null;
  history: RoundRecord[];
  scores: { [playerId: string]: number };
  bestOf: number;
  createdAt: number;
  // server-side timer driving phase transitions
  phaseStartedAt: number; // ms epoch when current phase entered
  phaseDurationMs: number; // 0 = no auto-advance (lobby/result/matchOver)
  phaseTimer: NodeJS.Timeout | null;
};

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;
const BEST_OF = 3;

const REVEAL_MS = 3000;
const BID_MS = 8000;
const BID_REVEAL_MS = 2000;
const PERFORM_MS = 25000;
const RESULT_AUTO_MS = 0; // 0 = wait for client click; set to e.g. 15000 for auto-continue
const RECONNECT_GRACE_MS = 30000;

const rooms = new Map<string, MGRoom>();
const socketToRoom = new Map<string, string>();
const socketToPlayer = new Map<string, string>();

function makeCode(): string {
  let code = '';
  do {
    code = Array.from({ length: CODE_LENGTH }, () =>
      CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
    ).join('');
  } while (rooms.has(code));
  return code;
}

function pickCategory(exclude?: string | null): CategoryRaw {
  maybeReload();
  const pool = exclude && CATEGORIES.length > 1
    ? CATEGORIES.filter(c => c.id !== exclude)
    : CATEGORIES;
  return pool[Math.floor(Math.random() * pool.length)];
}

type MGStateSnapshot = {
  code: string;
  phase: MGPhase;
  players: { id: string; name: string; connected: boolean }[];
  category: { id: string; short: string; prompt: string } | null;
  bids: { [playerId: string]: number };
  // dual-perform: both players' live data during performing phase
  performing: {
    byPlayer: { [playerId: string]: { validCount: number; judged: JudgedItem[]; done: boolean } };
  } | null;
  history: RoundRecord[];
  scores: { [playerId: string]: number };
  bestOf: number;
  winsNeeded: number;
  phaseStartedAt: number;
  phaseDurationMs: number;
  serverTime: number; // for clock-skew correction on the client
};

// Build a snapshot personalized for a specific player:
//  - During bidding: mask opponent's bid until bidReveal
//  - During performing: strip opponent's judged items (only send validCount + done)
function snapshotFor(room: MGRoom, myPlayerId: string): MGStateSnapshot {
  // Bids: during bidding phase, only reveal own bid
  let bids: { [pid: string]: number };
  if (room.phase === 'bidding') {
    bids = {};
    if (typeof room.bids[myPlayerId] === 'number') bids[myPlayerId] = room.bids[myPlayerId];
  } else {
    bids = { ...room.bids };
  }

  // Performing: full judged list for self, validCount+done only for opponents
  let performingSnap: MGStateSnapshot['performing'] = null;
  if (room.performing) {
    const byPlayer: { [pid: string]: { validCount: number; judged: JudgedItem[]; done: boolean } } = {};
    for (const [pid, slot] of Object.entries(room.performing)) {
      const validCount = slot.judged.filter(j => j.status === 'valid').length;
      byPlayer[pid] = {
        validCount,
        // Only the owner gets the real judged array during performing; opponents get empty
        judged: (room.phase === 'performing' && pid !== myPlayerId) ? [] : slot.judged,
        done: slot.done,
      };
    }
    performingSnap = { byPlayer };
  }

  return {
    code: room.code,
    phase: room.phase,
    players: room.players.map(p => ({
      id: p.playerId,
      name: p.name,
      connected: p.socketId !== null,
    })),
    category: room.category
      ? { id: room.category.id, short: room.category.short, prompt: room.category.prompt }
      : null,
    bids,
    performing: performingSnap,
    history: room.history,
    scores: { ...room.scores },
    bestOf: room.bestOf,
    winsNeeded: Math.ceil(room.bestOf / 2),
    phaseStartedAt: room.phaseStartedAt,
    phaseDurationMs: room.phaseDurationMs,
    serverTime: Date.now(),
  };
}

// ───────────── Phase machine ─────────────

function clearPhaseTimer(room: MGRoom) {
  if (room.phaseTimer) {
    clearTimeout(room.phaseTimer);
    room.phaseTimer = null;
  }
}

function setPhase(room: MGRoom, phase: MGPhase, durationMs: number, onExpire?: () => void, emit?: () => void) {
  clearPhaseTimer(room);
  room.phase = phase;
  room.phaseStartedAt = Date.now();
  room.phaseDurationMs = durationMs;
  if (durationMs > 0 && onExpire) {
    room.phaseTimer = setTimeout(() => {
      room.phaseTimer = null;
      onExpire();
      emit?.();
    }, durationMs);
  }
}

function newRound(room: MGRoom, emit: () => void, prevCatId: string | null) {
  room.category = pickCategory(prevCatId);
  room.bids = {};
  room.performing = null;
  setPhase(room, 'reveal', REVEAL_MS, () => advanceToBidding(room, emit), emit);
}

function advanceToBidding(room: MGRoom, emit: () => void) {
  setPhase(room, 'bidding', BID_MS, () => {
    // Anyone who didn't bid gets a default bid of 1 to allow round to resolve
    for (const p of room.players) {
      if (typeof room.bids[p.playerId] !== 'number') {
        room.bids[p.playerId] = 1;
      }
    }
    resolveBids(room, emit);
  }, emit);
}

function resolveBids(room: MGRoom, emit: () => void) {
  // Both players now perform their own bids simultaneously.
  // BidReveal still shows who bid what; then both perform.
  setPhase(room, 'bidReveal', BID_REVEAL_MS, () => startPerforming(room, emit), emit);
}

function startPerforming(room: MGRoom, emit: () => void) {
  // Initialise a perform slot for every player in the room
  room.performing = {};
  for (const p of room.players) {
    room.performing[p.playerId] = { judged: [], seen: new Set(), done: false };
  }
  setPhase(room, 'performing', PERFORM_MS, () => finishRound(room, emit), emit);
}

function finishRound(room: MGRoom, emit: () => void) {
  if (!room.category || !room.performing) return;
  if (room.players.length < 2) return;

  // Percentage-based scoring: compare validCount / bid for each player
  const results: RoundRecord['results'] = {};
  for (const p of room.players) {
    const bid = room.bids[p.playerId] ?? 1;
    const slot = room.performing[p.playerId];
    const valid = slot ? slot.judged.filter(j => j.status === 'valid').length : 0;
    const pct = valid / bid;
    results[p.playerId] = { validCount: valid, pct, judged: slot?.judged ?? [] };
  }

  // Determine winner: higher percentage wins; ties go to the lower bidder (conservative play)
  const [p1, p2] = room.players;
  const r1 = results[p1.playerId];
  const r2 = results[p2.playerId];
  let winnerId: string;
  if (r1.pct > r2.pct) {
    winnerId = p1.playerId;
  } else if (r2.pct > r1.pct) {
    winnerId = p2.playerId;
  } else {
    // Tie: lower bidder wins (they were more conservative)
    const b1 = room.bids[p1.playerId] ?? 1;
    const b2 = room.bids[p2.playerId] ?? 1;
    winnerId = b1 <= b2 ? p1.playerId : p2.playerId;
  }

  room.scores[winnerId] = (room.scores[winnerId] ?? 0) + 1;

  const record: RoundRecord = {
    categoryId: room.category.id,
    short: room.category.short,
    bids: { ...room.bids },
    results,
    winnerId,
  };
  room.history.push(record);

  // Always show the result screen so players can review the round's answer comparison.
  // The mg-next-round handler decides whether to continue or declare matchOver.
  if (RESULT_AUTO_MS > 0) {
    const winsNeeded = Math.ceil(room.bestOf / 2);
    const topScore = Math.max(...Object.values(room.scores), 0);
    setPhase(room, 'result', RESULT_AUTO_MS, () => {
      if (topScore >= winsNeeded) {
        setPhase(room, 'matchOver', 0);
        emit();
      } else {
        newRound(room, emit, room.category?.id ?? null);
      }
    }, emit);
  } else {
    setPhase(room, 'result', 0);
  }
}

function pauseRoom(room: MGRoom) {
  if (room.phase === 'paused' || room.phase === 'waiting' || room.phase === 'matchOver') return;
  const elapsed = Date.now() - room.phaseStartedAt;
  const remaining = Math.max(0, room.phaseDurationMs - elapsed);
  room.prePausedPhase = room.phase;
  room.prePausedRemainingMs = remaining;
  clearPhaseTimer(room);
  room.phase = 'paused';
  room.phaseStartedAt = Date.now();
  room.phaseDurationMs = 0;
}

function resumeRoom(room: MGRoom, emit: () => void) {
  if (room.phase !== 'paused') return;
  const prev = room.prePausedPhase;
  const remaining = room.prePausedRemainingMs ?? 0;
  room.prePausedPhase = null;
  room.prePausedRemainingMs = null;
  if (!prev) return;
  if (remaining <= 0) {
    // Just advance to the next phase as if expired
    switch (prev) {
      case 'reveal': advanceToBidding(room, emit); break;
      case 'bidding': resolveBids(room, emit); break;
      case 'bidReveal': startPerforming(room, emit); break;
      case 'performing': finishRound(room, emit); break;
      default: setPhase(room, prev, 0); break;
    }
  } else {
    // Restart the phase with the remaining time
    const onExpire = (() => {
      switch (prev) {
        case 'reveal': return () => advanceToBidding(room, emit);
        case 'bidding': return () => {
          for (const p of room.players) {
            if (typeof room.bids[p.playerId] !== 'number') room.bids[p.playerId] = 1;
          }
          resolveBids(room, emit);
        };
        case 'bidReveal': return () => startPerforming(room, emit);
        case 'performing': return () => finishRound(room, emit);
        default: return undefined;
      }
    })();
    setPhase(room, prev, remaining, onExpire, emit);
  }
}

// ───────────── Public registration ─────────────

export function registerMiniGame(io: Server) {
  const emitState = (code: string) => {
    const room = rooms.get(code);
    if (!room) return;
    // Send personalized snapshots so players can't see each other's answers during perform
    // or each other's bids during bidding.
    for (const player of room.players) {
      if (!player.socketId) continue;
      io.to(player.socketId).emit('mg-state', snapshotFor(room, player.playerId));
    }
  };

  // Periodic sweep: evict players whose grace period has expired
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      const evicted: MGPlayer[] = [];
      for (const p of room.players) {
        if (p.socketId === null && p.disconnectedAt && now - p.disconnectedAt > RECONNECT_GRACE_MS) {
          evicted.push(p);
        }
      }
      if (evicted.length === 0) continue;
      room.players = room.players.filter(p => !evicted.includes(p));
      if (room.players.length === 0) {
        clearPhaseTimer(room);
        rooms.delete(room.code);
        continue;
      }
      // Opponent lost permanently — reset to waiting
      if (room.phase !== 'matchOver') {
        clearPhaseTimer(room);
        room.phase = 'waiting';
        room.prePausedPhase = null;
        room.prePausedRemainingMs = null;
        room.category = null;
        room.bids = {};
        room.performing = null;
        room.phaseStartedAt = Date.now();
        room.phaseDurationMs = 0;
      }
      emitState(room.code);
    }
  }, 2000);
  sweep.unref?.();

  const handleDisconnect = (socket: Socket) => {
    const code = socketToRoom.get(socket.id);
    const playerId = socketToPlayer.get(socket.id);
    socketToRoom.delete(socket.id);
    socketToPlayer.delete(socket.id);
    if (!code || !playerId) return;
    const room = rooms.get(code);
    if (!room) return;
    const player = room.players.find(p => p.playerId === playerId);
    if (!player) return;
    player.socketId = null;
    player.disconnectedAt = Date.now();
    // Pause if mid-game and both seats were filled
    if (room.players.length === 2 && room.phase !== 'waiting' && room.phase !== 'matchOver') {
      pauseRoom(room);
    }
    emitState(code);
  };

  io.on('connection', (socket: Socket) => {

    socket.on('mg-create', (
      payload: { playerId: string; name: string },
      ack: (res: { ok: true; code: string; playerId: string } | { ok: false; error: string }) => void,
    ) => {
      const playerId = payload?.playerId?.trim();
      const name = payload?.name?.trim() || 'Player';
      if (!playerId) return ack({ ok: false, error: 'playerId required' });
      const code = makeCode();
      const room: MGRoom = {
        code,
        hostId: playerId,
        players: [{ playerId, socketId: socket.id, name, disconnectedAt: null }],
        phase: 'waiting',
        prePausedPhase: null,
        prePausedRemainingMs: null,
        category: null,
        bids: {},
        performing: null,
        history: [],
        scores: { [playerId]: 0 },
        bestOf: BEST_OF,
        createdAt: Date.now(),
        phaseStartedAt: Date.now(),
        phaseDurationMs: 0,
        phaseTimer: null,
      };
      rooms.set(code, room);
      socketToRoom.set(socket.id, code);
      socketToPlayer.set(socket.id, playerId);
      socket.join(`mg:${code}`);
      ack({ ok: true, code, playerId });
      emitState(code);
    });

    socket.on('mg-join', (
      payload: { code: string; playerId: string; name: string },
      ack: (res: { ok: true; playerId: string } | { ok: false; error: string }) => void,
    ) => {
      const code = payload?.code?.trim().toUpperCase();
      const playerId = payload?.playerId?.trim();
      const name = payload?.name?.trim() || 'Player';
      if (!code || !playerId) return ack({ ok: false, error: 'code and playerId required' });
      const room = rooms.get(code);
      if (!room) return ack({ ok: false, error: 'Room not found' });
      const existing = room.players.find(p => p.playerId === playerId);
      if (!existing && room.players.length >= 2) {
        return ack({ ok: false, error: 'Room is full' });
      }
      if (existing) {
        existing.socketId = socket.id;
        existing.name = name;
        existing.disconnectedAt = null;
      } else {
        room.players.push({ playerId, socketId: socket.id, name, disconnectedAt: null });
        room.scores[playerId] = room.scores[playerId] ?? 0;
      }
      socketToRoom.set(socket.id, code);
      socketToPlayer.set(socket.id, playerId);
      socket.join(`mg:${code}`);

      const allConnected = room.players.every(p => p.socketId !== null);
      if (room.players.length === 2 && allConnected) {
        if (room.phase === 'waiting') {
          newRound(room, () => emitState(room.code), null);
        } else if (room.phase === 'paused') {
          resumeRoom(room, () => emitState(room.code));
        }
      }

      ack({ ok: true, playerId });
      emitState(code);
    });

    socket.on('mg-leave', (_p: unknown, ack?: (r: { ok: true }) => void) => {
      handleDisconnect(socket);
      ack?.({ ok: true });
    });

    socket.on('mg-bid', (
      payload: { count: number },
      ack?: (res: { ok: true } | { ok: false; error: string }) => void,
    ) => {
      const code = socketToRoom.get(socket.id);
      const playerId = socketToPlayer.get(socket.id);
      const room = code ? rooms.get(code) : null;
      if (!room || !playerId) return ack?.({ ok: false, error: 'Not in room' });
      if (room.phase !== 'bidding') return ack?.({ ok: false, error: 'Not in bidding phase' });
      const count = Math.max(1, Math.min(500, Math.floor(Number(payload?.count))));
      if (!Number.isFinite(count)) return ack?.({ ok: false, error: 'Bad bid' });
      room.bids[playerId] = count;
      // If both locked, resolve early; otherwise just broadcast updated bids
      const bothLocked = room.players.every(p => typeof room.bids[p.playerId] === 'number');
      if (bothLocked) resolveBids(room, () => emitState(room.code));
      else emitState(room.code);
      ack?.({ ok: true });
    });

    socket.on('mg-perform-batch', (
      payload: { items: string[] },
      ack?: (res: { ok: true } | { ok: false; error: string }) => void,
    ) => {
      const code = socketToRoom.get(socket.id);
      const playerId = socketToPlayer.get(socket.id);
      const room = code ? rooms.get(code) : null;
      if (!room || !playerId) return ack?.({ ok: false, error: 'Not in room' });
      if (room.phase !== 'performing') return ack?.({ ok: false, error: 'Not performing' });
      if (!room.category || !room.performing) return ack?.({ ok: false, error: 'Bad state' });
      const slot = room.performing[playerId];
      if (!slot || slot.done) return ack?.({ ok: true }); // locked in, ignore
      const items = Array.isArray(payload?.items) ? payload.items : [];
      for (const raw of items) {
        const s = String(raw ?? '').trim();
        if (!s) continue;
        const judged = judgeItem(room.category, s, slot.seen);
        slot.judged.push(judged);
      }
      emitState(room.code);
      ack?.({ ok: true });
    });

    // Back-compat single-item event
    socket.on('mg-perform-item', (
      payload: { item: string },
      ack?: (res: { ok: true } | { ok: false; error: string }) => void,
    ) => {
      const code = socketToRoom.get(socket.id);
      const playerId = socketToPlayer.get(socket.id);
      const room = code ? rooms.get(code) : null;
      if (!room || !playerId) return ack?.({ ok: false, error: 'Not in room' });
      if (room.phase !== 'performing') return ack?.({ ok: false, error: 'Not performing' });
      if (!room.category || !room.performing) return ack?.({ ok: false, error: 'Bad state' });
      const slot = room.performing[playerId];
      if (!slot || slot.done) return ack?.({ ok: true });
      const raw = String(payload?.item ?? '').trim();
      if (!raw) return ack?.({ ok: true });
      const judged = judgeItem(room.category, raw, slot.seen);
      slot.judged.push(judged);
      emitState(room.code);
      ack?.({ ok: true });
    });

    socket.on('mg-perform-done', (_p: unknown, ack?: (r: { ok: true }) => void) => {
      const code = socketToRoom.get(socket.id);
      const playerId = socketToPlayer.get(socket.id);
      const room = code ? rooms.get(code) : null;
      if (!room || !playerId) return ack?.({ ok: true });
      if (room.phase !== 'performing') return ack?.({ ok: true });
      if (!room.performing) return ack?.({ ok: true });
      const slot = room.performing[playerId];
      if (slot) slot.done = true;
      // If all players are done, finish early
      const allDone = room.players.every(p => room.performing?.[p.playerId]?.done);
      if (allDone) {
        finishRound(room, () => emitState(room.code));
      }
      emitState(room.code);
      ack?.({ ok: true });
    });

    socket.on('mg-next-round', (_p: unknown, ack?: (r: { ok: true }) => void) => {
      const code = socketToRoom.get(socket.id);
      const room = code ? rooms.get(code) : null;
      if (!room) return ack?.({ ok: true });
      if (room.phase !== 'result') return ack?.({ ok: true });
      // If someone has already reached winsNeeded, declare matchOver instead of starting a new round
      const winsNeeded = Math.ceil(room.bestOf / 2);
      const topScore = Math.max(...Object.values(room.scores), 0);
      if (topScore >= winsNeeded) {
        setPhase(room, 'matchOver', 0);
      } else {
        const prevCatId = room.category?.id ?? null;
        newRound(room, () => emitState(room.code), prevCatId);
      }
      emitState(room.code);
      ack?.({ ok: true });
    });

    socket.on('mg-rematch', (_p: unknown, ack?: (r: { ok: true }) => void) => {
      const code = socketToRoom.get(socket.id);
      const room = code ? rooms.get(code) : null;
      if (!room) return ack?.({ ok: true });
      if (room.phase !== 'matchOver') return ack?.({ ok: true });
      room.history = [];
      for (const id of Object.keys(room.scores)) room.scores[id] = 0;
      newRound(room, () => emitState(room.code), room.category?.id ?? null);
      emitState(room.code);
      ack?.({ ok: true });
    });

    socket.on('disconnect', () => {
      handleDisconnect(socket);
    });
  });
}
