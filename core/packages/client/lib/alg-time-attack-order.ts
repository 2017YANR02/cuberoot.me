import type { AlgCase } from '@cuberoot/shared';
import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import { persistItem } from './safe-storage';
import { caseKey } from './trainer-case-key';

export interface TimeAttackOrderSnapshot {
  keys: string[];
  updatedAt: number;
}

export interface TimeAttackScope {
  value: string;
  depth: number;
}

const STORAGE_PREFIX = 'alg:time-attack-order:v1';
const LEGACY_STORAGE_PREFIX = 'alg:chain-order:v1';

export function timeAttackOrderStorageKey(puzzle: string, setSlug: string, scope: string): string {
  return `${STORAGE_PREFIX}:${puzzle}/${setSlug}/${scope || 'all'}`;
}

function legacyOrderStorageKey(puzzle: string, setSlug: string, scope: string): string {
  return `${LEGACY_STORAGE_PREFIX}:${puzzle}/${setSlug}/${scope || 'all'}`;
}

export function normalizeTimeAttackOrder(
  canonicalKeys: readonly string[],
  savedKeys: readonly string[] | null | undefined,
): string[] {
  const available = new Set(canonicalKeys);
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const key of savedKeys ?? []) {
    if (!available.has(key) || seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }
  for (const key of canonicalKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }
  return normalized;
}

export function newerTimeAttackOrder(
  local: TimeAttackOrderSnapshot | null,
  cloud: TimeAttackOrderSnapshot | null,
): TimeAttackOrderSnapshot | null {
  if (!local) return cloud;
  if (!cloud) return local;
  return local.updatedAt > cloud.updatedAt ? local : cloud;
}

export function timeAttackScopes(cases: readonly AlgCase[]): TimeAttackScope[] {
  const seen = new Set<string>();
  const scopes: TimeAttackScope[] = [];
  for (const c of cases) {
    const parts = c.subgroup.trim().toLowerCase().split('/').filter(Boolean);
    for (let depth = 1; depth <= parts.length; depth += 1) {
      const value = parts.slice(0, depth).join('/');
      if (seen.has(value)) continue;
      seen.add(value);
      scopes.push({ value, depth });
    }
  }
  return scopes;
}

export function casesForTimeAttackScope(cases: readonly AlgCase[], scope: string): AlgCase[] {
  const wanted = scope.trim().toLowerCase();
  if (!wanted) return [...cases];
  const exact = cases.filter((c) => {
    const subgroup = c.subgroup.trim().toLowerCase();
    return subgroup === wanted || subgroup.startsWith(`${wanted}/`);
  });
  if (exact.length > 0) return exact;

  // 老链接只带第二级 token（例如 ZBLL 的 COLL 名），仍尽量解析；有歧义时不猜。
  const tokenHits = cases.filter((c) => c.subgroup.toLowerCase().split('/').includes(wanted));
  const paths = new Set(tokenHits.map((c) => c.subgroup.toLowerCase()));
  return paths.size === 1 ? tokenHits : [];
}

export function readLocalTimeAttackOrder(puzzle: string, setSlug: string, scope: string): TimeAttackOrderSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(timeAttackOrderStorageKey(puzzle, setSlug, scope))
      ?? localStorage.getItem(legacyOrderStorageKey(puzzle, setSlug, scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TimeAttackOrderSnapshot>;
    if (!Array.isArray(parsed.keys) || typeof parsed.updatedAt !== 'number') return null;
    return {
      keys: parsed.keys.filter((key): key is string => typeof key === 'string'),
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function writeLocalTimeAttackOrder(
  puzzle: string,
  setSlug: string,
  scope: string,
  snapshot: TimeAttackOrderSnapshot,
): boolean {
  return persistItem(timeAttackOrderStorageKey(puzzle, setSlug, scope), JSON.stringify(snapshot));
}

function orderPath(puzzle: string, setSlug: string, scope: string): string {
  const query = scope ? `?scope=${encodeURIComponent(scope)}` : '';
  return `/v1/alg/time-attack-order/${encodeURIComponent(puzzle)}/${encodeURIComponent(setSlug)}${query}`;
}

export async function fetchCloudTimeAttackOrder(
  puzzle: string,
  setSlug: string,
  scope: string,
): Promise<TimeAttackOrderSnapshot | null> {
  const data = await handleApi<{ keys: string[]; updatedAt: number }>(
    await fetch(apiUrl(orderPath(puzzle, setSlug, scope)), {
      headers: authHeaders(false),
      cache: 'no-store',
    }),
  );
  return data.updatedAt > 0 ? data : null;
}

export async function saveCloudTimeAttackOrder(
  puzzle: string,
  setSlug: string,
  scope: string,
  snapshot: TimeAttackOrderSnapshot,
): Promise<void> {
  await handleApi(await fetch(apiUrl(orderPath(puzzle, setSlug, scope)), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(snapshot),
  }));
}

export function caseMap(cases: readonly AlgCase[]): Map<string, AlgCase> {
  return new Map(cases.map((c) => [caseKey(c), c]));
}
