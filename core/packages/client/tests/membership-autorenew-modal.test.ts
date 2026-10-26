// @vitest-environment jsdom
import { act, createElement, type AnchorHTMLAttributes } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ renewalAvailability: vi.fn(), createMembershipMiniLink: vi.fn(), enrollMembershipSubscription: vi.fn() }));
vi.mock('@/lib/membership-api', () => api);
vi.mock('@/i18n/tr', () => ({ tr: (copy: { zh: string }) => copy.zh }));
vi.mock('@/components/AppLink', () => ({
  default: ({ prefetch: _prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => createElement('a', props),
}));
import AutoRenewModal from '@/app/[lang]/membership/AutoRenewModal';

describe('auto-renewal before merchant approval', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });
  it.each([
    ['month', '¥29.99', '月'],
    ['year', '¥299', '年'],
  ] as const)('uses saved %s pricing and never enables a pretend signing action', async (period, price, cadence) => {
    await act(async () => root.render(createElement(AutoRenewModal, { period, price, onClose: vi.fn() })));
    expect(host.querySelector('.mem-pay-price')?.textContent).toBe(`${price}/${cadence}`);
    const consent = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    const sign = host.querySelector<HTMLButtonElement>('.mem-autorenew-sign')!;
    expect(consent.checked).toBe(false);
    expect(sign.disabled).toBe(true);
    await act(async () => consent.click());
    expect(consent.checked).toBe(true);
    expect(sign.disabled).toBe(true);
    expect(host.querySelector('a[href="/membership/renewal-terms"]')).not.toBeNull();
    expect(host.querySelector('a[href="/membership/subscription"]')).not.toBeNull();
    expect(host.querySelector('a[href="/membership/subscription"]')?.textContent).toBe('管理自动续费');
  });
  it('opens the mini handoff only after consent without creating an H5 contract', async () => {
    api.renewalAvailability.mockResolvedValue({ available: true, channel: 'miniprogram', termsVersion: '2026-10-14' });
    api.createMembershipMiniLink.mockResolvedValue({ urlLink: 'https://wxaurl.cn/example', qrCodeDataUrl: 'data:image/png;base64,abc', expiresIn: 600 });
    await act(async () => root.render(createElement(AutoRenewModal, { period: 'month', price: '¥29.99', planSlug: 'monthly_auto_renew', priceCents: 2999, onClose: vi.fn() })));
    const sign = host.querySelector<HTMLButtonElement>('.mem-autorenew-sign')!;
    expect(sign.disabled).toBe(true);
    await act(async () => host.querySelector<HTMLInputElement>('input')!.click());
    await act(async () => sign.click());
    expect(api.createMembershipMiniLink).toHaveBeenCalledWith('monthly_auto_renew');
    expect(api.enrollMembershipSubscription).not.toHaveBeenCalled();
    expect(host.querySelector('a[href="https://wxaurl.cn/example"]')).not.toBeNull();
    expect(host.querySelector('img')).not.toBeNull();
  });
  it('allows closing without consent', async () => {
    const onClose = vi.fn();
    await act(async () => root.render(createElement(AutoRenewModal, { period: 'month', price: '¥29.99', onClose })));
    await act(async () => host.querySelector<HTMLButtonElement>('.mem-pay-close')!.click());
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
