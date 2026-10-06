import type { Solve } from '@cuberoot/shared/timer';
import { createTimerReplayShare, fetchTimerReplayShare } from '@cuberoot/shared/timer/replay-client';
import { apiUrl } from '@/lib/api-base';
import { getSessionToken } from '@/lib/auth-store';

const transport = { apiUrl, fetcher: (...args: Parameters<typeof fetch>) => fetch(...args) };
export function createServerReplayShare(solve: Solve): Promise<string | null> {
  return createTimerReplayShare(solve, getSessionToken(), transport);
}
export function fetchServerReplayShare(id: string): Promise<Solve | null> {
  return fetchTimerReplayShare(id, transport);
}
