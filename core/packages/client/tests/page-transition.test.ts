// @vitest-environment jsdom
import { act, createElement, useEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
const route = vi.hoisted(() => ({ path: '/zh/timer' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.path }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(),
  ViewTransition: ({ children }: { children: ReactNode }) => children,
}));
import PageTransition, { pageTransitionSection } from '@/components/PageTransition';
it('shares module identity across locale, detail routes and null fallback', () => {
  expect(pageTransitionSection('/zh/wca/comp/Example')).toBe(pageTransitionSection('/wca/persons/Example'));
  expect(pageTransitionSection('/en/timer')).toBe('timer');
  expect(pageTransitionSection('/zh')).toBe('home');
  expect(pageTransitionSection(null)).toBe('home');
});
it('preserves child state within a module, replacing only on cross-module navigation', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const mounts = vi.fn();
  function Content() { useEffect(() => { mounts(); }, []); return createElement('div'); }
  const host = document.createElement('div'); const root = createRoot(host);
  const render = () => root.render(createElement(PageTransition, { children: createElement(Content) }));
  try {
    await act(async () => render());
    await act(async () => render());
    expect(mounts).toHaveBeenCalledTimes(1);
    route.path = '/zh/alg/3x3/pll';
    await act(async () => render());
    expect(mounts).toHaveBeenCalledTimes(2);
    route.path = '/zh/alg/3x3/pll/Aa';
    await act(async () => render());
    expect(mounts).toHaveBeenCalledTimes(2);
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
