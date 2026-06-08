// Move-count of a WCA scramble string, per-event notation.
//
// "Scramble length" means the number of moves TNoodle wrote into the scramble
// notation. Counting differs by puzzle, so the unit is event-specific:
//   - NxN / 333 family / clock / megaminx / pyraminx / skewb / magic: whitespace
//     tokens (wide moves, rotations and clock pins each count as one token).
//   - sq1: number of (x,y) twist pairs — '/' separators and the digits inside a
//     pair must not be split on whitespace.
//   - multi-blind (333mbf / 333mbo): one 3x3 scramble per line, so a row yields
//     one length per cube.
//
// Pure, dependency-free — imported by both the stats builder (Node) and the
// client test. Keep it that way.

export type ScrambleLengthUnit = 'moves' | 'twists';

/** Display unit for an event's scramble move-count. */
export function scrambleLengthUnit(eventId: string): ScrambleLengthUnit {
  return eventId === 'sq1' ? 'twists' : 'moves';
}

/**
 * Move-counts of one scramble string. Returns an array because multi-blind
 * packs several cubes (one per line) into a single scramble row — each cube is
 * counted as its own 3x3 sample. Returns `[]` when nothing is countable (e.g. a
 * blank magic scramble).
 */
export function scrambleMoveLengths(eventId: string, scramble: string): number[] {
  const s = (scramble ?? '').trim();
  if (!s) return [];

  // Square-1: slash-separated (x,y) twist pairs. A whitespace split would count
  // the '/' tokens and break "(1, 0)" with an inner space into two.
  if (eventId === 'sq1') {
    const pairs = s.match(/\(\s*-?\d+\s*,\s*-?\d+\s*\)/g);
    return pairs ? [pairs.length] : [];
  }

  // Multi-blind (current + retired old format): one 3x3 scramble per line.
  if (eventId === '333mbf' || eventId === '333mbo') {
    return s.split('\n').map(countTokens).filter((n) => n > 0);
  }

  // Everything else. Megaminx's 7 newline-separated lines collapse into the
  // same whitespace split (77 tokens), which is the conventional count.
  const n = countTokens(s);
  return n > 0 ? [n] : [];
}

function countTokens(line: string): number {
  const t = line.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}
