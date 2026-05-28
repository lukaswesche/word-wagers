// Mini-game categories. Sourced from data/mg-categories.json which is built by
// scripts/fetch-categories.mjs (pulls from dariusk/corpora plus inlined lists).

import bundle from './data/mg-categories.json';

export type Category = {
  id: string;
  prompt: string;
  short: string;
  // Each entry is one valid answer. Aliases are inner arrays — any one matches.
  answers: (string | string[])[];
};

export const CATEGORIES: Category[] = bundle as Category[];

// ───────────── judging helpers ─────────────

const STRIP_PREFIX = /^(the|a|an)\s+/i;

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?'"`’]/g, '')
    .replace(/[-_/]/g, ' ')
    .replace(STRIP_PREFIX, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function variants(answer: string | string[]): string[] {
  return (Array.isArray(answer) ? answer : [answer]).map(normalize);
}

// Cached per-category lookup: exact map + prefix map (mirrors server).
type CatIndex = { exact: Map<string, number>; prefix: Map<string, number[]> };
const catIndexCache = new WeakMap<Category, CatIndex>();

function getCatIndex(category: Category): CatIndex {
  let idx = catIndexCache.get(category);
  if (idx) return idx;
  const exact = new Map<string, number>();
  const prefix = new Map<string, number[]>();
  const addPrefix = (key: string, i: number) => {
    if (key.length < 3) return;
    let arr = prefix.get(key);
    if (!arr) { arr = []; prefix.set(key, arr); }
    if (!arr.includes(i)) arr.push(i);
  };
  for (let i = 0; i < category.answers.length; i++) {
    for (const v of variants(category.answers[i])) {
      if (!exact.has(v)) exact.set(v, i);
      const toks = v.split(/\s+/).filter(Boolean);
      if (toks.length >= 2) {
        addPrefix(toks[0], i);
        addPrefix(toks.slice(0, 2).join(' '), i);
        if (toks.length >= 3) addPrefix(toks.slice(0, 3).join(' '), i);
      }
    }
  }
  idx = { exact, prefix };
  catIndexCache.set(category, idx);
  return idx;
}

export function lookupAnswerIndex(category: Category, normalizedInput: string): number | undefined {
  const idx = getCatIndex(category);
  const exact = idx.exact.get(normalizedInput);
  if (exact !== undefined) return exact;
  const hits = idx.prefix.get(normalizedInput);
  if (hits && hits.length === 1) return hits[0];
  return undefined;
}

export type JudgedItem = {
  raw: string;
  matchedIndex: number | null;
  status: 'valid' | 'invalid' | 'duplicate';
};

export function judge(category: Category, items: string[]): JudgedItem[] {
  const seenIndices = new Set<number>();
  const out: JudgedItem[] = [];
  for (const raw of items) {
    const n = normalize(raw);
    if (!n) continue;
    const matched = lookupAnswerIndex(category, n);
    if (matched === undefined) {
      out.push({ raw, matchedIndex: null, status: 'invalid' });
    } else if (seenIndices.has(matched)) {
      out.push({ raw, matchedIndex: matched, status: 'duplicate' });
    } else {
      seenIndices.add(matched);
      out.push({ raw, matchedIndex: matched, status: 'valid' });
    }
  }
  return out;
}

export function validCount(items: JudgedItem[]): number {
  return items.filter(i => i.status === 'valid').length;
}

export function randomCategory(exclude?: string): Category {
  const pool = exclude && CATEGORIES.length > 1
    ? CATEGORIES.filter(c => c.id !== exclude)
    : CATEGORIES;
  return pool[Math.floor(Math.random() * pool.length)];
}
