/**
 * Every non-WCA puzzle the timer offers must actually produce a real scramble.
 *
 * An event in the picker that yields an empty string (or, worse, a 3x3 scramble
 * from the dispatcher's fallback) is worse than no event at all — so this file
 * drives the SAME engine and the SAME message protocol the client uses and
 * checks the output against an independent model per puzzle.
 *
 * How the engine is booted: `public/scramble_module.js` is csTimer's
 * Closure-compiled scramble bundle. In a WorkerGlobalScope (or Node, which it
 * detects the same way) its `execWorker` branch installs `self.kernel` plus a
 * `self.onmessage` speaking
 *     -> [reqId, 'scramble', [scramblerKey, length]]
 *     <- [reqId, 'scramble', scrambleText]
 * which is exactly what `_lib/scramble/cstimer_worker.ts` posts to
 * `new Worker('/scramble_module.js')`. Running it in a `node:vm` context
 * therefore exercises the production path, not a re-implementation.
 *
 * Oracles, strongest first:
 *   fto     cubing.js `fto` KPuzzle — applyAlg throws on any illegal move
 *   ivy     lib/ivy-solver  — strict parse + full-graph BFS solve
 *   gear    lib/gear-solver — strict parse + full-graph BFS solve
 *   mpyram  lib/mpyr-solver — exact cstimer token alphabet + facelet model
 *   kilominx / redi   structural: csTimer's own documented move alphabet
 *                     (cubing.js has both puzzles but in a different notation,
 *                     which is precisely why they get no scramble preview)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createContext, runInContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Alg } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';
import { solveIvy, IVY_GODS_NUMBER } from '@/lib/ivy-solver';
import { solveGear, GEAR_GODS_NUMBER } from '@/lib/gear-solver';
import { MPYR_MOVE_NAMES, mpyrFacelets, mpyrSolvedFacelets } from '@/lib/mpyr-solver';
import { NON_WCA_EVENT_IDS, cstimerKeyForEvent } from '@/app/[lang]/timer/_lib/scramble/nonwca';
import type { EventId } from '@/app/[lang]/timer/_lib/types';

const BUNDLE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', 'public', 'scramble_module.js',
);

type Ask = (key: string, length?: number) => string;

/** Boot the bundle in its worker branch and return its request/response call. */
function bootCstimerEngine(): Ask {
  const outbox: unknown[][] = [];
  const sandbox: Record<string, unknown> = {
    console,
    setTimeout,
    clearTimeout,
    postMessage: (m: unknown[]) => outbox.push(m),
  };
  // isInNode = process + require + global, which is how the bundle decides it is
  // NOT in a browser main thread and installs the worker-side kernel/onmessage.
  sandbox.self = sandbox;
  sandbox.global = sandbox;
  sandbox.process = { versions: process.versions };
  sandbox.require = () => ({});

  const ctx = createContext(sandbox);
  runInContext(readFileSync(BUNDLE, 'utf8'), ctx, { filename: 'scramble_module.js' });
  if (typeof sandbox.onmessage !== 'function') {
    throw new Error('scramble_module.js did not install its worker onmessage handler');
  }
  const onmessage = sandbox.onmessage as (e: { data: unknown[] }) => void;

  let reqId = 0;
  return (key: string, length = 0): string => {
    // csTimer returns undefined while a prune table is still building; upstream
    // (and our bridge) simply re-ask. Bounded so a broken key fails loudly.
    for (let attempt = 0; attempt < 200; attempt++) {
      const id = ++reqId;
      outbox.length = 0;
      onmessage({ data: [id, 'scramble', [key, length]] });
      const reply = outbox[0];
      expect(reply?.[0], `reply id mismatch for ${key}`).toBe(id);
      expect(reply?.[1]).toBe('scramble');
      const out = typeof reply?.[2] === 'string' ? (reply[2] as string).trim() : '';
      if (out.length > 0) return out;
    }
    throw new Error(`csTimer scrambler produced nothing for key: ${key}`);
  };
}

/** Every token looks like a move: letters, optional layer digit, optional '. */
const MOVE_TOKEN_RE = /^[A-Za-z]+\d*'?$/;

function tokens(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean);
}

let ask: Ask;
beforeAll(() => { ask = bootCstimerEngine(); }, 120_000);

describe('non-WCA scramble catalog', () => {
  it('maps every offered event to a scrambler the engine actually registers', () => {
    expect(NON_WCA_EVENT_IDS.length).toBeGreaterThan(0);
    for (const id of NON_WCA_EVENT_IDS) {
      const key = cstimerKeyForEvent(id as EventId);
      expect(key, `${id} has no csTimer key`).toBeTruthy();
      expect(() => ask(key!), `${id} (${key}) did not generate`).not.toThrow();
    }
  }, 120_000);

  it('produces a well-formed, non-empty, non-constant scramble for every event', () => {
    for (const id of NON_WCA_EVENT_IDS) {
      const key = cstimerKeyForEvent(id as EventId)!;
      const a = ask(key);
      const b = ask(key);
      expect(a.length, `${id}: empty scramble`).toBeGreaterThan(0);
      expect(tokens(a).length, `${id}: implausibly short scramble`).toBeGreaterThanOrEqual(4);
      for (const tok of tokens(a)) {
        expect(MOVE_TOKEN_RE.test(tok), `${id}: bad token ${JSON.stringify(tok)} in ${a}`).toBe(true);
      }
      // Two draws in a row being identical would mean a stuck/constant generator.
      expect(a, `${id}: generator returned the same scramble twice`).not.toBe(b);
    }
  }, 120_000);
});

describe('fto (ftoso)', () => {
  it('is valid cubing.js FTO notation and actually scrambles the puzzle', async () => {
    const kpuzzle = await puzzles.fto.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    // BL/BR is what separates an FTO scramble from a 3x3 one — FTO's other six
    // faces are spelled U/D/L/R/F/B, so a cube scramble would parse cleanly
    // here. But the check only holds in AGGREGATE: measured over 600 draws,
    // roughly 1% of csTimer's FTO scrambles happen to use none of the two back
    // faces, so asserting it per-draw is a ~1%-per-run flake (it fired). Six
    // draws puts a false red at ~1e-12.
    const draws: string[] = [];
    for (let i = 0; i < 6; i++) {
      const s = ask('ftoso');
      draws.push(s);
      // applyAlg throws on any move the FTO KPuzzle doesn't define, so a pass
      // here proves every token is a legal face turn of THIS puzzle.
      const state = solved.applyAlg(new Alg(s));
      expect(state.isIdentical(solved), `fto scramble left the puzzle solved: ${s}`).toBe(false);
    }
    const faces = new Set(
      draws.flatMap((s) => tokens(s)).map((t) => t.replace(/['2]/g, '')),
    );
    expect(
      faces.has('BL') || faces.has('BR'),
      `no BL/BR grip in any of 6 fto scrambles — is this the cube scrambler? ${draws.join(' | ')}`,
    ).toBe(true);
  }, 120_000);
});

describe('ivy (ivyso)', () => {
  it('parses and solves within the Ivy Cube god\'s number', () => {
    for (let i = 0; i < 3; i++) {
      const s = ask('ivyso');
      const { solution, length } = solveIvy(s); // throws on an illegal token
      expect(length).toBeGreaterThan(0);
      expect(length).toBeLessThanOrEqual(IVY_GODS_NUMBER);
      expect(solveIvy(`${s} ${solution}`).length, `solution did not solve ${s}`).toBe(0);
    }
  }, 60_000);
});

describe('gear (gearso)', () => {
  it('parses and solves within the Gear Cube god\'s number', () => {
    for (let i = 0; i < 3; i++) {
      const s = ask('gearso');
      const { solution, length } = solveGear(s); // throws on an illegal token
      expect(length).toBeGreaterThan(0);
      expect(length).toBeLessThanOrEqual(GEAR_GODS_NUMBER);
      expect(solveGear(`${s} ${solution}`).length, `solution did not solve ${s}`).toBe(0);
    }
  }, 60_000);
});

describe('mpyram (mpyrso)', () => {
  it('uses the exact cstimer Master Pyraminx alphabet and scrambles the model', () => {
    const alphabet = new Set(MPYR_MOVE_NAMES);
    const s = ask('mpyrso');
    for (const tok of tokens(s)) {
      expect(alphabet.has(tok), `mpyram: token ${tok} outside MPYR_MOVE_NAMES (${s})`).toBe(true);
    }
    expect(mpyrFacelets(s), `mpyram scramble left the net solved: ${s}`)
      .not.toEqual(mpyrSolvedFacelets());
  }, 120_000);
});

describe('kilominx (klmso)', () => {
  // csTimer's kilominx uses megaminx corner-grip notation: a face name built
  // from U/D + F/B + L/R (e.g. `DBR`), optionally 2, optionally '.
  const KILO_TOKEN_RE = /^(U|D|F|B|L|R|DR|DL|BR|BL|DBR|DBL|DFR|DFL)2?'?$/;
  it('uses megaminx corner-grip notation and mixes several grips', () => {
    const s = ask('klmso');
    const toks = tokens(s);
    expect(toks.length).toBeGreaterThanOrEqual(10);
    for (const tok of toks) {
      expect(KILO_TOKEN_RE.test(tok), `kilominx: bad token ${tok} in ${s}`).toBe(true);
    }
    // A multi-letter grip is what makes this a kilominx scramble rather than a
    // cube one — its absence would mean the generator silently changed puzzle.
    expect(toks.some((t) => /^[A-Z]{2,}/.test(t)), `kilominx: no corner grip in ${s}`).toBe(true);
  }, 60_000);
});

describe('redi (rediso)', () => {
  // csTimer's Redi Cube notation: corner turns F/L/B/R (upper) and f/l/b/r
  // (lower), optional '. Same alphabet its Dino sibling uses (DINO_TOKEN_RE).
  const REDI_TOKEN_RE = /^[FLBRflbr]'?$/;
  it('uses the csTimer Redi alphabet with both cases present', () => {
    const s = ask('rediso');
    const toks = tokens(s);
    expect(toks.length).toBeGreaterThanOrEqual(6);
    for (const tok of toks) {
      expect(REDI_TOKEN_RE.test(tok), `redi: bad token ${tok} in ${s}`).toBe(true);
    }
    expect(toks.some((t) => /[a-z]/.test(t)), `redi: no lower-case corner turn in ${s}`).toBe(true);
    expect(toks.some((t) => /[A-Z]/.test(t)), `redi: no upper-case corner turn in ${s}`).toBe(true);
  }, 60_000);
});
