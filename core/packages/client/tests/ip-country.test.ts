import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('shares one request across menus and validates the returned country', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ country: 'CN' }) });
  const { loadIpCountry } = await import('@/lib/ip-country');
  const first = loadIpCountry();
  expect(loadIpCountry()).toBe(first);
  expect(await first).toBe('cn');
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock.mock.calls[0][0]).toMatch(/\/v1\/geo\/country$/);
  expect(fetchMock.mock.calls[0][1].cache).toBe('no-store');
});

it.each([null, {}, { country: null }, { country: '_Asia' }, { country: 'invalid' }])('ignores unavailable or invalid data: %j', async data => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => data });
  const { loadIpCountry } = await import('@/lib/ip-country');
  expect(await loadIpCountry()).toBe('');
});

it('bounds a stalled request and leaves country menus usable', async () => {
  vi.useFakeTimers();
  fetchMock.mockImplementation((_url, { signal }: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  const { loadIpCountry } = await import('@/lib/ip-country');
  const result = loadIpCountry();
  await vi.advanceTimersByTimeAsync(5_000);
  expect(await result).toBe('');
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
});

it('handles failed HTTP responses without caching them in the browser', async () => {
  fetchMock.mockResolvedValue({ ok: false });
  const { loadIpCountry } = await import('@/lib/ip-country');
  expect(await loadIpCountry()).toBe('');
});
