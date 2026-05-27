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
    let matched: number | null = null;
    for (let i = 0; i < category.answers.length; i++) {
      if (variants(category.answers[i]).includes(n)) {
        matched = i;
        break;
      }
    }
    if (matched === null) {
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
