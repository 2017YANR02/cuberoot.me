/*
 * cuberoot.me bridge worker for cs0x7f/cstimer scramble core.
 * Loaded as classic worker by core/packages/client/src/utils/cstimerScramble.ts.
 *
 * Protocol (postMessage):
 *   in:  { id: number, key: string, length?: number, state?: any }
 *   out: { id, result: string } | { id, error: string }
 *
 * Why classic worker (not ES module): cstimer source uses IIFE + globals.
 * importScripts is the path of least resistance and the upstream's own
 * deployment model.
 *
 * Why a delay-poll loop: cstimer scramblers may return undefined while a
 * prune table is still being built; the upstream UI re-calls on a timer
 * (kernel.setTimeout). A worker has full CPU so we loop directly.
 */

'use strict';

// poly3dlib reads color preferences via kernel.getProp("colcube") etc when
// initializing certain puzzles (dmd / fto / ico ...). cstimer's `kernel` is a
// UI module not present in worker — shim with a getProp that returns '' so
// $.col2std falls back to no-color (scramble generation doesn't need colors).
self.kernel = { getProp: () => '', setProp: () => {}, regProp: () => {}, regListener: () => {}, pushSignal: () => {} };

// utillib defines self.$ (isArray/noop/now) in worker context, plus
// execMain/execWorker/ISCSTIMER/DEBUG. mathlib relies on $.isArray; the
// per-puzzle files rely on scrMgr / mathlib.
// Order matches upstream cstimer Makefile: utillib → isaac → mathlib → grouplib →
// poly3dlib → pat3x3 → min2phase → scramble.js (scrMgr) → all puzzle files.
// grouplib/poly3dlib/pat3x3/min2phase are pulled in because some scramble files
// reference them at IIFE-body call time (e.g. scramble_333_edit needs min2phase
// for 3x3 subset trainers, utilscramble needs poly3d+grouplib for dmd).
importScripts(
  'lib/utillib.js',
  'lib/isaac.js',
  'lib/mathlib.js',
  'lib/grouplib.js',
  'lib/poly3dlib.js',
  'lib/pat3x3.js',
  'lib/min2phase.js',
  'scramble/scramble.js',
  'scramble/megascramble.js',
  'scramble/scramble_333_edit.js',
  'scramble/scramble_444.js',
  'scramble/scramble_sq1_new.js',
  'scramble/pyraminx.js',
  'scramble/skewb.js',
  'scramble/2x2x2.js',
  'scramble/gearcube.js',
  'scramble/1x3x3.js',
  'scramble/2x2x3.js',
  'scramble/clock.js',
  'scramble/333lse.js',
  'scramble/mgmlsll.js',
  'scramble/megaminx.js',
  'scramble/scramble_fto.js',
  'scramble/redi.js',
  'scramble/slide.js',
  'scramble/utilscramble.js',
);

const MAX_POLL = 200_000;

function generate(key, length, state) {
  const fn = self.scrMgr.scramblers[key];
  if (!fn) throw new Error('unknown scramble key: ' + key);
  for (let i = 0; i < MAX_POLL; i++) {
    const out = fn(key, length, state);
    if (out !== undefined) {
      return self.scrMgr.toTxt(String(out)).trim();
    }
  }
  throw new Error('scramble timed out for key: ' + key);
}

// Solver registry: cstimer event key -> function(scramble) => solution string.
// Used by the in-site solver pages for random-state puzzles that ship a real
// cstimer two-phase solver (mpyr Master Pyraminx). Near-optimal, not provably
// optimal; validity (scramble∘solution = solved) is the contract.
const SOLVERS = {
  mpyrso: (scramble) => self.mpyr.solveScramble(scramble),
};

function solve(key, scramble) {
  const fn = SOLVERS[key];
  if (!fn) throw new Error('no solver for key: ' + key);
  const out = fn(scramble);
  return String(out).trim();
}

self.onmessage = function (e) {
  const { id, op, key, length, state, scramble } = e.data || {};
  try {
    if (op === 'solve') {
      self.postMessage({ id, result: solve(key, scramble) });
      return;
    }
    const result = generate(key, length, state);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: err && err.message ? err.message : String(err) });
  }
};
