/** Native PG state/notation shared by puzzle previews and verification. */
import { Alg, Commutator, Conjugate, Grouping, Move } from 'cubing/alg';
import { KPuzzle } from 'cubing/kpuzzle';
import { ExperimentalPGNotation, getPuzzleGeometryByDesc } from 'cubing/puzzle-geometry';
import { NATIVE_PUZZLES, type NativePuzzleId } from './native-puzzles';

const cachedPuzzles = new Map<NativePuzzleId, KPuzzle>();

export function nativePuzzleKPuzzle(id: NativePuzzleId): KPuzzle {
  let puzzle = cachedPuzzles.get(id);
  if (!puzzle) {
    // Same options used by TwistyPlayer's description loader. Preserve its native
    // notation mapper, including opposite slices and v-suffixed whole rotations.
    const pg = getPuzzleGeometryByDesc(NATIVE_PUZZLES[id].description, { allMoves: true, orientCenters: true, addRotations: true });
    puzzle = new KPuzzle(pg.getKPuzzleDefinition(true), {
      experimentalPGNotation: new ExperimentalPGNotation(pg, pg.getOrbitsDef(true)),
    });
    cachedPuzzles.set(id, puzzle);
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

export function parseNativePuzzleAlg(id: NativePuzzleId, input: string): Alg {
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
  const puzzle = nativePuzzleKPuzzle(id);
  // Validate the complete sequence atomically; do not silently ignore bad grips.
  for (const node of alg.experimentalExpand()) {
    if (node instanceof Move) puzzle.moveToTransformation(node);
  }
  return alg;
}

/** Cancel using each native axis's real order (SuperZ mixes orders 3 and 4). */
export function simplifyNativePuzzleAlg(id: NativePuzzleId, input: string): string {
  const alg = parseNativePuzzleAlg(id, input);
  const puzzle = nativePuzzleKPuzzle(id);
  return alg.experimentalSimplify({
    cancel: true,
    puzzleSpecificSimplifyOptions: {
      quantumMoveOrder: (quantum) => puzzle.moveToTransformation(new Move(quantum, 1)).repetitionOrder(),
    },
  }).toString();
}
