// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/lib/recon-intake-api', () => ({ intakeRequest: request }));
vi.mock('@/i18n/tr', () => ({ tr: (value: { en: string }) => value.en }));
vi.mock('@/components/AppLink', () => ({ default: ({ children }: { children: ReactNode }) => createElement('a', null, children) }));
vi.mock('@/components/Tooltip', () => ({ Tooltip: ({ children }: { children: (props: object) => ReactNode }) => children({}) }));
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
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  request.mockReset().mockImplementation(async (path: string) => path === '/sources/filters'
    ? { persons: [{ id: '2023GENG02', name: 'Xuanyi Geng' }, { id: '2009ZEMD01', name: 'Feliks Zemdegs' }],
      collectors: [{ id: '2017YANR02', name: 'Ruimin Yan' }, { id: 'another', name: 'Another collector' }] }
    : { items: [source(123), source(124)], hasMore: false });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

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
});

it('defaults both selectors and preserves changed filters for the next uncollected source', async () => {
  const onSelect = vi.fn(() => true);
  await act(async () => root.render(createElement(ReconTestPicker, { canSelect: true, onSelect })));
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Recon testing"]')!.click());
  const [solver, collector] = [...container.querySelectorAll('select')];
  expect(solver.value).toBe('2023GENG02');
  expect(collector.value).toBe('2017YANR02');
  expect(request).toHaveBeenCalledWith('/sources?status=pending&offset=0&personId=2023GENG02&collectorId=2017YANR02');
  await choose(solver, '2009ZEMD01');
  await choose(collector, 'another');
  const filtered = '/sources?status=pending&offset=0&personId=2009ZEMD01&collectorId=another';
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
  expect(request).toHaveBeenLastCalledWith('/sources?status=pending&offset=0&personId=2009ZEMD01&collectorId=');
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
