import { Alg } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';
import { requires3x3AlgCaseSetup } from '@cuberoot/shared';

export type RequiredSetupError = 'f2l_setup_required' | 'f2l_setup_invalid';

let cube3Promise: ReturnType<(typeof puzzles)['3x3x3']['kpuzzle']> | null = null;

/** Validate the explicit case state required by F2L thumbnails and players. */
export async function validateRequiredAlgCaseSetup(
  puzzle: string,
  setSlug: string,
  setup: unknown,
): Promise<RequiredSetupError | null> {
  if (!requires3x3AlgCaseSetup(puzzle, setSlug)) return null;
  if (typeof setup !== 'string' || !setup.trim()) return 'f2l_setup_required';

  try {
    cube3Promise ??= puzzles['3x3x3'].kpuzzle();
    const cube3 = await cube3Promise;
    cube3.defaultPattern().applyAlg(new Alg(setup));
    return null;
  } catch {
    return 'f2l_setup_invalid';
  }
}
