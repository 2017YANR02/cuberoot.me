// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { request, locale } = vi.hoisted(() => ({ request: vi.fn(), locale: { value: 'en' as 'en' | 'zh' } }));
vi.mock('@/lib/recon-intake-api', () => ({ intakeRequest: request }));
vi.mock('@/lib/recon-api', () => ({ getRecon: async () => ({ rawTime: 2.51, optimalScramble: 'R' }) }));
vi.mock('@/i18n/tr', () => ({ tr: (value: { en: string; zh: string }) => value[locale.value], useLang: () => locale.value }));
vi.mock('@/components/AppLink', () => ({ default: ({ children, prefetch: _prefetch, ...props }: { children: ReactNode; prefetch?: boolean }) => createElement('a', props, children) }));
vi.mock('@/lib/country-flags', () => ({
  loadFlagData: async () => 1,
  personFlagIso2: () => "cn",
  compFlagIso2: (id: string) => id === 'DeqingSmallSpecial2026' ? 'cn' : '',
  compNameZh: (name: string) => name === 'Deqing Small & Special 2026' ? '2026WCA德清短时赛' : '',
  compNameEnFromZh: () => '',
}));
vi.mock('@/components/Tooltip', () => ({ Tooltip: ({ children }: { children: (props: object) => ReactNode }) => children({}) }));
vi.mock('@/components/CompactSelect', () => ({ CompactSelect: ({ items, value, onChange, disabled }: { items: { value: string; label: ReactNode }[]; value: string; onChange: (value: string) => void; disabled: boolean }) => createElement('div', null,
  createElement('select', { value, disabled, onChange: (event: { target: { value: string } }) => onChange(event.target.value) }, items.map(item => createElement('option', { key: item.value, value: item.value }, item.value))),
  items.map(item => createElement('span', { key: item.value }, item.label))) }));
import ReconTestPicker from '@/app/[lang]/timer/_components/ReconTestPicker';
import { reconTestScrambleSource, reconTestSource, showReconTestEntry } from '@/lib/recon-test-source';
import { decodeTimerSolve } from '@cuberoot/shared/timer/persistence';

let root: Root;
let container: HTMLDivElement;
const source = (id: number) => ({ id, scramble: 'R', solution: "R'", competition: null, date: null,
  value: '4.00', intakeId: null, intakeStatus: null, truthStatus: null, sourceChanged: false, sourceHash: 'a'.repeat(32) });
const choose = async (select: HTMLSelectElement, value: string) => act(async () => {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
});
beforeEach(() => {
  locale.value = 'en';
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  request.mockReset().mockImplementation(async (path: string) => path === '/sources/filters'
    ? { persons: [{ id: '2023GENG02', name: 'Xuanyi Geng' }, { id: '2009ZEMD01', name: 'Feliks Zemdegs' }],
      collectors: [{ id: '2017YANR02', name: 'Ruimin Yan' }, { id: 'another', name: 'Another collector' }] }
    : { items: [source(123), source(124)], hasMore: false });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

it('localizes the competition with its flag and previews normalized cross without changing the source', async () => {
  locale.value = 'zh';
  const original = { ...source(2303), competition: 'Deqing Small & Special 2026', competitionId: 'DeqingSmallSpecial2026',
    country: null, solution: "M' // cross\nU // F2L" };
  request.mockImplementation(async (path: string) => path === '/sources/filters'
    ? { persons: [], collectors: [] } : { items: [original], hasMore: false });
  const onSelect = vi.fn(() => true);
  await act(async () => root.render(createElement(ReconTestPicker, { canSelect: true, onSelect })));
  await act(async () => container.querySelector<HTMLButtonElement>('.recon-test-trigger')!.click());
  const item = container.querySelector<HTMLButtonElement>('.recon-test-item')!;
  expect(item.textContent).toContain('德清短时赛');
  expect(item.textContent).toContain('2026');
  expect(item.textContent).not.toContain('Deqing');
  expect(item.querySelector('.comp-cell .fi-cn')).not.toBeNull();
  await act(async () => item.click());
  expect(container.querySelector('.recon-test-selected pre')?.textContent).toBe("x R' L // cross\nU // F2L");
  const link = container.querySelector('a[aria-label="打开复盘"]');
  expect(link?.getAttribute('href')).toBe('/recon/2303');
  expect(link?.textContent).toBe('');
  expect(link?.querySelector('svg')).not.toBeNull();
  await act(async () => container.querySelector<HTMLButtonElement>('.recon-test-use')!.click());
  expect(onSelect).toHaveBeenCalledWith(original);
  expect(original.solution).toBe("M' // cross\nU // F2L");
  const reference = document.querySelector('.recon-test-reference');
  expect(reference?.querySelector('pre')?.textContent).toBe("x R' L // cross\nU // F2L");
  expect(reference?.querySelector('.detail-caption-header')?.textContent).toContain('TPS');
  expect(reference?.querySelector('.normalized-cross-copy')).not.toBeNull();
  const handle = reference!.querySelector<HTMLElement>('.recon-test-reference-drag')!;
  handle.setPointerCapture = vi.fn();
  const pointer = (type: string, x: number, y: number) => {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, { button: 0, pointerId: 1, clientX: x, clientY: y });
    handle.dispatchEvent(event);
  };
  await act(async () => { pointer('pointerdown', 20, 30); pointer('pointermove', 120, 150); pointer('pointerup', 120, 150); });
  expect((reference as HTMLElement).style.left).toBe('100px');
  expect((reference as HTMLElement).style.top).toBe('120px');
  reference!.getBoundingClientRect = () => ({ left: 100, top: 120, right: 400, bottom: 320, width: 300, height: 200, x: 100, y: 120, toJSON: () => ({}) });
  for (const [edge, key, dimension, value, coordinate, location] of [
    ['right', 'ArrowRight', 'width', '316px', 'left', '100px'],
    ['left', 'ArrowLeft', 'width', '316px', 'left', '84px'],
    ['bottom', 'ArrowDown', 'height', '216px', 'top', '120px'],
    ['top', 'ArrowUp', 'height', '216px', 'top', '104px'],
  ] as const) {
    await act(async () => reference!.querySelector(`.recon-test-reference-resize--${edge}`)!
      .dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })));
    expect((reference as HTMLElement).style[dimension]).toBe(value);
    expect((reference as HTMLElement).style[coordinate]).toBe(location);
  }
  await act(async () => container.querySelector<HTMLButtonElement>('.recon-test-trigger')!.click());
  expect(container.querySelector('.recon-test-panel')).toBeNull();
  expect(document.querySelector('.recon-test-reference')).toBe(reference);
  await act(async () => reference!.querySelector<HTMLButtonElement>('button')!.click());
  expect(document.querySelector('.recon-test-reference')).toBeNull();
});

it('shows the test entry only to an administrator with a connected 3×3 cube outside competition', () => {
  expect(showReconTestEntry(true, true, '333', false)).toBe(true);
  expect(showReconTestEntry(false, true, '333', false)).toBe(false);
  expect(showReconTestEntry(true, false, '333', false)).toBe(false);
  expect(showReconTestEntry(true, true, '222', false)).toBe(false);
  expect(showReconTestEntry(true, true, '333', true)).toBe(false);
});

it('preserves only valid source identities for 3×3 solves', () => {
  const source = reconTestScrambleSource(123, 'a'.repeat(32));
  const solve = { id: 's', event: '333' as const, ts: 0, timeMs: 1000, penalty: 'ok' as const, scramble: 'R', scrambleSource: source };
  expect(reconTestSource(solve)).toEqual({ sourceReconId: 123, sourceReconHash: 'a'.repeat(32) });
  expect(reconTestSource(decodeTimerSolve(solve, '333')!)).toEqual({ sourceReconId: 123, sourceReconHash: 'a'.repeat(32) });
  expect(reconTestSource({ ...solve, event: '222' })).toBeUndefined();
  expect(reconTestSource({ ...solve, scrambleSource: { ...source, identity: 'recon-test:123' } })).toBeUndefined();
});

it('does not load a scramble while timing is unavailable and reports a rejected change', async () => {
  const onSelect = vi.fn(() => false);
  await act(async () => root.render(createElement(ReconTestPicker, { canSelect: false, onSelect })));
  await act(async () => container.querySelector<HTMLButtonElement>('.recon-test-trigger')!.click());
  await act(async () => container.querySelector<HTMLButtonElement>('.recon-test-item')!.click());
  const use = [...container.querySelectorAll('button')].find(button => button.textContent === 'Use scramble')!;
  expect(use.disabled).toBe(true);
  await act(async () => use.click()); expect(onSelect).not.toHaveBeenCalled();
  await act(async () => root.render(createElement(ReconTestPicker, { canSelect: true, onSelect })));
  await act(async () => use.click());
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Cannot change the scramble');
  expect(document.querySelector('.recon-test-reference')).toBeNull();
});

it('defaults both selectors and preserves changed filters for the next uncollected source', async () => {
  const onSelect = vi.fn(() => true);
  await act(async () => root.render(createElement(ReconTestPicker, { canSelect: true, onSelect })));
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Recon testing"]')!.click());
  const [solver, collector] = [...container.querySelectorAll('select')];
  expect(solver.value).toBe('2023GENG02');
  expect(collector.value).toBe('2017YANR02');
  expect(request).toHaveBeenCalledWith('/sources?v=2&status=pending&offset=0&personId=2023GENG02&collectorId=2017YANR02');
  await choose(solver, '2009ZEMD01');
  await choose(collector, 'another');
  const filtered = '/sources?v=2&status=pending&offset=0&personId=2009ZEMD01&collectorId=another';
  expect(request).toHaveBeenLastCalledWith(filtered);
  await act(async () => container.querySelector<HTMLButtonElement>('.recon-test-item')!.click());
  expect(container.querySelector('.recon-test-selected pre')?.textContent).toBe("R'");
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Use scramble')!.click());
  expect(onSelect).toHaveBeenLastCalledWith(source(123));
  const next = [...container.querySelectorAll('button')].find(button => button.textContent === 'Next uncollected')!;
  await act(async () => next.click());
  expect(request).toHaveBeenLastCalledWith(filtered);
  expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 124 }));
  await choose(collector, '');
  expect(container.querySelector('.recon-test-selected')).toBeNull();
  expect(request).toHaveBeenLastCalledWith('/sources?v=2&status=pending&offset=0&personId=2009ZEMD01&collectorId=');
});

it.each(['filters', 'close'])('discards a delayed next-source response after changing %s', async change => {
  const onSelect = vi.fn(() => true);
  await act(async () => root.render(createElement(ReconTestPicker, { canSelect: true, onSelect })));
  await act(async () => container.querySelector<HTMLButtonElement>('.recon-test-trigger')!.click());
  await act(async () => container.querySelector<HTMLButtonElement>('.recon-test-item')!.click());
  let finish!: (value: unknown) => void;
  request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Next uncollected')!.click());
  if (change === 'filters') {
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Collected')!.click());
    await choose(container.querySelector('select')!, '2009ZEMD01');
  } else {
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Close')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('.recon-test-trigger')!.click());
  }
  await act(async () => finish({ items: [source(999)], hasMore: false }));
  expect(onSelect).not.toHaveBeenCalled();
  expect(container.textContent).not.toContain('#999');
});
