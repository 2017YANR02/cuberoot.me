import { checkReconRowCompletion } from './recon_completion.js';

export type CompletionRow = Record<string, unknown> & {
  id: number; completion_status: string; unsolved_reason: string | null;
};

/** Only derived fields change; recorded moves and other user content stay intact. */
export async function planReconCompletionUpdate(before: CompletionRow) {
  const { status } = await checkReconRowCompletion(before);
  // An unavailable checker is not grounds to discard a previous authoritative result.
  if (status === 'unchecked' && before.record_type !== 'timing') return null;
  const reason = status === 'solved' ? null : before.unsolved_reason;
  if (status === before.completion_status && reason === before.unsolved_reason) return null;
  return { before, after: { completion_status: status, unsolved_reason: reason } };
}
