/*
 * cross-trainer/fill — complete a sub-step coordinate into a uniformly random LEGAL cube.
 *
 * The sub-step coordinate pins a few pieces (4 cross edges, sometimes a corner + an edge, …).
 * Everything else must be filled uniformly at random subject to the three cube constraints —
 * and, critically, the repair of those constraints must never touch a pinned piece, or the
 * emitted state would be legal but no longer have the requested optimal length:
 *   • Σ eo ≡ 0 (mod 2)  → derive the last FREE edge's flip.
 *   • Σ co ≡ 0 (mod 3)  → derive the last FREE corner's twist.
 *   • sgn(ep) = sgn(cp) → resample the FREE corner permutation until the parities agree
 *                          (Kociemba's own method; ~2 draws). Never swap to "fix" it.
 *
 * Because every fiber of the coordinate projection has the same size, uniform coordinate ×
 * uniform fill = uniform over all cube states with that optimal length.
 */

import type { CubieCube } from '../kociemba/cube.js';

/** One pinned piece: `piece` (its identity) sits at `slot` with orientation `ori`. */
export interface Pin { piece: number; slot: number; ori: number }

function permParity(p: ArrayLike<number>): number {
  const n = p.length;
  const seen = new Uint8Array(n);
  let cycles = 0;
  for (let i = 0; i < n; i++) {
    if (seen[i]) continue;
    cycles++;
    let j = i;
    while (!seen[j]) { seen[j] = 1; j = p[j]; }
  }
  return (n - cycles) & 1;
}

function shuffle(a: number[], rng: () => number): void {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
}

/**
 * Build a uniformly random legal cube whose pinned edges/corners are exactly as given.
 * `edgePins` / `cornerPins` must use distinct pieces and distinct slots.
 */
export function fillState(edgePins: Pin[], cornerPins: Pin[], rng: () => number): CubieCube {
  const ep = new Array<number>(12).fill(-1);
  const eo = new Array<number>(12).fill(0);
  const cp = new Array<number>(8).fill(-1);
  const co = new Array<number>(8).fill(0);

  for (const p of edgePins) { ep[p.slot] = p.piece; eo[p.slot] = p.ori; }
  for (const p of cornerPins) { cp[p.slot] = p.piece; co[p.slot] = p.ori; }

  const freeEdgeSlots: number[] = [], freeEdgePieces: number[] = [];
  for (let i = 0; i < 12; i++) if (ep[i] < 0) freeEdgeSlots.push(i);
  for (let i = 0; i < 12; i++) if (!ep.includes(i)) freeEdgePieces.push(i);
  const freeCornerSlots: number[] = [], freeCornerPieces: number[] = [];
  for (let i = 0; i < 8; i++) if (cp[i] < 0) freeCornerSlots.push(i);
  for (let i = 0; i < 8; i++) if (!cp.includes(i)) freeCornerPieces.push(i);

  // edges: random placement + random flips, last free flip derived from the pinned sum
  const edgePerm = freeEdgePieces.slice();
  shuffle(edgePerm, rng);
  let flipSum = edgePins.reduce((s, p) => s + p.ori, 0);
  for (let i = 0; i < freeEdgeSlots.length; i++) {
    ep[freeEdgeSlots[i]] = edgePerm[i];
    if (i < freeEdgeSlots.length - 1) {
      const o = rng() < 0.5 ? 0 : 1;
      eo[freeEdgeSlots[i]] = o;
      flipSum += o;
    }
  }
  // With every edge pinned the caller already owns the flip parity (it sampled a legal set).
  if (freeEdgeSlots.length > 0) eo[freeEdgeSlots[freeEdgeSlots.length - 1]] = flipSum & 1;

  // corners: random twists (last derived), permutation resampled until parity matches
  let twistSum = cornerPins.reduce((s, p) => s + p.ori, 0);
  for (let i = 0; i < freeCornerSlots.length - 1; i++) {
    const o = (rng() * 3) | 0;
    co[freeCornerSlots[i]] = o;
    twistSum += o;
  }
  if (freeCornerSlots.length > 0) co[freeCornerSlots[freeCornerSlots.length - 1]] = (3 - (twistSum % 3)) % 3;

  const wanted = permParity(ep);
  const cornerPerm = freeCornerPieces.slice();
  for (let guard = 0; guard < 64; guard++) {
    shuffle(cornerPerm, rng);
    for (let i = 0; i < freeCornerSlots.length; i++) cp[freeCornerSlots[i]] = cornerPerm[i];
    if (permParity(cp) === wanted) break;
  }
  return { cp, co, ep, eo };
}
