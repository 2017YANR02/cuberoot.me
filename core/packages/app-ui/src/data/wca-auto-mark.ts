import type { WebSession } from '@cuberoot/shared/auth/web-session';
import { ownerKey } from '@cuberoot/shared/account';
import {
  decodeTimerWcaCompetitionScrambleSlotIdentity,
  timerWcaScrambleMarkWriteMode,
  timerWcaScrambleMarkKeyFromSlot,
  type Solve,
  type TimerWcaScrambleMarkKey,
  type TimerWcaScrambleMarksResponse,
} from '@cuberoot/shared/timer';

export interface WcaAutoMarkDependencies {
  loadMarks(
    key: TimerWcaScrambleMarkKey,
    refresh?: boolean,
  ): Promise<TimerWcaScrambleMarksResponse>;
  postMark(
    key: TimerWcaScrambleMarkKey,
    mark: { country: string; timeCs: number | null },
    token: string,
  ): Promise<unknown>;
  updateMark(
    key: TimerWcaScrambleMarkKey,
    mark: { country: string; timeCs: number | null },
    token: string,
  ): Promise<boolean>;
}

export function wcaAutoMarkOwnerKey(session: WebSession | null): string {
  return session ? ownerKey(session.user.uid, session.user.wcaId) : '';
}

/** Busy auth can still expose the previous render's session while logout/switch is pending. */
export function wcaAutoMarkLiveSession(
  session: WebSession | null,
  busy: boolean,
): WebSession | null {
  return busy ? null : session;
}

/** Runs only after its caller has durably saved this solve. */
export async function autoMarkSavedWcaSolve(
  solve: Omit<Solve, 'id' | 'ts'>,
  ownerAtSaveStart: string,
  liveSession: WebSession | null,
  enabled: boolean,
  dependencies: WcaAutoMarkDependencies,
): Promise<boolean> {
  if (!ownerAtSaveStart || wcaAutoMarkOwnerKey(liveSession) !== ownerAtSaveStart) return false;
  const writeMode = timerWcaScrambleMarkWriteMode({
    penalty: solve.penalty,
    signedIn: Boolean(liveSession),
    enabled,
  });
  if (!writeMode || !liveSession || solve.scrambleSource?.kind !== 'wca') return false;

  const slot = decodeTimerWcaCompetitionScrambleSlotIdentity(
    solve.scrambleSource.identity,
  );
  if (!slot) return false;
  const key = timerWcaScrambleMarkKeyFromSlot(slot);
  const timeCs = Math.round((
    solve.timeMs + (solve.penalty === '+2' ? 2_000 : 0)
  ) / 10);
  const mark = { country: '', timeCs };
  const updated = writeMode === 'upsert'
    ? (await dependencies.postMark(key, mark, liveSession.token), true)
    : await dependencies.updateMark(key, mark, liveSession.token);
  if (!updated) return false;
  await dependencies.loadMarks(key, true);
  return true;
}
