// @vitest-environment jsdom
import { act, createElement, type AnchorHTMLAttributes } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    ['month', '¥29.99', '每月'],
    ['year', '¥299', '每年'],
  ] as const)('uses saved %s pricing and never enables a pretend signing action', async (period, price, cadence) => {
    await act(async () => root.render(createElement(AutoRenewModal, { period, price, onClose: vi.fn() })));
    expect(host.textContent).toContain(`首期及以后${cadence}均为 ${price}`);
    expect(host.querySelector('[role="status"]')?.textContent).toContain('当前不能签约或扣款');
    const consent = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    const sign = host.querySelector<HTMLButtonElement>('.mem-autorenew-sign')!;
    expect(consent.checked).toBe(false);
    expect(sign.disabled).toBe(true);
    await act(async () => consent.click());
    expect(consent.checked).toBe(true);
    expect(sign.disabled).toBe(true);
    expect(host.querySelector('a[href="/membership/renewal-terms"]')).not.toBeNull();
    expect(host.querySelector('a[href="/membership/subscription"]')).not.toBeNull();
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
