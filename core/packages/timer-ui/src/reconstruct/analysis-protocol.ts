import type { ReconTextInput, ReconTextResult } from '@cuberoot/shared/timer/reconstruct/recon-text';
import type { ReferenceResult, SlotReference } from '@cuberoot/shared/timer/reconstruct/reference';

export interface AnalysisInput {
  text: ReconTextInput;
  scoreable: boolean;
}

export interface AnalysisSnapshot {
  text: ReconTextResult | null;
  reference: ReferenceResult | null;
  slotReference: SlotReference[] | null;
  status: 'pending' | 'complete' | 'error';
}

export interface AnalysisRequest { id: number; input: AnalysisInput }
export interface AnalysisResponse {
  id: number;
  patch?: Partial<Omit<AnalysisSnapshot, 'status'>>;
  error?: string;
  done?: boolean;
}

export function emptyAnalysis(): AnalysisSnapshot {
  return { text: null, reference: null, slotReference: null, status: 'pending' };
}
