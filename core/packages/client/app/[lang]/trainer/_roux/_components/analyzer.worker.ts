// Off-thread Roux FB analyzer worker (Turbopack Web Worker).
// Faithful to roux-trainers/src/worker/index.ts: comlink expose({ analyze }).
// The analyzer enumerates many orientations × premoves and is heavy, so we run
// it off the UI thread. AnalyzerView falls back to a main-thread analyze() if
// the worker fails to construct/run.

import { expose } from 'comlink';
import { analyze, type AnalyzerState, type SolutionDesc } from '@/lib/roux/Analyzer';

const api = {
  analyze: (state: AnalyzerState): SolutionDesc[] => analyze(state),
};

export type AnalyzerWorker = typeof api;

expose(api);
