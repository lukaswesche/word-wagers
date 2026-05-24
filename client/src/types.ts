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

// Time-limit options shown to the host (must match server's ALLOWED_TIMEOUTS).
export const TIME_LIMIT_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'No limit' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 90, label: '90 seconds' },
  { value: 120, label: '2 minutes' },
];

export function formatTimeLimit(seconds: number | null): string {
  const opt = TIME_LIMIT_OPTIONS.find((o) => o.value === seconds);
  return opt?.label ?? (seconds === null ? 'No limit' : `${seconds}s`);
}
