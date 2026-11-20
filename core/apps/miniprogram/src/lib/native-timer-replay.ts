import { isTimerOrdinaryEvent } from '@cuberoot/shared/timer/event-catalog';
import { readTimerReplay } from '@cuberoot/shared/timer/replay-client';
import type { Solve } from '@cuberoot/shared/timer/types';
import { nativeTimerFetch } from './native-timer-network';
import { miniProgramApi } from './platform';

function browserCompatibleBase64(value: string): string {
  if (typeof atob === 'function') return atob(value);
  const bytes = new Uint8Array(miniProgramApi().base64ToArrayBuffer(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return binary;
}

/** Open an ephemeral report using the same locator and decode rules as Web. */
export async function readNativeTimerReplay(input: string, candidates: readonly Solve[], signal: AbortSignal) {
  const solve = await readTimerReplay(input, candidates, {
    apiUrl: path => path,
    fetcher: nativeTimerFetch,
    decodeBase64: browserCompatibleBase64,
  }, signal);
  return !signal.aborted && solve?.moves?.length && isTimerOrdinaryEvent(solve.event) ? solve : null;
}
