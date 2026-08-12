import type { AlgPuzzle } from '@cuberoot/shared';
import { normalizeAlgForTwisty } from '@/lib/alg_normalize';

/** Resolve the preview's initial state without duplicating the rule across renderers. */
export function resolvePlayerSetup(
  puzzle: AlgPuzzle,
  alg: string,
  setup: string | undefined,
  startSolved: boolean,
): string {
  if (startSolved) return '';
  if (setup?.trim()) return normalizeAlgForTwisty(puzzle, setup);
  return `(${normalizeAlgForTwisty(puzzle, alg)})'`;
}
