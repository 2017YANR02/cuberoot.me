// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import type { PlatformEntity, PlatformRouteDefinition } from '@/lib/platform-types';

const { plans, shipping } = vi.hoisted(() => ({ plans: vi.fn(), shipping: vi.fn() }));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/lib/auth-store', async original => ({ ...await original<object>(), useAuthUser: () => null }));
vi.mock('@/lib/platform-gateway', async original => ({
  ...await original<object>(), loadPlatformMembershipPlans: plans, loadPlatformShippingAddresses: shipping,
}));
import { PlatformMembershipCatalog } from '@/components/platform/PlatformMembershipCatalog';
import { PlatformShippingAddressManager } from '@/components/platform/PlatformShippingAddressManager';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.clearAllMocks());

it('loads a standalone membership catalog once when no route entities are supplied', async () => {
  plans.mockResolvedValue([]);
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(PlatformMembershipCatalog, {
      definition: { id: 'me-membership' } as PlatformRouteDefinition,
      params: {}, busy: null, runAction: vi.fn(),
    })));
    expect(plans).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('当前没有在售课程权益套餐');
  } finally { await act(async () => root.unmount()); }
});

it('discards an obsolete shipping response instead of replacing current addresses', async () => {
  let finishOld!: (value: { items: PlatformEntity[] }) => void;
  const first = vi.fn();
  const latest = vi.fn();
  shipping.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
    .mockResolvedValueOnce({ items: [{ id: 'new', title: '新地址', data: {} }] });
  const host = document.createElement('div');
  const root = createRoot(host);
  const props = { definition: { id: 'account-shipping' } as PlatformRouteDefinition, params: {}, busy: null, runAction: vi.fn() };
  try {
    await act(async () => root.render(createElement(PlatformShippingAddressManager, { ...props, onAddresses: first })));
    const oldSignal = shipping.mock.calls[0][0] as AbortSignal;
    await act(async () => root.render(createElement(PlatformShippingAddressManager, { ...props, onAddresses: latest })));
    expect(oldSignal.aborted).toBe(true);
    await act(async () => finishOld({ items: [{ id: 'old', title: '旧地址', data: {} }] }));
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('新地址');
    expect(host.textContent).not.toContain('旧地址');
  } finally { await act(async () => root.unmount()); }
});

it('shows a domain empty-state message without generic implementation commentary', async () => {
  const { PlatformState } = await import('@/components/platform/PlatformState');
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(PlatformState, { kind: 'empty', message: '当前没有在售课程权益套餐。' })));
    expect(host.textContent).toContain('当前没有在售课程权益套餐。');
    expect(host.textContent).not.toContain('真实数据');
    await act(async () => root.render(createElement(PlatformState, { kind: 'loading' })));
    expect(host.textContent).toBe('正在加载');
  } finally { await act(async () => root.unmount()); }
});
