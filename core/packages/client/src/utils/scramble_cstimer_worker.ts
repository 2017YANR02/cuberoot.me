/**
 * Generic cstimer Web Worker — receives {spec: {type, length}} and answers
 * with the generated scramble. Shared by every cstimer-routed event
 * (333/444/555/666/777/2x2/clock/minx/pyram/skewb/sq1/bld/oh/fm).
 *
 * cstimer's getScramble is stateful: on first call for a given type it
 * builds pruning tables (lazy, ~100ms-3s). Subsequent calls reuse cached
 * tables. One worker can mix types — each adds its own table to memory
 * but stays cached for the worker's lifetime, so a multi-event Generate
 * batch only pays cold-build once per (worker, type).
 */
import cstimer from 'cstimer_module';

interface Req {
  id: number;
  spec: { type: string; length: number };
}

interface Res {
  id: number;
  moves?: string;
  error?: string;
}

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, spec } = e.data;
  try {
    const moves = cstimer.getScramble(spec.type, spec.length) as string;
    (self as unknown as Worker).postMessage({ id, moves } as Res);
  } catch (err) {
    (self as unknown as Worker).postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    } as Res);
  }
};
