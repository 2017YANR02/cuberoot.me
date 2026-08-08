/** @vitest-environment jsdom */
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@cuberoot/shared', () => ({
  isPersonsIndexReady: () => true,
  loadPersonsIndex: () => Promise.resolve(),
  searchLocalPersons: () => [],
}));

vi.mock('@/lib/wca-api', () => ({
  WCA_ID_REGEX: /^\d{4}[A-Z]{4}\d{2}$/,
  getPerson: () => Promise.resolve(null),
  searchPersons: () => Promise.resolve([]),
}));

import { WcaPersonPicker } from '@/components/WcaPersonPicker';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe('WcaPersonPicker free-text identity', () => {
  it('keeps an unmatched name through parent rerenders and explains that it will be saved', async () => {
    const queries: string[] = [];

    function Harness() {
      const [, setName] = useState('');
      return createElement(WcaPersonPicker, {
        value: null,
        onChange: () => {},
        onQueryChange: (query: string) => {
          queries.push(query);
          setName(query);
        },
        allowFreeText: true,
        isZh: true,
      });
    }

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root?.render(createElement(Harness)));

    const input = host.querySelector('input');
    expect(input).not.toBeNull();
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setValue?.call(input, '孙卓远');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(queries.at(-1)).toBe('孙卓远');
    expect(input?.value).toBe('孙卓远');
    expect(host.textContent).toContain('No WCA match; the typed name will be saved');
  });
});
