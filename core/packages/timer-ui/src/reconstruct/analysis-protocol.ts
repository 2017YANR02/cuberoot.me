import type { ReconTextInput, ReconTextResult, ReconTextLine } from '@cuberoot/shared/timer/reconstruct/recon-text';
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
  /** Live steps remain visible while the final move stream is reconciled. */
  provisional?: boolean;
}

export interface AnalysisRequest { id: number; input: AnalysisInput; skipText?: boolean }
export interface AnalysisWarmup { type: 'warmup' }
export type AnalysisWorkerRequest = AnalysisRequest | AnalysisWarmup;
export interface AnalysisResponse {
  id: number;
  patch?: Partial<Omit<AnalysisSnapshot, 'status'>>;
  error?: string;
  done?: boolean;
}

export function emptyAnalysis(): AnalysisSnapshot {
  return { text: null, reference: null, slotReference: null, status: 'pending' };
}

/** Same attempt prefix, including lossless encoder timestamps and view context. */
export function isAnalysisContinuation(previous: AnalysisInput, next: AnalysisInput): boolean {
  const before = previous.text.physical ?? previous.text;
  const after = next.text.physical ?? next.text;
  return before.scramble === after.scramble && before.moves.length > 0
    && before.moves.length <= after.moves.length
    && previous.text.viewRotation === next.text.viewRotation
    && previous.text.method === next.text.method && previous.text.language === next.text.language
    && before.moves.every((move, i) => move.m === after.moves[i].m && move.ts === after.moves[i].ts);
}

/** Only close a stage once a subsequent gesture has cleared the encoder's
 * short pairing window. The active tail is never a confirmed stage. */
export function confirmedReconPrefix(input: ReconTextInput, recon: ReconTextResult): ReconTextResult {
  const lines: ReconTextLine[] = [];
  const solved = input.segs.solvedEndIdx != null;
  for (const line of recon.lines) {
    if (line.key === 'tail' || (!solved && (line.toIdx >= input.moves.length - 1
      || input.totalMs - (input.moves[line.toIdx]?.ts ?? input.totalMs) < 200))) break;
    lines.push(line);
  }
  const end = lines.at(-1)?.toIdx ?? -1;
  return { ...recon, lines, presentation: recon.presentation ? {
    ...recon.presentation, lines: recon.presentation.lines.filter(line => line.toIdx <= end), presentation: undefined,
  } : undefined };
}
