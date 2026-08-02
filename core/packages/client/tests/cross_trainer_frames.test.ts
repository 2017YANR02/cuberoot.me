/*
 * cross-trainer, frames: the 24 whole-cube rotations, and the claim that rests on them —
 * ONE table set (cross on D, slot DFR) answers every (colour, slot) frame.
 *
 * The rotation code is checked two ways, neither of which can hide a bug inside itself:
 *   • a rotated state must stay legal, and its cross distance for face π(f) must equal the
 *     original's for f (cross tables are already pinned to or18's published histogram);
 *   • a state sampled for frame (colour, slot) is re-measured by an IDA* that walks the
 *     frame's OWN pieces — no rotation involved — with the cross distance as its only
 *     heuristic. If the rotate → sample → un-rotate chain were off by one relabel, the
 *     requested depth and the measured one would disagree.
 */

import { describe, expect, it } from 'vitest';
import { crossDist, crossNext, encodeCross } from '@/lib/cross-trainer/dist';
import { CORNER_STEP, EDGE_STEP, FACE_EDGES, f2lSlots, skipRow, COLOR_FACE, type FaceIdx } from '@/lib/cross-trainer/model';
import { ROTATIONS, ROT_FOR_FRAME, CANON_FACE, CANON_SLOT, inverseRotation, rotateState, N_ROTATIONS } from '@/lib/cross-trainer/rotate';
import {
  sampleTrainerState, xcrossFrameDist, crossMetric, facesOfSubset, slotNamesOf,
  eoCoordOf, xcoordOf, xxcoordOf, applyMove, trainerSolution,
  trainerVariants, trainerStagesOf, trainerCaps,
} from '@/lib/cross-trainer';
import { eoCrossDistCapped, eoFrameData } from '@/lib/cross-trainer/eo';
import { pairDistCapped, pairFrameData } from '@/lib/cross-trainer/pair';
import { xpairDistCapped, xpairFrameData } from '@/lib/cross-trainer/xpair';
import {
  pseudoCrossDist, pseudoXFrameData, pseudoXcrossDistCapped, xxFrameData, xxcrossDistCapped,
} from '@/lib/cross-trainer/multi';
import { fillState } from '@/lib/cross-trainer/fill';
import { validateCubie, type CubieCube } from '@/lib/cube-facelet';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const crossCoordOf = (c: CubieCube, f: FaceIdx): number => {
  const at = (piece: number) => { const s = c.ep.indexOf(piece); return s * 2 + c.eo[s]; };
  const h = FACE_EDGES[f];
  return encodeCross(at(h[0]), at(h[1]), at(h[2]), at(h[3]));
};

/** Optimal XCross for a frame, walking that frame's own pieces. Heuristic: cross only. */
function directXcrossDist(state: CubieCube, face: FaceIdx, slot: number, cap: number): number {
  const next = crossNext();
  const cd = crossDist(face);
  const s = f2lSlots(face)[slot];
  const home = FACE_EDGES[face];
  const goalCross = encodeCross(home[0] * 2, home[1] * 2, home[2] * 2, home[3] * 2);
  const goalCorner = s.corner * 3, goalEdge = s.edge * 2;
  const at = (piece: number) => { const i = state.ep.indexOf(piece); return i * 2 + state.eo[i]; };
  const cs = state.cp.indexOf(s.corner);
  const start = { c: crossCoordOf(state, face), co: cs * 3 + state.co[cs], e: at(s.edge) };
  const solved = (c: number, co: number, e: number) => c === goalCross && co === goalCorner && e === goalEdge;
  if (solved(start.c, start.co, start.e)) return 0;
  const rec = (c: number, co: number, e: number, depth: number, prev: number): boolean => {
    const skip = skipRow(prev);
    const base = c * 18;
    for (let m = 0; m < 18; m++) {
      if (skip[m]) continue;
      const nc = next[base + m], nco = CORNER_STEP[m][co], ne = EDGE_STEP[m][e];
      if (depth === 1) { if (solved(nc, nco, ne)) return true; continue; }
      if (cd[nc] >= depth) continue;
      if (rec(nc, nco, ne, depth - 1, m)) return true;
    }
    return false;
  };
  for (let lim = Math.max(cd[start.c], 1); lim <= cap; lim++) if (rec(start.c, start.co, start.e, lim, -1)) return lim;
  return -1;
}

describe('cross-trainer / rotations', () => {
  it('there are exactly 24, each with an inverse', () => {
    expect(N_ROTATIONS).toBe(24);
    expect(new Set(ROTATIONS.map((r) => r.face.join(''))).size).toBe(24);
    for (let r = 0; r < 24; r++) {
      const inv = inverseRotation(r);
      expect(inv, `inverse of ${r}`).toBeGreaterThanOrEqual(0);
      for (let f = 0; f < 6; f++) expect(ROTATIONS[inv].face[ROTATIONS[r].face[f]]).toBe(f);
    }
  });

  it('rotating keeps the cube legal and carries cross distance with the face', () => {
    const rng = lcg(31337);
    for (let n = 0; n < 12; n++) {
      const st = fillState([], [], rng);
      for (let r = 0; r < 24; r++) {
        const rot = rotateState(st, r);
        expect(validateCubie(rot), `rot ${r}`).toBeNull();
        for (let f = 0; f < 6; f++) {
          const before = crossDist(f as FaceIdx)[crossCoordOf(st, f as FaceIdx)];
          const img = ROTATIONS[r].face[f] as FaceIdx;
          expect(crossDist(img)[crossCoordOf(rot, img)], `r${r} f${f}`).toBe(before);
        }
        // round trip
        const back = rotateState(rot, inverseRotation(r));
        expect(back.ep).toEqual(st.ep);
        expect(back.eo).toEqual(st.eo);
        expect(back.cp).toEqual(st.cp);
        expect(back.co).toEqual(st.co);
      }
    }
  });

  it('every (colour, slot) frame has exactly one rotation onto the canonical frame', () => {
    const used = new Set<number>();
    for (let f = 0; f < 6; f++) {
      expect(ROT_FOR_FRAME[f]).toHaveLength(4);
      for (const r of ROT_FOR_FRAME[f]) {
        expect(r, `frame ${f}`).toBeGreaterThanOrEqual(0);
        used.add(r);
      }
    }
    expect(used.size).toBe(24); // simply transitive
    // the canonical frame maps to itself by the identity
    const canonSlotCorner = f2lSlots(CANON_FACE)[CANON_SLOT].corner;
    const idRot = ROT_FOR_FRAME[CANON_FACE][CANON_SLOT];
    expect(ROTATIONS[idRot].face).toEqual([0, 1, 2, 3, 4, 5]);
    expect(ROTATIONS[idRot].cMap[canonSlotCorner]).toBe(canonSlotCorner);
  });
});

describe('cross-trainer / registry', () => {
  it('cross: sampled states hit the requested best-of-subset window', () => {
    const rng = lcg(7);
    for (const colors of ['W', 'WY', 'BGORWY']) {
      const faces = facesOfSubset(colors);
      for (const [lo, hi] of [[2, 2], [4, 5], [6, 6]] as const) {
        const got = sampleTrainerState({ variant: 'std', stage: 'cross', colors, slot: 'best', lo, hi }, rng);
        expect(got, `${colors} ${lo}-${hi}`).not.toBeNull();
        expect(validateCubie(got!.state)).toBeNull();
        expect(got!.depth).toBe(crossMetric(got!.state, faces));
        expect(got!.depth).toBeGreaterThanOrEqual(lo);
        expect(got!.depth).toBeLessThanOrEqual(hi);
      }
    }
  }, 120_000);

  it('xcross: a fixed (colour, slot) draw really is that many moves in ITS OWN frame', () => {
    const rng = lcg(2026);
    // two frames well away from the canonical one, so a wrong relabel cannot pass
    const frames: Array<[FaceIdx, number]> = [[COLOR_FACE.White, 2], [COLOR_FACE.Green, 1]];
    for (const [face, slot] of frames) {
      const colors = { 0: 'W', 1: 'R', 2: 'G', 3: 'Y', 4: 'O', 5: 'B' }[face]!;
      for (const d of [0, 1, 3, 5, 6, 7, 8]) {
        const got = sampleTrainerState({ variant: 'std', stage: 'xcross', colors, slot, lo: d, hi: d }, rng);
        expect(got, `${colors}/${slot} d=${d}`).not.toBeNull();
        expect(got!.depth, `${colors}/${slot} d=${d}`).toBe(d);
        expect(validateCubie(got!.state), 'legality').toBeNull();
        // independent: no rotation, no joint tables — the frame's own pieces + cross heuristic
        expect(directXcrossDist(got!.state, face, slot, d + 1), `verify ${colors}/${slot} d=${d}`).toBe(d);
        // and the registry's own frame-generic reading agrees
        expect(xcrossFrameDist(got!.state, face, slot, 10)).toBe(d);
      }
    }
  }, 300_000);

  it('xcross: colour-neutral / slot-neutral draws are the best over the chosen frames', () => {
    const rng = lcg(555);
    const cases: Array<{ colors: string; slot: number | 'best'; lo: number; hi: number }> = [
      { colors: 'Y', slot: 'best', lo: 5, hi: 6 },
      { colors: 'WY', slot: 2, lo: 6, hi: 7 },
      { colors: 'BGORWY', slot: 'best', lo: 4, hi: 5 },
    ];
    for (const c of cases) {
      const got = sampleTrainerState({ variant: 'std', stage: 'xcross', ...c }, rng);
      expect(got, JSON.stringify(c)).not.toBeNull();
      expect(got!.depth).toBeGreaterThanOrEqual(c.lo);
      expect(got!.depth).toBeLessThanOrEqual(c.hi);
      // brute force the same minimum with the independent search
      const faces = facesOfSubset(c.colors);
      const slots = c.slot === 'best' ? [0, 1, 2, 3] : [c.slot];
      let best = 99;
      for (const f of faces) for (const s of slots) {
        const v = directXcrossDist(got!.state, f, s, c.hi);
        if (v >= 0) best = Math.min(best, v);
      }
      expect(best, JSON.stringify(c)).toBe(got!.depth);
    }
  }, 300_000);

  it('eocross: a draw is that many moves in ITS OWN frame, not the canonical one', () => {
    const rng = lcg(808);
    for (const [face, letter] of [[COLOR_FACE.White, 'W'], [COLOR_FACE.Green, 'G']] as const) {
      // frame data built straight for this (face, axis) — no rotation involved
      const d = eoFrameData({ face });
      for (const depth of [3, 5, 7]) {
        const got = sampleTrainerState({ variant: 'eo', stage: 'eo_cross', colors: letter, slot: 'best', lo: depth, hi: depth }, rng);
        expect(got, `${letter} d=${depth}`).not.toBeNull();
        expect(got!.depth).toBe(depth);
        expect(validateCubie(got!.state)).toBeNull();
        expect(eoCrossDistCapped(d, eoCoordOf(got!.state, d), depth + 1), `${letter} d=${depth}`).toBe(depth);
      }
    }
  }, 300_000);

  it('eocross: colour-neutral draws are the best over the subset', () => {
    const rng = lcg(1234);
    const got = sampleTrainerState({ variant: 'eo', stage: 'eo_cross', colors: 'WY', slot: 'best', lo: 5, hi: 6 }, rng);
    expect(got).not.toBeNull();
    let best = 99;
    for (const face of [COLOR_FACE.White, COLOR_FACE.Yellow]) {
      const d = eoFrameData({ face });
      const v = eoCrossDistCapped(d, eoCoordOf(got!.state, d), 7);
      if (v >= 0) best = Math.min(best, v);
    }
    expect(best).toBe(got!.depth);
  }, 300_000);

  // Every remaining stage generates in the canonical frame and relabels the result into the
  // frame the user picked. Each case is re-measured with tables built DIRECTLY for that frame,
  // which is the one thing the relabel cannot fake.
  it('free pair / pseudo cross / pseudo xcross / pseudo pair land in their own frame', () => {
    const rng = lcg(6060);
    const face = COLOR_FACE.Blue, slot = 2, colors = 'B';

    for (const d of [2, 4, 6]) {
      const got = sampleTrainerState({ variant: 'pair', stage: 'cross_pair', colors, slot, lo: d, hi: d }, rng);
      expect(got, `pair d=${d}`).not.toBeNull();
      expect(got!.depth).toBe(d);
      const fd = pairFrameData({ face, slot });
      expect(pairDistCapped(fd, xcoordOf(got!.state, fd), d + 1), `pair d=${d}`).toBe(d);
    }

    for (const d of [3, 5, 7]) {
      const got = sampleTrainerState({ variant: 'pseudo', stage: 'pseudo_cross', colors, slot: 'best', lo: d, hi: d }, rng);
      expect(got, `pseudo cross d=${d}`).not.toBeNull();
      expect(pseudoCrossDist(face)[crossCoordOf(got!.state, face)], `pseudo cross d=${d}`).toBe(d);
    }

    for (const d of [2, 4, 6]) {
      const got = sampleTrainerState({ variant: 'pseudo', stage: 'pseudo_xcross', colors, slot, lo: d, hi: d }, rng);
      expect(got, `pseudo xcross d=${d}`).not.toBeNull();
      const fd = pseudoXFrameData({ face, slot });
      expect(pseudoXcrossDistCapped(fd, xcoordOf(got!.state, fd), d + 1), `pseudo xcross d=${d}`).toBe(d);
    }

    for (const d of [2, 4, 5]) {
      const got = sampleTrainerState({ variant: 'pseudo_pair', stage: 'pseudo_cross_pseudo_pair', colors, slot, lo: d, hi: d }, rng);
      expect(got, `pseudo pair d=${d}`).not.toBeNull();
      const fd = pairFrameData({ face, slot, pseudo: true });
      expect(pairDistCapped(fd, xcoordOf(got!.state, fd), d + 1), `pseudo pair d=${d}`).toBe(d);
    }
  }, 600_000);

  it('xxcross: both pair shapes relabel onto the right canonical frame', () => {
    const rng = lcg(77);
    const face = COLOR_FACE.Red;
    // slot index 0 = {FR,FL}-shaped (adjacent), 4 = {0,2} (diagonal) — see XX_PAIRS
    for (const [slot, pair] of [[0, [0, 1]], [4, [0, 2]]] as const) {
      for (const d of [3, 5]) {
        const got = sampleTrainerState({ variant: 'std', stage: 'xxcross', colors: 'R', slot, lo: d, hi: d }, rng);
        expect(got, `xx ${pair} d=${d}`).not.toBeNull();
        expect(got!.depth).toBe(d);
        const fd = xxFrameData({ face, slots: [pair[0], pair[1]] });
        expect(xxcrossDistCapped(fd, xxcoordOf(got!.state, fd), d + 1), `xx ${pair} d=${d}`).toBe(d);
      }
    }
  }, 600_000);

  // XCross-pair is the only stage whose two slots have DIFFERENT goals, so the pair is ordered:
  // (A, B) ≠ (B, A). Re-measuring with tables built directly for the frame catches a swap.
  it('xcross pair: the first slot is solved, the second only paired', () => {
    const rng = lcg(4242);
    const face = COLOR_FACE.Green;
    const slots = f2lSlots(face);
    // XP_PAIRS index 1 = (0,2) diagonal, 3 = (1,0) — the reverse of index 0, a different goal.
    for (const [slot, pair] of [[1, [0, 2]], [3, [1, 0]]] as const) {
      for (const d of [3, 6]) {
        const spec = { variant: 'pair', stage: 'xcross_pair', colors: 'G', slot, lo: d, hi: d };
        const got = sampleTrainerState(spec, rng);
        expect(got, `xp ${pair} d=${d}`).not.toBeNull();
        expect(got!.depth).toBe(d);
        const fd = xpairFrameData({ face, slots: [pair[0], pair[1]] });
        expect(xpairDistCapped(fd, xxcoordOf(got!.state, fd), d + 1), `xp ${pair} d=${d}`).toBe(d);

        let cur = got!.state;
        for (const m of trainerSolution(spec, got!.state)!.moves) cur = applyMove(cur, m);
        expect(xpairDistCapped(fd, xxcoordOf(cur, fd), 1), `xp ${pair} d=${d} solved`).toBe(0);
        // slot A is home outright; slot B is not required to be (that is the whole point)
        const a = slots[pair[0]];
        const cs = cur.cp.indexOf(a.corner), es = cur.ep.indexOf(a.edge);
        expect([cs, cur.co[cs], es, cur.eo[es]], `xp ${pair} slot A home`).toEqual([a.corner, 0, a.edge, 0]);
      }
    }
  }, 600_000);

  it('every stage can solve the case it generated, optimally', () => {
    const rng = lcg(2468);
    for (const variant of trainerVariants()) {
      for (const stage of trainerStagesOf(variant)) {
        const caps = trainerCaps(variant, stage)!;
        const d = caps.band[0];
        const spec = { variant, stage, colors: 'WY', slot: 'best' as const, lo: d, hi: d };
        const got = sampleTrainerState(spec, rng);
        expect(got, `${variant}/${stage}`).not.toBeNull();
        const sol = trainerSolution(spec, got!.state);
        expect(sol, `${variant}/${stage}`).not.toBeNull();
        expect(sol!.moves.length, `${variant}/${stage} optimality`).toBe(got!.depth);
        // applying it really does reach the goal (distance 0 in the winning frame)
        let cur = got!.state;
        for (const m of sol!.moves) cur = applyMove(cur, m);
        expect(trainerSolution(spec, cur)!.moves.length, `${variant}/${stage} solved`).toBe(0);
      }
    }
  }, 900_000);

  it('slot names are the frame’s own letters', () => {
    expect(slotNamesOf(COLOR_FACE.Yellow).sort()).toEqual(['BL', 'BR', 'FL', 'FR']);
    expect(slotNamesOf(COLOR_FACE.Green).sort()).toEqual(['DL', 'DR', 'UL', 'UR']);
  });
});
