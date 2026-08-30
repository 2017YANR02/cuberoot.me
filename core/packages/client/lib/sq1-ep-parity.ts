export type Sq1EpParity = 'no-parity' | 'parity';

/**
 * EP pattern parity by layer. Solved/Ua/Ub/Z/H are even permutations;
 * Adj/Opp/O+/O-/W are odd permutations. An EP case has parity when the two
 * layers differ. Unknown or malformed names stay unclassified instead of
 * being mislabeled.
 */
const EVEN_LAYER_PATTERNS = new Set(['solved', 'ua', 'ub', 'z', 'h']);
const ODD_LAYER_PATTERNS = new Set(['adj', 'opp', 'o+', 'o-', 'w']);
const NUMERIC_LAYER_NAMES = new Map([
  ['solved', '0'],
  ['opp', '1'],
  ['adj', '2'],
  ['ua', '3+'],
  ['ub', '3-'],
  ['o+', '4+'],
  ['o-', '4-'],
  ['w', '7'],
  ['h', '+'],
  ['z', '//'],
]);

function casePatterns(caseName: string): [string, string] | null {
  const parts = caseName.trim().split(/\s*(?:\/|&)\s*/);
  if (parts.length !== 2 || parts.some(part => part.length === 0)) return null;
  return [parts[0], parts[1]];
}

function layerParity(pattern: string): 'even' | 'odd' | null {
  const normalized = pattern.trim().toLowerCase();
  if (EVEN_LAYER_PATTERNS.has(normalized)) return 'even';
  if (ODD_LAYER_PATTERNS.has(normalized)) return 'odd';
  return null;
}

export function classifySq1EpParity(caseName: string): Sq1EpParity | null {
  const parts = casePatterns(caseName);
  if (!parts) return null;

  const top = layerParity(parts[0]);
  const bottom = layerParity(parts[1]);
  if (!top || !bottom) return null;
  return top === bottom ? 'no-parity' : 'parity';
}

/** Chinese numeric naming from the source table. Standalone + means H. */
export function sq1EpNumericLayerName(pattern: string): string | null {
  return NUMERIC_LAYER_NAMES.get(pattern.trim().toLowerCase()) ?? null;
}

export function sq1EpNumericCaseName(caseName: string): string | null {
  const parts = casePatterns(caseName);
  if (!parts) return null;
  const top = sq1EpNumericLayerName(parts[0]);
  const bottom = sq1EpNumericLayerName(parts[1]);
  return top && bottom ? `${top}.${bottom}` : null;
}

export function sq1EpTopLayerName(caseName: string): string | null {
  const parts = casePatterns(caseName);
  return parts?.[0].trim() || null;
}

export function partitionSq1EpCases<T extends { name: string }>(cases: readonly T[]) {
  const noParity: T[] = [];
  const parity: T[] = [];
  const unclassified: T[] = [];
  for (const item of cases) {
    const classification = classifySq1EpParity(item.name);
    if (classification === 'no-parity') noParity.push(item);
    else if (classification === 'parity') parity.push(item);
    else unclassified.push(item);
  }
  return { noParity, parity, unclassified };
}
