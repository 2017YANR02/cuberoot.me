// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SkewbOdds from '@/app/[lang]/math/probability/_components/SkewbOdds';
import { changeAppLanguage } from '@/i18n/i18n-client';
import { groupDigits } from '@/lib/group-digits';
import { SKEWB_ODDS } from '@/lib/skewb-odds';
import type { PuzzleDistributionJson } from '@/lib/puzzle-distribution';

vi.mock('@/components/AppLink', () => ({ default: 'a' }));

const fixture: PuzzleDistributionJson = JSON.parse(readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../stats/scramble/puzzle_distribution.json'), 'utf8',
));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  changeAppLanguage('en');
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it.each(['en', 'zh'] as const)('renders the current statistics response and future updates in %s', async lang => {
  changeAppLanguage(lang);
  for (const extra of [0, 1000]) {
    const data = structuredClone(fixture);
    data.puzzles.skewb.sample_count += extra;
    data.puzzles.skewb.dist.counts['7'] += extra;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => data });
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => root.render(createElement(SkewbOdds, { key: extra })));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/stats/scramble/puzzle_distribution.json'));
    expect(host.textContent).toContain(groupDigits(String(data.puzzles.skewb.sample_count)));
    let worst = 0;
    for (let d = 7; d < SKEWB_ODDS.histogram.length; d++) {
      worst = Math.max(worst, Math.abs(SKEWB_ODDS.histogram[d] / SKEWB_ODDS.wcaLegal
        - (data.puzzles.skewb.dist.counts[d] ?? 0) / data.puzzles.skewb.sample_count) * 100);
    }
    expect(host.textContent).toContain(worst.toFixed(3));
    expect(host.querySelector('[role="status"]')).toBeNull();
  }
});

it.each(['http', 'network', 'missing'] as const)('retains theoretical results without inventing sample data on %s failure', async failure => {
  vi.stubGlobal('fetch', failure === 'network'
    ? vi.fn().mockRejectedValue(new Error('offline'))
    : vi.fn().mockResolvedValue({ ok: failure !== 'http', status: 503, json: async () => ({ puzzles: {} }) }));
  await act(async () => root.render(createElement(SkewbOdds)));
  expect(host.querySelector('[role="status"]')?.textContent).toBe('Scramble statistics are temporarily unavailable.');
  expect(host.textContent).toContain(groupDigits('3149280'));
  expect(host.textContent).not.toContain('Across');
});

it('shows a loading state until the statistics response arrives', async () => {
  let resolve!: (value: unknown) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise(done => { resolve = done; })));
  await act(async () => root.render(createElement(SkewbOdds)));
  expect(host.querySelector('[role="status"]')?.textContent).toBe('Loading scramble statistics…');
  await act(async () => resolve({ ok: true, json: async () => fixture }));
  expect(host.querySelector('[role="status"]')).toBeNull();
  expect(host.textContent).toContain(groupDigits(String(fixture.puzzles.skewb.sample_count)));
});
