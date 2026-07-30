/**
 * The training-mode hijack: does a relabelled cube behave like the real thing?
 *
 * The whole feature rests on one algebraic claim — an offset commutes with
 * turning, so executing an algorithm on a relabelled cube drives the REPORTED
 * state exactly as it would drive a cube that had really been set up. If that
 * claim is off by an inverse, the trainer would still look plausible (cases
 * appear, the cube turns) and simply never register a correct solve.
 */

import { describe, it, expect } from 'vitest';

import { makeHijack, applyHijack } from '@/app/[lang]/timer/_lib/bluetooth/state_hijack';
import { stepSolved } from '@/app/[lang]/timer/_lib/cube/steps';
import {
  applyScramble,
  applyMoves,
  toFaceletString,
  fromFaceletString,
  solved,
} from '@/app/[lang]/timer/_lib/cube/state';
import { parseScramble } from '@/app/[lang]/timer/_lib/cube/moves';

const SOLVED = toFaceletString(solved(3));

/** Turn a facelet string through an algorithm, via the shared cube model. */
function turn(facelets: string, alg: string): string {
  const faces = fromFaceletString(facelets);
  if (!faces) throw new Error(`not a cube state: ${facelets}`);
  return toFaceletString(applyMoves(faces, 3, parseScramble(alg)));
}

/**
 * Undo an algorithm: reverse the order, invert each turn.
 *
 * The tests use this to get each case's solving algorithm rather than a
 * hand-written one. That is not laziness — a wrong alg from memory fails these
 * tests in exactly the same way a broken hijack would, and the first draft of
 * this file did precisely that (T perm is its own inverse; what I wrote was
 * not).
 */
function inverseOf(alg: string): string {
  return parseScramble(alg)
    .slice()
    .reverse()
    .map((m) => {
      const suffix = m.amount === 2 || m.amount === -2 ? '2' : m.amount === 1 ? "'" : '';
      return `${m.face}${suffix}`;
    })
    .join(' ');
}

/** A few real cases, named by the algorithm that CREATES them. */
const SETUPS = [
  { name: 'T perm', setup: "R U R' U' R' F R2 U' R' U' R U R' F'" },
  { name: 'Sune', setup: "R U2 R' U' R U' R'" },
  { name: 'OLL 45', setup: "F R U R' U' F'" },
  { name: 'U perm', setup: "R2 U R U R' U' R' U' R' U R'" },
];
const CASES = SETUPS.map((c) => ({ ...c, solve: inverseOf(c.setup) }));

describe('makeHijack', () => {
  it('makes the current state read as the target', () => {
    const cur = SOLVED;
    const target = toFaceletString(applyScramble(3, CASES[0].setup));
    const h = makeHijack(cur, target);
    expect(h).not.toBeNull();
    expect(applyHijack(h, cur)).toBe(target);
  });

  it('works from a cube that is not solved', () => {
    const cur = toFaceletString(applyScramble(3, "R U F' D2 L"));
    const target = toFaceletString(applyScramble(3, CASES[1].setup));
    expect(applyHijack(makeHijack(cur, target), cur)).toBe(target);
  });

  it('has nothing to do when the cube is already at the target', () => {
    const cur = toFaceletString(applyScramble(3, "R U R'"));
    expect(makeHijack(cur, cur)).toBeNull();
    // And a null hijack is the identity view.
    expect(applyHijack(null, cur)).toBe(cur);
  });

  it('refuses states that are not physically reachable', () => {
    // Twist one corner: colour counts stay right, but no cube can be like this.
    const faces = applyScramble(3, 'R U');
    const u = faces.U.slice();
    const r = faces.R.slice();
    const f = faces.F.slice();
    const tmp = u[8]; u[8] = r[0]; r[0] = f[2]; f[2] = tmp;
    const twisted = toFaceletString({ ...faces, U: u, R: r, F: f });
    expect(makeHijack(SOLVED, twisted)).toBeNull();
    expect(makeHijack(twisted, SOLVED)).toBeNull();
  });

  it('leaves malformed input alone instead of throwing', () => {
    const h = makeHijack(SOLVED, toFaceletString(applyScramble(3, 'R')));
    expect(applyHijack(h, 'nonsense')).toBe('nonsense');
    expect(makeHijack('too short', SOLVED)).toBeNull();
  });
});

describe('a hijacked view turns like a real cube', () => {
  it('commutes with turning: view(cur·A) === target·A', () => {
    const cur = toFaceletString(applyScramble(3, "L2 D R' F"));
    const target = toFaceletString(applyScramble(3, CASES[0].setup));
    const h = makeHijack(cur, target);
    for (const alg of ["R", "R U R'", "F R U R' U' F'", "M2 E2 S2", "R U R' U' R' F R2 U' R' U' R U R' F'"]) {
      // The physical cube goes cur → cur·A; the view must go target → target·A.
      expect(applyHijack(h, turn(cur, alg)), alg).toBe(turn(target, alg));
    }
  });

  it('reports solved exactly when the algorithm solves the case', () => {
    for (const c of CASES) {
      // The user finished the previous repetition, so the cube is solved.
      const target = toFaceletString(applyScramble(3, c.setup));
      const h = makeHijack(SOLVED, target);
      expect(h, c.name).not.toBeNull();
      expect(stepSolved('solved', applyHijack(h, SOLVED)), `${c.name} at start`).toBe(false);
      // Execute on the physical cube; the VIEW should reach solved.
      const after = turn(SOLVED, c.solve);
      expect(stepSolved('solved', applyHijack(h, after)), `${c.name} after solving`).toBe(true);
      // And the physical cube is now scrambled, which is the point: the user
      // never had to set the case up by hand.
      expect(stepSolved('solved', after), `${c.name} physical`).toBe(false);
    }
  });

  it('reports a SUB-step done for a case that only finishes that step', () => {
    // Drilling OLL: after the OLL algorithm the last layer is oriented but not
    // permuted, so 'oll' must be done while 'solved' is not.
    const target = toFaceletString(applyScramble(3, "R U2 R' U' R U' R'")); // Sune case
    const h = makeHijack(SOLVED, target);
    const after = turn(SOLVED, "R U R' U R U2 R'");
    const view = applyHijack(h, after);
    expect(stepSolved('oll', view)).toBe(true);
    expect(stepSolved('solved', view)).toBe(true); // Sune leaves it fully solved
    // A PLL case instead: OLL is done from the very start, so OLL would be a
    // useless stop condition there — worth pinning, since picking the wrong
    // step per case is the likely wiring mistake.
    const pll = toFaceletString(applyScramble(3, CASES[0].setup));
    const hp = makeHijack(SOLVED, pll);
    expect(stepSolved('oll', applyHijack(hp, SOLVED))).toBe(true);
    expect(stepSolved('solved', applyHijack(hp, SOLVED))).toBe(false);
  });

  it('is undone by dropping it — the view returns to the physical cube', () => {
    const cur = SOLVED;
    const target = toFaceletString(applyScramble(3, CASES[2].setup));
    const h = makeHijack(cur, target);
    const after = turn(cur, "R U R'");
    expect(applyHijack(h, after)).not.toBe(after);
    expect(applyHijack(null, after)).toBe(after);
  });

  it('can be re-aimed at the next case without touching the cube', () => {
    // The continuous training loop: finish a case, immediately point at the
    // next one from wherever the cube physically ended up.
    let physical = SOLVED;
    for (const c of CASES) {
      const target = toFaceletString(applyScramble(3, c.setup));
      const h = makeHijack(physical, target);
      expect(applyHijack(h, physical), c.name).toBe(target);
      physical = turn(physical, c.solve);
      expect(stepSolved('solved', applyHijack(h, physical)), `${c.name} completes`).toBe(true);
    }
    // Four cases in, the physical cube is nowhere near solved and it never
    // mattered once.
    expect(stepSolved('solved', physical)).toBe(false);
  });
});
