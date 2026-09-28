import { afterEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
const mocks = vi.hoisted(() => ({ ensure: vi.fn(async () => {}), solve: vi.fn(async (_scramble: string, onState: (state: { phase: string }) => void) => { onState({ phase: 'active' }); return { htm: 1, solution: "R'" }; }), capture: vi.fn(async () => {}) }));
vi.mock('../src/cubeopt/daemon.js', () => ({ isEnabled: () => true, isConfigured: () => true, isReady: () => false, ensureDaemon: mocks.ensure, solveOptimal: mocks.solve, getLastLoadMs: () => 0, captureSolverDiagnostics: mocks.capture }));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAuth: async () => ({ isAdmin: true }) }));
import { cubeoptSolveRoutes } from '../src/routes/cubeopt_solve.js';
import { requestDiagnostics } from '../src/observability/request.js';
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); });
const id = '22222222-2222-4222-8222-222222222222';
const request = () => new Hono().use('*', requestDiagnostics).route('/v1', cubeoptSolveRoutes).request('/v1/scramble/optimal-solve', { method: 'POST', headers: { 'X-Request-ID': id, 'Content-Type': 'application/json', Authorization: 'Bearer private-token' }, body: JSON.stringify({ scrambles: ['R'] }) });
describe('CubeOpt SSE request diagnostics', () => {
  it('records terminal success and keeps request IDs without payloads or tokens', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const response = await request(); const body = await response.text();
    expect(body).toContain('"solution":"R\'"');
    const entries = log.mock.calls.map(call => JSON.parse(call[0]));
    expect(entries).toContainEqual(expect.objectContaining({ event: 'cubeopt_request_finished', requestId: id, count: 1, ok: 1, fail: 0, aborted: false }));
    expect(JSON.stringify(entries)).not.toContain('private-token');
    expect(JSON.stringify(entries)).not.toContain('solution');
  });
  it('reports slow table loading before completion and records failure counts', async () => {
    vi.useFakeTimers(); const log = vi.spyOn(console, 'log').mockImplementation(() => {}); const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let reject!: (error: Error) => void;
    mocks.ensure.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    const result = request().then(response => response.text());
    await vi.advanceTimersByTimeAsync(10001);
    expect(warn.mock.calls.map(call => JSON.parse(call[0]))).toContainEqual(expect.objectContaining({ event: 'cubeopt_request_slow', requestId: id, phase: 'loading' }));
    reject(new Error('private-backend-error')); await result;
    expect(warn.mock.calls.map(call => JSON.parse(call[0]))).toContainEqual(expect.objectContaining({ event: 'cubeopt_request_finished', ok: 0, fail: 1 }));
    expect(mocks.capture).toHaveBeenCalledWith('slow_request');
    expect(JSON.stringify([...log.mock.calls, ...warn.mock.calls])).not.toContain('private-backend-error');
  });
});
