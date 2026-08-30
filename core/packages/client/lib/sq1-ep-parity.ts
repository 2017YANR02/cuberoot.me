export type Sq1EpParity = 'no-parity' | 'parity';

/**
 * EP pattern parity by layer. Solved/Ua/Ub/Z/H are even permutations;
 * Adj/Opp/O+/O-/W are odd permutations. An EP case has parity when the two
 * layers differ. Unknown or malformed names stay unclassified instead of
 * being mislabeled.
 */
const EVEN_LAYER_PATTERNS = new Set(['solved', 'ua', 'ub', 'z', 'h']);
const ODD_LAYER_PATTERNS = new Set(['adj', 'opp', 'o+', 'o-', 'w']);

function layerParity(pattern: string): 'even' | 'odd' | null {
  const normalized = pattern.trim().toLowerCase();
  if (EVEN_LAYER_PATTERNS.has(normalized)) return 'even';
  if (ODD_LAYER_PATTERNS.has(normalized)) return 'odd';
  return null;
}

export function classifySq1EpParity(caseName: string): Sq1EpParity | null {
  const parts = caseName.trim().split(/\s*(?:\/|&)\s*/);
  if (parts.length !== 2 || parts.some(part => part.length === 0)) return null;

  const top = layerParity(parts[0]);
  const bottom = layerParity(parts[1]);
  if (!top || !bottom) return null;
  return top === bottom ? 'no-parity' : 'parity';
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
