// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ admin: false, pathname: '/admin', section: 'content', view: 'tools' }));
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }));
vi.mock('nuqs', () => ({ parseAsString: {}, useQueryState: (key: string) => [key === 'view' ? state.view : state.section] }));
vi.mock('@/lib/auth-store', () => ({ useIsAdmin: () => state.admin }));
vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));
vi.mock('@/components/AppLink', () => ({ default: ({ children }: { children: React.ReactNode }) => createElement('a', null, children) }));
vi.mock('@app-foundation/navigation-ui', () => ({ NavigationShell: ({ items, children }: { items: Array<{ id: string; active: boolean }>; children: React.ReactNode }) => createElement('div', null, items.map(item => createElement('span', { key: item.id, 'data-active': item.active }, item.id)), children) }));
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
  expect(node.querySelector('[data-active="true"]')?.textContent).toBe('content');
  state.pathname = '/zh/admin/users';
  await act(async () => root.render(createElement(AdminShell, null, 'Page content')));
  expect(node.querySelector('[data-active="true"]')?.textContent).toBe('users');
  state.pathname = '/admin'; state.section = 'system'; state.view = 'monitoring';
  await act(async () => root.render(createElement(AdminShell, null, 'Page content')));
  expect(node.querySelector('[data-active="true"]')?.textContent).toBe('system-monitoring');
  await act(async () => root.unmount());
});
