import {
  canonicalSq1CsCaseKey,
  canonicalSq1CsCaseName,
} from '@cuberoot/shared/sq1-shapes';

export const isSq1CsTarget = (puzzle: string, setSlug: string): boolean =>
  puzzle.toLowerCase() === 'sq1' && setSlug.toLowerCase() === 'cs';

export function normalizeStoredSq1CsKeys(
  puzzle: string,
  setSlug: string,
  keys: readonly string[],
): string[] {
  if (!isSq1CsTarget(puzzle, setSlug)) return [...keys];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const key of keys) {
    const next = canonicalSq1CsCaseKey(key);
    if (seen.has(next)) continue;
    seen.add(next);
    normalized.push(next);
  }
  return normalized;
}

/** Re-key an SQ1/CS object; on collisions the caller decides which value is newer. */
export function normalizeStoredSq1CsRecord<T>(
  puzzle: string,
  setSlug: string,
  record: Readonly<Record<string, T>>,
  choose?: (current: T, incoming: T) => T,
): Record<string, T> {
  if (!isSq1CsTarget(puzzle, setSlug)) return { ...record };
  const normalized: Record<string, T> = {};
  const entries = Object.entries(record);
  // Legacy aliases first, canonical entries second, so canonical data wins ties.
  entries.sort(([left], [right]) => Number(canonicalSq1CsCaseKey(left) === left)
    - Number(canonicalSq1CsCaseKey(right) === right));
  for (const [key, value] of entries) {
    const next = canonicalSq1CsCaseKey(key);
    normalized[next] = normalized[next] === undefined || !choose
      ? value
      : choose(normalized[next], value);
  }
  return normalized;
}

export function normalizeStoredSq1CsName(puzzle: string, setSlug: string, name: string): string {
  return isSq1CsTarget(puzzle, setSlug) ? canonicalSq1CsCaseName(name) : name;
}
