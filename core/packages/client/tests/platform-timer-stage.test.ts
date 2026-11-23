// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { readTimerStage, stageFromTimerBackup } from '@/lib/platform-timer-stage';
import { sessionFetch } from '@/lib/session-fetch';

vi.mock('@/lib/session-fetch', () => ({sessionFetch: vi.fn()}));
vi.mock('@/lib/admin-api', () => ({authHeaders: () => ({})}));
const signal = new AbortController().signal;
function snapshot(times: number[], penalty = 'ok', event = '333') {
  const solves = times.map((timeMs, ts) => ({id: 't' + ts, event, timeMs, ts: ts + 1, penalty, scramble: 'R U'}));
  return JSON.stringify({version: 2, byEvent: {[event]: solves}});
}
afterEach(() => { localStorage.clear(); vi.resetAllMocks(); });

it('uses recent valid solves, includes penalties and ignores other events', () => {
  expect(stageFromTimerBackup(snapshot([...Array(20).fill(70000), ...Array(11).fill(30000), 5000]))).toBe('sub30');
  expect(stageFromTimerBackup(snapshot(Array(5).fill(14500), '+2'))).toBe('sub20');
  expect(stageFromTimerBackup(snapshot(Array(5).fill(10000), 'DNF'))).toBeNull();
  expect(stageFromTimerBackup(snapshot(Array(5).fill(10000), 'ok', 'pll'))).toBeNull();
  expect(stageFromTimerBackup(snapshot(Array(4).fill(10000)))).toBeNull();
});
it('uses a local timer database without contacting the cloud', async () => {
  localStorage.setItem('cuberoot-timer.v2', snapshot(Array(6).fill(20000)));
  expect(await readTimerStage('42', signal)).toBe('sub20');
  expect(sessionFetch).not.toHaveBeenCalled();
});
it('falls back to an account snapshot only for signed-in users', async () => {
  localStorage.setItem('cuberoot-timer.v3', 'bad json');
  expect(await readTimerStage('guest', signal)).toBeNull();
  expect(sessionFetch).not.toHaveBeenCalled();
  const meta = {exists: true, updatedAt: 10, solveCount: 5, byteSize: 600};
  vi.mocked(sessionFetch).mockResolvedValueOnce(Response.json(meta))
    .mockResolvedValueOnce(Response.json({...meta, blob: snapshot(Array(5).fill(15000))}));
  expect(await readTimerStage('42', signal)).toBe('sub15');
});
