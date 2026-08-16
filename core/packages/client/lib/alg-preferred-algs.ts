'use client';

import { create } from 'zustand';
import type { AlgCase, AlgEntry, AlgPuzzle } from '@cuberoot/shared';
import { mirrorMoveString } from '@cuberoot/shared/alg-mirror';
import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import { getSessionToken } from './auth-store';
import { persistItem } from './safe-storage';
import { isSq1CsTarget, normalizeStoredSq1CsRecord } from './sq1-cs-storage';

export interface PreferredAlgSnapshot {
  /** `${subgroup}|${name}::${orientation}` -> stable algorithm reference. */
  items: Record<string, string>;
  updatedAt: number;
}

const STORAGE_PREFIX = 'alg:preferred:v1';
const MAX_ITEMS = 5000;

const targetKey = (puzzle: string, setSlug: string) => `${puzzle}/${setSlug}`;
const storageKey = (puzzle: string, setSlug: string) => `${STORAGE_PREFIX}:${targetKey(puzzle, setSlug)}`;
const normalizeAlg = (alg: string) => alg.trim().replace(/\s+/g, ' ');

export function preferredAlgRef(entry: AlgEntry): string {
  const altId = entry.altId?.trim();
  return altId ? `id:${altId}` : `alg:${normalizeAlg(entry.alg)}`;
}

export function preferredAlgSlot(c: Pick<AlgCase, 'subgroup' | 'name'>, orientation = 0): string {
  return `${c.subgroup}|${c.name}::${orientation}`;
}

export function findPreferredAlg(
  entries: readonly AlgEntry[],
  ref: string | null | undefined,
): AlgEntry | undefined {
  return ref ? entries.find(entry => preferredAlgRef(entry) === ref) : undefined;
}

export function sortPreferredAlgs(
  entries: readonly AlgEntry[],
  ref: string | null | undefined,
): Array<{ entry: AlgEntry; originalIndex: number }> {
  const rows = entries.map((entry, originalIndex) => ({ entry, originalIndex }));
  if (!ref) return rows;
  const index = rows.findIndex(row => preferredAlgRef(row.entry) === ref);
  if (index <= 0) return rows;
  return [rows[index], ...rows.slice(0, index), ...rows.slice(index + 1)];
}

/** Cloud wins a timestamp tie, matching the other trainer preference stores. */
export function newerPreferredAlgs(
  local: PreferredAlgSnapshot | null,
  cloud: PreferredAlgSnapshot | null,
): PreferredAlgSnapshot | null {
  if (!local) return cloud;
  if (!cloud) return local;
  return local.updatedAt > cloud.updatedAt ? local : cloud;
}

function validSnapshot(value: unknown): PreferredAlgSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<PreferredAlgSnapshot>;
  if (!raw.items || typeof raw.items !== 'object' || Array.isArray(raw.items)) return null;
  if (typeof raw.updatedAt !== 'number' || !Number.isSafeInteger(raw.updatedAt) || raw.updatedAt < 0) return null;
  const items: Record<string, string> = {};
  for (const [slot, ref] of Object.entries(raw.items)) {
    if (Object.keys(items).length >= MAX_ITEMS) break;
    if (slot.length < 1 || slot.length > 192 || typeof ref !== 'string' || ref.length < 1 || ref.length > 4096) continue;
    items[slot] = ref;
  }
  return { items, updatedAt: raw.updatedAt };
}

function readLocal(puzzle: string, setSlug: string): PreferredAlgSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(puzzle, setSlug));
    const snapshot = raw ? validSnapshot(JSON.parse(raw)) : null;
    if (!snapshot) return null;
    const items = normalizeStoredSq1CsRecord(puzzle, setSlug, snapshot.items);
    const normalized = { ...snapshot, items };
    if (isSq1CsTarget(puzzle, setSlug) && JSON.stringify(items) !== JSON.stringify(snapshot.items)) {
      writeLocal(puzzle, setSlug, normalized);
    }
    return normalized;
  } catch {
    return null;
  }
}

function writeLocal(puzzle: string, setSlug: string, snapshot: PreferredAlgSnapshot): void {
  if (typeof window === 'undefined') return;
  persistItem(storageKey(puzzle, setSlug), JSON.stringify(snapshot));
}

function endpoint(puzzle: string, setSlug: string): string {
  return `/v1/alg/preferred-algs/${encodeURIComponent(puzzle)}/${encodeURIComponent(setSlug)}`;
}

async function fetchCloud(puzzle: string, setSlug: string): Promise<PreferredAlgSnapshot | null> {
  if (!getSessionToken()) return null;
  try {
    const data = await handleApi<PreferredAlgSnapshot>(await fetch(apiUrl(endpoint(puzzle, setSlug)), {
      headers: authHeaders(false),
      cache: 'no-store',
    }));
    return data.updatedAt > 0 ? validSnapshot(data) : null;
  } catch (error) {
    console.warn('[alg-preferred] cloud unavailable, local only', error);
    return null;
  }
}

async function saveCloud(puzzle: string, setSlug: string, snapshot: PreferredAlgSnapshot): Promise<void> {
  if (!getSessionToken()) return;
  try {
    await handleApi(await fetch(apiUrl(endpoint(puzzle, setSlug)), {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(snapshot),
    }));
  } catch (error) {
    console.warn('[alg-preferred] cloud save failed, kept locally', error);
  }
}

interface PreferredAlgState {
  snapshots: Record<string, PreferredAlgSnapshot>;
  load: (puzzle: AlgPuzzle, setSlug: string) => void;
  setPreferred: (puzzle: AlgPuzzle, setSlug: string, slot: string, ref: string | null) => void;
}

const loadTokens = new Map<string, number>();

export const usePreferredAlgs = create<PreferredAlgState>((set, get) => ({
  snapshots: {},

  load: (puzzle, setSlug) => {
    const key = targetKey(puzzle, setSlug);
    const token = (loadTokens.get(key) ?? 0) + 1;
    loadTokens.set(key, token);
    const local = readLocal(puzzle, setSlug);
    if (local) set(state => ({ snapshots: { ...state.snapshots, [key]: local } }));
    if (!getSessionToken()) return;
    void (async () => {
      const cloud = await fetchCloud(puzzle, setSlug);
      if (loadTokens.get(key) !== token) return;
      const current = get().snapshots[key] ?? local;
      const winner = newerPreferredAlgs(current ?? null, cloud);
      if (!winner) return;
      writeLocal(puzzle, setSlug, winner);
      set(state => ({ snapshots: { ...state.snapshots, [key]: winner } }));
      if (current && (!cloud || current.updatedAt > cloud.updatedAt)) {
        await saveCloud(puzzle, setSlug, current);
      }
    })();
  },

  setPreferred: (puzzle, setSlug, slot, ref) => {
    const key = targetKey(puzzle, setSlug);
    const current = get().snapshots[key] ?? readLocal(puzzle, setSlug) ?? { items: {}, updatedAt: 0 };
    const items = { ...current.items };
    if (ref) items[slot] = ref;
    else delete items[slot];
    const snapshot = { items, updatedAt: Math.max(Date.now(), current.updatedAt + 1) };
    writeLocal(puzzle, setSlug, snapshot);
    set(state => ({ snapshots: { ...state.snapshots, [key]: snapshot } }));
    void saveCloud(puzzle, setSlug, snapshot);
  },
}));

/**
 * 记忆模式的防认打乱候选：当前 case 的其它公式，加上元数据镜像 case 映回来的公式。
 * 只在已经明确选了主公式时启用；无候选时调用方保留原打乱策略。
 */
export function nonPreferredSolutions(
  c: AlgCase,
  setCases: readonly AlgCase[],
  preferredRef: string | null | undefined,
  orientation = 0,
): string[] {
  const entries = c.algs[orientation] ?? [];
  const preferred = findPreferredAlg(entries, preferredRef);
  if (!preferred) return [];
  const preferredAlg = normalizeAlg(preferred.alg);
  const candidates: string[] = [];
  const seen = new Set<string>([preferredAlg]);
  const add = (alg: string) => {
    const normalized = normalizeAlg(alg);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  for (const entry of entries) {
    if (preferredAlgRef(entry) !== preferredRef) add(entry.alg);
  }

  const mirrorNo = c.meta?.mirror;
  if (mirrorNo != null) {
    const partner = setCases.find(candidate => candidate.meta?.no === mirrorNo);
    for (const entry of partner?.algs[orientation] ?? []) {
      try { add(mirrorMoveString(entry.alg, 'M')); } catch { /* unsupported notation: skip */ }
    }
  }
  return candidates;
}
