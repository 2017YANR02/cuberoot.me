// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCompSchedule } from '@/lib/comp-schedule';

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('competition schedule preloading', () => {
  it('shares an in-flight request with the view and reuses its cached result', async () => {
    const schedule = { venues: [], activities: [], rounds: {} };
    let release!: (response: unknown) => void;
    const fetchMock = vi.fn(() => new Promise(resolve => { release = resolve; }));
    vi.stubGlobal('fetch', fetchMock);

    const preload = fetchCompSchedule('ConcurrentSchedule2026');
    const view = fetchCompSchedule('ConcurrentSchedule2026');
    expect(fetchMock).toHaveBeenCalledOnce();
    release({ ok: true, json: async () => ({ schedule }) });
    await expect(preload).resolves.toEqual(schedule);
    await expect(view).resolves.toEqual(schedule);
    await expect(fetchCompSchedule('ConcurrentSchedule2026')).resolves.toEqual(schedule);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not cache an unavailable schedule and can retry later', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ schedule: null }) }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchCompSchedule('MissingSchedule2026')).resolves.toBeNull();
    await expect(fetchCompSchedule('MissingSchedule2026')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps requests for different competitions independent', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => ({ ok: true, json: async () => ({ schedule: null }) }));
    vi.stubGlobal('fetch', fetchMock);
    await Promise.all([fetchCompSchedule('ScheduleA2026'), fetchCompSchedule('ScheduleB2026')]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('ScheduleA2026/schedule');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('ScheduleB2026/schedule');
  });
});
