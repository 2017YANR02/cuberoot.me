"use server";

const LEGACY_TIMER_ERROR = "legacy_timer_read_only";

export type SaveSolveResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function saveSolveAction(input: {
  event: string;
  timeMs: number;
  scramble: string;
  penalty?: string;
}): Promise<SaveSolveResult> {
  void input;
  return { ok: false, error: LEGACY_TIMER_ERROR };
}

export async function setPenaltyAction(
  id: string,
  penalty: string,
): Promise<{ ok: boolean }> {
  void id;
  void penalty;
  return { ok: false };
}

export async function deleteSolveAction(id: string): Promise<{ ok: boolean }> {
  void id;
  return { ok: false };
}
