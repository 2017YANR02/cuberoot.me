import type { AlgPuzzle } from '@cuberoot/shared/alg';
import { stm } from '@cuberoot/shared/alg-notation';
import { parseFtoEifAlgorithm, parseFtoEifToken } from '@cuberoot/shared/fto-notation';
import { displayAlg } from '@/lib/alg_display';
import { sq1MoveCounts } from '@/lib/sq1-metrics';

const FTO_ROTATIONS = new Set(['Rt', 'Lt', 'Ft']);

/** Count the same algorithm text that the catalog displays, using each puzzle's canonical notation parser. */
export function displayedAlgorithmStm(puzzle: AlgPuzzle, algorithm: string): number | null {
  const displayed = displayAlg(algorithm);
  if (puzzle === 'sq1') return sq1MoveCounts(displayed).twist;
  if (puzzle !== 'fto') return stm(displayed);

  const parsed = parseFtoEifAlgorithm(displayed);
  if (parsed.invalid.length > 0) return null;
  return parsed.tokens.reduce((total, token) => {
    const root = parseFtoEifToken(token)?.root;
    return total + (root && !FTO_ROTATIONS.has(root) ? 1 : 0);
  }, 0);
}
