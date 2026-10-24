/** Bounded notation search for a fixed outer-turn path; no cube solving/table IO. */
import { strictOuterForm } from '../../../core/packages/shared/src/timer/reconstruct/library_correction.ts';
import { outerTurnSequence } from '../../../core/packages/shared/src/recon_ground_truth.ts';
import { canonicalize3x3WideMoves } from '../../../core/packages/shared/src/alg_notation.ts';
import { algSpeed, MCC_DEFAULTS, normalizeLine } from '../../../core/packages/client/lib/mcc.ts';

type Transition = { moves: string[]; frame: number; token: string };
type Candidate = { alg: string; score: number };
const BEAM_PER_FRAME = 3;
const RETURN_BEST = 8;
const MAX_OUTER_MOVES = 80;
export const ZBLL_ALLOWED_FAMILIES = ['R', 'L', 'U', 'D', 'F', 'r', 'u', 'E', 'M', 'S'] as const;
const TOKENS = ZBLL_ALLOWED_FAMILIES.flatMap(face => [face, `${face}'`, `${face}2`]);
const allowedTokens = new Set<string>(TOKENS);
let transitions: Array<Map<string, Transition[]>> | undefined;

/** The empty algorithm is the identity; every actual move must be allowed. */
export function isAllowedZbllAlgorithm(alg: string): boolean {
  return alg.trim().split(/\s+/).filter(Boolean).every(token => allowedTokens.has(token));
}

function assertEquivalentAlgorithms(algorithms: string[], canonical: string): string[] {
  for (const candidate of algorithms) {
    if (!isAllowedZbllAlgorithm(candidate))
      throw Error(`Notation optimizer produced a disallowed move: ${candidate}`);
    if (strictOuterForm(candidate.split(' ').filter(Boolean)).key !== canonical)
      throw Error('Notation optimizer changed the canonical outer-turn path');
  }
  return algorithms;
}

function score(alg: string, ignoreAUF = true): number {
  const value = algSpeed(normalizeLine(canonicalize3x3WideMoves(alg)), false, ignoreAUF, MCC_DEFAULTS);
  if (typeof value !== 'number' || !Number.isFinite(value)) throw Error(`MCC rejected notation: ${alg}`);
  return value;
}

/** Count two-layer turns, not half-turns or single middle slices (M/E/S). */
export function wideTurnCount(alg: string): number {
  return alg.trim().split(/\s+/).filter(token => /^(?:[rlufbd]|[RLUFBD]w)(?:2'?|')?$/.test(token)).length;
}

/** Only breaks MCC ties; this is a notation preference, not another MCC metric. */
export function compareZbllNotation(a: string, b: string): number {
  return wideTurnCount(a) - wideTurnCount(b) || a.localeCompare(b);
}

function compare(a: Candidate, b: Candidate): number {
  return a.score - b.score || wideTurnCount(a.alg) - wideTurnCount(b.alg)
    || a.alg.split(' ').length - b.alg.split(' ').length
    || compareZbllNotation(a.alg, b.alg);
}

function getTransitions(): Array<Map<string, Transition[]>> {
  if (transitions) return transitions;
  // A pure rotation has no outer moves. Its canonical residual spelling is a
  // stable frame key, supplied by the existing normalization implementation.
  const frames: string[][] = [[]];
  const ids = new Map<string, number>([['', 0]]);
  for (let i = 0; i < frames.length; i++) {
    for (const turn of ['x', 'y', 'z']) {
      const { rotation } = outerTurnSequence([...frames[i], turn]);
      const key = rotation.join(' ');
      if (!ids.has(key)) { ids.set(key, frames.length); frames.push(rotation); }
    }
  }
  if (frames.length !== 24) throw Error(`Expected 24 cube frames, got ${frames.length}`);
  transitions = frames.map(frame => {
    const byFirstMove = new Map<string, Transition[]>();
    for (const token of TOKENS) {
      // A token consumes one outer turn (face/wide) or two (slice), and moves
      // the current centre frame. Canonicalize commuting opposite faces too.
      const expanded = outerTurnSequence([...frame, token]);
      const key = strictOuterForm(expanded.moves).key;
      const moves = key.split(' ').filter(Boolean);
      const nextFrame = ids.get(expanded.rotation.join(' '));
      if (moves.length < 1 || moves.length > 2 || nextFrame === undefined)
        throw Error(`Unexpected primitive expansion: ${frame.join(' ')} ${token}`);
      const entries = byFirstMove.get(moves[0]) ?? [];
      entries.push({ moves, frame: nextFrame, token });
      byFirstMove.set(moves[0], entries);
    }
    return byFirstMove;
  });
  return transitions;
}

/**
 * Return several low-MCC spellings of the same canonical outer-turn path.
 * Wide/slice moves may occur anywhere. Generated spellings have no explicit
 * rotations; final whole-cube orientation is allowed to differ. The canonical
 * outer spelling is retained as a fallback, as is the original when all of its
 * moves are allowed. This beam search is deliberately bounded and does not
 * claim a globally minimum MCC.
 */
export function improveNotation(alg: string, options: { preserveOrientation?: boolean; beamPerFrame?: number; completeBoundaryAUF?: boolean; ignoreBoundaryAUF?: boolean } = {}): string[] {
  const tokens = alg.trim().split(/\s+/).filter(Boolean);
  if (tokens.some(token => !/^(?:[URFDLB]w?|[urfdlbMESxyz])(?:2'?|')?$/.test(token)))
    throw Error('Notation optimizer requires ordinary 3x3 move tokens');
  const canonical = strictOuterForm(tokens).key;
  const outer = canonical.split(' ').filter(Boolean);
  const original = tokens.join(' ');
  const fallback = [...new Set([original, canonical].filter(isAllowedZbllAlgorithm))];
  if (!outer.length || outer.length > MAX_OUTER_MOVES)
    return assertEquivalentAlgorithms(fallback, canonical);

  const table = getTransitions();
  const buckets: Array<Map<number, Candidate[]>> = Array.from({ length: outer.length + 1 }, () => new Map());
  buckets[0].set(0, [{ alg: '', score: 0 }]);
  for (let at = 0; at < outer.length; at++) {
    for (const [frame, candidates] of buckets[at]) {
      for (const transition of table[frame].get(outer[at]) ?? []) {
        if (!transition.moves.every((move, offset) => outer[at + offset] === move)) continue;
        const destination = buckets[at + transition.moves.length];
        const beam = destination.get(transition.frame) ?? [];
        for (const candidate of candidates) {
          const nextAlg = candidate.alg ? `${candidate.alg} ${transition.token}` : transition.token;
          if (beam.some(existing => existing.alg === nextAlg)) continue;
          beam.push({ alg: nextAlg, score: score(nextAlg, options.ignoreBoundaryAUF !== false && (!options.completeBoundaryAUF || at + transition.moves.length === outer.length)) });
        }
        beam.sort(compare);
        beam.length = Math.min(beam.length, options.beamPerFrame ?? BEAM_PER_FRAME);
        destination.set(transition.frame, beam);
      }
    }
    // Only transitions to the next one or two positions remain live.
    buckets[at].clear();
  }
  const finalBuckets = options.preserveOrientation ? [buckets[outer.length].get(0) ?? []] : [...buckets[outer.length].values()];
  const best = finalBuckets.flat().map(c => ({alg: c.alg, score: score(c.alg, options.ignoreBoundaryAUF !== false)})).sort(compare).slice(0, RETURN_BEST);
  const output = [...new Set([...best.map(candidate => candidate.alg), ...fallback])].filter(a => !options.preserveOrientation || strictOuterForm(a.split(" ")).rotation.length === 0);
  assertEquivalentAlgorithms(output, canonical);
  return output.sort((a, b) => compare({ alg: a, score: score(a, options.ignoreBoundaryAUF !== false) }, { alg: b, score: score(b, options.ignoreBoundaryAUF !== false) }));
}
