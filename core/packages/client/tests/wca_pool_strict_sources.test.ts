import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WcaSourceSpec } from '@/app/[lang]/timer/_lib/scramble/wca_pool';

const fetchByDifficultyMock = vi.hoisted(() => vi.fn());
const fetchPuzzleExamplesMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => `http://test${path}` }));
vi.mock('@/lib/timer-wca-difficulty-adapter', () => ({
  webTimerWcaDifficultyAdapter: {
    fetchByDifficulty: fetchByDifficultyMock,
    getCompetitionCoverage: vi.fn(() => null),
    probeCompetitionCoverage: vi.fn(async () => null),
  },
}));
vi.mock('@/lib/puzzle-examples', () => ({
  fetchPuzzleExamples: fetchPuzzleExamplesMock,
}));

const dateSpec: WcaSourceSpec = {
  event: '333',
  mode: 'date',
  comp: '',
  compName: '',
  round: '',
  group: '',
  from: '',
  to: '',
  optimal: false,
};

const competitionSpec: WcaSourceSpec = {
  ...dateSpec,
  mode: 'comp',
  comp: 'StrictComp2026',
  compName: 'Strict Competition 2026',
  diff: {
    variant: 'std',
    stage: 'cross',
    colors: 'W',
    steps: [5],
    merged: false,
  },
};

const valid333 = {
  scramble: "R U R'",
  ci: 'StrictComp2026',
  cn: 'Strict Competition 2026',
  e: '333',
  r: '1',
  g: 'A',
  n: 2,
  x: 0 as const,
};

async function freshPool() {
  vi.resetModules();
  return import('@/app/[lang]/timer/_lib/scramble/wca_pool');
}

beforeEach(() => {
  vi.unstubAllGlobals();
  fetchByDifficultyMock.mockReset();
  fetchPuzzleExamplesMock.mockReset();
  vi.stubGlobal('localStorage', undefined);
});

describe('WCA pool strict external-slot boundaries', () => {
  it('skips a strict-invalid random-live row and keeps a later valid row', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        scrambles: [
          { ...valid333, scramble: 'BAD', g: 'GROUP-TOO-LONG', n: 1 },
          valid333,
        ],
      }),
    })));
    const { nextWcaRow } = await freshPool();

    const row = await nextWcaRow(dateSpec);

    expect(row?.scramble).toBe(valid333.scramble);
    expect(row?.meta).toMatchObject({ ci: 'StrictComp2026', g: 'A', n: 2 });
  });

  it('skips a strict-invalid by-difficulty row and keeps a later valid row', async () => {
    fetchByDifficultyMock.mockResolvedValue({
      total: 2,
      page: 1,
      pageSize: 200,
      scrambles: [
        { ...valid333, scramble: 'BAD', r: 'round-too-long', n: 1 },
        valid333,
      ],
    });
    const { nextWcaRow } = await freshPool();

    const row = await nextWcaRow(competitionSpec);

    expect(row?.scramble).toBe(valid333.scramble);
    expect(row?.meta).toMatchObject({ ci: 'StrictComp2026', r: '1', n: 2 });
    expect(fetchByDifficultyMock).toHaveBeenCalledOnce();
  });

  it('skips a strict-invalid precomputed row and keeps a later valid row', async () => {
    const noBar = "R' U' F U F R' U2 F U2";
    fetchPuzzleExamplesMock.mockResolvedValue({
      meta: { generated_at: '2026-09-02T00:00:00.000Z' },
      puzzles: {
        '222': {
          types: { nobar: [['bad-slot', noBar], ['valid-slot', noBar]] },
          comps: {
            '!': ['Invalid Competition', '2026-01-01'],
            ValidComp2026: ['Valid Competition 2026', '2026-01-02'],
          },
          idMeta: {
            'bad-slot': ['!', '222', 1, '1', 'A', 0],
            'valid-slot': ['ValidComp2026', '222', 2, '1', 'A', 0],
          },
        },
      },
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
    const { nextWcaRow } = await freshPool();

    const row = await nextWcaRow({ ...dateSpec, event: '222', typeFilter: 'nobar' });

    expect(row?.scramble).toBe(noBar);
    expect(row?.meta).toMatchObject({ ci: 'ValidComp2026', e: '222', n: 2 });
    expect(fetchPuzzleExamplesMock).toHaveBeenCalledOnce();
  });
});
