import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class FakeWorker {
  static all: FakeWorker[] = [];
  onmessage?: (e: { data: Record<string, unknown> }) => void;
  onerror?: (e: { message: string }) => void;
  messages: Record<string, unknown>[] = [];
  terminated = false;
  constructor(readonly url: string) { FakeWorker.all.push(this); }
  postMessage(msg: Record<string, unknown>) { this.messages.push(msg); }
  terminate() { this.terminated = true; }
  send(data: Record<string, unknown>) { this.onmessage?.({ data }); }
}
const tick = () => Promise.resolve();
const worker = (mode: string) => FakeWorker.all.find((w) => w.messages[0]?.mode === mode)!;
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); FakeWorker.all = [];
  vi.stubGlobal('Worker', FakeWorker);
  vi.stubGlobal('location', { origin: 'https://example.test' });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('XCross acquisition lifecycle', () => {
  it('uses a cache hit without starting generation', async () => {
    const { claimXCrossTable } = await import('@/lib/rust-cross-tables');
    const promise = claimXCrossTable(new AbortController().signal);
    await tick();
    const bytes = new ArrayBuffer(16);
    worker('download').send({ type: 'ready', source: 'cache', bytes });
    expect(await promise).toBe(bytes);
    expect(FakeWorker.all).toHaveLength(1);
    expect(worker('download').messages[1]).toEqual({ type: 'persist' });
    worker('download').send({ type: 'stored' });
    expect(worker('download').terminated).toBe(true);
  });
  it.each(['download', 'generate'])('accepts %s first, terminates the loser and ignores late results', async (winner) => {
    const { claimXCrossTable, onXCrossProgress } = await import('@/lib/rust-cross-tables');
    const progress = vi.fn(); onXCrossProgress(progress);
    const a = claimXCrossTable(new AbortController().signal);
    const b = claimXCrossTable(new AbortController().signal);
    await tick();
    worker('download').send({ type: 'cache_miss' });
    expect(FakeWorker.all).toHaveLength(2);
    const bytes = new ArrayBuffer(8);
    const loser = worker(winner === 'download' ? 'generate' : 'download');
    worker(winner).send({ type: 'ready', source: winner === 'generate' ? 'generated' : 'download', bytes });
    loser.send({ type: 'ready', source: 'cache', bytes: new ArrayBuffer(1) });
    expect(await a).toBe(bytes); expect(await b).toBe(bytes);
    expect(loser.terminated).toBe(true);
    expect(progress.mock.lastCall![0].source).toBe(winner === 'generate' ? 'generated' : 'download');
    await vi.advanceTimersByTimeAsync(5000);
    expect(worker(winner).terminated).toBe(true);
  });
  it('cancels only after every consumer leaves, and can retry', async () => {
    const { claimXCrossTable } = await import('@/lib/rust-cross-tables');
    const ac = new AbortController(), bc = new AbortController();
    const a = claimXCrossTable(ac.signal).catch((e) => e.name);
    const b = claimXCrossTable(bc.signal).catch((e) => e.name);
    await tick(); worker('download').send({ type: 'cache_miss' });
    ac.abort(); expect(await a).toBe('AbortError');
    expect(worker('download').terminated).toBe(false);
    bc.abort(); expect(await b).toBe('AbortError');
    expect(FakeWorker.all.every((w) => w.terminated)).toBe(true);
    const c = claimXCrossTable(new AbortController().signal);
    await tick();
    FakeWorker.all.at(-1)!.send({ type: 'ready', source: 'cache', bytes: new ArrayBuffer(4) });
    expect((await c).byteLength).toBe(4);
  });
  it('reports both failures and allows retry', async () => {
    const { claimXCrossTable } = await import('@/lib/rust-cross-tables');
    const result = claimXCrossTable(new AbortController().signal).catch((e) => e.message);
    await tick(); worker('download').send({ type: 'error', error: 'network offline' });
    expect(worker('generate')).toBeDefined();
    worker('generate').send({ type: 'error', error: 'WASM unavailable' });
    expect(await result).toBe('XCross: network offline; WASM unavailable');
    const retry = claimXCrossTable(new AbortController().signal);
    await tick();
    FakeWorker.all.at(-1)!.send({ type: 'ready', source: 'cache', bytes: new ArrayBuffer(4) });
    expect((await retry).byteLength).toBe(4);
  });
  it('starts generation when persistent storage stalls', async () => {
    const { claimXCrossTable } = await import('@/lib/rust-cross-tables');
    const ac = new AbortController();
    const result = claimXCrossTable(ac.signal).catch((e) => e.name);
    await vi.advanceTimersByTimeAsync(200);
    expect(worker('generate')).toBeDefined();
    ac.abort(); expect(await result).toBe('AbortError');
  });
  it('does not mark the pool ready or submit stale work when acquisition is aborted', async () => {
    const { createRustCrossPool } = await import('@/lib/rust-cross-client');
    const pool = createRustCrossPool(1);
    const solver = FakeWorker.all[0];
    solver.send({ type: 'ready' }); await pool.ready;
    const job = pool.solveFace('R U', 1, 0).catch((e) => e.message);
    await tick(); expect(pool.hasXCross()).toBe(false);
    pool.abort();
    expect(await job).toBe('XCross table acquisition cancelled');
    expect(solver.terminated).toBe(true);
    expect(solver.messages.some((m) => m.type === 'face')).toBe(false);
    const retry = pool.ensureXCross(); await tick();
    const nextSolver = FakeWorker.all.find((w) => w !== solver && w.url.includes('cross-solver-worker'))!;
    FakeWorker.all.at(-1)!.send({ type: 'ready', source: 'cache', bytes: new ArrayBuffer(4) });
    await tick(); await tick(); nextSolver.send({ type: 'ready' });
    await retry; expect(pool.hasXCross()).toBe(true); pool.terminate();
  });
  it('rejects a failed attachment instead of leaving the waiting job pending', async () => {
    const { createRustCrossPool } = await import('@/lib/rust-cross-client');
    const pool = createRustCrossPool(1);
    const solver = FakeWorker.all[0];
    solver.send({ type: 'ready' }); await pool.ready;
    const result = pool.ensureXCross().catch((e) => e.message);
    await tick();
    worker('download').send({ type: 'ready', source: 'cache', bytes: new ArrayBuffer(4) });
    await tick(); await tick();
    const attach = solver.messages.find((m) => m.type === 'ensure_xcross')!;
    solver.send({ type: 'error', operation: 'ensure_xcross', id: attach.id, error: 'out of memory' });
    expect(await result).toBe('XCross worker unavailable');
    expect(pool.hasXCross()).toBe(false);
    expect(solver.terminated).toBe(true);
    pool.terminate();
  });
  it('does not start workers when the caller is already cancelled', async () => {
    const { claimXCrossTable } = await import('@/lib/rust-cross-tables');
    const controller = new AbortController(); controller.abort();
    await expect(claimXCrossTable(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(FakeWorker.all).toHaveLength(0);
  });

});
