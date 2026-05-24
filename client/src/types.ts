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

export type Resolution = {
  winner: Team;
  performerTeam: Team;
  bidCount: number;
  hint: string;
  targets: string[];
  guesses: string[];
};

export type RoomState = {
  code: string;
  players: Player[];
  phase: Phase;
  words: string[] | null;
  captains: Captains | null;
  bidding: BiddingState | null;
  performing: PerformingState | null;
  guessing: GuessingState | null;
  resolution: Resolution | null;
};

export type AckResponse<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export const TEAM_COLORS: Record<Team, string> = {
  red: '#d4453d',
  blue: '#3163d4',
};

export function teamLabel(team: Team): string {
  return team === 'red' ? 'Red' : 'Blue';
}
