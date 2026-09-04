/** @vitest-environment jsdom */
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { fetchAdminUsers, createContributor } = vi.hoisted(() => ({
  fetchAdminUsers: vi.fn(),
  createContributor: vi.fn(),
}));

vi.mock('@/lib/account-api', () => ({ fetchAdminUsers }));
vi.mock('@/lib/wca-api', () => ({ fetchPersonCard: () => Promise.resolve(null) }));
vi.mock('@/lib/sponsors-api', () => ({
  createContributor,
  updateContributor: vi.fn(),
  createSponsor: vi.fn(),
  updateSponsor: vi.fn(),
}));
vi.mock('@/components/WcaPersonPicker', () => ({
  WcaPersonPicker: ({ onQueryChange, additionalResults }: {
    onQueryChange?: (query: string) => void;
    additionalResults?: ReactNode;
  }) => createElement('div', null,
    createElement('input', {
      onInput: (event: Event) => onQueryChange?.((event.target as HTMLInputElement).value),
    }),
    additionalResults,
  ),
}));

import SupportEditor from '@/app/[lang]/support/SupportEditor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('SupportEditor registered-user search', () => {
  it('finds a CubeRoot ID and saves the selected account identity', async () => {
    vi.useFakeTimers();
    fetchAdminUsers.mockResolvedValue({
      users: [{ id: 42, displayName: 'Site User', avatarUrl: 'https://example.com/avatar.png', wcaId: '2020USER01' }],
    });
    createContributor.mockResolvedValue({ id: 1 });

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root?.render(createElement(SupportEditor, {
      target: { kind: 'contributor', initial: null },
      onClose: () => {},
      onSaved: () => {},
    })));

    const input = host.querySelector('input');
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setValue?.call(input, '42');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(fetchAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ q: '42' }));
    const user = host.querySelector<HTMLButtonElement>('.cuber-search-item');
    expect(user?.textContent).toContain('CubeRoot ID 42');
    await act(async () => user?.click());
    const save = [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Save');
    await act(async () => save?.click());

    expect(createContributor).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Site User',
      wcaId: '2020USER01',
      avatarUrl: 'https://example.com/avatar.png',
    }));
  });
});
