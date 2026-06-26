/**
 * Registry of group-theoretic 2D-net puzzles (non-WCA puzzles whose scrambles
 * come from cubing.js / our own random-move generators). Each entry is a
 * self-contained {@link PuzzleNetDef} — a permutation group (orbits + generators
 * in cycle notation) plus net geometry — defined in _nets/*.ts and rendered by
 * the generic engine. cubing.js is NOT imported here.
 *
 * To add a puzzle: `node scripts/gen-net.mts <id>` to emit _nets/<id>.ts, then
 * register it below and in ScramblePreview2D's HAS_PREVIEW.
 */
import { renderNet, type PuzzleNetDef } from './_net_render';
import { FTO } from './_nets/fto';
import { BABY_FTO } from './_nets/baby_fto';
import { MASTER_TETRAMINX } from './_nets/master_tetraminx';
import { KILOMINX } from './_nets/kilominx';
import { REDI_CUBE } from './_nets/redi_cube';

const REGISTRY: Record<string, PuzzleNetDef> = {
  fto: FTO,
  baby_fto: BABY_FTO,
  master_tetraminx: MASTER_TETRAMINX,
  kilominx: KILOMINX,
  redi_cube: REDI_CUBE,
};

/** Event ids that have a baked group-theoretic net renderer. */
export const BAKED_NET_EVENTS: readonly string[] = Object.keys(REGISTRY);

/** Render a baked-net puzzle's scramble preview, or null if the event has none. */
export function renderBakedNet(event: string, scramble: string): string | null {
  const def = REGISTRY[event];
  return def ? renderNet(def, scramble) : null;
}
