// @vitest-environment jsdom
import { act, createElement, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useProgressiveCount } from '@/components/persons/logic/use-progressive-count';

let host: HTMLDivElement;
let root: Root;
let commits: number[];
let reveal: (index: number) => void;
function Table({ total, order }: { total: number; order: string }) {
  const { count, ensureIndex } = useProgressiveCount(total, order, 2, 3);
  reveal = ensureIndex;
  useLayoutEffect(() => { commits.push(count); });
  return createElement('div', null, count);
}
const render = async (total: number, order: string) => {
  await act(async () => root.render(createElement(Table, { total, order })));
};
const tick = async () => { await act(async () => vi.advanceTimersByTime(32)); };
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers(); commits = [];
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

it('never commits the full old count when sorting or switching to another event', async () => {
  await render(8, '333'); await tick(); await tick();
  expect(commits).toEqual([2, 5, 8]);
  commits = [];
  await render(8, 'sorted');
  expect(commits).toEqual([2]);
  await tick(); expect(commits).toEqual([2, 5]);
  commits = [];
  await render(4, '222');
  expect(commits).toEqual([2]);
  await tick(); expect(commits).toEqual([2, 4]);
});

it('reveals deep links immediately and cancels the old append when the data changes', async () => {
  await render(100, '333');
  await act(async () => reveal(80));
  expect(host.textContent).toBe('81');
  await render(10, '222');
  await tick(); expect(host.textContent).toBe('5');
  await act(async () => reveal(100));
  expect(host.textContent).toBe('10');
  await tick(); expect(host.textContent).toBe('10');
  await render(0, 'empty');
  await tick(); expect(host.textContent).toBe('0');
});
