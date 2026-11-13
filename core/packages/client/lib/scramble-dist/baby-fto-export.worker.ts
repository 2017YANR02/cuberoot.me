import { babyFtoAllScramblesByLength } from '@cuberoot/puzzle-solvers/baby-fto';
import { blobFromLines } from './download';

self.onmessage = async (event: MessageEvent<{ depth?: number }>) => {
  try {
    const { depth } = event.data;
    const states = await babyFtoAllScramblesByLength();
    if (depth !== undefined && (!Number.isInteger(depth) || !states[depth])) throw new Error('Invalid depth');
    function* lines(): Generator<string> {
      if (depth !== undefined) {
        yield* states[depth];
        // Preserve the solved state's single empty line in the depth-zero TXT.
        yield '';
        return;
      }
      yield 'optimal_length,scramble';
      for (const [distance, scrambles] of Object.entries(states)) {
        for (const scramble of scrambles) yield `${distance},${scramble}`;
      }
      yield '';
    }
    self.postMessage({ blob: blobFromLines(lines()) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
