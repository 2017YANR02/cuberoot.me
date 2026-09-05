// @vitest-environment jsdom

import { act, createElement, type AnchorHTMLAttributes } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

vi.mock('@/components/AppLink', () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => createElement('a', props),
}));
vi.mock('@/lib/ops-api', () => ({ listCommands: async () => [] }));

it('keeps the server and first client render identical with a saved admin session', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.setItem('wca_user', JSON.stringify({
    wcaId: '', name: 'Test admin', avatar: '', country: '', isAdmin: true,
  }));
  const { default: OpsPage } = await import('@/app/[lang]/dev/ops/page');
  const host = document.createElement('div');
  document.body.appendChild(host);
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    host.innerHTML = renderToStaticMarkup(createElement(OpsPage));
    expect(host.querySelector('.ops-admin-bar')).toBeNull();
    const recoverableErrors: unknown[] = [];
    await act(async () => {
      root = hydrateRoot(host, createElement(OpsPage), {
        onRecoverableError: error => recoverableErrors.push(error),
      });
    });
    expect(recoverableErrors).toEqual([]);
    expect(host.querySelector('.ops-admin-new')).not.toBeNull();
  } finally {
    await act(async () => root?.unmount());
    host.remove();
    localStorage.removeItem('wca_user');
  }
});
