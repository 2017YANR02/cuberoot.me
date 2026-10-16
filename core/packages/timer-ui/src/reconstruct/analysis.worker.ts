import { runReconstructionAnalysis } from './analysis-runner';
import type { AnalysisRequest } from './analysis-protocol';
self.onmessage = ({ data }: MessageEvent<AnalysisRequest>) => {
  return runReconstructionAnalysis(data, response => self.postMessage(response));
};
