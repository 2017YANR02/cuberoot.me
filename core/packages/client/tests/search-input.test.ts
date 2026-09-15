// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SearchInput } from '@/components/SearchInput';

vi.mock('@/i18n/tr', () => ({ tr: ({ zh }: { zh: string }) => zh }));
let host: HTMLDivElement;
let root: Root;
const onChange = vi.fn();
const onKeyDown = vi.fn();
const render = async (value = '', debounceMs = 300) => {
  await act(async () => root.render(createElement(SearchInput, { value, onChange, onKeyDown, debounceMs })));
};
const input = () => host.querySelector('input')!;
const type = async (value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), value);
    input().dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const advance = async (ms = 300) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
beforeEach(async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); vi.clearAllMocks();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await render();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

it('debounces rapid typing and clears immediately without a late callback', async () => {
  await type('h'); await advance(200); await type('hu'); await advance(299);
  expect(onChange).not.toHaveBeenCalled();
  expect(input().value).toBe('hu');
  await advance(1);
  expect(onChange.mock.calls).toEqual([['hu']]);
  await type('huz');
  await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
  expect(onChange.mock.calls).toEqual([['hu'], ['']]);
  await advance();
  expect(onChange).toHaveBeenCalledTimes(2);
});

it('waits for compositionend and does not interpret IME Enter as a search action', async () => {
  await type('h');
  await act(async () => input().dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
  await type('hu'); await advance(1000);
  await act(async () => input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  expect(onChange).not.toHaveBeenCalled(); expect(onKeyDown).not.toHaveBeenCalled();
  await type('胡');
  await act(async () => input().dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
  await advance();
  expect(onChange.mock.calls).toEqual([['胡']]);
});

it('keeps new typing when a URL store echoes the previous submission', async () => {
  await type('old'); await advance();
  await type('new'); await render('old'); await advance();
  expect(input().value).toBe('new');
  expect(onChange.mock.calls).toEqual([['old'], ['new']]);
});

it('cancels pending input on external navigation and unmount', async () => {
  await type('pending'); await render('back'); await advance();
  expect(input().value).toBe('back'); expect(onChange).not.toHaveBeenCalled();
  await type('pending again'); await act(async () => root.render(null)); await advance();
  expect(onChange).not.toHaveBeenCalled();
});

it('preserves immediate filtering by default and immediately propagates whitespace clearing', async () => {
  await render('', 0); await type('胡');
  expect(onChange).toHaveBeenLastCalledWith('胡');
  await render('胡'); await type('   ');
  expect(onChange).toHaveBeenLastCalledWith('   ');
});
