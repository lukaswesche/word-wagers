import type {
  Bid,
  BiddingState,
  Captains,
  GuessingState,
  PerformingState,
  Player,
  Resolution,
  RoomState,
  Taunt,
  Team,
  TeamClock,
  TeamClocks,
} from './types.js';
import { pickRandomWords } from './words.js';

const CODE_LENGTH = 4;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BOARD_SIZE = 25;
const MIN_PLAYERS = 4;
const MIN_PER_TEAM = 2;
const MIN_OPENING_BID = 2;
const MAX_HINT_LENGTH = 30;

// Fixed per-team time budget. Each team has this much time across the entire
// round (bidding turns + performing + guessing). When a team's clock hits 0
// they lose. The clock runs only when it's "that team's turn to act":
//   - bidding phase: the team whose captain must bid or challenge next
//   - performing phase: the performer's team
//   - guessing phase: the performer's team (guessers picking words)
const TEAM_TIME_BUDGET_MS = 3 * 60 * 1000; // 3 minutes

type InternalPlayer = {
  playerId: string;
  socketId: string | null;
  name: string;
  team: Team | null;
};

type Room = {
  code: string;
  host: string;
  players: InternalPlayer[];
  phase: 'lobby' | 'bidding' | 'performing' | 'guessing' | 'resolved';
  words: string[] | null;
  captains: Captains | null;
  bidding: BiddingState | null;
  performing: PerformingState | null;
  guessing: GuessingState | null;
  resolution: Resolution | null;
  performerTargets: string[] | null;
  teamNames: { red: string; blue: string };
  taunt: Taunt | null;
  teamClocks: TeamClocks;
  timerId: NodeJS.Timeout | null; // server-only, fires when active team's clock hits 0
  createdAt: number;
};

type OnRoomChange = (room: Room) => void;

export class RoomManager {
  private rooms = new Map<string, Room>();
  private playerToRoom = new Map<string, string>();
  private socketToPlayer = new Map<string, string>();
  private onRoomChange?: OnRoomChange;

  constructor(onRoomChange?: OnRoomChange) {
    this.onRoomChange = onRoomChange;
  }

  // ─── identity ───

  identify(playerId: string, socketId: string): Room | null {
    this.socketToPlayer.set(socketId, playerId);
    const room = this.getRoomByPlayerId(playerId);
    if (room) {
      const player = room.players.find((p) => p.playerId === playerId);
      if (player) player.socketId = socketId;
    }
    return room ?? null;
  }

  handleSocketDisconnect(socketId: string): Room | null {
    const playerId = this.socketToPlayer.get(socketId);
    this.socketToPlayer.delete(socketId);
    if (!playerId) return null;

    const room = this.getRoomByPlayerId(playerId);
    if (!room) return null;

    const player = room.players.find((p) => p.playerId === playerId);
    if (player && player.socketId === socketId) {
      player.socketId = null;
    }
    return room;
  }

  getPlayerIdBySocket(socketId: string): string | null {
    return this.socketToPlayer.get(socketId) ?? null;
  }

  getRoomByPlayerId(playerId: string): Room | undefined {
    const code = this.playerToRoom.get(playerId);
    return code ? this.rooms.get(code) : undefined;
  }

  // ─── lobby ───

  createRoom(name: string, playerId: string, socketId: string): Room {
    if (this.playerToRoom.has(playerId)) {
      throw new Error('You are already in a room');
    }

    const code = this.generateUniqueCode();
    const room: Room = {
      code,
      host: playerId,
      players: [{ playerId, socketId, name, team: null }],
      phase: 'lobby',
      words: null,
      captains: null,
      bidding: null,
      performing: null,
      guessing: null,
      resolution: null,
      performerTargets: null,
      teamNames: { red: 'Red', blue: 'Blue' },
      taunt: null,
      teamClocks: freshClocks(),
      timerId: null,
      createdAt: Date.now(),
    };
    this.rooms.set(code, room);
    this.playerToRoom.set(playerId, code);
    return room;
  }

  joinRoom(code: string, name: string, playerId: string, socketId: string): Room | null {
    const upperCode = code.toUpperCase();
    const room = this.rooms.get(upperCode);
    if (!room) return null;

    if (this.playerToRoom.has(playerId)) {
      throw new Error('You are already in a room');
    }
    if (room.phase !== 'lobby') {
      throw new Error('Game already started in this room');
    }
    if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('That name is already taken in this room');
    }

    room.players.push({ playerId, socketId, name, team: null });
    this.playerToRoom.set(playerId, upperCode);
    return room;
  }

  leaveRoom(playerId: string): Room | null {
    const code = this.playerToRoom.get(playerId);
    if (!code) return null;
    this.playerToRoom.delete(playerId);

    const room = this.rooms.get(code);
    if (!room) return null;

    room.players = room.players.filter((p) => p.playerId !== playerId);
    if (room.players.length === 0) {
      this.clearRoomTimer(room);
      this.rooms.delete(code);
      return null;
    }
    if (room.host === playerId) {
      room.host = room.players[0].playerId;
    }
    return room;
  }

  setPlayerTeam(playerId: string, team: Team | null): Room {
    const room = this.requireRoomForPlayer(playerId);
    if (room.phase !== 'lobby') {
      throw new Error('Cannot change team after game starts');
    }
    const player = room.players.find((p) => p.playerId === playerId);
    if (!player) throw new Error('Player not found in room');
    player.team = team;
    return room;
  }

  setTeamName(playerId: string, team: Team, name: string): Room {
    const room = this.requireRoomForPlayer(playerId);
    if (room.phase !== 'lobby') throw new Error('Team names can only be changed in the lobby');
    if (playerId !== room.host) throw new Error('Only the host can change team names');
    const clean = name.trim().slice(0, 24);
    if (!clean) throw new Error('Team name cannot be empty');
    room.teamNames[team] = clean;
    return room;
  }

  sendTaunt(playerId: string, message: string): Room {
    const room = this.requireRoomForPlayer(playerId);
    if (room.phase !== 'resolved' || !room.resolution) {
      throw new Error('Taunts can only be sent after a round ends');
    }
    if (room.taunt) throw new Error('A victory message has already been sent');
    const player = room.players.find((p) => p.playerId === playerId);
    if (!player) throw new Error('Player not found');
    if (player.team !== room.resolution.winner) {
      throw new Error('Only the winning team can send a taunt');
    }
    const clean = message.trim().slice(0, 160);
    if (!clean) throw new Error('Message cannot be empty');
    room.taunt = { fromId: playerId, fromName: player.name, message: clean, winnerTeam: room.resolution.winner };
    return room;
  }

  startGame(playerId: string): Room {
    const room = this.requireRoomForPlayer(playerId);
    if (room.phase !== 'lobby') throw new Error('Game already started');
    if (playerId !== room.host) throw new Error('Only the host can start the game');

    const validation = this.validateStartConditions(room);
    if (!validation.ok) throw new Error(validation.error);

    this.beginRound(room);
    return room;
  }

  // ─── bidding ───

  placeBid(playerId: string, count: number): Room {
    const room = this.requireRoomForPlayer(playerId);
    if (room.phase !== 'bidding' || !room.bidding || !room.captains) {
      throw new Error('Not in bidding phase');
    }
    if (!Number.isInteger(count)) {
      throw new Error('Bid must be a whole number');
    }

    const turn = room.bidding.currentTurn;
    if (playerId !== room.captains[turn]) {
      throw new Error("It is not your team's turn");
    }

    const lastBid = room.bidding.history[room.bidding.history.length - 1];
    if (!lastBid) {
      if (count < MIN_OPENING_BID) {
        throw new Error(`Opening bid must be at least ${MIN_OPENING_BID}`);
      }
    } else if (count <= lastBid.count) {
      throw new Error(`Raise must be greater than ${lastBid.count}`);
    }

    const bid: Bid = { team: turn, count };
    room.bidding.history.push(bid);
    const next: Team = turn === 'red' ? 'blue' : 'red';
    room.bidding.currentTurn = next;
    // The other team's clock now starts; this team's pauses
    this.switchActiveTo(room, next);
    return room;
  }

  challenge(playerId: string): Room {
    const room = this.requireRoomForPlayer(playerId);
    if (room.phase !== 'bidding' || !room.bidding || !room.captains) {
      throw new Error('Not in bidding phase');
    }
    const turn = room.bidding.currentTurn;
    if (playerId !== room.captains[turn]) {
      throw new Error("It is not your team's turn");
    }

    const lastBid = room.bidding.history[room.bidding.history.length - 1];
    if (!lastBid) {
      throw new Error('Cannot challenge before any bid has been made');
    }

    const performingTeam = lastBid.team;
    room.phase = 'performing';
    room.performing = {
      team: performingTeam,
      captainId: room.captains[performingTeam],
      bidCount: lastBid.count,
      hint: null,
    };
    // The challenger was active; now the performer's team is on the clock.
    this.switchActiveTo(room, performingTeam);
    return room;
  }

  // ─── performing ───

  submitTargetsAndHint(playerId: string, targets: string[], hint: string): Room {
    const room = this.requireRoomForPlayer(playerId);
    if (room.phase !== 'performing' || !room.performing || !room.words) {
      throw new Error('Not in performing phase');
    }
    if (playerId !== room.performing.captainId) {
      throw new Error('Only the performing captain can submit');
    }

    const cleanHint = hint?.trim() ?? '';
    if (!cleanHint) throw new Error('Hint is required');
    if (/\s/.test(cleanHint)) throw new Error('Hint must be a single word (no spaces)');
    if (cleanHint.length > MAX_HINT_LENGTH) {
      throw new Error(`Hint must be at most ${MAX_HINT_LENGTH} characters`);
    }

    if (!Array.isArray(targets) || targets.length !== room.performing.bidCount) {
      throw new Error(`You must pick exactly ${room.performing.bidCount} words`);
    }
    const wordSet = new Set(room.words);
    const uniqueTargets = new Set(targets);
    if (uniqueTargets.size !== targets.length) {
      throw new Error('Duplicate target words');
    }
    for (const t of targets) {
      if (!wordSet.has(t)) throw new Error(`"${t}" is not on the board`);
    }

    room.performerTargets = [...targets];
    room.performing.hint = cleanHint;
    room.phase = 'guessing';
    room.guessing = { pendingGuesses: [] };
    // Active team doesn't change — the performer's team is still on the clock,
    // just for their guessers now. No need to switch.
    return room;
  }

  // ─── guessing ───

  toggleGuess(playerId: string, word: string): Room {
    const room = this.requireRoomForPlayer(playerId);
    if (
      room.phase !== 'guessing' ||
      !room.guessing ||
      !room.performing ||
      !room.words
    ) {
      throw new Error('Not in guessing phase');
    }
    this.requireGuesser(room, playerId);
    if (!room.words.includes(word)) {
      throw new Error('Word is not on the board');
    }

    const current = room.guessing.pendingGuesses;
    const idx = current.indexOf(word);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      if (current.length >= room.performing.bidCount) {
        throw new Error(`Already at the ${room.performing.bidCount}-word limit`);
      }
      current.push(word);
    }
    return room;
  }

  submitGuesses(playerId: string): Room {
    const room = this.requireRoomForPlayer(playerId);
    if (
      room.phase !== 'guessing' ||
      !room.guessing ||
      !room.performing ||
      !room.performerTargets ||
      !room.performing.hint
    ) {
      throw new Error('Not in guessing phase');
    }
    this.requireGuesser(room, playerId);

    const { pendingGuesses } = room.guessing;
    if (pendingGuesses.length !== room.performing.bidCount) {
      throw new Error(
        `Pick exactly ${room.performing.bidCount} words before submitting`,
      );
    }

    const targetSet = new Set(room.performerTargets);
    const allCorrect = pendingGuesses.every((g) => targetSet.has(g));
    const performerTeam = room.performing.team;
    const otherTeam: Team = performerTeam === 'red' ? 'blue' : 'red';

    room.resolution = {
      reason: 'normal',
      winner: allCorrect ? performerTeam : otherTeam,
      performerTeam,
      bidCount: room.performing.bidCount,
      hint: room.performing.hint,
      targets: [...room.performerTargets],
      guesses: [...pendingGuesses],
    };

    room.phase = 'resolved';
    this.pauseAllClocks(room);
    return room;
  }

  // ─── play again ───

  playAgain(playerId: string): Room {
    const room = this.requireRoomForPlayer(playerId);
    if (room.phase !== 'resolved') {
      throw new Error('Can only play again after a round is resolved');
    }
    if (playerId !== room.host) throw new Error('Only the host can start a new round');

    const validation = this.validateStartConditions(room);
    if (!validation.ok) {
      this.resetToLobby(room);
      return room;
    }

    this.beginRound(room);
    return room;
  }

  // ─── projection ───

  toRoomState(room: Room): RoomState {
    const publicPlayers: Player[] = room.players.map((p) => ({
      id: p.playerId,
      name: p.name,
      team: p.team,
      connected: p.socketId !== null,
    }));
    return {
      code: room.code,
      host: room.host,
      players: publicPlayers,
      phase: room.phase,
      words: room.words,
      captains: room.captains,
      bidding: room.bidding,
      performing: room.performing,
      guessing: room.guessing,
      resolution: room.resolution,
      teamNames: room.teamNames,
      taunt: room.taunt,
      teamClocks: cloneClocks(room.teamClocks),
    };
  }

  // ─── chess-clock helpers ───

  private switchActiveTo(room: Room, team: Team): void {
    const other: Team = team === 'red' ? 'blue' : 'red';
    pauseClock(room.teamClocks[other]);
    startClock(room.teamClocks[team]);
    this.scheduleTimeoutFor(room, team);
  }

  private pauseAllClocks(room: Room): void {
    pauseClock(room.teamClocks.red);
    pauseClock(room.teamClocks.blue);
    this.clearRoomTimer(room);
  }

  private scheduleTimeoutFor(room: Room, team: Team): void {
    this.clearRoomTimer(room);
    const remaining = room.teamClocks[team].remainingMs;
    if (remaining <= 0) {
      this.handleTimeout(room, team);
      return;
    }
    const code = room.code;
    room.timerId = setTimeout(() => {
      const r = this.rooms.get(code);
      if (!r) return;
      this.handleTimeout(r, team);
    }, remaining);
  }

  private clearRoomTimer(room: Room): void {
    if (room.timerId) {
      clearTimeout(room.timerId);
      room.timerId = null;
    }
  }

  private handleTimeout(room: Room, timedOutTeam: Team): void {
    if (room.phase === 'resolved' || room.phase === 'lobby') return;

    // Pause both clocks (timed-out team's remainingMs goes to 0; the other's snapshots wherever it was)
    pauseClock(room.teamClocks[timedOutTeam]);
    pauseClock(room.teamClocks[timedOutTeam === 'red' ? 'blue' : 'red']);
    room.teamClocks[timedOutTeam].remainingMs = 0;
    this.clearRoomTimer(room);

    const winner: Team = timedOutTeam === 'red' ? 'blue' : 'red';

    room.resolution = {
      reason: 'timeout',
      winner,
      timedOutTeam,
      performerTeam: room.performing?.team ?? null,
      bidCount: room.performing?.bidCount ?? null,
      hint: room.performing?.hint ?? null,
      targets: room.performerTargets ? [...room.performerTargets] : null,
      guesses: room.guessing ? [...room.guessing.pendingGuesses] : null,
    };
    room.phase = 'resolved';

    this.onRoomChange?.(room);
  }

  // ─── helpers ───

  private beginRound(room: Room): void {
    const reds = room.players.filter((p) => p.team === 'red');
    const blues = room.players.filter((p) => p.team === 'blue');

    const redCaptain = reds[Math.floor(Math.random() * reds.length)];
    const blueCaptain = blues[Math.floor(Math.random() * blues.length)];

    room.captains = { red: redCaptain.playerId, blue: blueCaptain.playerId };
    room.words = pickRandomWords(BOARD_SIZE);
    room.phase = 'bidding';

    const openingTeam: Team = Math.random() < 0.5 ? 'red' : 'blue';
    room.bidding = {
      history: [],
      currentTurn: openingTeam,
      openingTeam,
    };
    room.performing = null;
    room.guessing = null;
    room.resolution = null;
    room.performerTargets = null;
    room.taunt = null;
    room.teamClocks = freshClocks();
    this.switchActiveTo(room, openingTeam);
  }

  private resetToLobby(room: Room): void {
    room.phase = 'lobby';
    room.words = null;
    room.captains = null;
    room.bidding = null;
    room.performing = null;
    room.guessing = null;
    room.resolution = null;
    room.performerTargets = null;
    room.taunt = null;
    room.teamClocks = freshClocks();
    this.clearRoomTimer(room);
  }

  private requireGuesser(room: Room, playerId: string): void {
    if (!room.performing) throw new Error('No performer set');
    const player = room.players.find((p) => p.playerId === playerId);
    if (!player) throw new Error('Player not in room');
    if (player.team !== room.performing.team) {
      throw new Error("You are not on the performer's team");
    }
    if (playerId === room.performing.captainId) {
      throw new Error('Performer cannot guess for their own team');
    }
  }

  private requireRoomForPlayer(playerId: string): Room {
    const room = this.getRoomByPlayerId(playerId);
    if (!room) throw new Error('Not in a room');
    return room;
  }

  private validateStartConditions(room: Room): { ok: true } | { ok: false; error: string } {
    if (room.players.length < MIN_PLAYERS) {
      return { ok: false, error: `Need at least ${MIN_PLAYERS} players to start` };
    }
    const redCount = room.players.filter((p) => p.team === 'red').length;
    const blueCount = room.players.filter((p) => p.team === 'blue').length;
    if (redCount < MIN_PER_TEAM) {
      return { ok: false, error: `Red team needs at least ${MIN_PER_TEAM} players` };
    }
    if (blueCount < MIN_PER_TEAM) {
      return { ok: false, error: `Blue team needs at least ${MIN_PER_TEAM} players` };
    }
    return { ok: true };
  }

  private generateUniqueCode(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      let code = '';
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('Could not generate unique room code');
  }
}

// ─── module-level pure helpers ───

function freshClocks(): TeamClocks {
  return {
    red: { remainingMs: TEAM_TIME_BUDGET_MS, runningSince: null },
    blue: { remainingMs: TEAM_TIME_BUDGET_MS, runningSince: null },
  };
}

function cloneClocks(c: TeamClocks): TeamClocks {
  return {
    red: { ...c.red },
    blue: { ...c.blue },
  };
}

function pauseClock(clock: TeamClock): void {
  if (clock.runningSince !== null) {
    const elapsed = Date.now() - clock.runningSince;
    clock.remainingMs = Math.max(0, clock.remainingMs - elapsed);
    clock.runningSince = null;
  }
}

function startClock(clock: TeamClock): void {
  if (clock.runningSince === null) {
    clock.runningSince = Date.now();
  }
}

export type RoomForBroadcast = Room;
