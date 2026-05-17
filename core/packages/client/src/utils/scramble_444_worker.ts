/**
 * Dedicated 4x4 random-state scrambler — cs0x7f's Threephase (TPR) via the
 * `cstimer_module` npm package, which is the same JS code cubing.js vendors
 * but without cubing.js's worker boundary + rawRandom333Scramble prefix
 * overhead (cubing.js prepends a random 3x3 solve to each 4x4 scramble,
 * which adds ~50-150ms of solver work per call).
 *
 * Output is identical-format WCA-spec 4x4 wide-notation (~44 moves starting
 * with 3x3 notation, transitioning to Rw/Uw/Lw/Fw/Bw/Dw widening).
 *
 * Pruning tables (~30 MB) build on first call (~1.5s); subsequent warm calls
 * are 60-300ms. Tables persist for the worker's lifetime (page session).
 */
import cstimer from 'cstimer_module';

interface Req {
  id: number;
  type: 'scramble';
}

interface Res {
  id: number;
  moves?: string;
  error?: string;
}

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, type } = e.data;
  if (type !== 'scramble') return;
  try {
    const moves = cstimer.getScramble('444wca', 0) as string;
    const res: Res = { id, moves };
    (self as unknown as Worker).postMessage(res);
  } catch (err) {
    const res: Res = { id, error: err instanceof Error ? err.message : String(err) };
    (self as unknown as Worker).postMessage(res);
  }
};
