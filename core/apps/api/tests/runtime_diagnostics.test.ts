import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => {
  const end = vi.fn(async () => {});
  const query = Object.assign(vi.fn(async () => [{ state: 'active', blocked: 2, longest_active_seconds: 8 }]), { end });
  return { query, end, postgres: vi.fn(() => query), disk: vi.fn(async () => ({ bavail: 100, blocks: 10000, bsize: 1048576 })) };
});
vi.mock('postgres', () => ({ default: mocks.postgres }));
vi.mock('node:fs/promises', () => ({ statfs: mocks.disk }));
import { startRuntimeDiagnostics } from '../src/observability/runtime.js';

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe('runtime diagnostics', () => {
  it('records lock waits and low disk space and closes the read-only observer', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const stop = startRuntimeDiagnostics();
    await vi.advanceTimersByTimeAsync(30001);
    expect(mocks.postgres).toHaveBeenCalledWith(expect.objectContaining({ max: 1, connect_timeout: 2,
      connection: expect.objectContaining({ default_transaction_read_only: true, statement_timeout: 1500 }) }));
    const warnings = warn.mock.calls.map(call => JSON.parse(call[0]));
    expect(warnings).toContainEqual(expect.objectContaining({ event: 'database_activity', groups: [expect.objectContaining({ blocked: 2 })] }));
    expect(warnings).toContainEqual(expect.objectContaining({ event: 'host_disk', availableMiB: 100 }));
    expect(log.mock.calls.map(call => JSON.parse(call[0]))).toContainEqual(expect.objectContaining({ event: 'api_runtime', eventLoopMaxMs: expect.any(Number), rssMiB: expect.any(Number) }));
    expect(mocks.end).toHaveBeenCalledWith({ timeout: 0 });
    await stop();
    await vi.advanceTimersByTimeAsync(60000);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it('keeps runtime evidence and retries on the next interval when database collection fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    mocks.query.mockRejectedValueOnce(new Error('private-database-address-and-credentials'));
    const stop = startRuntimeDiagnostics();
    await vi.advanceTimersByTimeAsync(60001);
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls.map(call => JSON.parse(call[0]))).toContainEqual(expect.objectContaining({ event: 'database_observer_unavailable' }));
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private-');
    await stop();
  });
  it('terminates a stuck observer after three seconds', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    let rejectQuery!: (error: Error) => void;
    mocks.query.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectQuery = reject; }));
    mocks.end.mockImplementationOnce(async () => { rejectQuery(new Error('connection destroyed')); });
    const stop = startRuntimeDiagnostics();
    await vi.advanceTimersByTimeAsync(33001);
    expect(mocks.end).toHaveBeenCalledWith({ timeout: 0 });
    await stop();
  });
});
