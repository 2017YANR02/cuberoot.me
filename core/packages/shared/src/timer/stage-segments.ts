/**
 * Persisted CFOP reconstruction summary.
 *
 * This shape and its producer live in the shared package because every timer
 * client records and reads the same reconstruction data.
 */
export interface StageSegments {
  crossDoneMs: number | null;
  f2lDoneMs: number | null;
  ollDoneMs: number | null;
  solvedMs: number | null;
  crossEndIdx?: number | null;
  f2lEndIdx?: number | null;
  ollEndIdx?: number | null;
  solvedEndIdx?: number | null;
  crossMs: number | null;
  f2lMs: number | null;
  ollMs: number | null;
  pllMs: number | null;
  crossHtm: number | null;
  f2lHtm: number | null;
  ollHtm: number | null;
  pllHtm: number | null;
  crossSide: string | null;
  ollCase: string | null;
  pllCase: string | null;
}

export type { SolveMove } from './types';
