import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_TIMER_WCA_SOURCE_SETTINGS,
  createTimerWcaDifficultyDataAdapter,
  normalizeTimerWcaSourceSettings,
  parseTimerWcaByDifficultyResult,
  timerWcaDifficultyFilter,
  timerWcaDifficultyUiModel,
  timerWcaRandomRequestQuery,
  timerWcaSourceIdentity,
  type TimerWcaHttpFetch,
} from '@cuberoot/shared/timer';

const jsonResponse = (value: unknown, status = 200) => new Response(
  JSON.stringify(value),
  { status, headers: { 'content-type': 'application/json' } },
);

describe('shared timer WCA difficulty contract', () => {
  it('migrates missing fields and canonicalizes hostile persisted values', () => {
    expect(normalizeTimerWcaSourceSettings(undefined)).toEqual(
      DEFAULT_TIMER_WCA_SOURCE_SETTINGS,
    );
    expect(normalizeTimerWcaSourceSettings({
      wcaUseOptimal: false,
      wcaDifficultyOn: true,
      wcaDiffVariant: ' std ',
      wcaDiffStage: ' cross ',
      wcaDiffColors: 'YW',
      wcaDiffSteps: [6, 4, 6, -1, 501],
      wcaDiffMerged: false,
    })).toMatchObject({
      wcaUseOptimal: false,
      wcaDifficultyOn: true,
      wcaDiffVariant: 'std',
      wcaDiffStage: 'cross',
      wcaDiffColors: 'WY',
      wcaDiffSteps: [4, 6],
      wcaDiffMerged: false,
    });
  });

  it('puts every effective field into identity and every request parameter into one query', () => {
    const settings = {
      ...DEFAULT_TIMER_WCA_SOURCE_SETTINGS,
      wcaScrambleMode: 'date' as const,
      wcaDateFrom: '2024-01-02',
      wcaDateTo: '2024-03-04',
      wcaDifficultyOn: true,
      wcaDiffSteps: [4, 5, 6],
    };
    const identity = timerWcaSourceIdentity('333', '333', settings);
    for (const patch of [
      { wcaUseOptimal: false },
      { wcaDiffVariant: 'eo' },
      { wcaDiffStage: 'xcross' },
      { wcaDiffColors: 'WY' },
      { wcaDiffSteps: [5, 6] },
      { wcaDiffMerged: false },
      { wcaDateTo: '2024-03-05' },
    ]) {
      expect(timerWcaSourceIdentity('333', '333', { ...settings, ...patch }))
        .not.toBe(identity);
    }
    expect(Object.fromEntries(timerWcaRandomRequestQuery('333', settings, 50))).toEqual({
      event: '333',
      count: '50',
      from: '2024-01-02',
      to: '2024-03-04',
      optimal: '1',
      variant: 'std',
      stage: 'cross',
      colors: 'BGORWY',
      steps: '4,5,6',
      family: '1',
    });
  });

  it('suppresses optimal for Length and only bypasses indexed methods on an unindexed comp', () => {
    const length = {
      ...DEFAULT_TIMER_WCA_SOURCE_SETTINGS,
      wcaDifficultyOn: true,
      wcaDiffVariant: 'length',
      wcaDiffStage: 'length',
      wcaDiffSteps: [18, 19],
    };
    const query = timerWcaRandomRequestQuery('333', length, 50);
    expect(query.has('optimal')).toBe(false);
    expect(query.get('variant')).toBe('length');
    expect(timerWcaDifficultyFilter('333', length, { competitionUnindexed: true }))
      .toMatchObject({ variant: 'length' });
    expect(timerWcaDifficultyFilter('333', {
      ...length,
      wcaDiffVariant: 'std',
      wcaDiffStage: 'cross',
    }, { competitionUnindexed: true })).toBeNull();
  });

  it('treats steps-layout 404 as a cached static fallback, never a fake error state', async () => {
    const calls = new Map<string, number>();
    const fetcher = vi.fn(async (url: string) => {
      calls.set(url, (calls.get(url) ?? 0) + 1);
      if (url.endsWith('/steps/steps_layout.json')) return jsonResponse({}, 404);
      if (url.endsWith('/event_lengths.json')) return jsonResponse({
        events: { 333: { counts: { 18: 1, 20: 1 } } },
      });
      return jsonResponse({ sets: {} });
    }) as TimerWcaHttpFetch;
    const adapter = createTimerWcaDifficultyDataAdapter({
      apiUrl: (path) => `https://api.test${path}`,
      fetcher,
      statsUrl: (path) => `https://stats.test${path}`,
    });
    const first = await adapter.loadCatalog();
    const second = await adapter.loadCatalog();
    expect(first.layout).toBeNull();
    expect(second.layout).toBeNull();
    expect(calls.get('https://stats.test/stats/scramble/steps/steps_layout.json')).toBe(1);
    const model = timerWcaDifficultyUiModel('333', {
      ...DEFAULT_TIMER_WCA_SOURCE_SETTINGS,
      wcaDifficultyOn: true,
    }, first);
    expect(model.variantOptions).toContain('std');
    expect(model.variantOptions).toContain('length');
  });

  it('deduplicates coverage in-flight, caches authoritative empty, and retries all-error probes', async () => {
    let difficultyCalls = 0;
    let failDifficulty = false;
    let failDifficultyBin: string | null = null;
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes('/distribution.json')) return jsonResponse({
        sets: { wca: { variants: { std: { data: { cross: { BGORWY: { min: 4, max: 5 } } } } } } },
      });
      if (url.includes('/by-difficulty?')) {
        difficultyCalls += 1;
        const query = new URL(url).searchParams;
        if (failDifficulty || query.get('bin') === failDifficultyBin) return jsonResponse({}, 503);
        if (query.get('names') === 'Partial Open 2026' && query.get('bin') === '4') {
          return jsonResponse({ total: 1, page: 1, pageSize: 1, scrambles: [] });
        }
        return jsonResponse({ total: 0, page: 1, pageSize: 1, scrambles: [] });
      }
      return jsonResponse({}, 404);
    }) as TimerWcaHttpFetch;
    const adapter = createTimerWcaDifficultyDataAdapter({
      apiUrl: (path) => `https://api.test${path}`,
      fetcher,
      statsUrl: (path) => `https://stats.test${path}`,
    });
    await expect(Promise.all([
      adapter.probeCompetitionCoverage('Empty2026', 'Empty Open 2026', '333'),
      adapter.probeCompetitionCoverage('Empty2026', 'Empty Open 2026', '333'),
    ])).resolves.toEqual([false, false]);
    expect(difficultyCalls).toBe(2);
    expect(adapter.getCompetitionCoverage('Empty2026', '333')).toBe(false);
    await adapter.probeCompetitionCoverage('Empty2026', 'Empty Open 2026', '333');
    expect(difficultyCalls).toBe(2);

    failDifficulty = true;
    await expect(adapter.probeCompetitionCoverage('Retry2026', 'Retry Open 2026', '333'))
      .resolves.toBeNull();
    expect(adapter.getCompetitionCoverage('Retry2026', '333')).toBeNull();
    failDifficulty = false;
    await expect(adapter.probeCompetitionCoverage('Retry2026', 'Retry Open 2026', '333'))
      .resolves.toBe(false);
    expect(difficultyCalls).toBe(6);

    failDifficultyBin = '5';
    await expect(adapter.probeCompetitionCoverage('Partial2026', 'Partial Open 2026', '333'))
      .resolves.toBeNull();
    expect(adapter.getCompetitionCoverage('Partial2026', '333')).toBeNull();
    failDifficultyBin = null;
    await expect(adapter.probeCompetitionCoverage('Partial2026', 'Partial Open 2026', '333'))
      .resolves.toBe(true);
    expect(adapter.getCompetitionCoverage('Partial2026', '333')).toBe(true);
    expect(difficultyCalls).toBe(10);
  });

  it('keeps malformed responses distinct from authoritative empty results', () => {
    expect(parseTimerWcaByDifficultyResult({ scrambles: [] })).toBeNull();
    expect(parseTimerWcaByDifficultyResult({
      total: 0,
      page: 1,
      pageSize: 200,
      scrambles: [],
    })).toEqual({ total: 0, page: 1, pageSize: 200, scrambles: [] });
  });
});
