import { createReconstructionAnalyzer } from './analysis-core';
import { createLiveReconstructionStream as createLiveStream } from './analysis-live';
import type { AnalysisInput, AnalysisSnapshot } from './analysis-protocol';
export { createReconstructionAnalyzer } from './analysis-core';
export type { AnalysisInput, AnalysisRequest, AnalysisResponse, AnalysisSnapshot } from './analysis-protocol';

export const reconstructionAnalyzer = createReconstructionAnalyzer(() => (
  new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' })
));

export function createLiveReconstructionStream(
  listener: (input: AnalysisInput, snapshot: AnalysisSnapshot) => void,
  analyzer = reconstructionAnalyzer,
) {
  return createLiveStream(listener, analyzer);
}
