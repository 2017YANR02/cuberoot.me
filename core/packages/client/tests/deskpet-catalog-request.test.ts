import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => path }));
vi.mock('@/lib/auth-store', () => ({ getSessionToken: () => null, getToken: () => null }));

const catalog = { revision: 1, entries: [] };
const response = (value = catalog) => new Response(JSON.stringify(value));

beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function stalled(signal: AbortSignal) {
  return new Promise<never>((_, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
}

it('shares concurrent catalog requests and fetches fresh settings after completion', async () => {
  let resolve!: (value: Response) => void;
  const fetcher = vi.fn().mockReturnValueOnce(new Promise<Response>(done => { resolve = done; })).mockResolvedValueOnce(response({ revision: 2, entries: [] }));
  vi.stubGlobal('fetch', fetcher);
  const { getDeskPetCatalog } = await import('@/lib/deskpet-api');
  const first = getDeskPetCatalog();
  expect(getDeskPetCatalog()).toBe(first);
  expect(fetcher).toHaveBeenCalledOnce();
  resolve(response());
  expect(await first).toEqual(catalog);
  expect((await getDeskPetCatalog()).revision).toBe(2);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

it.each(['headers', 'body'])('aborts stalled %s after eight seconds and retries once', async part => {
  const fetcher = vi.fn().mockImplementationOnce((_url: string, { signal }: RequestInit) => {
    const pending = stalled(signal!);
    return part === 'headers' ? pending : Promise.resolve({ ok: true, json: () => pending });
  }).mockResolvedValueOnce(response());
  vi.stubGlobal('fetch', fetcher);
  const { getDeskPetCatalog } = await import('@/lib/deskpet-api');
  const pending = getDeskPetCatalog();
  await vi.advanceTimersByTimeAsync(7999);
  expect(fetcher).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1);
  expect(await pending).toEqual(catalog);
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

it('stops after two stalled attempts and allows a subsequent manual retry', async () => {
  const fetcher = vi.fn().mockImplementation((_url: string, { signal }: RequestInit) => stalled(signal!));
  vi.stubGlobal('fetch', fetcher);
  const { getDeskPetCatalog } = await import('@/lib/deskpet-api');
  const pending = expect(getDeskPetCatalog()).rejects.toMatchObject({ name: 'AbortError' });
  await vi.advanceTimersByTimeAsync(16000);
  await pending;
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.every(([, init]) => init.signal.aborted)).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  fetcher.mockResolvedValueOnce(response());
  expect(await getDeskPetCatalog()).toEqual(catalog);
});

it.each([
  ['invalid data', () => new Response('{}')],
  ['HTTP error', () => new Response('{}', { status: 503 })],
])('rejects %s without substituting default visibility or retrying', async (_label, makeResponse) => {
  const fetcher = vi.fn().mockResolvedValue(makeResponse());
  vi.stubGlobal('fetch', fetcher);
  const { getDeskPetCatalog } = await import('@/lib/deskpet-api');
  await expect(getDeskPetCatalog()).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
