import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { databaseLoad, diagnosticRequestId, measureDatabase, requestDiagnostics } from '../src/observability/request.js';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
const id = '11111111-1111-4111-8111-111111111111';

describe('API request diagnostics', () => {
  it('separates concurrent requests and records database timing without leaking data', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const app = new Hono().use('*', requestDiagnostics);
    app.get('/v1/nav/home-locks', async c => {
      await measureDatabase(async () => {
        if (c.req.header('X-Request-ID') === id) await gate;
        return 'private-database-result';
      });
      return c.json({ locks: {} });
    });
    const first = app.request('/v1/nav/home-locks?private-query=secret', {
      headers: { 'X-Request-ID': id, Cookie: 'private-cookie', Authorization: 'Bearer private-token' },
    });
    const second = await app.request('/v1/nav/home-locks');
    release();
    const firstResponse = await first;
    expect(firstResponse.status).toBe(200);
    expect(firstResponse.headers.get('X-Request-ID')).toBe(id);
    expect(second.headers.get('X-Request-ID')).not.toBe(id);
    const entries = log.mock.calls.map(call => JSON.parse(call[0]));
    expect(entries).toHaveLength(2);
    for (const entry of entries) expect(entry).toMatchObject({ event: 'api_request', route: '/v1/nav/home-locks', dbCalls: 1, dbErrors: 0, status: 200 });
    expect(new Set(entries.map(e => e.requestId)).size).toBe(2);
    expect(JSON.stringify(entries)).not.toContain('private-');
    expect(databaseLoad().inFlight).toBe(0);
  });

  it('records a pending request before completion and preserves a database failure', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const app = new Hono().use('*', requestDiagnostics);
    app.onError((_e, c) => c.json({ error: 'unavailable' }, 503));
    let fail!: (error: Error) => void;
    const query = new Promise<never>((_resolve, reject) => { fail = reject; });
    app.get('/v1/nav/home-locks', async c => { await measureDatabase(() => query); return c.json({ locks: {} }); });
    const request = app.request('/v1/nav/home-locks', { headers: { 'X-Request-ID': id } });
    await vi.advanceTimersByTimeAsync(4001);
    expect(warn.mock.calls.map(call => JSON.parse(call[0]))).toContainEqual(expect.objectContaining({ event: 'api_request_pending', requestId: id }));
    fail(new Error('private-sql-parameters'));
    expect((await request).status).toBe(503);
    expect(warn.mock.calls.map(call => JSON.parse(call[0]))).toContainEqual(expect.objectContaining({ event: 'api_request', dbCalls: 1, dbErrors: 1, status: 503 }));
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private-sql');
    expect(databaseLoad().inFlight).toBe(0);
  });

  it('uses route templates instead of visitor identifiers and tolerates a broken logger', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const app = new Hono().use('*', requestDiagnostics).get('/v1/fixture/:id', c => c.json({}, 503));
    await app.request('/v1/fixture/private-person-id?token=private-token');
    expect(JSON.parse(warn.mock.calls[0][0]).route).toBe('/v1/fixture/:id');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private-');
    warn.mockImplementation(() => { throw new Error('sink unavailable'); });
    expect((await app.request('/v1/fixture/abc')).status).toBe(503);
    expect(diagnosticRequestId('arbitrary-private-header')).toMatch(/^[0-9a-f-]{36}$/);
  });
});
