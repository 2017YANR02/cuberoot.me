import type { AlgCase, AlgPuzzle } from '@cuberoot/shared/alg';
import { stm } from '@cuberoot/shared/alg-notation';
import { parseFtoEifAlgorithm, parseFtoEifToken } from '@cuberoot/shared/fto-notation';
import { displayAlg } from '@/lib/alg_display';
import { sq1MoveCounts } from '@/lib/sq1-metrics';

type FirstAlgorithmCase = Pick<AlgCase, 'algs' | 'setup' | 'standard'>;

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

/** Mean STM of exactly one algorithm per case: the first entry, then the legacy standard fallback. */
export function firstAlgorithmAverageStm(
  puzzle: AlgPuzzle,
  cases: readonly FirstAlgorithmCase[],
): number | null {
  if (cases.length === 0) return null;

  let total = 0;
  for (const caseObj of cases) {
    const firstAlgorithm = caseObj.algs.flat()[0]?.alg ?? caseObj.standard;
    // FTO 1L3T deliberately includes one solved reference case: no setup and no moves.
    if (firstAlgorithm == null && puzzle === 'fto' && !caseObj.setup.trim()) continue;
    if (firstAlgorithm == null) return null;
    const moves = displayedAlgorithmStm(puzzle, firstAlgorithm);
    if (moves == null) return null;
    total += moves;
  }
  return total / cases.length;
}
