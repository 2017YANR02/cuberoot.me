import { runReconstructionAnalysis } from './analysis-runner';
import type { AnalysisWorkerRequest } from './analysis-protocol';
self.onmessage = ({ data }: MessageEvent<AnalysisWorkerRequest>) => {
  return runReconstructionAnalysis(data, response => self.postMessage(response));
};
