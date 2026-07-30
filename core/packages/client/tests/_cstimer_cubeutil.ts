/**
 * csTimer's real `cubeutil` in a VM, as an oracle for step detection.
 *
 * Unlike `_cstimer_sandbox.ts` — which hand-ports a mathlib subset because the
 * hardware drivers pull in Web Bluetooth and AES — this one loads the genuine
 * `lib/mathlib.js` and `lib/cubeutil.js` off disk. It turns out they only need
 * `isaac.js` (mathlib's RNG), a `DEBUG` global, and three tiny stubs. Nothing
 * under `D:\cube\cstimer` is modified.
 *
 * So the masks, the equivalence classes and the 24 rotations in
 * `_lib/cube/steps.ts` are checked against the implementation they were ported
 * from, on real states, rather than against my reading of it.
 */

import { createContext, runInContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { CSTIMER_ROOT, cstimerFileExists } from './_cstimer_sandbox';

export { cstimerFileExists };

export interface CstimerCubeutil {
  /** 0 = step complete, 1 = not. Upstream's `getStepProgress`. */
  getStepProgress(step: string, facelet: string, nAxis?: number): number;
  /** Upstream's `getProgress(kind, facelet)` — CFOP-style phase index. */
  getProgress(kind: string, facelet: string): number;
}

let cached: CstimerCubeutil | null = null;

/** Boot (or reuse) the VM. Throws if the csTimer clone is missing. */
export function loadCstimerCubeutil(): CstimerCubeutil {
  if (cached) return cached;
  const sandbox: Record<string, unknown> = {
    DEBUG: false,
    console,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    JSON,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  // cubeutil reaches for these three; none of them matter for step detection.
  sandbox.$ = {
    map: (arr: unknown[], fn: (v: unknown, i: number) => unknown) => arr.map(fn).flat(),
    now: () => Date.now(),
    extend: Object.assign,
  };
  sandbox.kernel = { getProp: () => '', regListener: () => {}, pushSignal: () => {} };
  sandbox.tools = { isCurTrainScramble: () => false, getCurScramble: () => [] };

  const ctx = createContext(sandbox);
  for (const rel of ['lib/isaac.js', 'lib/mathlib.js', 'lib/cubeutil.js']) {
    const src = readFileSync(path.join(CSTIMER_ROOT, rel), 'utf8');
    runInContext(src, ctx, { filename: `cstimer/${rel}` });
  }
  const cubeutil = sandbox.cubeutil as CstimerCubeutil | undefined;
  if (!cubeutil || typeof cubeutil.getStepProgress !== 'function') {
    throw new Error('cstimer cubeutil did not load');
  }
  cached = cubeutil;
  return cubeutil;
}
