import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { WcaTeamsResponse } from '@/lib/wca-teams-api';

const api = vi.hoisted(() => ({ listWcaTeams: vi.fn(), saveWcaTeam: vi.fn() }));
vi.mock('@/lib/wca-teams-api', () => api);
const empty: WcaTeamsResponse = { teams: [], assignments: [] };

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  api.listWcaTeams.mockReset().mockResolvedValue(empty);
  api.saveWcaTeam.mockReset();
});
afterEach(() => { vi.useRealTimers(); });

it('batches and deduplicates people, skips invalid IDs, and caches absent teams until stale', async () => {
  const directory = await import('@/lib/wca-team-directory');
  const ids = Array.from({ length: 101 }, (_, i) => `2023TEST${String(i + 1).padStart(2, '0')}`);
  // WCA IDs have exactly two trailing digits; use a second surname for person 101.
  ids[99] = '2023TESS01';
  ids[100] = '2023TESS02';
  for (const id of [...ids, ...ids, '', 'u123']) directory.requestWcaPersonTeam(id);
  await vi.runAllTimersAsync();
  expect(api.listWcaTeams.mock.calls.map(([batch]) => batch.length)).toEqual([100, 1]);
  expect(api.listWcaTeams.mock.calls.flatMap(([batch]) => batch)).toEqual(ids);
  expect(directory.getWcaPersonTeam(ids[0])).toBeNull();
  directory.requestWcaPersonTeam(ids[0]);
  await vi.runAllTimersAsync();
  expect(api.listWcaTeams).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(60_000);
  directory.requestWcaPersonTeam(ids[0]);
  await vi.runAllTimersAsync();
  expect(api.listWcaTeams).toHaveBeenCalledTimes(3);
});

it('deduplicates in-flight requests and allows retry after failure without recording absence', async () => {
  const directory = await import('@/lib/wca-team-directory');
  let reject!: (error: Error) => void;
  api.listWcaTeams.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
  directory.requestWcaPersonTeam('2023GENG02');
  await vi.advanceTimersByTimeAsync(0);
  directory.requestWcaPersonTeam('2023GENG02');
  expect(api.listWcaTeams).toHaveBeenCalledTimes(1);
  reject(new Error('offline'));
  await vi.runAllTimersAsync();
  expect(directory.getWcaPersonTeam('2023GENG02')).toBeUndefined();
  directory.requestWcaPersonTeam('2023GENG02');
  await vi.runAllTimersAsync();
  expect(api.listWcaTeams).toHaveBeenCalledTimes(2);
});

it('notifies badges after edits and prevents an older fetch from undoing a saved team or removal', async () => {
  const directory = await import('@/lib/wca-team-directory');
  const listener = vi.fn();
  const unsubscribe = directory.subscribeWcaTeams(listener);
  const gan = { id: 1, name: 'GAN' };
  for (const saved of [gan, null]) {
    let resolve!: (data: WcaTeamsResponse) => void;
    api.listWcaTeams.mockReturnValueOnce(new Promise<WcaTeamsResponse>(done => { resolve = done; }));
    const reading = directory.fetchWcaTeamDirectory(['2023GENG02']);
    api.saveWcaTeam.mockResolvedValueOnce({ team: saved });
    await directory.saveWcaPersonTeam('2023GENG02', saved?.name ?? '');
    expect(directory.getWcaPersonTeam('2023GENG02')).toEqual(saved);
    expect(listener).toHaveBeenCalled();
    resolve({ teams: [gan], assignments: saved ? [] : [{ wcaId: '2023GENG02', teamId: 1 }] });
    await reading;
    expect(directory.getWcaPersonTeam('2023GENG02')).toEqual(saved);
  }
  unsubscribe();
});
