'use client';

import { create } from 'zustand';
import { ALG_PUZZLES } from '@cuberoot/shared/alg';
import { persistItem } from './safe-storage';

const KEY = 'alg:recent:v1';
const LIMIT = 24;
export interface RecentAlgCase { puzzle: string; set: string; href: string; name: string }

function valid(value: unknown): value is RecentAlgCase {
  if (!value || typeof value !== 'object') return false;
  const item = value as RecentAlgCase;
  return (ALG_PUZZLES as readonly string[]).includes(item.puzzle)
    && typeof item.set === 'string' && /^[a-z0-9-]+$/.test(item.set)
    && typeof item.name === 'string' && item.name.length > 0 && item.name.length <= 200
    && typeof item.href === 'string' && item.href.length <= 500
    && item.href.startsWith(`/alg/${item.puzzle}/${item.set}/`)
    && /^\/alg\/[a-z0-9-]+\/[a-z0-9-]+\/[a-zA-Z0-9_%+.-]+$/.test(item.href);
}
function load(): RecentAlgCase[] {
  try {
    const values: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(values)) return [];
    return values.filter(valid).filter((item, index, list) => list.findIndex(other => other.href === item.href) === index).slice(0, LIMIT);
  } catch { return []; }
}

/** Public case shortcuts only; never persist formulas, query strings or account data. */
export const useRecentAlgCases = create<{
  items: RecentAlgCase[];
  hydrate: () => void;
  remember: (item: RecentAlgCase) => void;
  clear: (puzzle: string) => void;
}>((set) => ({
  items: [],
  hydrate: () => set({ items: load() }),
  remember: item => {
    if (!valid(item)) return;
    const items = [item, ...load().filter(previous => previous.href !== item.href)].slice(0, LIMIT);
    persistItem(KEY, JSON.stringify(items));
    set({ items });
  },
  clear: puzzle => {
    const items = load().filter(item => item.puzzle !== puzzle);
    persistItem(KEY, JSON.stringify(items));
    set({ items });
  },
}));
