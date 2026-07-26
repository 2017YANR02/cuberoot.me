'use client';

/**
 * 存下来的合练组合(「我的合集」)。
 *
 * 纯本地(localStorage):合集只是「哪几套一起练」的一句话,真正的进度仍在各 set 自己的
 * 标记 / 记忆里 —— 换设备丢的只是这份快捷方式,不是练习成果,所以不值得为它开一张云端表。
 * 想分享直接发合练 URL(`?sets=` 自带成员),比任何同步都直接。
 */
import { create } from 'zustand';
import { persistItem } from './safe-storage';
import type { AlgPuzzle } from '@cuberoot/shared';

const KEY = 'alg:mixes';
/** 上限:这是快捷方式不是资料库,多了反而找不着。 */
const MAX_SAVED = 30;

export interface SavedMix {
  /** `${puzzle}|${sets.join('+')}` —— 成员相同即同一条,不会存出两份。 */
  id: string;
  puzzle: AlgPuzzle;
  sets: string[];
  name: string;
  /** 最后一次保存 / 重命名的时间,列表按它倒序。 */
  at: number;
}

export const mixId = (puzzle: string, sets: readonly string[]) =>
  `${puzzle}|${[...sets].sort().join('+')}`;

function load(): SavedMix[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as SavedMix[];
    return Array.isArray(arr) ? arr.filter(m => m && Array.isArray(m.sets) && m.sets.length > 1) : [];
  } catch { return []; }
}

const save = (list: SavedMix[]) => persistItem(KEY, JSON.stringify(list));

interface SavedMixState {
  list: SavedMix[];
  /** 挂载后调用(SSG 壳先渲染空列表,避免水合不一致)。 */
  hydrate: () => void;
  /** 存一组;成员相同的已存在则更新名字并置顶。 */
  saveMix: (puzzle: AlgPuzzle, sets: string[], name: string) => void;
  remove: (id: string) => void;
}

export const useSavedMixes = create<SavedMixState>((set, get) => ({
  list: [],
  hydrate: () => set({ list: load() }),
  saveMix: (puzzle, sets, name) => {
    const members = [...new Set(sets)].sort();
    if (members.length < 2) return;
    const id = mixId(puzzle, members);
    const entry: SavedMix = { id, puzzle, sets: members, name: name.trim() || members.join(' + '), at: Date.now() };
    const next = [entry, ...get().list.filter(m => m.id !== id)].slice(0, MAX_SAVED);
    save(next);
    set({ list: next });
  },
  remove: (id) => {
    const next = get().list.filter(m => m.id !== id);
    save(next);
    set({ list: next });
  },
}));
