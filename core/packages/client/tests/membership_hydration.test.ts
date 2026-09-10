// @vitest-environment jsdom

import { act, createElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { ADMIN_WCA_IDS } from '@cuberoot/shared/admin';
import { expect, it, vi } from 'vitest';

vi.mock('@/lib/membership-api', () => ({ getMyMembership: vi.fn() }));

it.each([
  { session: 'anonymous', wcaId: null, member: false },
  { session: 'saved ordinary user', wcaId: '2000TEST01', member: false },
  { session: 'saved administrator', wcaId: ADMIN_WCA_IDS[0], member: true },
])('hydrates membership controls with a $session', async ({ wcaId, member }) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetModules();
  if (wcaId) {
    localStorage.setItem('wca_user', JSON.stringify({
      wcaId, name: 'Hydration test', avatar: '', country: '',
    }));
  }
  const { useMembership } = await import('@/hooks/useMembership');
  function MembershipControl() {
    const { isMember } = useMembership();
    return isMember
      ? createElement('button', { type: 'button' }, 'Play')
      : createElement('a', { href: '/membership' }, 'Membership');
  }
  const host = document.createElement('div');
  document.body.appendChild(host);
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    host.innerHTML = renderToStaticMarkup(createElement(MembershipControl));
    expect(host.querySelector('a')).not.toBeNull();
    const recoverableErrors: unknown[] = [];
    await act(async () => {
      root = hydrateRoot(host, createElement(MembershipControl), {
        onRecoverableError: error => recoverableErrors.push(error),
      });
    });
    expect(recoverableErrors).toEqual([]);
    expect(host.querySelector('button') !== null).toBe(member);
  } finally {
    await act(async () => root?.unmount());
    host.remove();
    localStorage.removeItem('wca_user');
  }
});
