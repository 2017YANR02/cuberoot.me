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

/** One countable sample: its move-count and the representative scramble text. */
export interface ScrambleSample {
  len: number;
  /** The scramble this length belongs to — the full string, except multi-blind
   *  where it's the single per-cube 3x3 line. */
  text: string;
}

/**
 * Per-sample move-counts of one scramble string. Returns an array because
 * multi-blind packs several cubes (one per line) into a single row — each cube
 * is its own 3x3 sample. Returns `[]` when nothing is countable (e.g. a blank
 * magic scramble). Single source of truth for both the histogram and examples.
 */
export function scrambleMoveSamples(eventId: string, scramble: string): ScrambleSample[] {
  const s = (scramble ?? '').trim();
  if (!s) return [];

  // Square-1: slash-separated (x,y) twist pairs. A whitespace split would count
  // the '/' tokens and break "(1, 0)" with an inner space into two.
  if (eventId === 'sq1') {
    const pairs = s.match(/\(\s*-?\d+\s*,\s*-?\d+\s*\)/g);
    return pairs ? [{ len: pairs.length, text: s }] : [];
  }

  // Multi-blind (current + retired old format): one 3x3 scramble per line.
  if (eventId === '333mbf' || eventId === '333mbo') {
    return s.split('\n').map((l) => l.trim())
      .map((l) => ({ len: countTokens(l), text: l }))
      .filter((x) => x.len > 0);
  }

  // Megaminx: count moves by the fixed alphabet (R±±/D±±/U/U') rather than
  // whitespace — a few WCA scrambles glue two moves with a missing space
  // (e.g. "R--D--"), which a whitespace split miscounts (76 instead of 77).
  if (eventId === 'minx') {
    const m = s.match(/R\+\+|R--|D\+\+|D--|U'|U/g);
    return m && m.length > 0 ? [{ len: m.length, text: s }] : [];
  }

  // Everything else: whitespace tokens (newlines collapse into the same split).
  const n = countTokens(s);
  return n > 0 ? [{ len: n, text: s }] : [];
}

/** Move-counts only — see scrambleMoveSamples. */
export function scrambleMoveLengths(eventId: string, scramble: string): number[] {
  return scrambleMoveSamples(eventId, scramble).map((x) => x.len);
}

function countTokens(line: string): number {
  const t = line.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}
