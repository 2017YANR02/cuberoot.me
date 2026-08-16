import {
  checkReconCompletion,
  normalizeReconScrambleSpacing,
  type ReconCompletionResult,
} from '@cuberoot/shared/recon-completion';

/** Canonicalise all persisted scramble columns before validation and storage. */
export function normalizeReconScrambleRow(
  row: Record<string, unknown>,
  fallbackEvent?: unknown,
): void {
  const event = String(row.event ?? fallbackEvent ?? '');
  for (const field of ['wca_scramble', 'optimal_scramble', 'scramble'] as const) {
    if (typeof row[field] === 'string') {
      row[field] = normalizeReconScrambleSpacing(event, row[field]);
    }
  }
}

/** Run the authoritative end-state check on a SQL-shaped reconstruction row. */
export async function checkReconRowCompletion(
  row: Record<string, unknown>,
): Promise<ReconCompletionResult> {
  return checkReconCompletion({
    event: String(row.event ?? ''),
    scramble: String(row.optimal_scramble || row.wca_scramble || row.scramble || ''),
    solution: String(row.solution ?? ''),
  });
}

export function hasUnsolvedReason(row: Record<string, unknown>): boolean {
  return typeof row.unsolved_reason === 'string' && row.unsolved_reason.trim().length > 0;
}
