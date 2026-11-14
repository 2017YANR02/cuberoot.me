import { afterEach, describe, expect, it, vi } from 'vitest';
import { planReconCompletionUpdate, type CompletionRow } from '../src/utils/recon_completion_backfill';
import { revalidateReconPages } from '../src/utils/recon_revalidate';

const row: CompletionRow = { id: 2967, event: '7x7', record_type: 'reconstruction',
  optimal_scramble: '', wca_scramble: 'R', scramble: '', solution: "R' (R U R' U)5",
  completion_status: 'unsolved', unsolved_reason: '不知道🤷' };

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('historical reconstruction completion', () => {
  it('repairs visible solved states and clears only their obsolete reason', async () => {
    const original = structuredClone(row);
    expect(await planReconCompletionUpdate(row)).toEqual({ before: original,
      after: { completion_status: 'solved', unsolved_reason: null } });
    expect(row).toEqual(original);
    expect(await planReconCompletionUpdate({ ...row, completion_status: 'solved', unsolved_reason: null })).toBeNull();
  });
  it('keeps genuine unsolved explanations and does not downgrade unavailable checks', async () => {
    expect(await planReconCompletionUpdate({ ...row, solution: '' })).toBeNull();
    expect(await planReconCompletionUpdate({ ...row, event: 'Gear' })).toBeNull();
    expect(await planReconCompletionUpdate({ ...row, record_type: 'timing' }))
      .toMatchObject({ after: { completion_status: 'unchecked', unsolved_reason: row.unsolved_reason } });
  });
  it('waits for both deployed Next caches to accept invalidation', async () => {
    vi.stubEnv('RECON_REVALIDATE_SECRET', 'test-secret');
    vi.stubEnv('RECON_REVALIDATE_URLS', 'https://one.test/revalidate,https://two.test/revalidate');
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ revalidated: true }) });
    vi.stubGlobal('fetch', fetch);
    await revalidateReconPages(2967, { strict: true });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][1].body).toBe('{"kind":"recon","id":"2967"}');
    fetch.mockResolvedValue({ ok: false });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(revalidateReconPages(2967, { strict: true })).rejects.toThrow('invalidation failed');
    // Normal form saves retain their existing best-effort cache behaviour.
    await expect(revalidateReconPages(2967)).resolves.toBeUndefined();
  });
});
