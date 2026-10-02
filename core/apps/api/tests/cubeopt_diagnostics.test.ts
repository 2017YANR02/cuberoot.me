import { afterEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
const mocks = vi.hoisted(() => ({ ids: ['42', 'self'], files: new Map<string, string>(), services: vi.fn(async () => ({ stdout: 'backup.service loaded active running Hidden description\n', stderr: '' })) }));
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async (path: string) => { if (!mocks.files.has(path)) throw new Error('private-path'); return mocks.files.get(path)!; }),
  readdir: vi.fn(async () => mocks.ids),
}));
vi.mock('node:child_process', () => ({ execFile: Object.assign(vi.fn(), { [Symbol.for('nodejs.util.promisify.custom')]: mocks.services }) }));
import { createSolverDiagnostics, parseHost, parseProcess, sampleRates, traceSolverJob } from '../src/cubeopt/diagnostics.js';
import { requestDiagnostics } from '../src/observability/request.js';
const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); mocks.files.clear(); mocks.ids = ['42', 'self']; Object.defineProperty(process, 'platform', platform); });
function stat(major = 10, ticks = 100, start = 1000) {
  const f = Array(30).fill('0'); f[0] = 'S'; f[9] = String(major); f[11] = String(ticks); f[19] = String(start);
  return `42 (solver (worker)) ${f.join(' ')}`;
}
function host(ticks = 1000, wait = 10) { return `cpu ${ticks} 0 0 1000 ${wait} 0 0 0\ncpu0 1\ncpu1 1\ncpu2 1\ncpu3 1\n`; }
const status = 'Name:\tMainThread\nVmRSS:\t7000000 kB\nVmSwap:\t128000 kB\n';
const mem = 'MemAvailable: 5000000 kB\nSwapFree: 2000000 kB\n';
function fixture() {
  Object.defineProperty(process, 'platform', { value: 'linux' });
  for (const [p, text] of Object.entries({ '/proc/stat': host(), '/proc/meminfo': mem, '/proc/vmstat': 'pswpin 10\npswpout 20',
    '/proc/42/stat': stat(), '/proc/42/status': status, '/proc/42/cgroup': '11:memory:/system.slice/pm2-root.service\n',
    '/proc/sys/vm/swappiness': '0\n', '/sys/fs/cgroup/memory/system.slice/pm2-root.service/memory.swappiness': '60\n' })) mocks.files.set(p, text);
}
describe('CubeOpt forensic diagnostics', () => {
  it('retains the solver and counts SSH processes beyond the previous 4096-process limit', async () => {
    fixture();
    mocks.ids = [...Array.from({ length: 5000 }, (_, i) => String(1000 + i)), '42'];
    for (const id of mocks.ids.slice(0, 5000)) mocks.files.set(`/proc/${id}/status`, 'Name:\tsshd\nVmRSS:\t1000 kB\n');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const observer = createSolverDiagnostics(() => ({ solverPid: 42, ready: true, queueDepth: 0, activeJobId: null }));
    await observer.snapshot('periodic');
    expect(log.mock.calls.map(call => JSON.parse(call[0]))).toContainEqual(expect.objectContaining({
      event: 'cubeopt_snapshot', processCount: 5001, scannedProcessCount: 5001, truncated: false,
      processCounts: [{ name: 'sshd', count: 5000 }, { name: 'MainThread', count: 1 }],
      topMemory: expect.arrayContaining([expect.objectContaining({ pid: 42 })]),
    }));
    observer.stop();
  });
  it('handles parentheses and PID reuse and calculates real counter deltas', () => {
    expect(parseProcess(stat(), status)).toEqual({ state: 'S', startTicks: 1000, cpuTicks: 100, majorFaults: 10, rssKiB: 7000000, swapKiB: 128000 });
    const before = { at: 1000, solverPid: 42, process: parseProcess(stat(), status), host: parseHost(host(), mem, 'pswpin 10\npswpout 20') };
    const after = { at: 11000, solverPid: 42, process: parseProcess(stat(1010, 500), status), host: parseHost(host(4000, 1010), mem, 'pswpin 110\npswpout 220') };
    expect(sampleRates(before, after)).toEqual({ intervalMs: 10000, majorFaultsPerSecond: 100, cpuPercent: 40, ioWaitPercent: 25, swapInPagesPerSecond: 10, swapOutPagesPerSecond: 20 });
    expect(sampleRates(before, { ...after, process: parseProcess(stat(10000, 10000, 9999), status) }).majorFaultsPerSecond).toBeNull();
    expect(sampleRates(null, after).cpuPercent).toBeNull();
    expect(() => parseProcess('truncated', status)).toThrow();
  });
  it('records actual cgroup policy, rate-limits snapshots and retries observer failures', async () => {
    vi.useFakeTimers(); fixture();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const observer = createSolverDiagnostics(() => ({ solverPid: 42, ready: true, queueDepth: 0, activeJobId: null }));
    observer.start(); await vi.advanceTimersByTimeAsync(1);
    const entries = () => [...log.mock.calls, ...warn.mock.calls].map(call => JSON.parse(call[0]));
    expect(entries()).toContainEqual(expect.objectContaining({ event: 'cubeopt_sample', globalSwappiness: 0, cgroupSwappiness: 60, solver: expect.objectContaining({ swapKiB: 128000 }) }));
    expect(entries()).toContainEqual(expect.objectContaining({ event: 'cubeopt_snapshot', runningServices: ['backup.service'], topMemory: [expect.objectContaining({ pid: 42 })] }));
    await observer.snapshot('slow_job'); expect(entries().filter(e => e.event === 'cubeopt_snapshot')).toHaveLength(1);
    mocks.files.delete('/proc/stat'); await vi.advanceTimersByTimeAsync(10000);
    expect(entries()).toContainEqual(expect.objectContaining({ event: 'cubeopt_sample_unavailable' }));
    mocks.files.set('/proc/stat', host(4000, 1010)); mocks.files.set('/proc/42/stat', stat(10010, 500));
    await vi.advanceTimersByTimeAsync(10000);
    expect(warn.mock.calls.map(call => JSON.parse(call[0]))).toContainEqual(expect.objectContaining({ event: 'cubeopt_sample', majorFaultsPerSecond: 500 }));
    await vi.advanceTimersByTimeAsync(41000); expect(entries().filter(e => e.event === 'cubeopt_snapshot')).toHaveLength(2);
    observer.stop(); const length = entries().length; await vi.advanceTimersByTimeAsync(60000); expect(entries()).toHaveLength(length);
    expect(JSON.stringify(entries())).not.toContain('private-path'); expect(JSON.stringify(entries())).not.toContain('Hidden description');
  });
  it('separates load, queue and solve timing and correlates requests without contents', async () => {
    vi.useFakeTimers(); const log = vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {});
    const capture = vi.fn(async () => {}); let trace!: ReturnType<typeof traceSolverJob>;
    const app = new Hono().use('*', requestDiagnostics).get('/trace', c => { trace = traceSolverJob('17', capture); return c.text('ok'); });
    const id = '11111111-1111-4111-8111-111111111111';
    await app.request('/trace?secret=private-scramble', { headers: { 'X-Request-ID': id } });
    await vi.advanceTimersByTimeAsync(2000); trace.queued(1); await vi.advanceTimersByTimeAsync(4000); trace.started();
    await vi.advanceTimersByTimeAsync(3000); trace.finish('success', 18); trace.finish('failed'); await vi.advanceTimersByTimeAsync(10000);
    const finish = log.mock.calls.map(call => JSON.parse(call[0])).filter(e => e.event === 'cubeopt_job_finished');
    expect(finish).toHaveLength(1); expect(finish[0]).toMatchObject({ requestId: id, jobId: '17', loadMs: 2000, queueMs: 4000, solveMs: 3000, totalMs: 9000, htm: 18, outcome: 'success' });
    expect(capture).not.toHaveBeenCalled(); expect(JSON.stringify(log.mock.calls)).not.toContain('private-scramble');
  });
  it('captures pending jobs before completion and settles a timeout once', async () => {
    vi.useFakeTimers(); vi.spyOn(console, 'log').mockImplementation(() => {}); const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const capture = vi.fn(async () => {}); const trace = traceSolverJob('18', capture); trace.queued(2);
    await vi.advanceTimersByTimeAsync(10000);
    expect(warn.mock.calls.map(call => JSON.parse(call[0]))).toContainEqual(expect.objectContaining({ event: 'cubeopt_job_slow', phase: 'queued', queueMs: 10000, solveMs: null }));
    expect(capture).toHaveBeenCalledWith('slow_job'); trace.finish('queue_timeout'); trace.finish('failed');
    expect(warn.mock.calls.map(call => JSON.parse(call[0])).filter(e => e.event === 'cubeopt_job_finished')).toHaveLength(1);
    expect(capture).toHaveBeenCalledWith('queue_timeout');
  });
});
