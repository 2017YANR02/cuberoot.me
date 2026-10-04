// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, it, vi } from 'vitest';
import type { PlatformRouteDefinition } from '@/lib/platform-types';
const mocks = vi.hoisted(() => ({ user: { current: { uid: 1, wcaId: '' } as null | { uid: number; wcaId: string } }, write: vi.fn(), fetch: vi.fn() }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => mocks.user.current }));
vi.mock('@/hooks/useT', () => { const t = (zh: string) => zh; return { useT: () => t }; });
vi.mock('@/components/AppLink', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => createElement('a', { href }, children) }));
vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => path }));
vi.mock('@/lib/admin-api', () => ({ authHeaders: () => ({}), handleApi: async (response: Response) => { if (!response.ok) throw new Error('Load failed'); return response.json(); } }));
vi.mock('@/lib/platform-gateway', () => ({ executePlatformAction: mocks.write, PlatformPermissionError: class extends Error { constructor(public status: number) { super('Authentication required'); } } }));
import { PlatformFavoriteButton } from '@/components/platform/PlatformFavoriteButton';
const entityId = 'd48ec765-5143-4fa6-b5d2-e8288716e510';
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.user.current = { uid: 1, wcaId: '' };
  mocks.write.mockReset().mockResolvedValue({ ok: true });
  mocks.fetch.mockReset(); vi.stubGlobal('fetch', mocks.fetch);
});
it.each(['course', 'product', 'event', 'news'] as const)('reads and toggles %s using the resolved UUID', async targetType => {
  const host = document.createElement('div'), root = createRoot(host);
  const definition = { id: `${targetType}-detail` } as PlatformRouteDefinition;
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ items: [{ id: entityId, targetType }] })));
  try {
    await act(async () => root.render(createElement(PlatformFavoriteButton, { definition, entityId, targetType })));
    expect(mocks.fetch.mock.calls[0][0]).toBe(`/v1/platform/me/${targetType === 'product' ? 'wishlist' : 'favorites'}`);
    expect(host.querySelector('button')?.getAttribute('aria-pressed')).toBe('true');
    await act(async () => host.querySelector('button')!.click());
    expect(mocks.write).toHaveBeenLastCalledWith(definition, { action: targetType === 'product' ? 'wishlist' : 'favorite', resourceId: entityId, payload: { targetType, active: false } });
    expect(host.querySelector('button')?.getAttribute('aria-pressed')).toBe('false');
    await act(async () => host.querySelector('button')!.click());
    expect(mocks.write.mock.calls.at(-1)?.[1].payload.active).toBe(true);
    expect(host.querySelector('button')?.getAttribute('aria-pressed')).toBe('true');
  } finally { await act(async () => root.unmount()); }
});
it('keeps the saved state when mutation fails and permits retry', async () => {
  const host = document.createElement('div'), root = createRoot(host);
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ items: [] })));
  mocks.write.mockRejectedValueOnce(new Error('Save failed'));
  try {
    await act(async () => root.render(createElement(PlatformFavoriteButton, { definition: {} as PlatformRouteDefinition, entityId, targetType: 'news' })));
    await act(async () => host.querySelector('button')!.click());
    expect(host.querySelector('button')?.getAttribute('aria-pressed')).toBe('false');
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Save failed');
    await act(async () => host.querySelector('button')!.click());
    expect(host.querySelector('button')?.getAttribute('aria-pressed')).toBe('true');
  } finally { await act(async () => root.unmount()); }
});
it('offers login without reading private favorites for a guest', async () => {
  mocks.user.current = null;
  const host = document.createElement('div'), root = createRoot(host);
  try {
    await act(async () => root.render(createElement(PlatformFavoriteButton, { definition: {} as PlatformRouteDefinition, entityId, targetType: 'news' })));
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/platform/login');
    expect(mocks.fetch).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); }
});
