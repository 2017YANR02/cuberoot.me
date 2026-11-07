/** Native PG state/notation shared by puzzle previews and verification. */
import { Alg, Commutator, Conjugate, Grouping, Move } from 'cubing/alg';
import { KPuzzle } from 'cubing/kpuzzle';
import { ExperimentalPGNotation, getPuzzleGeometryByDesc } from 'cubing/puzzle-geometry';
import { INTERACTIVE_PG_PUZZLES, type PgInteractionPuzzleId } from './native-puzzles';

const cachedPuzzles = new Map<string, KPuzzle>();

/** The shared native PG model, also used by catalog puzzles without a native scrambler. */
export function puzzleGeometryKPuzzle(description: string): KPuzzle {
  let puzzle = cachedPuzzles.get(description);
  if (!puzzle) {
    // Same options used by TwistyPlayer's description loader. Preserve its native
    // notation mapper, including opposite slices and v-suffixed whole rotations.
    const pg = getPuzzleGeometryByDesc(description, { allMoves: true, orientCenters: true, addRotations: true });
    puzzle = new KPuzzle(pg.getKPuzzleDefinition(true), {
      experimentalPGNotation: new ExperimentalPGNotation(pg, pg.getOrbitsDef(true)),
    });
    cachedPuzzles.set(description, puzzle);
  }
  return puzzle;
}

export function nativePuzzleKPuzzle(id: PgInteractionPuzzleId): KPuzzle {
  const description = INTERACTIVE_PG_PUZZLES[id].description;
  if (id !== 'baby_fto') return puzzleGeometryKPuzzle(description);
  // Match the named cubing.js BabyFTOPuzzleLoader synchronously for validation
  // and gestures. The renderer still loads `baby_fto` itself, including its SVG.
  const key = `named:${id}`;
  let puzzle = cachedPuzzles.get(key);
  if (!puzzle) {
    const pg = getPuzzleGeometryByDesc(description, { allMoves: true, orientCenters: true, addRotations: true });
    const definition = pg.getKPuzzleDefinition(true);
    definition.name = id;
    definition.defaultPattern.CENTERS.orientationMod = Array(definition.defaultPattern.CENTERS.pieces.length).fill(1);
    const notation = new ExperimentalPGNotation(pg, pg.getOrbitsDef(true));
    puzzle = new KPuzzle(notation.remapKPuzzleDefinition(definition), { experimentalPGNotation: notation });
    cachedPuzzles.set(key, puzzle);
  }
  return puzzle;
}

const MAX_LENGTH = 16_384;
const MAX_WORK = 4_096;
const MAX_DEPTH = 32;

/** Bound work before expansion, including huge empty repeats and move powers. */
function checkWork(alg: Alg, depth = 0): number {
  if (depth > MAX_DEPTH) throw new Error('Algorithm nesting is too deep');
  let work = 0;
  for (const node of alg.childAlgNodes()) {
    let cost = 1;
    if (node instanceof Move) cost += Math.abs(node.amount);
    else if (node instanceof Grouping) cost += (1 + checkWork(node.alg, depth + 1)) * Math.abs(node.amount);
    else if (node instanceof Commutator) cost += 2 * (checkWork(node.A, depth + 1) + checkWork(node.B, depth + 1));
    else if (node instanceof Conjugate) cost += 2 * checkWork(node.A, depth + 1) + checkWork(node.B, depth + 1);
    work += cost;
    if (!Number.isSafeInteger(work) || work > MAX_WORK) throw new Error('Algorithm expansion is too large');
  }
  return work;
}

function parseModelAlg(input: string, getPuzzle: () => KPuzzle): Alg {
  if (input.length > MAX_LENGTH) throw new Error('Algorithm is too long');
  // Bound nesting before the recursive upstream parser itself sees the input.
  let depth = 0;
  for (const line of input.split('\n')) {
    for (const char of line.split('//', 1)[0]) {
      if (char === '(' || char === '[') {
        if (++depth > MAX_DEPTH) throw new Error('Algorithm nesting is too deep');
      } else if (char === ')' || char === ']') depth--;
    }
  }
  const alg = new Alg(input);
  checkWork(alg);
  const puzzle = getPuzzle();
  // Validate the complete sequence atomically; do not silently ignore bad grips.
  for (const node of alg.experimentalExpand()) {
    if (node instanceof Move) puzzle.moveToTransformation(node);
  }
  return alg;
}

export function parsePuzzleGeometryAlg(description: string, input: string): Alg {
  return parseModelAlg(input, () => puzzleGeometryKPuzzle(description));
}

export function parseNativePuzzleAlg(id: PgInteractionPuzzleId, input: string): Alg {
  return parseModelAlg(input, () => nativePuzzleKPuzzle(id));
}

/** Cancel using each native axis's real order (SuperZ mixes orders 3 and 4). */
export function simplifyNativePuzzleAlg(id: PgInteractionPuzzleId, input: string): string {
  const alg = parseNativePuzzleAlg(id, input);
  const puzzle = nativePuzzleKPuzzle(id);
  return alg.experimentalSimplify({
    cancel: true,
    puzzleSpecificSimplifyOptions: {
      quantumMoveOrder: (quantum) => puzzle.moveToTransformation(new Move(quantum, 1)).repetitionOrder(),
    },
  }).toString();
}
