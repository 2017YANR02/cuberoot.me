// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import Top10HistoryPage from '@/components/wca-stats/Top10HistoryPage';

const History: React.FC<NonNullable<Parameters<typeof Top10HistoryPage>[0]>> = Top10HistoryPage;

vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
vi.mock('@/i18n/tr', () => ({ tr: ({ en }: { en: string }) => en }));
vi.mock('@/components/wca-stats/BarRaceChart', () => ({ default: () => null }));
vi.mock('@/components/CompactSelect', () => ({ CompactSelect: () => null }));
vi.mock('@/components/WcaEventSelector', () => ({ default: () => null }));
vi.mock('@/components/LangToggle', () => ({ default: () => null }));
vi.mock('@/components/EventIcon/EventIcon', () => ({ EventIcon: () => null }));
vi.mock('@/lib/top10-export', () => ({ exportTop10Video: vi.fn() }));
vi.mock('@/lib/country-flags', () => ({ loadFlagData: async () => {}, compFlagIso2: () => null }));
vi.mock('@/lib/comp-localize', () => ({ localizeCompName: (_id: string, name: string) => name }));

const events = [
  { d: '2026-10-01', p: 'A', v: 500, c: 'Test2026' },
  { d: '2026-10-03', p: 'B', v: 400, c: 'Test2026' },
  { d: '2026-10-04', p: 'B', v: 390, c: 'Test2026' },
];
const persons = {
  A: { name: 'Alice', country: 'China', iso2: null },
  B: { name: 'Bob', country: 'China', iso2: null },
};
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-10T23:59:30Z'));
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  // Chart animation is unrelated to the clock; leave the actual minute interval running.
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true,
    json: async () => url.endsWith('/top10_history.json')
      ? { events: ['333'], eventInfo: { '333': { hasAverage: false } }, topK: 10, persons, comps: {} }
      : { single: events, persons, comps: {} },
  })));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  expect(vi.getTimerCount()).toBe(0);
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it.each(['', 'CN'])('updates current holder days across UTC midnight (%s)', async country => {
  await act(async () => root.render(createElement(History, {
    controlledEventId: '333', controlledCountry: country,
  })));
  expect(host.querySelector('.t10h-bigdate')?.textContent).toBe('2026-10-10');
  const scope = country ? 'National' : 'World';
  // Breaking one's own record on Oct 4 must not reset the Oct 3 start date.
  expect(host.querySelector('.t10h-holder-sub')?.textContent).toBe(`${scope} record holder for 7 days`);
  await act(async () => vi.advanceTimersByTime(60_000));
  expect(host.querySelector('.t10h-bigdate')?.textContent).toBe('2026-10-11');
  expect(host.querySelector('.t10h-holder-sub')?.textContent).toBe(`${scope} record holder for 8 days`);

  const slider = host.querySelector<HTMLInputElement>('.t10h-scrub')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(slider, Date.parse('2026-10-02T00:00:00Z').toString());
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(host.querySelector('.t10h-holder-name')?.textContent).toBe('Alice');
  expect(host.querySelector('.t10h-holder-sub')?.textContent).toBe(`${scope} record holder for 1 days`);
  await act(async () => vi.advanceTimersByTime(86_400_000));
  expect(host.querySelector('.t10h-bigdate')?.textContent).toBe('2026-10-02');
  expect(host.querySelector('.t10h-holder-sub')?.textContent).toBe(`${scope} record holder for 1 days`);
});

it('keeps the server render independent of the wall clock', () => {
  const first = renderToString(createElement(History, { controlledEventId: '333' }));
  vi.setSystemTime(new Date('2026-10-12T00:00:00Z'));
  expect(renderToString(createElement(History, { controlledEventId: '333' }))).toBe(first);
});
