import type { Category } from './categories';

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

type Tuning = {
  ceilingPct: number;        // fraction of answers CPU can credibly produce
  aggression: [number, number]; // [min, max] multiplier on ceiling
  hitPenaltyPerOver: number; // penalty per unit over ceiling when bidding
  cadenceMs: [number, number]; // delay between spoken items
};

const TUNING: Record<Difficulty, Tuning> = {
  // Easy: CPU knows ~10% of answers, bids conservatively, slow, often misses
  easy:   { ceilingPct: 0.10, aggression: [0.55, 0.80], hitPenaltyPerOver: 0.55, cadenceMs: [2200, 4000] },
  // Medium: CPU knows ~30%, moderate bidding, occasionally misses
  medium: { ceilingPct: 0.28, aggression: [0.75, 1.00], hitPenaltyPerOver: 0.28, cadenceMs: [1300, 2500] },
  // Hard: CPU knows ~65%, aggressive bidding, rarely misses
  hard:   { ceilingPct: 0.65, aggression: [1.0, 1.35], hitPenaltyPerOver: 0.12, cadenceMs: [600, 1300] },
};

export function cpuCeiling(c: Category, d: Difficulty): number {
  const len = c.answers.length;
  const t = TUNING[d];
  return Math.max(2, Math.min(len - 1, Math.round(len * t.ceilingPct)));
}

export function cpuBidFor(c: Category, d: Difficulty): number {
  const ceiling = cpuCeiling(c, d);
  const t = TUNING[d];
  const [lo, hi] = t.aggression;
  const aggression = lo + Math.random() * (hi - lo);
  return Math.max(2, Math.round(ceiling * aggression));
}

export function cpuHitChance(bid: number, ceiling: number, d: Difficulty): number {
  const t = TUNING[d];
  return Math.max(0.04, Math.min(0.96, 1 - (bid - ceiling) * t.hitPenaltyPerOver));
}

export function cpuCadenceMs(d: Difficulty): number {
  const t = TUNING[d];
  const [lo, hi] = t.cadenceMs;
  return lo + Math.random() * (hi - lo);
}
