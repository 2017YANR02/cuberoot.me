import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAttempts, fetchResultRow } from '@/lib/wca-results-api';

afterEach(() => vi.unstubAllGlobals());

describe('WCA attempts imported into recon', () => {
  it.each([
    ['333fm', [17, 18, -1, -2, 0], [17, 18, -1, -2, null]],
    ['333', [1700, 1800, -1, -2, 0], [17, 18, -1, -2, null]],
  ] as const)('uses correct single units for %s in both import paths', async (event, raw, expected) => {
    const compId = `UnitTest-${event}`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      id: compId,
      rounds: [{ roundTypeId: 'f', results: [{ wca_id: 'person', attempts: raw }] }],
    }) }));
    expect(await fetchAttempts(compId, event, 'f', 'person')).toEqual(expected);
    const row = await fetchResultRow(compId, event, 'f', 'person');
    expect(row?.attempts).toEqual(expected);
    expect(row?.bestIndex).toBe(0);
  });
});
