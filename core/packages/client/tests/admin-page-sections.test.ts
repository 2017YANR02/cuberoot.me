// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ section: 'system', view: 'tools' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('nuqs', () => ({ parseAsString: { withDefault: () => ({}) }, parseAsStringEnum: () => ({ withDefault: () => ({}) }), useQueryState: (key: string) => [key === 'section' ? state.section : state.view] }));
vi.mock('@/lib/auth-store', () => ({ useIsAdmin: () => true, useAuthUser: () => ({ uid: 1 }), useAuthStore: (select: (state: unknown) => unknown) => select({ user: { uid: 1 } }), loginHref: () => '/account' }));
vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));
vi.mock('@/components/AppLink', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => createElement('a', { href }, children) }));
vi.mock('../app/[lang]/admin/Dashboard', () => ({ default: () => createElement('div', null, 'Dashboard content') }));
vi.mock('../app/[lang]/admin/AssistantMonitoring', () => ({ default: () => createElement('div', null, 'Assistant monitoring content') }));
vi.mock('../app/[lang]/admin/BootDiagnostics', () => ({ default: () => createElement('div', null, 'Boot diagnostics content') }));
vi.mock('../app/[lang]/admin/disk/DiskManagement', () => ({ default: () => createElement('div', null, 'Disk management content') }));
vi.mock('../app/[lang]/admin/WorkResources', () => ({ default: () => createElement('div', null, 'Work resources content') }));
import AdminPage from '../app/[lang]/admin/page';

it('shows only the selected system subsection', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const node = document.createElement('div');
  const root = createRoot(node);
  state.view = 'tools';
  await act(async () => root.render(createElement(AdminPage)));
  expect(node.textContent).toContain('Disk management content');
  expect(node.textContent).not.toContain('Assistant monitoring content');
  state.view = 'workspace';
  await act(async () => root.render(createElement(AdminPage)));
  expect(node.textContent).toContain('Work resources content');
  expect(node.textContent).not.toContain('Disk management content');
  state.view = 'monitoring';
  await act(async () => root.render(createElement(AdminPage)));
  expect(node.textContent).toContain('Assistant monitoring content');
  expect(node.textContent).toContain('Boot diagnostics content');
  expect(node.querySelector('a[href="/docs"]')).toBeNull();
  state.view = 'tax';
  await act(async () => root.render(createElement(AdminPage)));
  expect(node.textContent).toContain('Shanghai Electronic Tax Bureau');
  expect(node.textContent).not.toContain('Boot diagnostics content');
  await act(async () => root.unmount());
});
