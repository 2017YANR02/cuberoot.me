// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ admin: false, pathname: '/admin/team', section: 'mine', view: '' }));
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }));
vi.mock('nuqs', () => ({ parseAsString: {}, useQueryState: (key: string) => [key === 'view' ? state.view : state.section] }));
vi.mock('@/lib/auth-store', () => ({ useIsAdmin: () => state.admin, useAuthUser: () => ({ name: 'Admin' }) }));
vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));
vi.mock('@/components/AppLink', () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => createElement('a', props, children) }));
import WorkspaceNavigation from '../app/[lang]/workspace/WorkspaceNavigation';

it('separates team and administrator navigation and follows localized management routes', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const node = document.createElement('div');
  const root = createRoot(node);
  state.admin = false; state.pathname = '/admin/team'; state.section = 'mine';
  await act(async () => root.render(createElement(WorkspaceNavigation, null, 'Content')));
  expect(node.textContent).toContain('Team collaboration');
  expect(node.querySelector<HTMLAnchorElement>('.staff-brand')?.getAttribute('href')).toBe('/');
  expect(node.textContent).not.toContain('Site management');
  expect(node.querySelector('[aria-current="page"]')?.textContent).toContain('My work');
  state.admin = true; state.pathname = '/zh/admin/releases';
  await act(async () => root.render(createElement(WorkspaceNavigation, null, 'Content')));
  expect(node.textContent).toContain('Site management');
  expect(node.querySelector('[aria-current="page"]')?.textContent).toContain('System tools');
  expect(node.querySelector<HTMLAnchorElement>('a[href="/account"]')?.textContent).toBe('Admin');
  const group = [...node.querySelectorAll('details')].find(item => item.textContent?.includes('Site management'))!;
  expect(group.open).toBe(true);
  await act(async () => group.querySelector('summary')!.click());
  expect(group.open).toBe(false);
  await act(async () => root.unmount());
});
