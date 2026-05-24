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
