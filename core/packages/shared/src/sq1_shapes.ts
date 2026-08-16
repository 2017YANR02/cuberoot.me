/** Squanmate's canonical names for the 29 possible Square-1 layer shapes. */
export interface Sq1ShapeDefinition {
  /** Stable key used in URL state and tool controls. */
  id: string;
  /** Existing drawing-tool preset id; retained so saved links do not break. */
  drawId: string;
  /** Full name published by Squanmate. */
  sourceName: string;
  /** Compact CubeRoot label: only Left / Right are shortened to L / R. */
  name: string;
  /** Clockwise piece-type order (`c` corner, `e` edge). */
  pattern: string;
  /** Orientation used by the existing SQ1 drawing presets. */
  drawPattern: string;
}

/**
 * Single source of truth copied from Squanmate's `services/shapes.cljs`.
 * Keep sourceName and pattern byte-for-byte aligned with upstream.
 */
export const SQ1_SHAPES = [
  { id: 'four-four', drawId: '44', sourceName: '4-4', name: '4-4', pattern: 'eceeeeceee', drawPattern: 'eeceeeecee' },
  { id: 'five-three', drawId: '53', sourceName: '5-3', name: '5-3', pattern: 'eceeeeecee', drawPattern: 'eeceeeceee' },
  { id: 'six-two', drawId: '62', sourceName: '6-2', name: '6-2', pattern: 'ceeeeeecee', drawPattern: 'eeeceeceee' },
  { id: 'seven-one', drawId: '71', sourceName: '7-1', name: '7-1', pattern: 'ceeeeeeece', drawPattern: 'eeececeeee' },
  { id: 'eight', drawId: '8', sourceName: '8', name: '8', pattern: 'ceeeeeeeec', drawPattern: 'eeeecceeee' },
  { id: 'two-two-two', drawId: '222', sourceName: '2-2-2', name: '2-2-2', pattern: 'eeceeceec', drawPattern: 'ceeceecee' },
  { id: 'three-three', drawId: '33', sourceName: '3-3', name: '3-3', pattern: 'eecceeece', drawPattern: 'eeeceeecc' },
  { id: 'three-two-one', drawId: '321', sourceName: '3-2-1', name: '3-2-1', pattern: 'eeeceecec', drawPattern: 'ececeeece' },
  { id: 'three-one-two', drawId: '312', sourceName: '3-1-2', name: '3-1-2', pattern: 'ceeceeece', drawPattern: 'eeececeec' },
  { id: 'left-four-two', drawId: '42l', sourceName: 'Left 4-2', name: 'L 4-2', pattern: 'ceeeeceec', drawPattern: 'ceecceeee' },
  { id: 'right-four-two', drawId: '42r', sourceName: 'Right 4-2', name: 'R 4-2', pattern: 'ceeceeeec', drawPattern: 'eeeecceec' },
  { id: 'four-one-one', drawId: '411', sourceName: '4-1-1', name: '4-1-1', pattern: 'eceeeecec', drawPattern: 'ecececeee' },
  { id: 'left-five-one', drawId: '51l', sourceName: 'Left 5-1', name: 'L 5-1', pattern: 'ceeeeecec', drawPattern: 'ececceeee' },
  { id: 'right-five-one', drawId: '51r', sourceName: 'Right 5-1', name: 'R 5-1', pattern: 'ceceeeeec', drawPattern: 'eeeeccece' },
  { id: 'six', drawId: '6', sourceName: '6', name: '6', pattern: 'ceeeeeecc', drawPattern: 'eeccceeee' },
  { id: 'square', drawId: 'square', sourceName: 'Square', name: 'Square', pattern: 'cececece', drawPattern: 'ecececec' },
  { id: 'kite', drawId: 'kite', sourceName: 'Kite', name: 'Kite', pattern: 'ceceecec', drawPattern: 'ececcece' },
  { id: 'barrel', drawId: 'barrel', sourceName: 'Barrel', name: 'Barrel', pattern: 'ceecceec', drawPattern: 'ceecceec' },
  { id: 'shield', drawId: 'shield', sourceName: 'Shield', name: 'Shield', pattern: 'eeccceec', drawPattern: 'eeccceec' },
  { id: 'left-fist', drawId: 'left-fist', sourceName: 'Left fist', name: 'L fist', pattern: 'cececeec', drawPattern: 'ceeccece' },
  { id: 'right-fist', drawId: 'right-fist', sourceName: 'Right fist', name: 'R fist', pattern: 'ceececec', drawPattern: 'ececceec' },
  { id: 'left-pawn', drawId: 'left-paw', sourceName: 'Left pawn', name: 'L pawn', pattern: 'cceeecec', drawPattern: 'ececccee' },
  { id: 'right-pawn', drawId: 'right-paw', sourceName: 'Right pawn', name: 'R pawn', pattern: 'ceceeecc', drawPattern: 'eecccece' },
  { id: 'mushroom', drawId: 'mushroom', sourceName: 'Mushroom', name: 'Mushroom', pattern: 'cceeecce', drawPattern: 'ecceccee' },
  { id: 'scallop', drawId: 'scallop', sourceName: 'Scallop', name: 'Scallop', pattern: 'cceeeecc', drawPattern: 'eeccccee' },
  { id: 'paired-edges', drawId: 'twins', sourceName: 'Paired edges', name: 'Paired edges', pattern: 'cccccee', drawPattern: 'cceeccc' },
  { id: 'perpendicular-edges', drawId: 'l', sourceName: 'Perpendicular edges', name: 'Perpendicular edges', pattern: 'ccccece', drawPattern: 'cececcc' },
  { id: 'parallel-edges', drawId: 'i', sourceName: 'Parallel edges', name: 'Parallel edges', pattern: 'cccecce', drawPattern: 'ecceccc' },
  { id: 'star', drawId: 'star', sourceName: 'Star', name: 'Star', pattern: 'cccccc', drawPattern: 'cccccc' },
] as const satisfies readonly Sq1ShapeDefinition[];

export type Sq1ShapeId = (typeof SQ1_SHAPES)[number]['id'];

export const SQ1_SHAPE_NAMES = SQ1_SHAPES.map((shape) => shape.name);

/** Normalize historical CubeRoot / CubeZone labels to compact Squanmate labels. */
export function displaySq1ShapeName(name: string): string {
  return name
    .trim()
    .replace(/\bLeft\b/gi, 'L')
    .replace(/\bRight\b/gi, 'R')
    .replace(/\bMuffin\b/gi, 'Mushroom')
    .replace(/\bPawns?\b|\bPaw\b/gi, 'pawn')
    .replace(/\bFist\b/gi, 'fist')
    .replace(/\bPaired Edges\b/gi, 'Paired edges')
    .replace(/\bPerpendicular Edges\b/gi, 'Perpendicular edges')
    .replace(/\bParallel Edges\b/gi, 'Parallel edges')
    .replace(/\bPair\b/gi, 'Paired edges');
}

/** Return the exact full sourceName when a historical or compact label is known. */
export function canonicalSq1ShapeSourceName(name: string): string | null {
  const compact = displaySq1ShapeName(name);
  return SQ1_SHAPES.find((shape) => shape.name.toLowerCase() === compact.toLowerCase())?.sourceName ?? null;
}

/** Canonicalize a `top / bottom` Cube Shape case name without guessing unknown text. */
export function canonicalSq1CsCaseName(name: string): string {
  const parts = name.split('/').map((part) => canonicalSq1ShapeSourceName(part));
  return parts.length === 2 && parts.every((part): part is string => part !== null)
    ? `${parts[0]} / ${parts[1]}`
    : name.trim();
}

// Six legacy rows were grouped by the slash count of a different, misbound formula.
const SQ1_CS_CORRECTED_SUBGROUPS: Readonly<Record<string, string>> = {
  'Parallel edges / Left 4-2': '5 Slices',
  'Right pawn / Right pawn': '5 Slices',
  '3-1-2 / Parallel edges': '6 Slices',
  'Parallel edges / 3-1-2': '6 Slices',
  'Left fist / Square': '7 Slices',
  'Square / Right fist': '7 Slices',
};

/**
 * Upgrade a historical SQ1/CS trainer key to the corrected canonical key.
 * An optional `cs:` mixed-session prefix and preferred-alg `::orientation` suffix are preserved.
 */
export function canonicalSq1CsCaseKey(key: string): string {
  const orientationAt = key.lastIndexOf('::');
  const orientation = orientationAt >= 0 ? key.slice(orientationAt) : '';
  const withoutOrientation = orientationAt >= 0 ? key.slice(0, orientationAt) : key;
  const pipeAt = withoutOrientation.indexOf('|');
  if (pipeAt < 1) return key;

  const prefixAt = withoutOrientation.lastIndexOf(':', pipeAt);
  const prefix = prefixAt >= 0 ? withoutOrientation.slice(0, prefixAt + 1) : '';
  if (prefix && prefix.toLowerCase() !== 'cs:') return key;
  const raw = prefixAt >= 0 ? withoutOrientation.slice(prefixAt + 1) : withoutOrientation;
  const rawPipeAt = raw.indexOf('|');
  if (rawPipeAt < 1) return key;

  const subgroup = raw.slice(0, rawPipeAt).trim();
  const canonicalName = canonicalSq1CsCaseName(raw.slice(rawPipeAt + 1));
  const canonicalSubgroup = SQ1_CS_CORRECTED_SUBGROUPS[canonicalName] ?? subgroup;
  return `${prefix}${canonicalSubgroup}|${canonicalName}${orientation}`;
}
