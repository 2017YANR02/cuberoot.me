// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { InstalledAuthClient } from './installed-auth';
import { useInstalledAuth, type InstalledAuthPort } from './use-installed-auth';

describe('useInstalledAuth', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('keeps the ticket callback stable across renders and handles listener failure', async () => {
    const callbacks: Array<() => Promise<unknown>> = [];
    const client = {
      restore: vi.fn(async () => null),
      issueWebSessionTicket: vi.fn(),
    } as unknown as InstalledAuthClient;
    const port: InstalledAuthPort = {
      client,
      getLaunchUrls: vi.fn(async () => []),
      listen: vi.fn(async () => { throw new Error('unavailable'); }),
    };

    function Harness({ tick }: { tick: number }) {
      const auth = useInstalledAuth('en', port);
      useEffect(() => { callbacks.push(auth.issueWebSessionTicket); });
      return <output>{`${tick}:${auth.error}`}</output>;
    }

    await act(async () => root.render(<Harness tick={1} />));
    await act(async () => root.render(<Harness tick={2} />));

    expect(container.textContent).toBe('2:true');
    expect(callbacks.at(-1)).toBe(callbacks.at(-2));
  });

  it('reports a callback failure after the browser-open promise has already resolved', async () => {
    let callback: ((url: string) => void) | undefined;
    let login: (() => Promise<void>) | undefined;
    const client = {
      restore: vi.fn(async () => null),
      start: vi.fn(async () => undefined),
      finish: vi.fn(async () => { throw new Error('mobile auth request unavailable'); }),
    } as unknown as InstalledAuthClient;
    const port: InstalledAuthPort = {
      client,
      getLaunchUrls: async () => [],
      listen: async (listener) => { callback = listener; return { remove: async () => undefined }; },
    };
    function Harness() {
      const auth = useInstalledAuth('en', port);
      login = auth.login;
      return <output>{`${auth.busy}:${auth.error}`}</output>;
    }
    await act(async () => root.render(<Harness />));
    await act(async () => login?.());
    expect(container.textContent).toBe('false:false');
    await act(async () => callback?.('me.cuberoot.app://auth/callback'));
    expect(container.textContent).toBe('false:true');
  });
});
