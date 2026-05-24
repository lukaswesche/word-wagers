export type Team = 'red' | 'blue';

export type Phase = 'lobby' | 'bidding' | 'performing' | 'guessing' | 'resolved';

export type Player = {
  id: string;
  name: string;
  team: Team | null;
  connected: boolean;
};

export type Captains = {
  red: string;
  blue: string;
};

export type Bid = {
  team: Team;
  count: number;
};

export type BiddingState = {
  history: Bid[];
  currentTurn: Team;
  openingTeam: Team;
};

export type PerformingState = {
  team: Team;
  captainId: string;
  bidCount: number;
  hint: string | null;
};

export type GuessingState = {
  pendingGuesses: string[];
};

// Snapshot of a team's chess clock. When `runningSince` is null the clock is
// paused at `remainingMs`. When set, current remaining =
// max(0, remainingMs - (Date.now() - runningSince)).
export type TeamClock = {
  remainingMs: number;
  runningSince: number | null;
};

export type TeamClocks = {
  red: TeamClock;
  blue: TeamClock;
};

export type Resolution =
  | {
      reason: 'normal';
      winner: Team;
      performerTeam: Team;
      bidCount: number;
      hint: string;
      targets: string[];
      guesses: string[];
    }
  | {
      reason: 'timeout';
      winner: Team;
      timedOutTeam: Team;
      performerTeam: Team | null;
      bidCount: number | null;
      hint: string | null;
      targets: string[] | null;
      guesses: string[] | null;
    };

export type Taunt = {
  fromId: string;
  fromName: string;
  message: string;
  winnerTeam: Team;
};

export type RoomState = {
  code: string;
  host: string;
  players: Player[];
  phase: Phase;
  words: string[] | null;
  captains: Captains | null;
  bidding: BiddingState | null;
  performing: PerformingState | null;
  guessing: GuessingState | null;
  resolution: Resolution | null;
  teamNames: { red: string; blue: string };
  taunt: Taunt | null;
  scores: { red: number; blue: number };
  teamClocks: TeamClocks;
};

export type AckResponse<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export const TEAM_COLORS: Record<Team, string> = {
  red: '#f05060',
  blue: '#4d8eff',
};

export function teamLabel(team: Team): string {
  return team === 'red' ? 'Red' : 'Blue';
}

/** Compute current ms remaining on a team's clock at the moment of the call. */
export function getClockRemainingMs(clock: TeamClock): number {
  if (clock.runningSince === null) return clock.remainingMs;
  const elapsed = Date.now() - clock.runningSince;
  return Math.max(0, clock.remainingMs - elapsed);
}

/** Format a ms value as M:SS (or 0:0X for sub-10s, never negative). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
