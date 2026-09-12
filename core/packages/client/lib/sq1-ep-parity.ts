import { applySq1Scramble, type Sq1State } from '@cuberoot/shared/sq1-notation';

export type Sq1EpParity = 'no-parity' | 'parity';

// Canonical slot -> home-slot permutations, modulo a rotation of the face.
// Both layer arrays run clockwise when viewed directly at their own face.
// Thus 0231 solves clockwise (Ua / U+), and its inverse 0312 solves U-.
const EP_PATTERN_BY_PERMUTATION: Record<string, string> = {
  '0123': 'Solved', '0321': 'Opp', '0132': 'Adj',
  '0231': 'Ua', '0312': 'Ub', '1230': 'O+', '3012': 'O-',
  '1302': 'W', '2301': 'H', '1032': 'Z',
};
const SOLVED_SQ1 = applySq1Scramble('').pieces;

/** Classify physical EP state after aligning each layer's corners, not its label. */
export function classifySq1EpState(state: Sq1State): [string, string] | null {
  if (state.pieces.length !== 24) return null;
  const labels: string[] = [];
  for (const layer of [0, 1]) {
    const reference = SOLVED_SQ1.slice(layer * 12, layer * 12 + 12);
    const face = state.pieces.slice(layer * 12, layer * 12 + 12);
    const cornerIds = new Set(reference.filter((piece, i) => piece === reference[(i + 1) % 12]));
    const shift = Array.from({ length: 12 }, (_, i) => i).find(offset =>
      reference.every((piece, i) => !cornerIds.has(piece) || face[(i + offset) % 12] === piece));
    if (shift === undefined) return null;
    const edgeSlots = layer === 0 ? [2, 5, 8, 11] : [0, 3, 6, 9];
    const permutation = edgeSlots.map(i => edgeSlots.findIndex(j => reference[j] === face[(i + shift) % 12]));
    if (new Set(permutation).size !== 4 || permutation.includes(-1)) return null;
    const key = Array.from({ length: 4 }, (_, rotation) => permutation.map((_, i) =>
      (permutation[(i + rotation) % 4] - rotation + 4) % 4).join('')).sort()[0];
    const label = EP_PATTERN_BY_PERMUTATION[key];
    if (!label) return null;
    labels.push(label);
  }
  return [labels[0], labels[1]];
}

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

/** PDF 数据里的子组名形如 `Top Ua`；数字命名时统一显示成 `3+.*`。 */
export function sq1EpNumericGroupName(subgroup: string): string | null {
  const layerName = subgroup.trim().replace(/^top\s+/i, '');
  const numeric = sq1EpNumericLayerName(layerName);
  return numeric ? `${numeric}.*` : null;
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
