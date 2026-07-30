/**
 * Step-by-step scramble hinting.
 *
 * The oracle here is csTimer's `scrHinter.checkInSeq`
 * (`tools/bluetoothutil.js:29`), lifted into the sandbox and run against its
 * own CubieCube, so these tests compare our facelet-level port against the
 * cubie-level original on the same inputs rather than against my reading of it.
 *
 * csTimer's output format is a single string with `:` markers around the
 * current move — `"R U : F : D' L2"` — so the parity tests compare that
 * rendering, built from our structured result.
 */

import { describe, it, expect } from 'vitest';
import {
  hintScramble, parseHintableScramble,
} from '@/app/[lang]/timer/_lib/bluetooth/scramble_hint';
import { applyScramble, applyMoves, solved } from '@/app/[lang]/timer/_lib/cube/state';
import { parseScramble } from '@/app/[lang]/timer/_lib/cube/moves';
import {
  createCstimerSandbox, cstimerFileExists, extractFunction,
} from '@/tests/_cstimer_sandbox';

const HAVE_CSTIMER = cstimerFileExists();
const describeIf = HAVE_CSTIMER ? describe : describe.skip;

/** Cube state after applying `prefix` to a solved cube. */
const after = (prefix: string) => (prefix.trim()
  ? applyScramble(3, prefix)
  : solved(3));

describe('scramble hinting', () => {
  const SCRAMBLE = "R U2 F' D L2 B";

  it('says nothing is done on an untouched cube', () => {
    const h = hintScramble(SCRAMBLE, solved(3))!;
    expect(h.done).toEqual([]);
    expect(h.current).toBe('R');
    expect(h.pending).toEqual(['U2', "F'", 'D', 'L2', 'B']);
    expect(h.complete).toBe(false);
  });

  it('walks forward as each move is applied', () => {
    const steps = ['R', 'R U2', "R U2 F'", "R U2 F' D", "R U2 F' D L2"];
    const expected = ['U2', "F'", 'D', 'L2', 'B'];
    steps.forEach((prefix, i) => {
      const h = hintScramble(SCRAMBLE, after(prefix))!;
      expect(`${prefix} -> ${h.current}`).toBe(`${prefix} -> ${expected[i]}`);
      expect(h.done).toHaveLength(i + 1);
      expect(h.complete).toBe(false);
    });
  });

  it('reports completion on the fully scrambled cube', () => {
    const h = hintScramble(SCRAMBLE, after(SCRAMBLE))!;
    expect(h.complete).toBe(true);
    expect(h.current).toBeNull();
    expect(h.done).toEqual(['R', 'U2', "F'", 'D', 'L2', 'B']);
    expect(h.pending).toEqual([]);
  });

  it('keeps a half-finished move printed as the scramble wrote it', () => {
    // Scramble wants U2 and one U has been done. It still reads U2 — the strip
    // is the scramble, and rewriting a token mid-turn reads as the app editing
    // it. The user is holding the cube; they can see how far the turn got.
    const h = hintScramble(SCRAMBLE, after('R U'))!;
    expect(h.current).toBe('U2');
    expect(h.done).toEqual(['R']);
    expect(h.pending).toEqual(["F'", 'D', 'L2', 'B']);

    // Half done the other way round — same token.
    expect(hintScramble(SCRAMBLE, after("R U'"))!.current).toBe('U2');

    // Overshot a quarter turn into a half turn. The printed move stands: keep
    // turning that face and the walk advances within three more quarters, so
    // there is no state this can strand you in.
    const h2 = hintScramble("R U2 F' D L2 B", after('R U2 F2'))!;
    expect(h2.current).toBe("F'");
  });

  it('gives up when the cube is off the scramble path', () => {
    // A move the scramble never asked for at that point.
    expect(hintScramble(SCRAMBLE, after('R U2 L'))).toBeNull();
    // Right moves, wrong order.
    expect(hintScramble(SCRAMBLE, after("U2 R"))).toBeNull();
  });

  it('picks the EARLIEST consistent position when a path revisits a state', () => {
    // After "R R'" the cube is solved again, so both position 0 and position 2
    // describe the state. csTimer stops at the first one (its walk breaks as
    // soon as a step fails to advance) and so do we — the parity test below
    // covers this exact case. Ambiguity like this needs a cancellation in the
    // scramble, which WCA scrambles never have; it only shows up on
    // hand-pasted ones, and there "you are at the start" is the safer read.
    const scr = "R R' U F";
    const h = hintScramble(scr, after("R R'"))!;
    expect(h.done).toEqual([]);
    expect(h.current).toBe('R');
  });

  it('refuses scrambles with moves a smart cube cannot report', () => {
    expect(parseHintableScramble("R Rw U")).toBeNull();   // wide
    expect(parseHintableScramble("R M U")).toBeNull();    // slice
    expect(parseHintableScramble("R x U")).toBeNull();    // rotation
    expect(parseHintableScramble('')).toBeNull();
    expect(parseHintableScramble("R U2 F'")).toHaveLength(3);
  });

  it('handles a full 20-move WCA-shaped scramble at every prefix', () => {
    const scr = "D2 L2 F2 U' B2 U R2 U B2 F2 U' L' R B' F R' D2 L' D' F";
    const tokens = scr.split(' ');
    for (let i = 0; i <= tokens.length; i++) {
      const prefix = tokens.slice(0, i).join(' ');
      const h = hintScramble(scr, after(prefix));
      expect(h, `prefix of length ${i}`).not.toBeNull();
      expect(h!.done).toHaveLength(i);
      expect(h!.complete).toBe(i === tokens.length);
      if (i < tokens.length) expect(h!.current).toBe(tokens[i]);
    }
  });
});

/* ================================================================== */
/*  Parity with csTimer's scrHinter                                    */
/* ================================================================== */

/** Render our structured hint the way csTimer renders its annotated string. */
function toCstimerForm(h: NonNullable<ReturnType<typeof hintScramble>>): string {
  const parts = [...h.done];
  if (h.current !== null) parts.push(':', h.current, ':');
  parts.push(...h.pending);
  return parts.join(' ');
}

describeIf('scramble hinting vs csTimer scrHinter', () => {
  /**
   * csTimer's `checkInSeq` needs `CubieCube`, `cubeutil.parseScramble` and
   * `cubeutil.getConjMoves`. The sandbox's mathlib stub provides CubieCube;
   * the two cubeutil helpers are 3-line no-ops for plain 3x3 face-turn
   * scrambles (there is nothing to conjugate), so we install them as such and
   * assert only on scrambles with no rotations, which is where our port claims
   * to work anyway.
   */
  async function makeOracle() {
    const sb = await createCstimerSandbox({
      hardware: 'gocube.js',           // any hardware file; we only want mathlib
      deviceName: 'GoCube-ABC',
      services: { '6e400001-b5a3-f393-e0a9-e50e24dcca9e': ['6e400003-b5a3-f393-e0a9-e50e24dcca9e'] },
    });
    sb.run(`
      var cubeutil = {
        // "R U2 F'" -> [[face, 1, power], ...] with power 1=cw, 2=180, 3=ccw,
        // which is the shape checkInSeq indexes as seq[i][0] / seq[i][2].
        parseScramble: function(scr) {
          var out = [];
          var toks = scr.trim().split(/\\s+/);
          for (var i = 0; i < toks.length; i++) {
            var t = toks[i];
            if (!t) continue;
            var f = "URFDLB".indexOf(t.charAt(0));
            var p = t.length === 1 ? 1 : (t.charAt(1) === '2' ? 2 : 3);
            out.push([f, 1, p]);
          }
          return out;
        },
        getConjMoves: function(scr) { return scr; },
      };
      var __hintOracle = (function() {
        var CubieCube = mathlib.CubieCube;
        ${extractFunction(sb.source('tools/bluetoothutil.js'), 'checkInSeq')}
        return function(scramble, prefix) {
          var seq = cubeutil.parseScramble(scramble);
          var state = new CubieCube();
          var pre = cubeutil.parseScramble(prefix || '');
          for (var i = 0; i < pre.length; i++) {
            var out = new CubieCube();
            CubieCube.CubeMult(state, CubieCube.moveCube[pre[i][0] * 3 + pre[i][2] - 1], out);
            state = out;
          }
          return checkInSeq(state, null, seq);
        };
      })();
    `);
    return (scramble: string, prefix: string): string | null =>
      sb.run<string | null>(`__hintOracle(${JSON.stringify(scramble)}, ${JSON.stringify(prefix)})`);
  }

  const CASES: ReadonlyArray<readonly [string, string]> = [
    ["R U2 F' D L2 B", ''],
    ["R U2 F' D L2 B", 'R'],
    ["R U2 F' D L2 B", 'R U2'],
    ["R U2 F' D L2 B", "R U2 F' D L2"],
    ["R U2 F' D L2 B", "R U2 F' D L2 B"],
    ["D2 L2 F2 U' B2 U R2 U B2 F2 U' L' R B' F R' D2 L' D' F", "D2 L2 F2 U' B2 U R2"],
    ["R R' U F", "R R'"],
    // Partly-done moves in the middle: upstream leaves the token alone there
    // (its rewrite is position-0 only), and so do we — exact parity.
    ["R U2 F' D L2 B", 'R U'],
    ["R U2 F' D L2 B", "R U'"],
    ["R U2 F' D L2 B", 'R U2 F2'],
  ];

  it('marks the same position in the scramble as csTimer does', async () => {
    const oracle = await makeOracle();
    for (const [scr, prefix] of CASES) {
      const ours = hintScramble(scr, after(prefix));
      const theirs = oracle(scr, prefix);
      expect(ours, `${scr} @ "${prefix}"`).not.toBeNull();
      // Normalise whitespace: csTimer joins with single spaces around ':'.
      const mine = toCstimerForm(ours!).replace(/\s+/g, ' ').trim();
      const upstream = (theirs ?? '').replace(/\s+/g, ' ').trim();
      expect(`${scr} @ "${prefix}": ${mine}`).toBe(`${scr} @ "${prefix}": ${upstream}`);
    }
  });

  it('agrees that an off-path cube has no position', async () => {
    const oracle = await makeOracle();
    for (const [scr, prefix] of [
      ["R U2 F' D L2 B", 'R U2 L'],
      ["R U2 F' D L2 B", 'U2 R'],
    ] as const) {
      expect(oracle(scr, prefix)).toBeNull();
      expect(hintScramble(scr, after(prefix))).toBeNull();
    }
  });

  /**
   * DELIBERATE DEVIATION, pinned here.
   *
   * csTimer rewrites a partly-done move to the remaining amount when it is the
   * FIRST move of the scramble (`next == 0 && i == 0`, bluetoothutil.js:62):
   * one U of a `U2 R F` shows as `U`. We never rewrite, anywhere — a token that
   * changes halfway through a turn reads as the scramble changing, and the
   * turn's position is already visible in the strip and in your hands.
   *
   * Everywhere else the two agree, which is what the CASES table above pins.
   */
  it('keeps the printed move at position 0, where csTimer rewrites it', async () => {
    const oracle = await makeOracle();
    // Upstream: one U toward a leading U2 becomes ": U :".
    expect(oracle('U2 R F', 'U')).toContain(': U :');
    // Ours stays the scramble's own token, and the position is the same.
    const firstMovePartial = hintScramble('U2 R F', applyMoves(solved(3), 3, parseScramble('U')))!;
    expect(firstMovePartial.current).toBe('U2');
    expect(firstMovePartial.done).toEqual([]);
    expect(firstMovePartial.pending).toEqual(['R', 'F']);
  });
});
