/**
 * Persisted CFOP reconstruction summary.
 *
 * This shape lives in the shared package because it is embedded in a timer
 * solve. The reconstruction engine that produces it remains a website concern;
 * mobile consumers can safely read or preserve the data without importing the
 * cube recognizer and its browser-facing dependencies.
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
