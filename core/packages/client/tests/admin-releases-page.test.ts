// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ admin: false, mounted: vi.fn() }));
vi.mock('@/lib/auth-store', () => ({ useIsAdmin: () => state.admin }));
vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));
vi.mock('@/components/AppLink', () => ({ default: ({ children }: { children: React.ReactNode }) => createElement('a', null, children) }));
vi.mock('../app/[lang]/download/ReleaseManager', () => ({ default: () => { state.mounted(); return createElement('div', null, 'Release form'); } }));
import AdminReleasesPage from '../app/[lang]/admin/releases/page';

it('mounts the release form only for administrators', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const node = document.createElement('div');
  const root = createRoot(node);
  state.admin = false;
  state.mounted.mockClear();
  await act(async () => root.render(createElement(AdminReleasesPage)));
  expect(node.textContent).toContain('Only administrators');
  expect(state.mounted).not.toHaveBeenCalled();
  state.admin = true;
  await act(async () => root.render(createElement(AdminReleasesPage)));
  expect(node.textContent).toContain('Release form');
  expect(state.mounted).toHaveBeenCalled();
  await act(async () => root.unmount());
});
