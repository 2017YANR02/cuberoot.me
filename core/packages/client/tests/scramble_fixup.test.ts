/**
 * Off-path recovery: a fresh path from where the cube is to the scramble.
 *
 * The point of these tests is the DIRECTION. Composing cube states has four
 * plausible-looking conventions (a*b vs b*a, solution vs generator) and three
 * of them produce a sequence that looks perfectly reasonable and lands
 * somewhere else entirely. So nothing here reasons about the convention: every
 * test applies the moves that come out and checks where the cube ends up.
 *
 * The solver runs in-process via `scrambleFromState` — the same function the
 * Web Worker calls, so the semantics under test are the semantics in
 * production. Building the tables takes a few seconds, once for the file.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

import {
  fixupState,
  fixupScramble,
  createFixupRequester,
} from '@/app/[lang]/timer/_lib/bluetooth/scramble_fixup';
import { hintScramble } from '@/app/[lang]/timer/_lib/bluetooth/scramble_hint';
import {
  applyScramble,
  applyMoves,
  facesEqual,
  solved,
  toFaceletString,
  type CubeFaces,
} from '@/app/[lang]/timer/_lib/cube/state';
import { parseScramble } from '@/app/[lang]/timer/_lib/cube/moves';
import {
  formatMoves,
  multiply,
  inverseCubie,
  isSolvedCubie,
  solvedCubie,
  cubieEquals,
  applySequence,
  parseMoves,
} from '@/app/[lang]/timer/_lib/scramble/kociemba/cube';
import { buildMoveTables, type MoveTables } from '@/app/[lang]/timer/_lib/scramble/kociemba/movetables';
import { buildPruneTables, type PruneTables } from '@/app/[lang]/timer/_lib/scramble/kociemba/prune';
import { scrambleFromState } from '@/app/[lang]/timer/_lib/scramble/kociemba/search';
import { faceletToCubie, cubieToFacelet } from '@/lib/cube-facelet';

let mt: MoveTables;
let pt: PruneTables;

beforeAll(() => {
  mt = buildMoveTables();
  pt = buildPruneTables(mt);
}, 60_000);

/** What the worker does with `fixupState`'s answer. */
/**
 * `solveCube`'s budget is 200 ms of WALL CLOCK and it throws when that expires
 * before the first solution lands — fine in a browser worker on an idle thread,
 * but this suite runs alongside 250 other test files and lost that race under
 * load, taking a whole describe block down from its `beforeAll`. Tests get a
 * real budget; the production default is untouched, because there the caller
 * wants an answer inside a turn or not at all.
 */
const TEST_SOLVE = { timeoutMs: 10_000 };

function solveFixup(from: CubeFaces, target: CubeFaces): string {
  const st = fixupState(from, target);
  expect(st).not.toBeNull();
  return formatMoves(scrambleFromState(st!, mt, pt, TEST_SOLVE));
}

const SCRAMBLE = "R U R' F2 D B2 L' U2 R D' F R2 B2 U' L2 D2 F2 R2 B2";

describe('fixupState — cubie algebra', () => {
  it('composes so that from * fixup === target', () => {
    const from = faceletToCubie(toFaceletString(applyScramble(3, "R U F' D2")));
    const target = faceletToCubie(toFaceletString(applyScramble(3, SCRAMBLE)));
    const fix = multiply(inverseCubie(from), target);
    expect(cubieEquals(multiply(from, fix), target)).toBe(true);
  });

  it('inverseCubie really is the inverse', () => {
    for (const alg of ["R U R' U'", "F2 B2 L2 D", "R L U D F B", SCRAMBLE]) {
      const c = faceletToCubie(toFaceletString(applyScramble(3, alg)));
      expect(isSolvedCubie(multiply(c, inverseCubie(c)))).toBe(true);
      expect(isSolvedCubie(multiply(inverseCubie(c), c))).toBe(true);
    }
  });

  it('is what fixupState returns, read back through facelets', () => {
    const fromFaces = applyScramble(3, "R U F' D2");
    const targetFaces = applyScramble(3, SCRAMBLE);
    const expected = multiply(
      inverseCubie(faceletToCubie(toFaceletString(fromFaces))),
      faceletToCubie(toFaceletString(targetFaces)),
    );
    const got = fixupState(fromFaces, targetFaces);
    expect(got).not.toBeNull();
    expect(cubieToFacelet(got!)).toBe(cubieToFacelet(expected));
  });

  it('says nothing to fix when the cube is already at the scramble', () => {
    const faces = applyScramble(3, SCRAMBLE);
    expect(fixupState(faces, faces)).toBeNull();
  });

  it('says nothing to fix for a solved cube against a solved target', () => {
    expect(fixupState(solved(3), solved(3))).toBeNull();
  });

  it('refuses a physically impossible state instead of sending the solver hunting', () => {
    // A single twisted corner: swap two stickers of the URF corner. Colour
    // counts stay right, every piece is still identifiable, but the corner
    // twist sum is no longer 0 mod 3, so no sequence reaches it.
    const bad = applyScramble(3, "R U R'");
    const u = bad.U.slice();
    const r = bad.R.slice();
    const f = bad.F.slice();
    // URF corner stickers: U[8], R[0], F[2]
    const tmp = u[8]; u[8] = r[0]; r[0] = f[2]; f[2] = tmp;
    const twisted: CubeFaces = { ...bad, U: u, R: r, F: f };
    expect(fixupState(twisted, applyScramble(3, SCRAMBLE))).toBeNull();
  });
});

describe('fixup path — end to end through the solver', () => {
  it('lands exactly on the scramble state', () => {
    const targetFaces = applyScramble(3, SCRAMBLE);
    // Several ways of going wrong: one wrong turn, a wrong turn mid-scramble,
    // an extra turn after finishing, and a completely unrelated state.
    const deviations = [
      "R U R' F2 D B2 L' U2 R D' F R2 B2 U' L2 D2 F2 R2 B2 U",   // one too many
      "R U R' F2 D B2 L' U2 R D' F R2 B2 U' L2 D2 F2 R2 B",      // last move short
      "R U R' F2 D B2 L' U2 R D' F R2 B2 U' L2 D2 F2 R2 B2 L D", // wandered off
      "R U F' D2",                                               // barely started
      "",                                                        // never started
    ];
    for (const dev of deviations) {
      const fromFaces = dev ? applyScramble(3, dev) : solved(3);
      const fix = solveFixup(fromFaces, targetFaces);
      const landed = applyMoves(fromFaces, 3, parseScramble(fix));
      expect(facesEqual(landed, targetFaces), `fix "${fix}" from "${dev}"`).toBe(true);
    }
  }, 60_000);

  it('stays inside the two-phase length bound', () => {
    const fix = solveFixup(applyScramble(3, "R U F' D2"), applyScramble(3, SCRAMBLE));
    expect(parseScramble(fix).length).toBeLessThanOrEqual(23);
  }, 30_000);

  it('agrees with applySequence at the cubie level', () => {
    // Same check one layer down, so a facelet-model bug and a cubie-model bug
    // cannot cancel each other out.
    const fromFaces = applyScramble(3, "L2 D R'");
    const targetFaces = applyScramble(3, SCRAMBLE);
    const fix = solveFixup(fromFaces, targetFaces);
    const landed = applySequence(faceletToCubie(toFaceletString(fromFaces)), parseMoves(fix));
    expect(cubieEquals(landed, faceletToCubie(toFaceletString(targetFaces)))).toBe(true);
  }, 30_000);

  it('is hintable from the state it was generated at', () => {
    const fromFaces = applyScramble(3, "R U F' D2");
    const targetFaces = applyScramble(3, SCRAMBLE);
    const fix = solveFixup(fromFaces, targetFaces);
    const moves = parseScramble(fix);

    // At the start: nothing done, the first fix move is what the user owes.
    const h0 = hintScramble(fix, fromFaces, fromFaces);
    expect(h0).not.toBeNull();
    expect(h0!.done).toEqual([]);
    expect(h0!.current).toBe(fix.split(' ')[0]);
    expect(h0!.complete).toBe(false);

    // After the first move: it goes dim, the second is current.
    const after1 = applyMoves(fromFaces, 3, moves.slice(0, 1));
    const h1 = hintScramble(fix, after1, fromFaces);
    expect(h1).not.toBeNull();
    expect(h1!.done).toEqual([fix.split(' ')[0]]);
    expect(h1!.current).toBe(fix.split(' ')[1]);

    // All the way through: complete, which is the signal to drop the fix-up and
    // go back to checking the real scramble.
    const done = applyMoves(fromFaces, 3, moves);
    const hEnd = hintScramble(fix, done, fromFaces);
    expect(hEnd).not.toBeNull();
    expect(hEnd!.complete).toBe(true);
    expect(hEnd!.current).toBeNull();
    expect(facesEqual(done, targetFaces)).toBe(true);
  }, 30_000);

  it('hinting the fix-up from SOLVED instead of its own start state finds nothing', () => {
    // Guards the `from` argument: without it the walk starts at solved and the
    // fix-up path is not there, so the feature would silently do nothing.
    const fromFaces = applyScramble(3, "R U F' D2");
    const fix = solveFixup(fromFaces, applyScramble(3, SCRAMBLE));
    expect(hintScramble(fix, fromFaces)).toBeNull();
  }, 30_000);
});

describe('fixupScramble — the async wrapper', () => {
  it('returns null with no worker available rather than throwing', async () => {
    // vitest runs in node: `new Worker(new URL(...))` is not available, which is
    // exactly how the caller finds out it cannot offer a fix-up. It must not
    // reject — the strip just falls back to the binary verdict.
    await expect(
      fixupScramble(applyScramble(3, "R U F' D2"), applyScramble(3, SCRAMBLE)),
    ).resolves.toBeNull();
  }, 30_000);

  it('returns null without touching the solver when there is nothing to fix', async () => {
    const faces = applyScramble(3, SCRAMBLE);
    await expect(fixupScramble(faces, faces)).resolves.toBeNull();
  });
});

/**
 * The requester's job is everything that happens because solving takes longer
 * than a turn. This whole block exists because the first version bailed out
 * when the cube moved mid-solve, which in the browser meant a correction path
 * appeared only every OTHER time the user went off track.
 */
describe('createFixupRequester', () => {
  const TARGET = applyScramble(3, SCRAMBLE);
  const OFF_PATH = applyScramble(3, "R U F' D2");
  const OFF_PATH_2 = applyScramble(3, "R U F' D2 B");

  /** The real path, precomputed so the fake solver can be synchronous-ish. */
  let pathFrom1: string;
  let pathFrom2: string;
  beforeAll(() => {
    pathFrom1 = solveFixup(OFF_PATH, TARGET);
    pathFrom2 = solveFixup(OFF_PATH_2, TARGET);
  }, 60_000);

  function solverFor(paths: Map<CubeFaces, string>) {
    const calls: CubeFaces[] = [];
    const solve = async (from: CubeFaces) => {
      calls.push(from);
      return paths.get(from) ?? null;
    };
    return { solve, calls };
  }

  it('offers the path when the cube stays put', async () => {
    const { solve, calls } = solverFor(new Map([[OFF_PATH, pathFrom1]]));
    const req = createFixupRequester({ faces: () => OFF_PATH, solve, valid: () => true });
    const res = await req.request(TARGET);
    expect(res).not.toBeNull();
    expect(res!.seq).toBe(pathFrom1);
    expect(res!.from).toBe(OFF_PATH);
    expect(res!.hint.done).toEqual([]);
    expect(res!.hint.current).toBe(pathFrom1.split(' ')[0]);
    expect(calls).toHaveLength(1);
  });

  it('solves again from the new state when the cube turns mid-solve', async () => {
    // First call answers for OFF_PATH, but by then the cube has moved on to
    // OFF_PATH_2, so that path fits nothing and a second solve is needed.
    let where = OFF_PATH;
    const { solve, calls } = solverFor(new Map([
      [OFF_PATH, pathFrom1],
      [OFF_PATH_2, pathFrom2],
    ]));
    const req = createFixupRequester({
      faces: () => where,
      solve: async (from) => {
        const seq = await solve(from);
        if (from === OFF_PATH) where = OFF_PATH_2; // turned while we solved
        return seq;
      },
      valid: () => true,
    });
    const res = await req.request(TARGET);
    expect(res).not.toBeNull();
    expect(res!.seq).toBe(pathFrom2);
    expect(res!.from).toBe(OFF_PATH_2);
    expect(calls).toEqual([OFF_PATH, OFF_PATH_2]);
  });

  it('offers nothing when the cube reaches the scramble mid-solve', async () => {
    let where: CubeFaces = OFF_PATH;
    const req = createFixupRequester({
      faces: () => where,
      solve: async () => { where = TARGET; return pathFrom1; },
      valid: () => true,
    });
    // The plain "scrambled" verdict covers this; a spent correction path would
    // just be noise.
    await expect(req.request(TARGET)).resolves.toBeNull();
  });

  it('gives up after three tries if the cube never settles', async () => {
    // Always answer for a state the cube has already left.
    const calls: CubeFaces[] = [];
    let where = OFF_PATH;
    const req = createFixupRequester({
      faces: () => where,
      solve: async (from) => {
        calls.push(from);
        where = where === OFF_PATH ? OFF_PATH_2 : OFF_PATH;
        return from === OFF_PATH ? pathFrom1 : pathFrom2;
      },
      valid: () => true,
    });
    await expect(req.request(TARGET)).resolves.toBeNull();
    expect(calls).toHaveLength(3);
    expect(req.busy()).toBe(false);   // and it lets the next turn try again
  });

  it('runs one solve at a time', async () => {
    let release: (v: string | null) => void = () => {};
    const calls: number[] = [];
    const req = createFixupRequester({
      faces: () => OFF_PATH,
      solve: () => { calls.push(1); return new Promise((r) => { release = r; }); },
      valid: () => true,
    });
    const first = req.request(TARGET);
    expect(req.busy()).toBe(true);
    // A second off-path turn while the first solve is in flight must not queue
    // another one — that is how you get a backlog of stale paths.
    await expect(req.request(TARGET)).resolves.toBeNull();
    expect(calls).toHaveLength(1);
    release(pathFrom1);
    await expect(first).resolves.not.toBeNull();
    expect(req.busy()).toBe(false);
  });

  it('abandons the request when the scramble is replaced under it', async () => {
    const { calls } = solverFor(new Map());
    const req = createFixupRequester({
      faces: () => OFF_PATH,
      solve: async () => pathFrom1,
      valid: () => false,   // e.g. the user hit "next scramble", or started solving
    });
    await expect(req.request(TARGET)).resolves.toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('offers nothing when there is no cube', async () => {
    const req = createFixupRequester({
      faces: () => null,
      solve: async () => pathFrom1,
      valid: () => true,
    });
    await expect(req.request(TARGET)).resolves.toBeNull();
  });

  it('offers nothing when the solver has nothing to say', async () => {
    const req = createFixupRequester({
      faces: () => OFF_PATH,
      solve: async () => null,
      valid: () => true,
    });
    await expect(req.request(TARGET)).resolves.toBeNull();
  });
});

describe('solvedCubie sanity', () => {
  it('is the identity for multiply', () => {
    const c = faceletToCubie(toFaceletString(applyScramble(3, SCRAMBLE)));
    expect(cubieEquals(multiply(c, solvedCubie()), c)).toBe(true);
    expect(cubieEquals(multiply(solvedCubie(), c), c)).toBe(true);
  });
});

/**
 * 修正路径亮着的时候,点击复制给的是**打乱**,不是条上写着的那串。
 *
 * 2026-08-04 用户撞上:条上是 `B2 D2 L2 …`(修正路径),末尾一个绿勾,剪贴板里
 * 却是 `F' L U2 …`(那把真正的打乱)。复制的内容是对的 —— 成绩记的就是它,
 * 而修正路径每转一下就会重算,复制它没有意义。错的是那个勾:它贴在最后一步
 * 右边,读起来就是「复制的是你看到的这串」。
 *
 * 所以:修正路径上不挂勾,改成右边一个写明白的绿标。
 */
describe('复制反馈不能骑在修正路径上(2026-08-04)', () => {
  const hostSrc = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'app', '[lang]', 'timer', '_shell', 'SoloView.tsx'),
    'utf8',
  );
  const stripSrc = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'timer-ui', 'src', 'TimerScrambleStrip.tsx'),
    'utf8',
  );

  it('绿勾在 fixup 亮着时不渲染', () => {
    expect(stripSrc).toMatch(/const copiedCheck = copied && !correctionActive/);
  });

  it('改成一条说清楚复制了什么的绿标', () => {
    expect(hostSrc).toMatch(/copiedCorrection: tr\(\{ zh: '已复制原打乱', en: 'Copied the scramble' \}\)/);
  });

  it('复制的仍然是打乱本身,不是条上那串', () => {
    // 取 scrambleHist 当前项 → 就是成绩会记下的那条打乱。
    expect(hostSrc).toMatch(/scrambleHistRef\.current\.list\[scrambleHistRef\.current\.idx\]/);
  });
});
