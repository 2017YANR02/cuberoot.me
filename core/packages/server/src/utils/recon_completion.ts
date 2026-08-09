import { checkReconCompletion, type ReconCompletionResult } from '@cuberoot/shared/recon-completion';

/** Run the authoritative end-state check on a SQL-shaped reconstruction row. */
export async function checkReconRowCompletion(
  row: Record<string, unknown>,
): Promise<ReconCompletionResult> {
  return checkReconCompletion({
    event: String(row.event ?? ''),
    scramble: String(row.wca_scramble || row.optimal_scramble || ''),
    solution: String(row.solution ?? ''),
  });
}

export function hasUnsolvedReason(row: Record<string, unknown>): boolean {
  return typeof row.unsolved_reason === 'string' && row.unsolved_reason.trim().length > 0;
}
