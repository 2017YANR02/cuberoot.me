import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAlgCatalog } from '@/lib/alg-catalog-server';

vi.mock('@/lib/alg-catalog', () => ({ prepareAlgCatalog: async (snapshot: unknown) => snapshot }));

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('catalog ISR failure handling', () => {
  it('propagates a temporary API error instead of replacing cached covers with an empty snapshot', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PHASE', 'phase-production-server');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Unavailable', { status: 502 })));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(fetchAlgCatalog('3x3')).rejects.toThrow('Alg catalog HTTP 502');
  });

  it('propagates a runtime network failure for the same stale-page protection', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PHASE', 'phase-production-server');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unavailable')));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(fetchAlgCatalog('3x3')).rejects.toThrow('Network unavailable');
  });

  it('allows the first build to precede the API rollout', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not found', { status: 404 })));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(fetchAlgCatalog('3x3')).resolves.toBeNull();
  });

  it('returns a recovered catalog on the next successful regeneration', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PHASE', 'phase-production-server');
    const snapshot = { puzzle: '3x3', order: [], sets: [] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(snapshot)));
    await expect(fetchAlgCatalog('3x3')).resolves.toEqual(snapshot);
  });
});
