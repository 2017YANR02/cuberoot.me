/**
 * Registry of per-puzzle PG bindings. Imported lazily (it pulls in the ~3.4k-line
 * vendored puzzle-geometry via PgBackbone), so it must never land in the default
 * bundle — `GroupTheoryPanel` reaches it through `import()`.
 *
 * To give another engine puzzle a group-theory kernel: write its `<x>PgBridge.ts`
 * (PG name + engine generators as PG transforms + move↔step + parse/print) and add it
 * here. Everything else (BSGS solve/scramble, live mirroring, the panel) is shared.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PgEngineBinding, type MoveBridge } from './pgBinding';
import { pyraPgBridge } from './pyra/pyraPgBridge';

const BRIDGES: Record<string, MoveBridge<any>> = {
  pyraminx: pyraPgBridge,
};

/** Engine puzzle kinds that have a PG group-theory binding (for the render toggle). */
export const PG_BOUND_PUZZLES = Object.keys(BRIDGES);

export function hasPgBinding(puzzle: string): boolean {
  return puzzle in BRIDGES;
}

export function createBinding(puzzle: string): PgEngineBinding<any> | null {
  const bridge = BRIDGES[puzzle];
  return bridge ? new PgEngineBinding(bridge) : null;
}
