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
import { PgEngineBinding, type MoveBridge, type GroupKernel } from './pgBinding';
import { PermEngineBinding } from './permBinding';
import type { PermBridge } from './permBridge';
import { pyraPgBridge } from './pyra/pyraPgBridge';
import { dinoPgBridge } from './dino/dinoPgBridge';
import { skewbPgBridge } from './skewb/skewbPgBridge';
import { heliPgBridge } from './heli/heliPgBridge';
import { megaPgBridge } from './mega/megaPgBridge';
import { ftoPgBridge } from './fto/ftoPgBridge';
import { rediPgBridge } from './redi/rediPgBridge';
import { ivyPermBridge } from './ivy/ivyPermBridge';
import { rexPermBridge } from './rex/rexPermBridge';
import { nxnPgBridge, nxnHasPgKernel, NXN_PG_MIN, NXN_PG_MAX } from './nxn/nxnPgBridge';

// Keyed by the ENGINE puzzle kind (the World.puzzleKind / SimPuzzle), not the PG name —
// e.g. engine 'heli' → bridge.pgName 'helicopter'. NxN cubes are handled separately: the
// engine kind is the numeric order, so `createBinding('3')` → nxnPgBridge(3).
const BRIDGES: Record<string, MoveBridge<any>> = {
  pyraminx: pyraPgBridge,
  dino: dinoPgBridge,
  skewb: skewbPgBridge,
  heli: heliPgBridge,
  megaminx: megaPgBridge,
  fto: ftoPgBridge,
  redi: rediPgBridge,
};

/** Engine puzzle kinds bound via the NON-PG permutation backbone (PG's polytope compiler
 *  can't represent them faithfully): ivy (only 4 tetrahedral corners turn), rex (invisible
 *  centre orientation would inflate PG's FTO count). Keyed by engine puzzleKind. */
const PERM_BRIDGES: Record<string, PermBridge<any>> = {
  ivy: ivyPermBridge,
  rex: rexPermBridge,
};

/** Fixed (non-NxN) engine puzzle kinds that have a group-theory binding (PG or perm). */
export const PG_BOUND_PUZZLES = [...Object.keys(BRIDGES), ...Object.keys(PERM_BRIDGES), 'mirror'];

/** All PG (cubing.js) bridges as a flat list (fixed + NxN 2..N), for the offline facts
 *  generator. Mirror reuses nxnPgBridge(3)'s '3x3x3' facts, so it is not listed separately. */
export function allBridges(): MoveBridge<any>[] {
  const list: MoveBridge<any>[] = Object.values(BRIDGES);
  for (let n = NXN_PG_MIN; n <= NXN_PG_MAX; n++) list.push(nxnPgBridge(n));
  return list;
}

/** All perm-backbone bridges, for the offline facts generator (baked under bridge.key). */
export function permBridges(): PermBridge<any>[] {
  return Object.values(PERM_BRIDGES);
}

/** Parse an NxN engine kind ("3", or the number 3) to its order, or null. */
function nxnOrder(puzzle: string | number): number | null {
  const n = typeof puzzle === 'number' ? puzzle : parseInt(puzzle, 10);
  return nxnHasPgKernel(n) ? n : null;
}

export function hasPgBinding(puzzle: string | number): boolean {
  if (typeof puzzle === 'string' && (puzzle in BRIDGES || puzzle in PERM_BRIDGES || puzzle === 'mirror')) return true;
  return nxnOrder(puzzle) !== null;
}

export function createBinding(puzzle: string | number): GroupKernel | null {
  const n = nxnOrder(puzzle);
  if (n !== null) return new PgEngineBinding(nxnPgBridge(n));
  // Mirror Cube is mechanically a 3x3x3 (the engine runs Cube(3)); reuse the 3x3 kernel.
  if (puzzle === 'mirror') return new PgEngineBinding(nxnPgBridge(3));
  if (typeof puzzle === 'string' && puzzle in PERM_BRIDGES) return new PermEngineBinding(PERM_BRIDGES[puzzle]);
  const bridge = typeof puzzle === 'string' ? BRIDGES[puzzle] : undefined;
  return bridge ? new PgEngineBinding(bridge) : null;
}
