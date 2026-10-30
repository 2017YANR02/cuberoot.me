// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ user: null as null | { uid: number }, push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock('@/lib/auth-store', () => ({ useAuthStore: { getState: () => ({ user: state.user }) } }));
import { useRequireMembership } from '@/hooks/useRequireMembership';
let root: Root;
let requireMembership: () => boolean;
function Probe({ access }: { access: boolean }) { requireMembership = useRequireMembership(access); return null; }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  root = createRoot(document.createElement('div'));
  state.user = null;
  state.push.mockClear();
  window.history.replaceState(null, '', '/zh/music?view=player#track');
});
afterEach(async () => { await act(async () => root.unmount()); });
it('requires login before checkout and retains the full product location', async () => {
  await act(async () => root.render(createElement(Probe, { access: false })));
  expect(requireMembership()).toBe(false);
  const login = new URL(state.push.mock.calls[0][0], window.location.origin);
  expect(login.pathname).toBe('/zh/account');
  const checkout = new URL(login.searchParams.get('next')!, window.location.origin);
  expect(checkout.pathname).toBe('/zh/membership');
  expect(checkout.searchParams.get('next')).toBe('/zh/music?view=player#track');
});
it('sends a signed-in non-member directly to checkout', async () => {
  state.user = { uid: 1 };
  await act(async () => root.render(createElement(Probe, { access: false })));
  expect(requireMembership()).toBe(false);
  expect(state.push).toHaveBeenCalledWith('/zh/membership?next=%2Fzh%2Fmusic%3Fview%3Dplayer%23track');
});
it('allows members without navigating, but rechecks login at click time', async () => {
  state.user = { uid: 1 };
  await act(async () => root.render(createElement(Probe, { access: true })));
  expect(requireMembership()).toBe(true);
  expect(state.push).not.toHaveBeenCalled();
  state.user = null;
  expect(requireMembership()).toBe(false);
  expect(state.push).toHaveBeenCalledTimes(1);
});
