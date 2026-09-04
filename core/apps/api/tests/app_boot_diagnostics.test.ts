import { describe, expect, it, vi } from 'vitest';
import {
  createAppBootDiagnosticRoutes,
  type AppBootDiagnosticStore,
} from '../src/routes/app_boot_diagnostics.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36';
const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const CODE = 'APP-CHUNK-ABC1234';

function fakeStore() {
  const record = vi.fn<AppBootDiagnosticStore['record']>(async () => {});
  const cleanupExpired = vi.fn<AppBootDiagnosticStore['cleanupExpired']>(async () => {});
  const find = vi.fn<AppBootDiagnosticStore['find']>(async () => [{ eventId: EVENT_ID, code: CODE }]);
  return { record, cleanupExpired, find } satisfies AppBootDiagnosticStore;
}

function validBody() {
  return {
    version: 1,
    eventId: EVENT_ID,
    code: CODE,
    kind: 'chunk',
    path: '/zh/music',
    online: true,
    errorName: 'ChunkLoadError',
    errorMessage: 'Failed https://cuberoot.me/chunk.js?token=secret Bearer secret-token',
    evidence: [{
      source: 'runtime',
      name: 'ChunkLoadError',
      message: 'Loading https://cuberoot.me/chunk.js#private failed',
      url: 'https://cuberoot.me/chunk.js?token=secret#private',
    }],
  };
}

describe('app boot diagnostics API', () => {
  it('stores only bounded, redacted diagnostics and coarse runtime dimensions', async () => {
    const store = fakeStore();
    const routes = createAppBootDiagnosticRoutes({ store, identifyIp: () => 'test', rateLimit: () => {} });
    const response = await routes.request('/app/boot-diagnostics', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'User-Agent': USER_AGENT },
      body: JSON.stringify(validBody()),
    });

    expect(response.status).toBe(204);
    expect(store.cleanupExpired).toHaveBeenCalledTimes(1);
    expect(store.record).toHaveBeenCalledWith(expect.objectContaining({
      eventId: EVENT_ID,
      code: CODE,
      path: '/zh/music',
      errorMessage: 'Failed https://cuberoot.me/chunk.js Bearer [redacted]',
      evidence: [{
        source: 'runtime',
        name: 'ChunkLoadError',
        message: 'Loading https://cuberoot.me/chunk.js failed',
        url: 'https://cuberoot.me/chunk.js',
      }],
    }), expect.objectContaining({
      deviceType: 'desktop',
      browserFamily: 'chrome',
      browserMajor: 140,
      osFamily: 'windows',
      osMajor: 10,
    }));
    expect(store.record.mock.calls[0]?.flat().join(' ')).not.toContain(USER_AGENT);
  });

  it('rejects undeclared fields and keeps exact-code reads admin-only', async () => {
    const store = fakeStore();
    const authorizeAdmin = vi.fn(async () => {});
    const routes = createAppBootDiagnosticRoutes({ store, authorizeAdmin, rateLimit: () => {} });
    const invalid = await routes.request('/app/boot-diagnostics', {
      method: 'POST',
      body: JSON.stringify({ ...validBody(), accountId: 'private' }),
    });
    expect(invalid.status).toBe(400);
    expect(store.record).not.toHaveBeenCalled();

    const response = await routes.request(`/app/boot-diagnostics?code=${CODE}&limit=20`);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(authorizeAdmin).toHaveBeenCalledTimes(1);
    expect(store.find).toHaveBeenCalledWith(CODE, 20);
    expect(await response.json()).toMatchObject({ code: CODE, retentionDays: 90 });

    expect((await routes.request('/app/boot-diagnostics?code=bad')).status).toBe(400);
    expect(store.find).toHaveBeenCalledTimes(1);
  });
});
