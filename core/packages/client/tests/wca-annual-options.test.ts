import { afterEach, expect, it, vi } from 'vitest';
import { loadAnnualParticipationOptions } from '@/lib/wca-annual-options';

afterEach(() => vi.unstubAllGlobals());

it('uses per-event availability when annual data is ready', async () => {
  const data = { options: [{ event: 'clock', year: 2026 }], events: ['clock'] };
  const fetcher = vi.fn().mockResolvedValue(Response.json(data));
  vi.stubGlobal('fetch', fetcher);
  expect(await loadAnnualParticipationOptions('CN', new AbortController().signal)).toEqual({ ...data, years: [] });
  expect(fetcher).toHaveBeenCalledOnce();
});

it.each([503, 200])('retains real year choices when annual metadata is unavailable or malformed (%s)', async status => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(Response.json({ error: 'not ready' }, { status }))
    .mockResolvedValueOnce(Response.json({ years: [2026, 2025] }));
  vi.stubGlobal('fetch', fetcher);
  expect(await loadAnnualParticipationOptions('CN', new AbortController().signal)).toEqual({ years: [2026, 2025] });
  expect(fetcher.mock.calls[1][0]).toContain('v=2&scope=CN');
});

it('does not accept malformed fallback data or retry an aborted request', async () => {
  const fetcher = vi.fn().mockImplementation(async () => Response.json({ years: [null] }));
  vi.stubGlobal('fetch', fetcher);
  await expect(loadAnnualParticipationOptions('CN', new AbortController().signal)).rejects.toThrow('Invalid annual years');
  fetcher.mockReset().mockRejectedValue(new Error('aborted'));
  const controller = new AbortController();
  controller.abort();
  await expect(loadAnnualParticipationOptions('CN', controller.signal)).rejects.toThrow('aborted');
  expect(fetcher).toHaveBeenCalledOnce();
});
