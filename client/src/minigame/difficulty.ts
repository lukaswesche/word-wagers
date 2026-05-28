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
  maxHitChance: number;      // hard cap on hit chance (even for tiny bids)
  bidRange: [number, number]; // absolute clamp on bid so player & CPU bid in same range
  cadenceMs: [number, number]; // delay between spoken items
};

// Difficulty tuning — rebalanced after playtesting showed all tiers too hard.
// Rule of thumb for player feel:
//   Easy   → player should win most rounds (~70%+) if they put in any effort
//   Medium → coin-flip-ish (~50/50), a real contest
//   Hard   → CPU favored (~60-70%) but beatable with strong knowledge + good bid
const TUNING: Record<Difficulty, Tuning> = {
  // maxHitChance caps the % of rounds CPU "hits its bid" — this is what really
  // determines win rate, because percentage scoring + tie-to-lower-bidder means
  // a CPU that always hits a small bid is unbeatable. Capping it lets the
  // player win when the CPU busts.
  easy:   { ceilingPct: 0.05, aggression: [0.35, 0.60], hitPenaltyPerOver: 0.85, maxHitChance: 0.35, bidRange: [2, 4], cadenceMs: [2800, 5000] },
  medium: { ceilingPct: 0.15, aggression: [0.55, 0.85], hitPenaltyPerOver: 0.50, maxHitChance: 0.60, bidRange: [3, 6], cadenceMs: [1800, 3200] },
  hard:   { ceilingPct: 0.35, aggression: [0.85, 1.10], hitPenaltyPerOver: 0.25, maxHitChance: 0.70, bidRange: [4, 7], cadenceMs: [1000, 1800] },
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
  const raw = Math.round(ceiling * aggression);
  const [bidMin, bidMax] = t.bidRange;
  return Math.max(bidMin, Math.min(bidMax, raw));
}

export function cpuHitChance(bid: number, ceiling: number, d: Difficulty): number {
  const t = TUNING[d];
  const base = 1 - (bid - ceiling) * t.hitPenaltyPerOver;
  return Math.max(0.04, Math.min(t.maxHitChance, base));
}

export function cpuCadenceMs(d: Difficulty): number {
  const t = TUNING[d];
  const [lo, hi] = t.cadenceMs;
  return lo + Math.random() * (hi - lo);
}
