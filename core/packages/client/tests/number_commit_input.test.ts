// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NumberCommitInput from '@/components/NumberCommitInput';

describe('NumberCommitInput', () => {
  let host: HTMLDivElement, root: Root, input: HTMLInputElement;
  const commit = vi.fn();
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    commit.mockClear();
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
  async function mount(allowDecimal = false) {
    await act(async () => root.render(createElement(NumberCommitInput, { value: 10, min: .1, max: 2000, allowDecimal, onCommit: commit })));
    input = host.querySelector('input')!;
  }
  async function edit(value: string, key?: string) {
    await act(async () => {
      input.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      if (key) input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      else input.blur();
    });
  }
  it('preserves the default integer contract', async () => {
    await mount(); await edit('37.5'); expect(commit.mock.calls).toEqual([[37]]);
  });
  it('accepts decimals, clamps boundaries and restores blank or invalid input', async () => {
    await mount(true); await edit('37.5', 'Enter'); expect(commit.mock.calls).toEqual([[37.5]]);
    await edit('0'); await edit('3000'); expect(commit.mock.calls).toEqual([[37.5], [.1], [2000]]);
    await edit(''); expect(input.value).toBe('10');
    await edit('invalid'); expect(input.value).toBe('10'); expect(commit).toHaveBeenCalledTimes(3);
  });
  it('cancels Escape without committing on blur and permits the next edit', async () => {
    await mount(true); await edit('123.4', 'Escape'); expect(input.value).toBe('10'); expect(commit).not.toHaveBeenCalled();
    await edit('12.5', 'Enter'); expect(commit.mock.calls).toEqual([[12.5]]);
  });
});
