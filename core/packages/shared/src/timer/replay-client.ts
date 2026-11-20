import { decodeTimerSolve } from './persistence';
import { EVENTS, type Solve } from './types';
import { decodeReplayParam, solveFromReplay } from './replay-decode';
import { extractReplayParam, timerReplaySearchParams } from './replay-input';
import type { TimerHttpRequest, TimerHttpResponse } from './http';

export interface TimerReplayTransport {
  apiUrl(path: string): string;
  fetcher(url: string, init?: TimerHttpRequest & { cache?: 'no-store' }): Promise<TimerHttpResponse>;
  decodeBase64?(value: string): string;
}

const validShareId = (id: string) => /^[A-Za-z0-9_-]{8,16}$/.test(id);

export async function createTimerReplayShare(solve: Solve, token: string | null | undefined, transport: TimerReplayTransport): Promise<string | null> {
  if (!token) return null;
  const response = await transport.fetcher(transport.apiUrl('/v1/timer/replay-shares'), {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ solve }),
  });
  if (!response.ok) throw new Error(`Replay share failed: HTTP ${response.status}`);
  const data = await response.json() as { id?: unknown };
  if (typeof data.id !== 'string' || !validShareId(data.id)) throw new Error('Invalid replay share response');
  return data.id;
}

export async function fetchTimerReplayShare(id: string, transport: TimerReplayTransport, signal?: AbortSignal): Promise<Solve | null> {
  if (!validShareId(id)) return null;
  const response = await transport.fetcher(transport.apiUrl(`/v1/timer/replay-shares/${id}`), { cache: 'no-store', signal });
  if (!response.ok) return null;
  const data = await response.json() as { solve?: unknown };
  if (!data.solve || typeof data.solve !== 'object') return null;
  const event = (data.solve as Solve).event;
  if (!EVENTS.some(item => item.id === event)) return null;
  return decodeTimerSolve(data.solve, event);
}

/** Never fetch the pasted URL: only its locator is sent to the configured API. */
export async function readTimerReplay(input: string, candidates: readonly Solve[], transport: TimerReplayTransport, signal?: AbortSignal): Promise<Solve | null> {
  const param = extractReplayParam(input);
  if (param) {
    const decoded = decodeReplayParam(param, transport.decodeBase64);
    return decoded ? solveFromReplay(decoded, candidates) : null;
  }
  try {
    const share = timerReplaySearchParams(input).get('share');
    return share ? fetchTimerReplayShare(share, transport, signal) : null;
  } catch { return null; }
}
