// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { normalizeTimerRankScopes, type Solve } from '@cuberoot/shared/timer';
import RankBadge, { type RankBadgeProps } from '@/app/[lang]/timer/_shell/RankBadge';
import { fetchRankFor } from '@/lib/rank-client';
import { getSettings, updateSettings } from '@/app/[lang]/timer/_lib/settings';

vi.mock('@/lib/rank-client', () => ({ fetchRankFor: vi.fn() }));
const host = document.createElement('div');
let root = createRoot(host);
const solve = (timeMs: number, penalty: Solve['penalty'] = 'ok'): Solve => ({
  id: String(timeMs), event: '333', timeMs, penalty, ts: 1, scramble: '',
});
async function render(props: Partial<RankBadgeProps>) {
  await act(async () => root.render(createElement(RankBadge, {
    eventId: '333', centis: 1000, type: 'single', ...props,
  })));
  return host.textContent;
}
afterEach(async () => {
  await act(async () => root.unmount());
  root = createRoot(host);
  vi.clearAllMocks();
});

it('normalizes old/malformed preferences and persists explicit all-off', () => {
  expect(normalizeTimerRankScopes(undefined)).toEqual(['PR', 'NR', 'CR', 'WR']);
  expect(normalizeTimerRankScopes(['NR', 'NR', 'invalid'])).toEqual(['NR']);
  expect(normalizeTimerRankScopes([])).toEqual([]);
  updateSettings({ showRankBadge: false, rankScopes: [] });
  expect(getSettings().showRankBadge).toBe(false);
  expect(JSON.parse(localStorage.getItem('cuberoot-timer.settings.v1')!).rankScopes).toEqual([]);
});

it('ranks current-session singles with ties and penalties, without network requests', async () => {
  const solves = [solve(9000), solve(8000, '+2'), solve(10004), solve(1, 'DNF'), solve(1, 'DNS'), solve(0), solve(NaN)];
  expect(await render({ scopes: ['PR'], solves })).toBe('PR2');
  expect(fetchRankFor).not.toHaveBeenCalled();
  expect(await render({ scopes: [], solves })).toBe('');
  expect(await render({ scopes: ['PR'], solves, centis: null })).toBe('');
  expect(await render({ scopes: ['PR'], solves: [] })).toBe('');
  expect(await render({ scopes: ['PR'], solves, eventId: '333fm' })).toBe('');
  expect(await render({ scopes: ['PR'], solves, eventId: '333mbld' })).toBe('');
});

it('honors scope selection even for record ranks and keeps PR when WCA is unavailable', async () => {
  vi.mocked(fetchRankFor).mockResolvedValue({
    world: { rank: 1, total: 100 }, continental: { rank: 1, total: 20 }, national: { rank: 1, total: 10 },
  });
  expect(await render({ country: 'CN', scopes: ['WR', 'CR', 'NR'] })).toBe('WR/AsR/NR');
  expect(await render({ country: 'CN', scopes: ['NR'] })).toBe('NR');
  expect(await render({ country: '', scopes: ['NR', 'CR'] })).toBe('');
  vi.mocked(fetchRankFor).mockResolvedValue(null);
  expect(await render({ country: 'CN', centis: 1001, scopes: ['PR', 'WR'], solves: [solve(9000)] })).toBe('PR2');
});
