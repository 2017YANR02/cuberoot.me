// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRetainedState } from '@/hooks/useRetainedState';
import { useAuthStore } from '@/lib/auth-store';

vi.mock('@/lib/auth-store', async () => {
  const { create } = await import('zustand');
  return { useAuthStore: create(() => ({ user: null })) };
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
const host = document.createElement('div');
let write: (value: string) => void;
const paints: string[] = [];
function Probe({ cacheKey }: { cacheKey: string }) {
  const [value, setValue] = useRetainedState(cacheKey, 'loading');
  write = setValue;
  paints.push(value);
  return createElement('span', null, value);
}
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  host.innerHTML = '';
  paints.length = 0;
  useAuthStore.setState({ user: null });
});

describe('retained page data', () => {
  it('restores data on the first client navigation render but keeps SSR deterministic', async () => {
    root = createRoot(host);
    await act(async () => root!.render(createElement(Probe, { cacheKey: 'test:return' })));
    await act(async () => write('loaded'));
    await act(async () => root!.unmount());
    root = undefined;
    paints.length = 0;
    root = createRoot(host);
    await act(async () => root!.render(createElement(Probe, { cacheKey: 'test:return' })));
    expect(paints).toEqual(['loaded']);
    const html = renderToString(createElement(Probe, { cacheKey: 'test:return' }));
    expect(html).toContain('loading');
    await act(async () => root!.unmount());
    root = undefined;
    host.innerHTML = html;
    const errors: unknown[] = [];
    await act(async () => {
      root = hydrateRoot(host, createElement(Probe, { cacheKey: 'test:return' }), { onRecoverableError: error => errors.push(error) });
    });
    expect(errors).toEqual([]);
    expect(host.textContent).toBe('loaded');
  });

  it('clears data and rejects old requests across an identity change and return', async () => {
    root = createRoot(host);
    await act(async () => root!.render(createElement(Probe, { cacheKey: 'test:identity' })));
    await act(async () => write('guest result'));
    const oldRequest = write;
    await act(async () => useAuthStore.setState({
      user: { uid: 99, wcaId: '', name: 'Test', avatar: '', avatarSource: 'auto', avatarPreset: null, country: '', isAdmin: false },
    }));
    expect(host.textContent).toBe('loading');
    await act(async () => write('private result'));
    await act(async () => useAuthStore.setState({ user: null }));
    await act(async () => oldRequest('late guest result'));
    expect(host.textContent).toBe('loading');
  });
});
