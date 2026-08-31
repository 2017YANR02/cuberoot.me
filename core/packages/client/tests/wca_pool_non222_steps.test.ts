import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WcaSourceSpec } from '@/app/[lang]/timer/_lib/scramble/wca_pool';

const fetchWcaScramblesMock = vi.hoisted(() => vi.fn());
const filterNon222Mock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/wca-results-api', () => ({
  fetchWcaScrambles: fetchWcaScramblesMock,
}));
vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => `http://test${path}` }));
vi.mock('@/app/[lang]/timer/_lib/scramble/non222-steps-pool', () => ({
  filterWebNon222BySteps: filterNon222Mock,
}));

function compSpec(event: 'pyra' | 'skewb', metric: string): WcaSourceSpec {
  return {
    event,
    mode: 'comp',
    comp: `Exact${event}2026`,
    compName: `Exact ${event} 2026`,
    round: '',
    group: '',
    from: '',
    to: '',
    optimal: false,
    stepFilter: { metric, lo: 7, hi: 9 },
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  fetchWcaScramblesMock.mockReset();
  filterNon222Mock.mockReset();
  vi.stubGlobal('localStorage', undefined);
});

describe('Web WCA non-2x2 step filters', () => {
  it.each([
    ['pyra', 'pyram', 'cube'],
    ['skewb', 'skewb', 'htm'],
  ] as const)('filters an entire %s competition through the shared Worker predicate', async (
    event,
    wcaEvent,
    metric,
  ) => {
    fetchWcaScramblesMock.mockResolvedValue([
      {
        event_id: wcaEvent, round_type_id: '1', group_id: 'A', is_extra: false,
        scramble_num: 1, scramble: 'OUTSIDE', optimal_scramble: null,
      },
      {
        event_id: wcaEvent, round_type_id: '1', group_id: 'A', is_extra: false,
        scramble_num: 2, scramble: 'INSIDE', optimal_scramble: null,
      },
    ]);
    filterNon222Mock.mockImplementation(async (_event, rows) => rows.slice(1));
    const { nextWcaRow } = await import('@/app/[lang]/timer/_lib/scramble/wca_pool');
    const spec = compSpec(event, metric);

    const row = await nextWcaRow(spec);
    expect(row?.scramble).toBe('INSIDE');
    expect(row?.meta?.n).toBe(2);
    expect(filterNon222Mock).toHaveBeenCalledWith(
      event,
      expect.arrayContaining([
        expect.objectContaining({ scramble: 'OUTSIDE' }),
        expect.objectContaining({ scramble: 'INSIDE' }),
      ]),
      spec.stepFilter,
      expect.any(AbortSignal),
    );
  });

  it('batch-filters date samples before queueing or remembering provenance', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('puzzle_examples.json')) {
        return { ok: false, status: 503, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          scrambles: [
            { scramble: 'OUTSIDE', ci: 'Date2026', cn: 'Date 2026', e: 'pyram', r: '1', g: 'A', n: 1, x: 0 },
            { scramble: 'INSIDE', ci: 'Date2026', cn: 'Date 2026', e: 'pyram', r: '1', g: 'A', n: 2, x: 0 },
          ],
        }),
      };
    }));
    filterNon222Mock.mockImplementation(async (_event, rows) => rows.slice(1));
    const { nextWcaRow } = await import('@/app/[lang]/timer/_lib/scramble/wca_pool');
    const spec: WcaSourceSpec = {
      ...compSpec('pyra', 'cube'),
      mode: 'date',
      comp: '',
      compName: '',
      from: '2020-01-01',
      to: '2026-01-01',
    };

    const row = await nextWcaRow(spec);
    expect(row?.scramble).toBe('INSIDE');
    expect(row?.meta?.n).toBe(2);
    expect(filterNon222Mock).toHaveBeenCalledWith(
      'pyra',
      expect.any(Array),
      spec.stepFilter,
      expect.any(AbortSignal),
    );
  });
});
