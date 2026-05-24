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
      timedOutPhase: 'bidding' | 'performing' | 'guessing';
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

export type RoomSettings = {
  roundTimeoutSeconds: number | null;
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
  settings: RoomSettings;
  turnDeadline: number | null;
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

// Server-enforced bounds. Must match server's MIN/MAX_TIMEOUT_SECONDS.
export const MIN_TIMEOUT_SECONDS = 5;
export const MAX_TIMEOUT_SECONDS = 3600;

export function formatTimeLimit(seconds: number | null): string {
  if (seconds === null) return 'No limit';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (s === 0) return m === 1 ? '1 min' : `${m} min`;
  return `${m}m ${s}s`;
}
