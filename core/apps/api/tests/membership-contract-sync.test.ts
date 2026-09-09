import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ reserve: vi.fn(), connection: vi.fn(), release: vi.fn(), tx: vi.fn(),
  transaction: vi.fn(), sync: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ sql: { reserve: mocks.reserve }, withTransaction: mocks.transaction }));
vi.mock('../src/payment/membership-contracts.js', () => ({ synchronizeMembershipContract: mocks.sync }));
import { runMembershipContractSyncOnce, startMembershipContractSync } from '../src/payment/membership-contract-sync.js';

describe('membership contract reconciliation worker', () => {
  let candidates: { id: string; wca_id: string; cancel: boolean }[];
  let current: { id: string; wca_id: string; cancel: boolean } | undefined;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('WECHAT_PAPAY_SYNC_ENABLED', 'true');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    candidates = [];
    Object.assign(mocks.connection, { release: mocks.release });
    mocks.reserve.mockResolvedValue(mocks.connection);
    mocks.connection.mockResolvedValue([{ locked: true }]);
    mocks.transaction.mockImplementation(async run => run(mocks.tx));
    mocks.tx.mockImplementation(async (statement: string) => {
      if (statement.includes('SELECT contract.id')) {
        current = candidates.shift();
        return current ? [current] : [];
      }
      if (statement.includes('UPDATE membership_contracts')) {
        return [{ cancellation_requested_at: current?.cancel ? '2026-09-09' : null }];
      }
      return [];
    });
    mocks.sync.mockResolvedValue({ syncStatus: 'verified' });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); });

  it.each(['', 'false', '1', 'TRUE'])('does nothing unless switch is exactly true (%s)', async value => {
    vi.stubEnv('WECHAT_PAPAY_SYNC_ENABLED', value);
    startMembershipContractSync()();
    await runMembershipContractSyncOnce();
    expect(mocks.reserve).not.toHaveBeenCalled();
  });

  it('uses one cross-process lock and releases the reserved connection when another worker owns it', async () => {
    mocks.connection.mockResolvedValue([{ locked: false }]);
    await runMembershipContractSyncOnce();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
    expect(mocks.connection).toHaveBeenCalledTimes(1);
  });

  it('queries normal contracts and only retries cancellation when intent already exists', async () => {
    candidates.push({ id: 'a', wca_id: 'u1', cancel: false }, { id: 'b', wca_id: 'u2', cancel: true });
    mocks.sync.mockRejectedValueOnce(new Error('provider unavailable'));
    await runMembershipContractSyncOnce();
    expect(mocks.sync.mock.calls).toEqual([['a', 'u1', false], ['b', 'u2', true]]);
    const statements = mocks.tx.mock.calls.map(([text]) => text);
    expect(statements[1]).toContain('FOR UPDATE OF account SKIP LOCKED');
    expect(statements[1]).toContain('ORDER BY contract.last_sync_attempt_at ASC NULLS FIRST');
    expect(statements[2]).toContain('last_sync_attempt_at = now()');
    expect(mocks.tx.mock.calls[2][1]).toEqual(['a', 'u1', 5]);
    expect(mocks.tx.mock.invocationCallOrder[2]).toBeLessThan(mocks.sync.mock.invocationCallOrder[0]);
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it('limits each run to ten sequential records and prevents overlapping local runs', async () => {
    candidates.push(...Array.from({ length: 15 }, (_, i) => ({ id: String(i), wca_id: `u${i}`, cancel: false })));
    let finish!: () => void;
    mocks.sync.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const first = runMembershipContractSyncOnce();
    await vi.waitFor(() => expect(mocks.sync).toHaveBeenCalledTimes(1));
    await runMembershipContractSyncOnce();
    expect(mocks.reserve).toHaveBeenCalledOnce();
    expect(mocks.sync).toHaveBeenCalledTimes(1);
    finish(); await first;
    expect(mocks.sync).toHaveBeenCalledTimes(10);
    expect(candidates).toHaveLength(5);
  });

  it('resets local overlap guard after database failure', async () => {
    mocks.reserve.mockRejectedValueOnce(new Error('offline'));
    await runMembershipContractSyncOnce();
    await runMembershipContractSyncOnce();
    expect(mocks.reserve).toHaveBeenCalledTimes(2);
    expect(mocks.release).toHaveBeenCalledOnce();
  });
});
