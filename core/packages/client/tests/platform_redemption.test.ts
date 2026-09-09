// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { PlatformRouteDefinition } from '@/lib/platform-types';
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/components/AppLink', () => ({ default: ({ children }: { children: ReactNode }) => children }));
import { PlatformLearningActions } from '@/components/platform/PlatformDomainActions';

it('keeps one visible redemption title and an accessible required code field', async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(PlatformLearningActions, {
      definition: { id: 'account-invites' } as PlatformRouteDefinition,
      params: {}, busy: null, runAction: vi.fn(),
    })));
    expect(host.querySelector('h2')?.textContent).toBe('兑换课程码');
    expect(host.querySelector('label > span')?.className).toBe('sr-only');
    expect(host.querySelector('label > span')?.textContent).toBe('兑换码');
    const input = host.querySelector('input')!;
    expect(input.required).toBe(true);
    expect(input.minLength).toBe(3);
    expect(input.maxLength).toBe(128);
    expect(host.querySelector('button[type="submit"]')?.textContent).toBe('兑换');
    expect(host.querySelector('form')?.checkValidity()).toBe(false);
  } finally { await act(async () => root.unmount()); }
});
