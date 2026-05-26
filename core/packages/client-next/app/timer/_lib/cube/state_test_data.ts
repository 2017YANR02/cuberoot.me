/**
 * Self-tests for the NxN cube state model.
 *
 * Run from `core/`:
 *   pnpm exec tsx packages/client/src/pages/timer/cube/state_test_data.ts
 *
 * Each test asserts a known cubing identity:
 *   - sune × 6 = identity   (R U R' U R U2 R' applied 6 times solves)
 *   - T-perm × 2 = identity (R U R' U' R' F R2 U' R' U' R U R' F' applied 2x)
 *   - Y-perm × 2 = identity
 *   - any single move + its inverse = identity
 *   - 4 of any single move = identity
 *   - cube rotation x⁴ = identity
 *   - 4x4 wide turn Rw + R⁻¹ + slice (= 3-slice) returns to solved when
 *     undone in reverse
 */

import { applyMoves, applyScramble, facesEqual, solved } from './state';
import { parseScramble } from './moves';

interface TestCase {
  name: string;
  n: number;
  scramble: string;
  /** Should the result equal the solved state? */
  shouldBeSolved: boolean;
}

const tests: TestCase[] = [
  // Single move + inverse cancels.
  { name: "R R'", n: 3, scramble: "R R'", shouldBeSolved: true },
  { name: "U U'", n: 3, scramble: "U U'", shouldBeSolved: true },
  { name: "F F'", n: 3, scramble: "F F'", shouldBeSolved: true },
  { name: "L L'", n: 3, scramble: "L L'", shouldBeSolved: true },
  { name: "B B'", n: 3, scramble: "B B'", shouldBeSolved: true },
  { name: "D D'", n: 3, scramble: "D D'", shouldBeSolved: true },

  // 4 of any face = identity.
  { name: "R R R R", n: 3, scramble: "R R R R", shouldBeSolved: true },
  { name: "U U U U", n: 3, scramble: "U U U U", shouldBeSolved: true },
  { name: "F F F F", n: 3, scramble: "F F F F", shouldBeSolved: true },

  // Single move alone is NOT solved.
  { name: "R (not solved)", n: 3, scramble: "R", shouldBeSolved: false },
  { name: "U (not solved)", n: 3, scramble: "U", shouldBeSolved: false },

  // Sune × 6 = identity.
  {
    name: "Sune × 6",
    n: 3,
    scramble: "R U R' U R U2 R' R U R' U R U2 R' R U R' U R U2 R' R U R' U R U2 R' R U R' U R U2 R' R U R' U R U2 R'",
    shouldBeSolved: true,
  },

  // T-perm × 2 = identity.
  {
    name: "T-perm × 2",
    n: 3,
    scramble: "R U R' U' R' F R2 U' R' U' R U R' F' R U R' U' R' F R2 U' R' U' R U R' F'",
    shouldBeSolved: true,
  },

  // Y-perm × 2 = identity.
  {
    name: "Y-perm × 2",
    n: 3,
    scramble: "F R U' R' U' R U R' F' R U R' U' R' F R F' F R U' R' U' R U R' F' R U R' U' R' F R F'",
    shouldBeSolved: true,
  },

  // Cube rotation x⁴ = identity.
  { name: "x⁴", n: 3, scramble: "x x x x", shouldBeSolved: true },
  { name: "y⁴", n: 3, scramble: "y y y y", shouldBeSolved: true },
  { name: "z⁴", n: 3, scramble: "z z z z", shouldBeSolved: true },

  // M slice 4x = identity.
  { name: "M⁴", n: 3, scramble: "M M M M", shouldBeSolved: true },
  { name: "E⁴", n: 3, scramble: "E E E E", shouldBeSolved: true },
  { name: "S⁴", n: 3, scramble: "S S S S", shouldBeSolved: true },

  // Wide turn + inverse cancels on 4x4.
  { name: "Rw Rw'", n: 4, scramble: "Rw Rw'", shouldBeSolved: true },
  { name: "Uw Uw'", n: 4, scramble: "Uw Uw'", shouldBeSolved: true },
  { name: "3Rw 3Rw'", n: 5, scramble: "3Rw 3Rw'", shouldBeSolved: true },

  // 222 single-cube identity sanity.
  { name: "222 R R'", n: 2, scramble: "R R'", shouldBeSolved: true },
  { name: "222 R⁴", n: 2, scramble: "R R R R", shouldBeSolved: true },

  // 5x5 sanity.
  { name: "555 U U'", n: 5, scramble: "U U'", shouldBeSolved: true },
  { name: "555 Rw Rw' Uw Uw'", n: 5, scramble: "Rw Rw' Uw Uw'", shouldBeSolved: true },

  // Long random-ish: scramble + reverse = identity.
  // (We do this manually below in the runner because we need to invert.)
];

function invertScramble(s: string): string {
  const tokens = s.split(/\s+/).filter(Boolean);
  return tokens
    .reverse()
    .map(t => {
      if (t.endsWith("'")) return t.slice(0, -1);
      if (t.endsWith('2')) return t;
      // Need to handle 2' suffix too
      if (t.endsWith("2'")) return t.slice(0, -1); // becomes ...2
      return t + "'";
    })
    .join(' ');
}

function runOne(t: TestCase): boolean {
  const result = applyScramble(t.n, t.scramble);
  const got = facesEqual(result, solved(t.n));
  return got === t.shouldBeSolved;
}

export function runAllTests(): { passed: number; failed: number; failures: string[] } {
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const t of tests) {
    const ok = runOne(t);
    if (ok) {
      passed++;
    } else {
      failed++;
      failures.push(`${t.name} (n=${t.n})`);
    }
  }

  // Inverse-scramble tests: a moderately long scramble undone by its inverse
  // should be solved.
  const longScrambles = [
    { n: 3, s: "R U R' U' F2 L D' L' B R B' D2 R' F R F'" },
    { n: 3, s: "U2 R F U' L D B R' L2 F' D2 U' B2 R" },
    { n: 4, s: "Rw U L' Uw' F2 Rw' B Uw R F' Lw D2" },
    { n: 5, s: "Rw U Lw' Uw' F2 Rw' Bw Uw R F' Lw D2 3Rw 3Uw'" },
  ];
  for (const ls of longScrambles) {
    const fwd = ls.s;
    const inv = invertScramble(fwd);
    const moves = parseScramble(`${fwd} ${inv}`);
    const result = applyMoves(solved(ls.n), ls.n, moves);
    const ok = facesEqual(result, solved(ls.n));
    const label = `inverse-cancels n=${ls.n} "${ls.s.slice(0, 25)}..."`;
    if (ok) passed++;
    else { failed++; failures.push(label); }
  }

  return { passed, failed, failures };
}

// Allow running this file directly via tsx. We use a guard that works in
// both ESM and CJS. We avoid referencing the Node `process` global by name
// in order to keep this file portable across DOM-only tsconfigs.
interface ProcLike { argv: string[]; exit(code: number): void }
const proc = (globalThis as unknown as { process?: ProcLike }).process;
const isMain = !!proc
  && Array.isArray(proc.argv)
  && !!proc.argv[1]
  && /state_test_data\.(ts|js)$/.test(proc.argv[1]);

if (isMain && proc) {
  const { passed, failed, failures } = runAllTests();
  console.log(`[cube state self-tests] passed=${passed} failed=${failed}`);
  if (failures.length) {
    console.log('Failures:\n  ' + failures.join('\n  '));
    proc.exit(1);
  }
}
