import type { AlgCase } from '@cuberoot/shared';
import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import { persistItem } from './safe-storage';
import { caseKey } from './trainer-case-key';

export interface ChainOrderSnapshot {
  keys: string[];
  updatedAt: number;
}

export interface ChainScope {
  value: string;
  depth: number;
}

const STORAGE_PREFIX = 'alg:chain-order:v1';

export function chainOrderStorageKey(puzzle: string, setSlug: string, scope: string): string {
  return `${STORAGE_PREFIX}:${puzzle}/${setSlug}/${scope || 'all'}`;
}

export function normalizeChainOrder(
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

export function newerChainOrder(
  local: ChainOrderSnapshot | null,
  cloud: ChainOrderSnapshot | null,
): ChainOrderSnapshot | null {
  if (!local) return cloud;
  if (!cloud) return local;
  return local.updatedAt > cloud.updatedAt ? local : cloud;
}

export function chainScopes(cases: readonly AlgCase[]): ChainScope[] {
  const seen = new Set<string>();
  const scopes: ChainScope[] = [];
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

export function casesForChainScope(cases: readonly AlgCase[], scope: string): AlgCase[] {
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

export function readLocalChainOrder(puzzle: string, setSlug: string, scope: string): ChainOrderSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(chainOrderStorageKey(puzzle, setSlug, scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ChainOrderSnapshot>;
    if (!Array.isArray(parsed.keys) || typeof parsed.updatedAt !== 'number') return null;
    return {
      keys: parsed.keys.filter((key): key is string => typeof key === 'string'),
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function writeLocalChainOrder(
  puzzle: string,
  setSlug: string,
  scope: string,
  snapshot: ChainOrderSnapshot,
): boolean {
  return persistItem(chainOrderStorageKey(puzzle, setSlug, scope), JSON.stringify(snapshot));
}

function orderPath(puzzle: string, setSlug: string, scope: string): string {
  const query = scope ? `?scope=${encodeURIComponent(scope)}` : '';
  return `/v1/alg/chain-order/${encodeURIComponent(puzzle)}/${encodeURIComponent(setSlug)}${query}`;
}

export async function fetchCloudChainOrder(
  puzzle: string,
  setSlug: string,
  scope: string,
): Promise<ChainOrderSnapshot | null> {
  const data = await handleApi<{ keys: string[]; updatedAt: number }>(
    await fetch(apiUrl(orderPath(puzzle, setSlug, scope)), {
      headers: authHeaders(false),
      cache: 'no-store',
    }),
  );
  return data.updatedAt > 0 ? data : null;
}

export async function saveCloudChainOrder(
  puzzle: string,
  setSlug: string,
  scope: string,
  snapshot: ChainOrderSnapshot,
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
