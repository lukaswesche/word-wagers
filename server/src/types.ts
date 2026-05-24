export type Team = 'red' | 'blue';

export type Phase = 'lobby' | 'bidding' | 'performing' | 'guessing' | 'resolved';

export type Player = {
  id: string;
  name: string;
  team: Team | null;
  connected: boolean;
};

export type HelloPayload = { playerId: string };

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

// Discriminated union: timeouts don't have all the normal fields populated.
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
      // Best-effort snapshots of partial state at timeout (may be null if not yet set):
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
  // null = no time limit
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
  // Unix ms timestamp by which the current decision must be made; null if no limit
  turnDeadline: number | null;
};

export type CreateRoomPayload = { name: string };
export type JoinRoomPayload = { code: string; name: string };
export type SetTeamPayload = { team: Team | null };
export type StartGamePayload = Record<string, never>;
export type PlaceBidPayload = { count: number };
export type ChallengePayload = Record<string, never>;
export type SubmitTargetsAndHintPayload = { targets: string[]; hint: string };
export type ToggleGuessPayload = { word: string };
export type SubmitGuessesPayload = Record<string, never>;
export type PlayAgainPayload      = Record<string, never>;
export type LeaveRoomPayload      = Record<string, never>;
export type SetTeamNamePayload    = { team: Team; name: string };
export type SendTauntPayload      = { message: string };
export type SetTimeLimitPayload   = { seconds: number | null };

export type AckResponse<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };
