/**
 * Step detection: does "is OLL done?" agree with csTimer, on real states?
 *
 * The masks are copied from upstream, but two things in our port are NOT copies
 * and are exactly where a subtle error would hide:
 *   - the 24 orientation tables, derived here from sticker geometry;
 *   - the direction in which those tables are read.
 * Both are settled by running csTimer's genuine `cubeutil` in a VM and
 * comparing verdicts state by state.
 */

import { describe, it, expect } from 'vitest';

import { stepSolved, orientationTables, faceletPosition, type CubeStep } from '@/app/[lang]/timer/_lib/cube/steps';
import { applyScramble, applyMoves, toFaceletString, fromFaceletString, solved } from '@/app/[lang]/timer/_lib/cube/state';
import { parseScramble } from '@/app/[lang]/timer/_lib/cube/moves';
import { CORNER_FACELET, EDGE_FACELET } from '@/lib/cube-facelet';
import { loadCstimerCubeutil, cstimerFileExists } from './_cstimer_cubeutil';

const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

const STEPS: CubeStep[] = ['cross', 'f2l', 'oll', 'ocll', 'eoll', 'cpll', 'fb', 'sb', 'cmll', 'solved'];

/**
 * `ocll` is ours, not upstream's — csTimer has no mask for "last-layer corners
 * oriented" because it has no alg library to drill CLS from. So it takes part in
 * every test here EXCEPT the parity ones, where upstream would silently fall
 * through to its plain solved check and disagree for the wrong reason.
 */
const UPSTREAM_STEPS: CubeStep[] = STEPS.filter((s) => s !== 'ocll');

/** The steps we only sweep 6 orientations for — see the invariance test below. */
const SIX_AXIS_STEPS: CubeStep[] = ['cross', 'f2l', 'oll', 'ocll', 'eoll', 'cpll', 'solved'];

/** A spread of real states: scrambles, and partial solves of them. */
function sampleStates(): string[] {
  const scrambles = [
    "R U R' U' R' F R2 U' R' U' R U R' F'",              // T perm
    "F R U R' U' F'",                                     // OLL 45
    "R U R' U R U2 R'",                                   // Sune
    "D2 L2 F2 U2 F2 D2 L2 U2 R2 B2 U2",                   // all-2 state
    "R' U' F D2 L2 F' R2 B2 U2 F2 D2 R2 B U' L B D' B2 R' F'",
    "L2 D2 B2 R2 F2 D' F2 U' R2 U2 B2 L' U B R' D2 F U2 L' F2",
    "U",                                                   // one turn
    "R L U D F B R' L' U' D' F' B'",
  ];
  const out: string[] = [SOLVED];
  for (const scr of scrambles) {
    const faces = applyScramble(3, scr);
    out.push(toFaceletString(faces));
    // Every prefix too: those are the states a cube actually passes through,
    // and they include plenty of "cross done but nothing else" cases.
    const moves = parseScramble(scr);
    for (let n = 1; n < moves.length; n++) {
      out.push(toFaceletString(applyMoves(solved(3), 3, moves.slice(0, n))));
    }
  }
  // Cross-only and F2L-only states, built deliberately: a random scramble is
  // unlikely to produce them, and they are the interesting ones.
  const crossOnly = "R U R' U' R U R' U'";  // leaves D cross intact
  out.push(toFaceletString(applyScramble(3, crossOnly)));
  out.push(toFaceletString(applyScramble(3, "U R U' R'")));           // F2L pair broken on U only
  out.push(toFaceletString(applyScramble(3, "R U R' U' R U R' U' R U R' U'")));
  return out;
}

describe('geometry model', () => {
  it('puts the three stickers of each corner at the same cube corner', () => {
    for (const [a, b, c] of CORNER_FACELET) {
      const pa = faceletPosition(a).pos;
      const pb = faceletPosition(b).pos;
      const pc = faceletPosition(c).pos;
      expect(pb, `corner ${a}/${b}/${c}`).toEqual(pa);
      expect(pc, `corner ${a}/${b}/${c}`).toEqual(pa);
      // A corner is a cube vertex: all three coordinates at the surface.
      expect(pa.map(Math.abs)).toEqual([1, 1, 1]);
    }
  });

  it('puts both stickers of each edge at the same cube edge', () => {
    for (const [a, b] of EDGE_FACELET) {
      const pa = faceletPosition(a).pos;
      expect(faceletPosition(b).pos, `edge ${a}/${b}`).toEqual(pa);
      // An edge has exactly one coordinate at zero.
      expect(pa.filter((v) => v === 0)).toHaveLength(1);
    }
  });

  it('derives exactly 24 orientations, each a permutation', () => {
    const tables = orientationTables();
    expect(tables).toHaveLength(24);
    for (const t of tables) {
      expect(t).toHaveLength(54);
      expect(new Set(t).size).toBe(54);
    }
    // All distinct.
    expect(new Set(tables.map((t) => t.join(','))).size).toBe(24);
  });

  it('orders them so the first six are one per axis', () => {
    const tables = orientationTables();
    const downFaces = tables.slice(0, 6).map((t) => Math.floor(t[31] / 9));
    expect(new Set(downFaces).size).toBe(6);
  });

  /**
   * The load-bearing property. We sweep only 6 orientations for the CFOP steps,
   * one per possible cross face, picking an arbitrary representative for each.
   * That is only legitimate if those masks cannot tell the four y-variants of an
   * axis apart — otherwise the verdict would depend on which representative the
   * derivation happened to enumerate first, which is exactly the kind of bug
   * that survives a green parity test on a small sample.
   */
  it('gives the 6-axis steps a verdict that no y-rotation can change', () => {
    for (const facelets of sampleStates()) {
      for (const step of SIX_AXIS_STEPS) {
        const base = stepSolved(step, facelets);
        for (const rot of ['y', "y'", 'y2', 'x', 'z', 'x y', "z y'"]) {
          // Turning the whole cube cannot change whether a step is done — the
          // step is a property of the state, not of how you hold it.
          expect(stepSolved(step, rotateFacelets(facelets, rot)), `${step} after ${rot}`).toBe(base);
        }
      }
    }
  });

  /**
   * A tempting shortcut that does NOT hold, pinned so nobody takes it.
   *
   * It looks as though every mask but `solved` should be blind to the AUF: they
   * leave the last layer unconstrained, or ask only that its stickers agree with
   * each other, and a U turn maps corners to corners. But the orientation sweep
   * may have matched the mask with the U face as the FINISHED side — a cross
   * built on top is a cross — and then a U turn is not an AUF at all, it takes
   * the thing apart. Only whole-cube rotations are safe (the test above).
   */
  it('lets a U turn change a verdict, because the sweep may be matching the far side', () => {
    const crossOnTop = rotateFacelets(toFaceletString(applyScramble(3, "R U R' U'")), 'x2');
    expect(stepSolved('cross', crossOnTop)).toBe(true);
    expect(stepSolved('cross', rotateFacelets(crossOnTop, 'U'))).toBe(false);
    // And the plain case, for contrast: with the cross where it belongs, a U turn
    // leaves it alone.
    const crossBelow = toFaceletString(applyScramble(3, "R U R' U'"));
    expect(stepSolved('cross', crossBelow)).toBe(true);
    expect(stepSolved('cross', rotateFacelets(crossBelow, 'U'))).toBe(true);
  });

  it('keeps every face uniform on a solved cube under all 24', () => {
    for (const t of orientationTables()) {
      const rotated = t.map((src) => SOLVED[src]).join('');
      for (let f = 0; f < 6; f++) {
        const face = rotated.slice(f * 9, f * 9 + 9);
        expect(new Set(face).size, `face ${f}`).toBe(1);
      }
    }
  });
});

describe('stepSolved', () => {
  it('says every step is done on a solved cube', () => {
    for (const step of STEPS) expect(stepSolved(step, SOLVED), step).toBe(true);
  });

  it('says nothing is done on a properly scrambled cube', () => {
    const scrambled = toFaceletString(applyScramble(3, "R' U' F D2 L2 F' R2 B2 U2 F2 D2 R2 B U' L B D' B2 R' F'"));
    for (const step of STEPS) expect(stepSolved(step, scrambled), step).toBe(false);
  });

  it('sees a cross that is not on D', () => {
    // Build the D cross, then turn the whole cube so it is on the left.
    const withCross = applyScramble(3, "R U R' U'");
    const rotated = applyMoves(withCross, 3, parseScramble('z'));
    expect(stepSolved('cross', toFaceletString(withCross))).toBe(true);
    expect(stepSolved('cross', toFaceletString(rotated))).toBe(true);
  });

  it('sees OLL as done when the last layer is oriented but not permuted', () => {
    // A PLL case: U face is a solid colour, everything below is solved, but the
    // side stickers are not in place.
    const tPerm = toFaceletString(applyScramble(3, "R U R' U' R' F R2 U' R' U' R U R' F'"));
    expect(stepSolved('oll', tPerm)).toBe(true);
    expect(stepSolved('solved', tPerm)).toBe(false);
  });

  it('separates cpll from a full solve', () => {
    // A U perm permutes edges only, so corner permutation is already done.
    const uPerm = toFaceletString(applyScramble(3, "R2 U R U R' U' R' U' R' U R'"));
    expect(stepSolved('cpll', uPerm)).toBe(true);
    expect(stepSolved('solved', uPerm)).toBe(false);
  });

  it('refuses malformed input instead of throwing', () => {
    expect(stepSolved('oll', '')).toBe(false);
    expect(stepSolved('oll', 'UUU')).toBe(false);
  });
});

describe('parity with csTimer cubeutil', () => {
  it.skipIf(!cstimerFileExists())('agrees on every step, over scrambles and their prefixes', () => {
    const cubeutil = loadCstimerCubeutil();
    const states = sampleStates();
    expect(states.length).toBeGreaterThan(60);
    let agreements = 0;
    const positives = new Map<CubeStep, number>();
    for (const facelets of states) {
      for (const step of UPSTREAM_STEPS) {
        const mine = stepSolved(step, facelets);
        // Upstream has no 'solved' entry in stepParams: it falls through to the
        // plain solved mask with a single axis, which is the same statement.
        const theirs = step === 'solved'
          ? cubeutil.getStepProgress('solved', facelets) === 0
          : cubeutil.getStepProgress(step, facelets) === 0;
        expect(mine, `${step} on ${facelets}`).toBe(theirs);
        agreements++;
        if (mine) positives.set(step, (positives.get(step) ?? 0) + 1);
      }
    }
    expect(agreements).toBeGreaterThan(700);
    // A parity test that only ever compares `false` proves nothing, so insist
    // the sample actually exercised completed steps.
    for (const step of ['cross', 'f2l', 'oll', 'cpll', 'solved'] as CubeStep[]) {
      expect(positives.get(step) ?? 0, `${step} never came out true`).toBeGreaterThan(0);
    }
  });

  it.skipIf(!cstimerFileExists())('agrees under all 24 ways of holding the cube', () => {
    const cubeutil = loadCstimerCubeutil();
    // Roux blocks are the orientation-sensitive ones — this is where a wrong
    // rotation table or a wrong read direction shows up.
    const states = [
      toFaceletString(applyScramble(3, "R U R' U'")),
      toFaceletString(applyScramble(3, "F R U R' U' F'")),
      toFaceletString(applyScramble(3, "L2 D2 B2 R2 F2 D' F2 U' R2 U2 B2 L' U B R' D2 F U2 L' F2")),
      SOLVED,
    ];
    for (const base of states) {
      for (const rot of ['', 'x', 'y', 'z', "x'", "y'", "z'", 'x2', 'y2', 'z2', 'x y', 'y z', 'z x']) {
        const rotated = rotateFacelets(base, rot);
        for (const step of ['fb', 'sb', 'cmll', 'cross', 'f2l', 'oll'] as CubeStep[]) {
          expect(stepSolved(step, rotated), `${step} on ${base} after "${rot}"`)
            .toBe(cubeutil.getStepProgress(step, rotated) === 0);
        }
      }
    }
  });
});

/** Turn the whole cube, via the shared cube model rather than a second one. */
function rotateFacelets(facelets: string, rot: string): string {
  if (rot === '') return facelets;
  const faces = fromFaceletString(facelets);
  if (!faces) throw new Error(`not a cube state: ${facelets}`);
  return toFaceletString(applyMoves(faces, 3, parseScramble(rot)));
}
