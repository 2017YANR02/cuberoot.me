import { afterEach, expect, it, vi } from 'vitest';

// Native streams/Blob/Response exercise the real large-snapshot encoding path.
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
it('reloads a compressed large set without waiting for the live request', async () => {
  const store: Record<string, string> = {};
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
  });
  const value = { formula: 'R U R\' U\' '.repeat(80000) };
  const first = await import('@/lib/alg-library-cache');
  await first.readAlgLibrary('file:3x3/1lll', async () => value);
  await vi.waitFor(() => expect(JSON.parse(store['alg-library:v1:file:3x3/1lll'] ?? '{}').gzip).toBeTypeOf('string'));
  expect(store['alg-library:v1:file:3x3/1lll'].length).toBeLessThan(10000);
  vi.resetModules();
  const next = await import('@/lib/alg-library-cache');
  let finish!: (result: typeof value) => void;
  const network = new Promise<typeof value>(resolve => { finish = resolve; });
  expect((await next.readAlgLibrary('file:3x3/1lll', () => network)).formula).toBe(value.formula);
  finish(value);
});
