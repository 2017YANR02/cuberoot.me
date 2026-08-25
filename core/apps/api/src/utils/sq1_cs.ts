import {
  canonicalSq1CsCaseKey,
  canonicalSq1CsCaseName,
} from '@cuberoot/shared/sq1-shapes';

export function isSq1Cs(puzzle: string, setSlug: string): boolean {
  return puzzle.toLowerCase() === 'sq1' && setSlug.toLowerCase() === 'cs';
}

export function normalizeCaseNameForSet(puzzle: string, setSlug: string, name: string): string {
  return isSq1Cs(puzzle, setSlug) ? canonicalSq1CsCaseName(name) : name;
}

export function normalizeCaseKeyForSet(puzzle: string, setSlug: string, key: string): string {
  return isSq1Cs(puzzle, setSlug) ? canonicalSq1CsCaseKey(key) : key;
}

export function normalizeCaseKeysForSet(puzzle: string, setSlug: string, keys: readonly string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const key of keys) {
    const next = normalizeCaseKeyForSet(puzzle, setSlug, key);
    if (seen.has(next)) continue;
    seen.add(next);
    normalized.push(next);
  }
  return normalized;
}
/** Canonical entries win if an old client sent both the legacy and corrected slot. */
export function normalizePreferredItemsForSet(
  puzzle: string,
  setSlug: string,
  items: Readonly<Record<string, string>>,
): Record<string, string> {
  if (!isSq1Cs(puzzle, setSlug)) return { ...items };
  const normalized: Record<string, string> = {};
  const entries = Object.entries(items);
  for (const [slot, ref] of entries) {
    const next = canonicalSq1CsCaseKey(slot);
    if (next !== slot) normalized[next] = ref;
  }
  for (const [slot, ref] of entries) {
    const next = canonicalSq1CsCaseKey(slot);
    if (next === slot) normalized[next] = ref;
  }
  return normalized;
}
