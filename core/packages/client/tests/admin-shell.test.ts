// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ admin: false, pathname: '/admin', section: 'content', view: 'tools' }));
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }));
vi.mock('nuqs', () => ({ parseAsString: {}, useQueryState: (key: string) => [key === 'view' ? state.view : state.section] }));
vi.mock('@/lib/auth-store', () => ({ useIsAdmin: () => state.admin, useAuthUser: () => ({ name: 'CubeRoot Admin' }) }));
vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));
vi.mock('@/components/AppLink', () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => createElement('a', props, children) }));
import AdminShell from '../app/[lang]/admin/AdminShell';

it('shows navigation only for administrators and follows the active page', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const node = document.createElement('div');
  const root = createRoot(node);
  state.admin = false;
  await act(async () => root.render(createElement(AdminShell, null, 'Page content')));
  expect(node.textContent).toBe('Page content');
  state.admin = true;
  await act(async () => root.render(createElement(AdminShell, null, 'Page content')));
  const accountLink = node.querySelector<HTMLAnchorElement>('.admin-navigation__account');
  expect(accountLink?.textContent).toBe('CubeRoot Admin');
  expect(accountLink?.getAttribute('href')).toBe('/account');
  expect(node.querySelector('[aria-current="page"]')?.textContent).toContain('Content and community');
  const group = node.querySelector('details')!;
  expect(group.open).toBe(false);
  await act(async () => group.querySelector('summary')!.click());
  expect(group.open).toBe(true);
  await act(async () => group.querySelector('summary')!.click());
  expect(group.open).toBe(false);
  state.pathname = '/zh/admin/users';
  await act(async () => root.render(createElement(AdminShell, null, 'Page content')));
  expect(node.querySelector('[aria-current="page"]')?.textContent).toContain('Users and memberships');
  state.pathname = '/admin'; state.section = 'system'; state.view = 'monitoring';
  await act(async () => root.render(createElement(AdminShell, null, 'Page content')));
  expect(node.querySelector('details')?.open).toBe(true);
  expect(node.querySelector('[aria-current="page"]')?.textContent).toContain('Assistant and diagnostics');
  await act(async () => root.unmount());
});
