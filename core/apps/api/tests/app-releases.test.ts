import { describe, expect, it, vi } from 'vitest';
import { HTTPException } from 'hono/http-exception';
import { Hono } from 'hono';
import { createReleaseService } from '../src/releases/service.js';
import { createAppReleaseRoutes } from '../src/routes/app_releases.js';

const request = { requestId: '12345678-1234-4234-8234-123456789012', platform: 'both' as const, commit: 'a'.repeat(40), notes: 'Update timer' };
function setup(failDispatch = false) {
  let receipts: any[] = [];
  let history: any[] = [];
  const github = vi.fn(async (path: string) => {
    if (path.endsWith('/dispatches')) { if (failDispatch) throw new Error('Network timeout'); return null; }
    if (path.startsWith('git/')) return { object: { sha: request.commit } };
    return { workflow_runs: history };
  });
  const service = createReleaseService({ configured: () => true, github,
    load: async () => structuredClone(receipts), save: async rows => { receipts = structuredClone(rows); }, locked: async fn => fn(),
  });
  return { service, github, setHistory: (rows: any[]) => { history = rows; }, receipts: () => receipts };
}
describe('administrator release orchestration', () => {
  it('dispatches exact main once and preserves an idempotent receipt', async () => {
    const { service, github } = setup();
    expect(await service.dispatch(request, 'admin')).toMatchObject({ state: 'accepted' });
    await service.dispatch(request, 'admin');
    expect(github.mock.calls.filter(([path]) => path.endsWith('/dispatches'))).toHaveLength(1);
    expect(github).toHaveBeenCalledWith('actions/workflows/app_release.yml/dispatches', { ref: 'main', inputs: { request_id: request.requestId, source_commit: request.commit, platform: 'both', notes: request.notes } });
    await expect(service.dispatch({ ...request, notes: 'different' }, 'admin')).rejects.toThrow('identity conflict');
  });
  it('rejects stale main and preserves unknown network outcomes without redispatch', async () => {
    const { service, github } = setup(true);
    await expect(service.dispatch({ ...request, commit: 'b'.repeat(40) }, 'admin')).rejects.toThrow('Main changed');
    expect(await service.dispatch(request, 'admin')).toMatchObject({ state: 'unknown' });
    await service.dispatch(request, 'admin');
    expect(github.mock.calls.filter(([path]) => path.endsWith('/dispatches'))).toHaveLength(1);
    await expect(service.dispatch({ ...request, requestId: '22345678-1234-4234-8234-123456789012' }, 'admin')).rejects.toThrow('awaiting confirmation');
  });
  it('reconciles a completed run durably so history pagination cannot block future releases', async () => {
    const { service, setHistory, receipts } = setup();
    await service.dispatch(request, 'admin');
    setHistory([{ id: 1, run_number: 1, display_title: `App release ${request.requestId}`, status: 'completed', conclusion: 'success', created_at: '2026-10-25' }]);
    expect((await service.status()).pending).toBeNull();
    expect(receipts()[0].state).toBe('completed');
    setHistory([]);
    await expect(service.dispatch({ ...request, requestId: '22345678-1234-4234-8234-123456789012' }, 'admin')).resolves.toMatchObject({ state: 'accepted' });
  });
  it('authorizes reads and writes before touching the release service', async () => {
    const service = { status: vi.fn(), dispatch: vi.fn() };
    const app = createAppReleaseRoutes({ service, authorize: async () => { throw new HTTPException(403); } });
    expect((await app.request('/admin/app-releases')).status).toBe(403);
    expect((await app.request('/admin/app-releases', { method: 'POST', body: JSON.stringify(request) })).status).toBe(403);
    expect(service.status).not.toHaveBeenCalled(); expect(service.dispatch).not.toHaveBeenCalled();
  });
  it('rejects malformed input and hides provider details on status failure', async () => {
    const service = { status: vi.fn().mockRejectedValue(new Error('secret')), dispatch: vi.fn() };
    const app = createAppReleaseRoutes({ service, authorize: async () => ({ wcaId: 'admin' }) });
    const response = await app.request('/admin/app-releases');
    expect(response.status).toBe(502); expect(await response.text()).not.toContain('secret');
    expect((await app.request('/admin/app-releases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...request, platform: 'macos' }) })).status).toBe(400);
    expect(service.dispatch).not.toHaveBeenCalled();
  });
  it('preserves release status codes under the API root error handler', async () => {
    const service = { status: vi.fn(), dispatch: vi.fn().mockRejectedValue(new HTTPException(409, { message: 'Main changed' })) };
    const app = new Hono();
    app.onError((_error, c) => c.json({ error: 'root failure' }, 500));
    app.route('/v1', createAppReleaseRoutes({ service, authorize: async () => ({ wcaId: 'admin' }) }));
    const response = await app.request('/v1/admin/app-releases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
    expect(response.status).toBe(409);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
});
