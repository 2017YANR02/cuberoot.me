// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_CARD_IDS } from '@cuberoot/shared/site-directory';

const state = vi.hoisted(() => ({ user: { isAdmin: true }, end: null as null | ((event: unknown) => Promise<void>) }));
const api = vi.hoisted(() => ({ getHomeCardOrders: vi.fn(), reorderHomeCards: vi.fn() }));
vi.mock('@/lib/home-card-order-api', () => api);
vi.mock('@/lib/auth-store', () => ({
  hasAdminAccess: (user: { isAdmin: boolean }) => user.isAdmin,
  useAuthStore: Object.assign((select: (s: typeof state) => unknown) => select(state), { getState: () => state }),
}));
vi.mock('@dnd-kit/core', async importOriginal => ({
  ...await importOriginal<typeof import('@dnd-kit/core')>(),
  DndContext: ({ children, onDragEnd }: { children: ReactNode; onDragEnd: typeof state.end }) => { state.end = onDragEnd; return children; },
}));
vi.mock('@/components/SortableCard', () => ({ default: ({ id, draggable, disabled, children }: {
  id: string; draggable: boolean; disabled: boolean; children: ReactNode;
}) => createElement('div', { 'data-id': id }, draggable && createElement('button', { disabled }), children) }));
import AccountCardGrid from '@/app/[lang]/account/AccountCardGrid';

describe('account shared sorting', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const cards = ['pet', 'progress', 'friends'].map(id => ({ id, content: createElement('a', { href: `/${id}` }, id) }));
  const render = () => act(async () => root.render(createElement(AccountCardGrid, { cards })));
  const ids = () => [...host.querySelectorAll('[data-id]')].map(el => el.getAttribute('data-id'));
  const drag = () => state.end!({ active: { id: 'pet' }, over: { id: 'friends' } });
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    state.user = { isAdmin: true };
    api.getHomeCardOrders.mockResolvedValue({ account: [...ACCOUNT_CARD_IDS] });
    api.reorderHomeCards.mockResolvedValue({ ok: true });
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    host = document.createElement('div');
    root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); vi.restoreAllMocks(); });
  it('shows the shared order to ordinary users without allowing writes', async () => {
    state.user.isAdmin = false;
    api.getHomeCardOrders.mockResolvedValue({ account: ['friends', 'pet', 'progress'] });
    await render();
    expect(ids()).toEqual(['friends', 'pet', 'progress']);
    expect(host.querySelector('button')).toBeNull();
    await act(drag);
    expect(api.reorderHomeCards).not.toHaveBeenCalled();
  });
  it('keeps hidden cards in the shared order and blocks a second in-flight save', async () => {
    let finish!: () => void;
    api.reorderHomeCards.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    await render();
    let pending!: Promise<void>;
    await act(async () => { pending = drag(); await drag(); });
    expect(ids()).toEqual(['progress', 'friends', 'pet']);
    expect(api.reorderHomeCards).toHaveBeenCalledTimes(1);
    const sent = api.reorderHomeCards.mock.calls[0];
    expect(sent[0]).toBe('account');
    expect(sent[1]).toEqual([...ACCOUNT_CARD_IDS.slice(1, 8), 'pet', ...ACCOUNT_CARD_IDS.slice(8)]);
    expect(host.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
    await act(async () => { finish(); await pending; });
  });
  it('rolls back a failed save and checks current admin access at drop time', async () => {
    api.reorderHomeCards.mockRejectedValue(new Error('offline'));
    await render();
    await act(drag);
    expect(ids()).toEqual(['pet', 'progress', 'friends']);
    expect(window.alert).toHaveBeenCalledTimes(1);
    state.user.isAdmin = false;
    await act(drag);
    expect(api.reorderHomeCards).toHaveBeenCalledTimes(1);
  });
  it('does not allow overwriting shared state after a failed initial load', async () => {
    api.getHomeCardOrders.mockRejectedValue(new Error('offline'));
    await render();
    expect(host.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
    expect(host.querySelector('[role=alert]')).not.toBeNull();
    await act(drag);
    expect(api.reorderHomeCards).not.toHaveBeenCalled();
  });
});
