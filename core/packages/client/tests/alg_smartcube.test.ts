/**
 * "This set is finished when THIS step is done" — checked against the library's
 * own algs, not against my reading of what each set is for.
 *
 * Two ways the table in `_trainer/smartcube.ts` can be wrong, and they fail in
 * opposite, equally silent directions:
 *
 *   too weak   — the step is already true the moment the case appears, so the
 *                clock stops on the first turn and every rep reads ~0.1s;
 *   too strict — the step is never true after a correct solve, so the clock
 *                never stops and the drill hangs.
 *
 * Both are settled with real data. `shared/data/{oll,pll,zbll,zbls}.json` and
 * `fixtures/oll_db_setups.json` carry the states the trainer presents AND algs
 * that solve them, so every case can be walked from its presented state to its
 * finished state and the step asked at both ends — 850 cases across four sets.
 *
 * One thing the library's data does NOT give us is a pairing: a stored scramble
 * presents its case at some arbitrary AUF (and the F2L family at an arbitrary
 * `y`), while a stored alg carries the AUF of one canonical presentation. So
 * these walks apply the alg the way a person does — after turning the cube to
 * the angle it is written for. See `PREFIXES`.
 */

import { describe, it, expect } from 'vitest';

import { ALG_CATALOG } from '@cuberoot/shared';
import ollData from '@cuberoot/shared/data/oll.json';
import pllData from '@cuberoot/shared/data/pll.json';
import zbllData from '@cuberoot/shared/data/zbll.json';
import zblsData from '@cuberoot/shared/data/zbls.json';
import ollDbSetups from './fixtures/oll_db_setups.json';

import {
  algSetStep,
  autoStopStep,
  caseStep,
  caseTargetFacelets,
  puzzleHasSmartCube,
  setsWithAutoStop,
} from '@/app/[lang]/alg/_trainer/smartcube';
import { stepSolved, type CubeStep } from '@/app/[lang]/timer/_lib/cube/steps';
import { applyMoves, applyScramble, fromFaceletString, toFaceletString } from '@/app/[lang]/timer/_lib/cube/state';
import { parseScrambleStrict } from '@/app/[lang]/timer/_lib/cube/moves';
import { purifyScramble } from '@/lib/trainer-scramble';

const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

/** Turn a facelet state through an alg. null when the alg has a token we can't read. */
function turn(facelets: string, alg: string): string | null {
  const faces = fromFaceletString(facelets);
  if (!faces) return null;
  const { moves, bad } = parseScrambleStrict(purifyScramble('3x3', alg));
  if (bad.length > 0) return null;
  return toFaceletString(applyMoves(faces, 3, moves));
}

/**
 * How a person applies a stored alg to a presented case: turn the cube to the
 * angle the alg is written for, and add the AUF the presentation needs.
 *
 * Sixteen prefixes out of a very large space is a real constraint, not a free
 * pass — and the "already done at the start" half of every check below is what
 * stops a too-weak step from passing on the strength of the search alone. The
 * uniqueness test further down puts a number on how tight it is: across all 57
 * OLL cases, exactly one of the 57 algs orients each one under this search.
 */
const PREFIXES: string[] = ['', 'y', 'y2', "y'"].flatMap((rot) =>
  ['', 'U', 'U2', "U'"].map((auf) => [rot, auf].filter(Boolean).join(' ')),
);
const SUFFIXES = ['', 'U', 'U2', "U'"];

/** Does some adjustment of `alg` finish `step` from `start`? Returns the end state. */
function solveTo(start: string, alg: string, step: CubeStep): string | null {
  for (const pre of PREFIXES) {
    for (const post of SUFFIXES) {
      const end = turn(start, [pre, alg, post].filter(Boolean).join(' '));
      if (end !== null && stepSolved(step, end)) return end;
    }
  }
  return null;
}

/**
 * One case, walked. `end` is null when no adjustment of the library alg finishes
 * the step — the "too strict" failure. `alreadyDone` marks a presented state that
 * satisfies the step before it is touched — the "too weak" failure, unless it is
 * the case data itself that is off, which `autoStopStep` is there to absorb.
 */
interface Walk { name: string; start: string; end: string | null; alreadyDone: boolean }

function walk(name: string, scramble: string, alg: string, step: CubeStep): Walk | null {
  const start = caseTargetFacelets(scramble);
  if (start === null) return null;
  if (turn(start, alg) === null) return null;   // alg has notation we can't read
  return { name, start, end: solveTo(start, alg, step), alreadyDone: stepSolved(step, start) };
}

/** Invert an alg through the shared parser, so a case can be built from its solution. */
function invert(alg: string): string {
  const { moves, bad } = parseScrambleStrict(purifyScramble('3x3', alg));
  if (bad.length > 0) return '';
  return moves
    .slice()
    .reverse()
    .map((m) => {
      const amount = m.amount === 2 || m.amount === -2 ? '2' : m.amount === 1 ? "'" : '';
      const face = m.isRotation
        ? ({ R: 'x', U: 'y', F: 'z' } as Record<string, string>)[m.face] ?? m.face
        : m.layers >= 2 ? `${m.layers > 2 ? m.layers : ''}${m.face}w` : m.face;
      return `${face}${amount}`;
    })
    .join(' ');
}

/* ── the four corpora ────────────────────────────────────────────────────── */

const OLL_ALGS = ollData as Record<string, { alg: string; alg2: string }>;
/** The library's own OLL setups — the same strings the case thumbnails render. */
const OLL_SETUPS = ollDbSetups as Record<string, string>;

function ollWalks(): Walk[] {
  const step = algSetStep('3x3', 'oll')!;
  const out: Walk[] = [];
  for (const [name, setup] of Object.entries(OLL_SETUPS)) {
    const alg = OLL_ALGS[name]?.alg;
    if (!alg) continue;
    const w = walk(name, setup, alg, step);
    if (w) out.push(w);
  }
  return out;
}

function pllWalks(): Walk[] {
  const step = algSetStep('3x3', 'pll')!;
  // PLL has algs per finishing AUF and no scrambles, so a case is built by
  // running its alg backwards — which is what `generateScramble`'s `inv` mode
  // does in the trainer for any set whose setup column is empty.
  const out: Walk[] = [];
  for (const [name, byAuf] of Object.entries(pllData as Record<string, Record<string, string>>)) {
    const alg = byAuf.noAuf ?? byAuf.U ?? '';
    const scramble = alg ? invert(alg) : '';
    if (!scramble) continue;
    const w = walk(`PLL ${name}`, scramble, alg, step);
    if (w) out.push(w);
  }
  return out;
}

function zbllWalks(): Walk[] {
  const step = algSetStep('3x3', 'zbll')!;
  // ZBLL keeps its scrambles bucketed by length ({"15": [...], "14": [...]}).
  const cases = zbllData as unknown as Record<string, { algs: string[]; scrambles?: Record<string, string[]> }>;
  const out: Walk[] = [];
  for (const [name, entry] of Object.entries(cases)) {
    const scr = Object.values(entry.scrambles ?? {}).flat()[0];
    const alg = entry.algs?.[0];
    if (!scr || !alg) continue;
    const w = walk(`ZBLL ${name}`, scr, alg, step);
    if (w) out.push(w);
  }
  return out;
}

function zblsWalks(): Walk[] {
  const step = algSetStep('3x3', 'zbls')!;
  const cases = zblsData as Record<string, { algs: string[]; scrambles?: string[] }>;
  const out: Walk[] = [];
  for (const [name, entry] of Object.entries(cases)) {
    const scr = entry.scrambles?.[0];
    const alg = entry.algs?.[0];
    if (!scr || !alg) continue;
    const w = walk(`ZBLS ${name}`, scr, alg, step);
    if (w) out.push(w);
  }
  return out;
}

/**
 * The step behaves as a stop condition across a whole set.
 *
 * `maxAlreadyDone` is a budget for case data that does not present what it
 * claims — one ZBLS scramble in the library has its last slot already filled.
 * Those are the cases `autoStopStep` hands back to the space bar, so the budget
 * is small and non-zero rather than zero: a systemic regression blows through it
 * immediately, and one bad row does not turn the suite red.
 */
function expectStopCondition(slug: string, walks: Walk[], minCases: number, maxAlreadyDone = 0) {
  const step = algSetStep('3x3', slug);
  expect(step, `${slug} has no step`).not.toBeNull();
  expect(walks.length, `${slug} corpus`).toBeGreaterThanOrEqual(minCases);
  const already: string[] = [];
  for (const w of walks) {
    if (w.alreadyDone) { already.push(w.name); continue; }
    // Reached once a library alg has solved it — otherwise the clock never stops.
    expect(w.end, `${w.name}: no adjustment of the library alg finished ${step}`).not.toBeNull();
  }
  expect(already.length, `${slug}: ${step} already done at the start of ${already.join(', ')}`)
    .toBeLessThanOrEqual(maxAlreadyDone);
  // And every one of those is refused auto-stop rather than stopping instantly.
  for (const name of already) {
    const w = walks.find((x) => x.name === name)!;
    expect(autoStopStep('3x3', slug, null, w.start), name).toBeNull();
  }
}

describe('the set → step table', () => {
  it('only names sets that exist in the library', () => {
    const known = new Set(ALG_CATALOG['3x3'].map((s) => s.slug));
    for (const slug of setsWithAutoStop()) {
      expect(known.has(slug), `${slug} is not a 3x3 set`).toBe(true);
    }
    expect(setsWithAutoStop().length).toBeGreaterThan(10);
  });

  it('has nothing to say about puzzles without smart cubes', () => {
    for (const p of ['2x2', '4x4', '5x5', 'sq1', 'megaminx', 'pyraminx', 'skewb'] as const) {
      expect(puzzleHasSmartCube(p)).toBe(false);
      // 'eo' / 'cp' exist as slugs under sq1 and megaminx — a lookup that ignored
      // the puzzle would happily answer for them.
      expect(algSetStep(p, 'eo')).toBeNull();
      expect(algSetStep(p, 'pll')).toBeNull();
    }
    expect(puzzleHasSmartCube('3x3')).toBe(true);
    expect(puzzleHasSmartCube(null)).toBe(false);
  });

  it('declines the sets whose finish we cannot state', () => {
    for (const slug of ['2-look-cmll', 'eo4a', 'lse-eolr', 'anti-pll', 'fruf']) {
      expect(algSetStep('3x3', slug), slug).toBeNull();
    }
    expect(algSetStep('3x3', 'oh-cmll')).toBe('cmll');
    expect(algSetStep('3x3', 'no-such-set')).toBeNull();
    expect(algSetStep('3x3', '')).toBeNull();
  });

  it('follows the case, not the session, in a mixed drill', () => {
    // A mixed session's cases each remember where they came from, and an OLL
    // drawn next to a PLL has to stop somewhere else.
    expect(caseStep('3x3', 'mix:oll+pll', { srcSet: 'oll' })).toBe('oll');
    expect(caseStep('3x3', 'mix:oll+pll', { srcSet: 'pll' })).toBe('solved');
    // Single-set sessions leave srcSet unset and fall back to the session's set.
    expect(caseStep('3x3', 'coll', { srcSet: undefined })).toBe('cpll');
    expect(caseStep('3x3', 'coll', null)).toBe('cpll');
    expect(caseStep('3x3', 'mix:cls+eo4a', { srcSet: 'eo4a' })).toBeNull();
  });
});

describe('the step really is the finish line', () => {
  it('OLL: oriented after the alg, not before', () => {
    expectStopCondition('oll', ollWalks(), 57);
  });

  it('PLL: solved after the alg, not before', () => {
    expectStopCondition('pll', pllWalks(), 18);
  });

  it('ZBLL: solved after the alg, not before', () => {
    expectStopCondition('zbll', zbllWalks(), 400);
  });

  it('ZBLS: last-layer edges oriented after the alg, not before', () => {
    // One of the 302 stored scrambles presents a state with the slot already
    // filled; `expectStopCondition` checks that one is refused auto-stop.
    expectStopCondition('zbls', zblsWalks(), 250, 1);
  });
});

describe('what the sets structurally are', () => {
  /**
   * These check the masks against the library rather than the mapping, and they
   * are why a wrong mapping cannot hide: they pin down which steps a case of
   * each set satisfies BEFORE it is touched, which is the "too weak" failure.
   */
  it('an OLL case has F2L intact and nothing above it', () => {
    for (const w of ollWalks()) {
      expect(stepSolved('f2l', w.start), `${w.name} F2L`).toBe(true);
      expect(stepSolved('oll', w.start), `${w.name} OLL`).toBe(false);
    }
    // So mapping OLL to `f2l` would stop the clock on the first turn — which is
    // the mistake this whole file exists to catch.
    expect(algSetStep('3x3', 'oll')).not.toBe('f2l');
  });

  it('tells all 57 OLL cases apart', () => {
    // The sharpest statement available about the `oll` mask AND about the AUF
    // search: for each of the library's 57 setups, exactly ONE of the 57 algs
    // orients it. A mask that were too loose would let several through.
    const algs = Object.entries(OLL_SETUPS).map(([name]) => OLL_ALGS[name]?.alg).filter(Boolean) as string[];
    expect(algs).toHaveLength(57);
    for (const [name, setup] of Object.entries(OLL_SETUPS)) {
      const start = caseTargetFacelets(setup)!;
      const solvers = algs.filter((alg) => solveTo(start, alg, 'oll') !== null);
      expect(solvers, `${name}: ${solvers.length} of 57 algs orient it`).toHaveLength(1);
      expect(solvers[0]).toBe(OLL_ALGS[name].alg);
    }
  });

  it('a PLL case is already oriented, so `oll` would stop instantly', () => {
    for (const w of pllWalks()) {
      expect(stepSolved('oll', w.start), `${w.name} oriented`).toBe(true);
      expect(stepSolved('solved', w.start), `${w.name} solved`).toBe(false);
    }
    expect(algSetStep('3x3', 'pll')).toBe('solved');
  });

  it('a ZBLL case already has its last-layer edges oriented', () => {
    // The defining property of ZBLL. 472 real cases is a stronger statement
    // about the `eoll` mask than any state I could construct — and it is also
    // why `zbll` must not map to `eoll`.
    const walks = zbllWalks();
    expect(walks.filter((w) => stepSolved('eoll', w.start))).toHaveLength(walks.length);
    expect(algSetStep('3x3', 'zbll')).not.toBe('eoll');
  });

  it('ZBLS finishes short of OLL often enough for `eoll` to be doing work', () => {
    // ZBLS orients the edges and generally leaves the corners twisted. Not
    // always — the stored scrambles were built from solved cubes, so some cases
    // come out fully oriented — but often enough that `eoll` is demonstrably a
    // weaker condition here and not a stand-in for `oll`.
    const ends = zblsWalks().map((w) => w.end).filter((e): e is string => e !== null);
    expect(ends.length).toBeGreaterThan(250);
    expect(ends.filter((e) => !stepSolved('oll', e)).length).toBeGreaterThan(50);
  });

  it('ocll and eoll split the last layer between them', () => {
    // Our own mask, so nothing upstream can confirm it. A state with two
    // last-layer edges flipped and nothing else must read as corners oriented
    // (`ocll`) and not as edges oriented (`eoll`) nor as `oll`.
    const flipped = flipTwoUpEdges();
    expect(stepSolved('f2l', flipped)).toBe(true);
    expect(stepSolved('ocll', flipped)).toBe(true);
    expect(stepSolved('eoll', flipped)).toBe(false);
    expect(stepSolved('oll', flipped)).toBe(false);
    // Which is also what makes `eoll` the discriminating condition for ZBLS: a
    // last slot filled without orienting the edges must NOT count as finished,
    // even though `f2l` would say it was.
    expect(algSetStep('3x3', 'zbls')).toBe('eoll');
    // The converse: a Sune leaves the edges oriented with a corner twisted.
    const sune = toFaceletString(applyScramble(3, "R U R' U R U2 R'"));
    expect(stepSolved('eoll', sune)).toBe(true);
    expect(stepSolved('ocll', sune)).toBe(false);
    // Both hold on a solved cube, neither on a scramble.
    expect(stepSolved('ocll', SOLVED)).toBe(true);
    const scrambled = toFaceletString(applyScramble(3, "R' U' F D2 L2 F' R2 B2 U2 F2 D2 R2 B U' L B D' B2 R' F'"));
    expect(stepSolved('ocll', scrambled)).toBe(false);
  });
});

describe('autoStopStep', () => {
  it('is the set’s step for an ordinary case', () => {
    const start = caseTargetFacelets("R U R' U' R' F R2 U' R' U' R U R' F'")!;
    expect(autoStopStep('3x3', 'pll', null, start)).toBe('solved');
  });

  it('refuses a case that starts where it should finish', () => {
    // Would otherwise stop the clock on the first turn, forever, and look like a
    // broken timer rather than bad case data.
    expect(autoStopStep('3x3', 'pll', null, SOLVED)).toBeNull();
    expect(autoStopStep('3x3', 'oll', null, toFaceletString(applyScramble(3, "R U R' U' R' F R2 U' R' U' R U R' F'"))))
      .toBeNull();  // a PLL state is already oriented
  });

  it('refuses when there is no state or no step', () => {
    expect(autoStopStep('3x3', 'pll', null, null)).toBeNull();
    expect(autoStopStep('3x3', 'fruf', null, SOLVED)).toBeNull();
    expect(autoStopStep('2x2', 'cll', null, SOLVED)).toBeNull();
  });
});

describe('caseTargetFacelets', () => {
  it('is the state the trainer draws its picture from', () => {
    // Same convention as the case thumbnail: setup applied to a solved cube.
    const scr = "R U R' U' R' F R2 U' R' U' R U R' F'";
    expect(caseTargetFacelets(scr)).toBe(toFaceletString(applyScramble(3, scr)));
  });

  it('expands the library’s grouping and regrip marks', () => {
    // Setups are stored for humans: `(…)2` repeats, `↑↓·` are regrips.
    expect(caseTargetFacelets("(R U R' U')2")).toBe(toFaceletString(applyScramble(3, "R U R' U' R U R' U'")));
    expect(caseTargetFacelets("R U · R'")).toBe(toFaceletString(applyScramble(3, "R U R'")));
  });

  it('refuses a scramble it cannot fully parse instead of guessing', () => {
    // A dropped token would leave the cube reporting a legal state that is the
    // wrong case, and nothing downstream could tell.
    expect(caseTargetFacelets('R U nonsense')).toBeNull();
    expect(caseTargetFacelets('R++ D--')).toBeNull();
    expect(caseTargetFacelets('')).toBeNull();
    expect(caseTargetFacelets(null)).toBeNull();
    expect(caseTargetFacelets('   ')).toBeNull();
  });

  it('keeps a whole-cube rotation as a change of frame only', () => {
    // F2L cases can get a random final `y`. The state is read against its own
    // centres downstream, so the case survives; only the holding changes.
    const plain = caseTargetFacelets("R U R'");
    const rotated = caseTargetFacelets("R U R' y");
    expect(plain).not.toBeNull();
    expect(rotated).not.toBe(plain);
    for (const step of ['cross', 'f2l', 'oll', 'solved'] as CubeStep[]) {
      expect(stepSolved(step, rotated!), step).toBe(stepSolved(step, plain!));
    }
  });
});

/** Two U-layer edges flipped in place, built at the sticker level. */
function flipTwoUpEdges(): string {
  const s = SOLVED.split('');
  // UF edge: U-face sticker 7 with F-face sticker 19. UB: 1 with 46.
  const swap = (a: number, b: number) => { const t = s[a]; s[a] = s[b]; s[b] = t; };
  swap(7, 19);
  swap(1, 46);
  const out = s.join('');
  expect(fromFaceletString(out), 'flipped state is still a cube').not.toBeNull();
  return out;
}

describe('corpus', () => {
  it('loaded every set', () => {
    expect(Object.keys(OLL_ALGS)).toHaveLength(57);
    expect(Object.keys(OLL_SETUPS)).toHaveLength(57);
    expect(Object.keys(pllData)).toHaveLength(21);
    expect(Object.keys(zbllData).length).toBeGreaterThan(400);
    expect(Object.keys(zblsData).length).toBeGreaterThan(250);
  });
});
