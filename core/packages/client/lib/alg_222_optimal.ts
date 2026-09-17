import { puzzles } from 'cubing/puzzles';
import type { KTransformation } from 'cubing/kpuzzle';
import { cube222MetricOfScramble } from '@cuberoot/puzzle-solvers/cube222';
import { CUBE_ORIENTATIONS } from './cube-orientation';
import { normalizeAlg } from './alg_normalize';

const key = (t: KTransformation) => JSON.stringify(t.transformationData);

/** Factor each move as U/R/F followed by a free whole-cube rotation.
 * This keeps the existing exact solver's fixed DBL convention, even for setups
 * containing L/D/B or rotations. cubing.js supplies all move transformations.
 */
async function createNormalizer() {
  const kp = await puzzles['2x2x2'].kpuzzle();
  const factors = new Map<string, { move: string; rotation: KTransformation }>();
  for (const { value } of CUBE_ORIENTATIONS) {
    const rotation = kp.algToTransformation(value);
    for (const move of ['', 'U', 'U2', "U'", 'R', 'R2', "R'", 'F', 'F2', "F'"]) {
      factors.set(key(kp.algToTransformation(move).applyTransformation(rotation)), { move, rotation });
    }
  }
  return (setup: string): string => {
    let rotation = kp.identityTransformation();
    const moves: string[] = [];
    for (const token of normalizeAlg('2x2', setup).split(/\s+/).filter(Boolean)) {
      const factor = factors.get(key(rotation.applyTransformation(kp.algToTransformation(token))));
      if (!factor) throw new Error(`Unsupported 2x2 move: ${token}`);
      if (factor.move) moves.push(factor.move);
      rotation = factor.rotation;
    }
    return moves.join(' ');
  };
}

let normalizer: ReturnType<typeof createNormalizer> | undefined;
export async function normalize222OptimalSetup(setup: string): Promise<string> {
  normalizer ??= createNormalizer();
  return (await normalizer)(setup);
}

/** Exact full-solve HTM distance of the displayed setup; rotations cost zero.
 * Stage goals (e.g. Ortega OLL) must not use this full-solve distance.
 * Invalid setups stay unavailable instead of accidentally becoming zero.
 */
export async function compute222OptimalHtm(setups: readonly string[]): Promise<(number | null)[]> {
  const results: (number | null)[] = [];
  for (const setup of setups) {
    try {
      results.push(cube222MetricOfScramble(await normalize222OptimalSetup(setup), 'htm'));
    } catch {
      results.push(null);
    }
  }
  return results;
}
