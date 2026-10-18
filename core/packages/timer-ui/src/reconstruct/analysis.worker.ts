import { runReconstructionAnalysis } from './analysis-runner';
import { reconstructionLibraries } from './library-cache';
import type { AnalysisWorkerRequest } from './analysis-protocol';
self.onmessage = ({ data }: MessageEvent<AnalysisWorkerRequest>) => {
  if ('type' in data && data.type === 'warmup') return reconstructionLibraries.warm();
  if (!('input' in data)) return;
  return runReconstructionAnalysis(data, response => self.postMessage(response));
};
