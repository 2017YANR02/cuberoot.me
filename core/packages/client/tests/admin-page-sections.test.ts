// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ section: 'system', view: 'tools' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('nuqs', () => ({ parseAsStringEnum: () => ({ withDefault: () => ({}) }), useQueryState: (key: string) => [key === 'section' ? state.section : state.view] }));
vi.mock('@/lib/auth-store', () => ({ useIsAdmin: () => true, useAuthStore: (select: (state: unknown) => unknown) => select({ user: { uid: 1 } }), loginHref: () => '/account' }));
vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));
vi.mock('@/components/AppLink', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => createElement('a', { href }, children) }));
vi.mock('../app/[lang]/admin/Dashboard', () => ({ default: () => createElement('div', null, 'Dashboard content') }));
vi.mock('../app/[lang]/admin/AssistantMonitoring', () => ({ default: () => createElement('div', null, 'Assistant monitoring content') }));
vi.mock('../app/[lang]/admin/BootDiagnostics', () => ({ default: () => createElement('div', null, 'Boot diagnostics content') }));
import AdminPage from '../app/[lang]/admin/page';

it('shows only the selected system subsection', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const node = document.createElement('div');
  const root = createRoot(node);
  state.view = 'tools';
  await act(async () => root.render(createElement(AdminPage)));
  expect(node.textContent).toContain('App releases');
  expect(node.textContent).not.toContain('Assistant monitoring content');
  state.view = 'workspace';
  await act(async () => root.render(createElement(AdminPage)));
  expect(node.textContent).toContain('Documents');
  expect(node.textContent).not.toContain('App releases');
  state.view = 'monitoring';
  await act(async () => root.render(createElement(AdminPage)));
  expect(node.textContent).toContain('Assistant monitoring content');
  expect(node.textContent).toContain('Boot diagnostics content');
  expect(node.textContent).not.toContain('Documents');
  state.view = 'tax';
  await act(async () => root.render(createElement(AdminPage)));
  expect(node.textContent).toContain('Shanghai Electronic Tax Bureau');
  expect(node.textContent).not.toContain('Boot diagnostics content');
  await act(async () => root.unmount());
});
