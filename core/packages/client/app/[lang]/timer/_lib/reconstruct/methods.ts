/**
 * Which method the solve is read as.
 *
 * The report used to speak CFOP and only CFOP, which makes it useless to a Roux
 * or ZZ solver: their move stream never passes through "cross done", so every
 * stage number comes out null and the whole panel disappears. A method here is
 * just an ordered list of "is this stage finished" predicates over a facelet
 * string; `method_walk.ts` turns any such list into the same per-stage times,
 * turns and recognition/execution split.
 *
 * Where the predicates come from:
 *
 *   CFOP — `cube/cfop_detect.ts`, the detector the rest of the timer already
 *     uses, so the report and the stored `stageSegments` cannot disagree.
 *   Roux — `cube/steps.ts`'s masks (`fb` / `sb` / `cmll`), a csTimer port that
 *     is already rotation-invariant across all 24 orientations. That matters
 *     more here than for CFOP: nobody agrees which side the first block goes on.
 *   ZZ   — the line and the two blocks are mask work, but EOLine also needs
 *     every edge ORIENTED, which no colour-equality mask can express. That
 *     comes from `faceletToCubie`'s `eo`, the solver's own decoding, rather
 *     than a hand-rolled orientation test.
 *
 * Not here: Petrus. The dropdown we are matching offers CFOP / Roux / ZZ, and a
 * fourth entry would need its 2x2x2 and 2x2x3 masks derived and checked against
 * something — see SMART_CUBE_PROGRESS.md. An unverified mask that quietly never
 * matches is worse than an absent method.
 */

import { faceletToCubie } from '@/lib/cube-facelet';
import { detectCfopStage, stageRank } from '../cube/cfop_detect';
import type { CubeFaces } from '../cube/state';
import { toFaceletString } from '../cube/state';
import { stepSolved } from '../cube/steps';

export type MethodId = 'cfop' | 'roux' | 'zz';

export interface MethodStage {
  /** Stable key — used for CSS hooks, per-stage colours and stored data. */
  key: string;
  zh: string;
  en: string;
  /** True once this stage is finished. Called on every move, so keep it cheap. */
  done: (faces: CubeFaces, facelets: string) => boolean;
}

export interface SolveMethod {
  id: MethodId;
  zh: string;
  en: string;
  /** In solve order. Each stage implies all the ones before it. */
  stages: MethodStage[];
  /** True when this method's report also carries slots / case names / references. */
  rich: boolean;
}

/** All edges oriented in the F/B sense — the thing EOLine and ZZ are about. */
export function allEdgesOriented(facelets: string): boolean {
  try {
    return faceletToCubie(facelets).eo.every(o => o === 0);
  } catch {
    // Not a legal cube (mid-decode garbage). "Not oriented" is the safe read:
    // it can only delay a stage boundary, never invent one.
    return false;
  }
}

/** The two D-layer edges of the ZZ line, in place and oriented. */
function lineSolved(faces: CubeFaces): boolean {
  const { D, F, B } = faces;
  return D[1] === D[4] && F[7] === F[4] && D[7] === D[4] && B[7] === B[4];
}

const CFOP: SolveMethod = {
  id: 'cfop',
  zh: 'CFOP',
  en: 'CFOP',
  rich: true,
  stages: [
    { key: 'cross', zh: '十字', en: 'Cross', done: f => stageRank(detectCfopStage(f)) >= stageRank('cross') },
    { key: 'f2l',   zh: 'F2L',  en: 'F2L',   done: f => stageRank(detectCfopStage(f)) >= stageRank('f2l') },
    { key: 'oll',   zh: 'OLL',  en: 'OLL',   done: f => stageRank(detectCfopStage(f)) >= stageRank('oll') },
    { key: 'pll',   zh: 'PLL',  en: 'PLL',   done: f => stageRank(detectCfopStage(f)) >= stageRank('pll') },
  ],
};

const ROUX: SolveMethod = {
  id: 'roux',
  zh: 'Roux',
  en: 'Roux',
  rich: false,
  stages: [
    { key: 'fb',   zh: '第一块',   en: 'First block',  done: (_f, s) => stepSolved('fb', s) },
    { key: 'sb',   zh: '第二块',   en: 'Second block', done: (_f, s) => stepSolved('sb', s) },
    { key: 'cmll', zh: 'CMLL',    en: 'CMLL',         done: (_f, s) => stepSolved('cmll', s) },
    { key: 'lse',  zh: 'LSE',     en: 'LSE',          done: (_f, s) => stepSolved('solved', s) },
  ],
};

const ZZ: SolveMethod = {
  id: 'zz',
  zh: 'ZZ',
  en: 'ZZ',
  rich: false,
  stages: [
    {
      key: 'eoline', zh: 'EOLine', en: 'EOLine',
      done: (f, s) => lineSolved(f) && allEdgesOriented(s),
    },
    // The two halves of ZZ's F2L are exactly Roux's blocks — same five pieces a
    // side — so they reuse the same verified masks rather than a second copy.
    { key: 'zzleft',  zh: '左块', en: 'Left block',  done: (_f, s) => stepSolved('fb', s) },
    { key: 'zzright', zh: '右块', en: 'Right block', done: (_f, s) => stepSolved('sb', s) },
    { key: 'll',      zh: '顶层', en: 'Last layer',  done: (_f, s) => stepSolved('solved', s) },
  ],
};

export const METHODS: Readonly<Record<MethodId, SolveMethod>> = Object.freeze({
  cfop: CFOP, roux: ROUX, zz: ZZ,
});

export const METHOD_ORDER: readonly MethodId[] = ['cfop', 'roux', 'zz'];

export function methodById(id: string | null | undefined): SolveMethod {
  return (id && (METHODS as Record<string, SolveMethod>)[id]) || CFOP;
}

/** Facelet string for a state, memo-free — the walker calls this once per move. */
export function facesToFacelets(f: CubeFaces): string {
  return toFaceletString(f);
}
