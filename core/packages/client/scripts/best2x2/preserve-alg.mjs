import { Alg } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';

const puzzle = puzzles['2x2x2'].kpuzzle();
const AUF = ['', 'U', 'U2', "U'"];

/** Call only after source case membership is verified. Never rewrite the source moves. */
export async function preserveAlg(setup, entry) {
  if (!entry.alg?.trim()) throw new Error('Empty source algorithm');
  const kpuzzle = await puzzle;
  const state = kpuzzle.defaultPattern().applyAlg(setup);
  for (const pre of AUF) {
    const alg = pre ? `${pre} ${entry.alg}` : entry.alg;
    if (state.applyAlg(alg).experimentalIsSolved({ ignorePuzzleOrientation: true, ignoreCenterOrientation: true })) {
      const { setup: _oldSetup, ...rest } = entry;
      return { ...rest, alg };
    }
  }
  // Existing per-entry setup handles a different angle / finishing AUF without
  // changing the executable formula or adding a trailing adjustment.
  return { ...entry, setup: new Alg(entry.alg).invert().toString() };
}
