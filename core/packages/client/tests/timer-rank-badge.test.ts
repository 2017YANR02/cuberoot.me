// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { normalizeTimerRankScopes } from '@cuberoot/shared/timer';
import RankBadge, { type RankBadgeProps } from '@/app/[lang]/timer/_shell/RankBadge';
import { fetchRankFor } from '@/lib/rank-client';
import { getSettings, updateSettings } from '@/app/[lang]/timer/_lib/settings';
import { fetchWcaPersonResults, type WcaResultRow } from '@/lib/wca-person-api';

vi.mock('@/lib/rank-client', () => ({ fetchRankFor: vi.fn() }));
vi.mock('@/lib/wca-person-api', () => ({ fetchWcaPersonResults: vi.fn() }));
const host = document.createElement('div');
let root = createRoot(host);
const result = (attempts: number[], overrides: Partial<WcaResultRow> = {}): WcaResultRow => ({
  competition_id: 'Test2026', event_id: '333', round_type_id: 'f', format_id: 'a',
  best: 900, average: 1100, pos: 1, attempts, ...overrides,
});
async function render(props: Partial<RankBadgeProps>) {
  await act(async () => root.render(createElement(RankBadge, {
    eventId: '333', centis: 1000, type: 'single', wcaId: '2017YANR02', ...props,
  })));
  return host.textContent;
}
beforeEach(() => {
  vi.mocked(fetchWcaPersonResults).mockResolvedValue([]);
});
afterEach(async () => {
  await act(async () => root.unmount());
  root = createRoot(host);
  vi.resetAllMocks();
});

it('normalizes old/malformed preferences and persists explicit all-off', () => {
  expect(normalizeTimerRankScopes(undefined)).toEqual(['PR', 'NR', 'CR', 'WR']);
  expect(normalizeTimerRankScopes(['NR', 'NR', 'invalid'])).toEqual(['NR']);
  expect(normalizeTimerRankScopes([])).toEqual([]);
  updateSettings({ rankScopes: [] });
  expect(getSettings().rankScopes).toEqual([]);
  expect(JSON.parse(localStorage.getItem('cuberoot-timer.settings.v1')!).rankScopes).toEqual([]);
});

it('ranks all personal official attempts with ties, excluding invalid, live and other-event results', async () => {
  vi.mocked(fetchWcaPersonResults).mockResolvedValue([
    result([900, 1000, 1000, -1, -2, 0, NaN]),
    result([100], { live: true }),
    result([100], { event_id: '222' }),
  ]);
  expect(await render({ scopes: ['PR'] })).toBe('PR2');
  expect(fetchWcaPersonResults).toHaveBeenCalledWith('2017YANR02');
  expect(fetchRankFor).not.toHaveBeenCalled();
  expect(await render({ scopes: ['PR'], centis: 264 })).toBe('PR');
  expect(await render({ scopes: ['PR'], type: 'average', centis: 1200 })).toBe('PR2');
  expect(await render({ scopes: [] })).toBe('');
  expect(await render({ scopes: ['PR'], centis: null })).toBe('');
  expect(await render({ scopes: ['PR'], wcaId: '' })).toBe('');
  expect(await render({ scopes: ['PR'], wcaId: 'invalid' })).toBe('');
  expect(await render({ scopes: ['PR'], eventId: '333fm' })).toBe('');
  expect(await render({ scopes: ['PR'], eventId: '333mbld' })).toBe('');
});

it('shows only the highest selected record and compares official personal results', async () => {
  vi.mocked(fetchWcaPersonResults).mockResolvedValue([result([900])]);
  vi.mocked(fetchRankFor).mockResolvedValue({
    world: { rank: 1, total: 100 }, continental: { rank: 1, total: 20 }, national: { rank: 1, total: 10 },
  });
  expect(await render({ country: 'CN', scopes: ['WR', 'CR', 'NR', 'PR'], centis: 264 })).toBe('WR');
  expect(await render({ country: 'CN', scopes: ['WR', 'CR', 'NR'] })).toBe('WR');
  expect(await render({ country: 'CN', scopes: ['PR', 'NR', 'CR'] })).toBe('AsR');
  expect(await render({ country: 'CN', scopes: ['NR'] })).toBe('NR');
  expect(await render({ country: '', scopes: ['NR', 'CR'] })).toBe('');
  vi.mocked(fetchRankFor).mockResolvedValue(null);
  expect(await render({ country: 'CN', centis: 1001, scopes: ['PR', 'WR'] })).toBe('PR2');
});

it('hides smaller scopes below a record while retaining higher ordinary ranks in order', async () => {
  vi.mocked(fetchWcaPersonResults).mockResolvedValue([result([900])]);
  const ranks = async (national: number, continental: number, world: number, centis: number) => {
    vi.mocked(fetchRankFor).mockResolvedValue({
      national: { rank: national, total: 10 },
      continental: { rank: continental, total: 20 },
      world: { rank: world, total: 100 },
    });
    return render({ country: 'CN', centis });
  };
  expect(await ranks(1, 1, 3, 800)).toBe('AsR/WR3');
  expect(await ranks(1, 2, 3, 801)).toBe('NR/AsR2/WR3');
  expect(await ranks(2, 3, 4, 802)).toBe('PR/NR2/AsR3/WR4');
  expect(await ranks(3, 4, 5, 1000)).toBe('PR2/NR3/AsR4/WR5');
});

it('hides PR when official results are unavailable or an account changes', async () => {
  expect(await render({ scopes: ['PR'] })).toBe('');
  vi.mocked(fetchWcaPersonResults).mockRejectedValueOnce(new Error('offline'));
  expect(await render({ scopes: ['PR'], wcaId: '2009ZEMD01' })).toBe('');
  vi.mocked(fetchWcaPersonResults).mockResolvedValueOnce([result([900])]);
  expect(await render({ scopes: ['PR'] })).toBe('PR2');
  let finish!: (rows: WcaResultRow[]) => void;
  vi.mocked(fetchWcaPersonResults).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  expect(await render({ scopes: ['PR'], wcaId: '2009ZEMD01' })).toBe('');
  expect(await render({ scopes: ['PR'], wcaId: '' })).toBe('');
  await act(async () => finish([result([900])]));
  expect(host.textContent).toBe('');
});
