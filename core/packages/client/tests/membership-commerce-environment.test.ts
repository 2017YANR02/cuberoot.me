// @vitest-environment jsdom
import { act, createElement, type AnchorHTMLAttributes } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ listPlans: vi.fn(), getEnv: vi.fn(), login: vi.fn() }));
vi.mock('@/lib/wechat-js-sdk', () => ({
  loadWeChatJsSdk: async () => ({ miniProgram: { navigateTo: vi.fn(), getEnv: mocks.getEnv } }),
}));
vi.mock('@/i18n/tr', () => ({ useLang: () => 'zh', tr: ({ zh }: { zh: string }) => zh }));
vi.mock('nuqs', () => ({ useQueryState: () => [null, vi.fn()] }));
vi.mock('@/lib/auth-store', () => ({
  useAuthStore: (select: (state: unknown) => unknown) => select({ user: null, login: mocks.login }),
  isAdmin: () => false, getSessionToken: () => null, getWcaToken: () => null,
}));
vi.mock('@/lib/apple-membership-bridge', () => ({ isIosMembershipSurface: () => false, useAppleMembershipAvailable: () => false }));
vi.mock('@/lib/membership-api', async (original) => ({
  ...await original<typeof import('@/lib/membership-api')>(), listPlans: mocks.listPlans, renewalAvailability: async () => ({ available: false, termsVersion: '2026-10-14' }),
}));
vi.mock('@/components/AppLink', () => ({ default: ({ prefetch: _prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => createElement('a', props) }));
vi.mock('@/components/CubeRootLogo', () => ({ default: () => null }));
vi.mock('@/components/DonateModal', () => ({ default: () => null }));
vi.mock('@/components/MemberProfileEditor', () => ({ default: () => null }));
vi.mock('@/app/[lang]/membership/PayModal', () => ({ default: () => null }));
vi.mock('@/app/[lang]/membership/AdminPanel', () => ({ default: () => null }));
vi.mock('@/app/[lang]/membership/MemberContact', () => ({ default: () => null }));
vi.mock('@/app/[lang]/membership/AutoRenewModal', () => ({ default: () => null }));
vi.mock('@/app/[lang]/membership/AppleMembership', () => ({ default: () => null }));
import MembershipPage from '@/app/[lang]/membership/page';

describe('membership in the WeChat browser', () => {
  let host: HTMLDivElement;
  let root: Root;
  let reply: (env: { miniprogram: boolean }) => void;
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone) MicroMessenger/8.0');
    mocks.getEnv.mockReset().mockImplementation((callback) => { reply = callback; });
    mocks.listPlans.mockReset().mockResolvedValue({
      plans: [{ slug: 'monthly', nameZh: '月度会员', nameEn: 'Monthly', period: 'month', periodCount: 1, priceCents: 3999, currency: 'CNY', perks: [] }],
      renewalPlans: [{ slug: 'monthly_auto_renew', nameZh: '连续包月', nameEn: 'Monthly auto-renewal', period: 'month', periodCount: 1, priceCents: 2999, currency: 'CNY', perks: [], active: false }],
      payEnabled: true, channels: { wechat: true, wechatNative: true, wechatH5: true },
    });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it.each([false, true])('waits for getEnv then renders the correct purchase surface (miniprogram=%s)', async (miniprogram) => {
    await act(async () => root.render(createElement(MembershipPage)));
    expect(mocks.getEnv).toHaveBeenCalledTimes(1);
    expect(mocks.listPlans).not.toHaveBeenCalled();
    expect(host.textContent).toContain('加载中');
    expect(host.textContent).not.toContain('小程序内暂不提供');
    expect(host.querySelector('.mem-plan-cta')).toBeNull();

    await act(async () => reply({ miniprogram }));
    if (miniprogram) {
      expect(host.textContent).toContain('小程序内暂不提供会员购买服务');
      expect(mocks.listPlans).not.toHaveBeenCalled();
      expect(host.querySelector('.mem-plan-cta')).toBeNull();
    } else {
      expect(mocks.listPlans).toHaveBeenCalledTimes(1);
      expect(host.textContent).not.toContain('小程序内暂不提供');
      expect(host.querySelector('.mem-plan-cta')?.textContent).toBe('自动续费暂未开放');
      expect((host.querySelector('.mem-plan-cta') as HTMLButtonElement).disabled).toBe(true);
      expect(host.querySelectorAll('.mem-plan-cta')).toHaveLength(1);
      expect(host.textContent).toContain('微信签约后按所选周期自动续费');
      const select = host.querySelector('#membership-payment-mode') as HTMLSelectElement;
      await act(async () => { select.value = 'manual'; select.dispatchEvent(new Event('change', { bubbles: true })); });
      expect(host.textContent).toContain('仅支付本期费用，不会自动扣款');
      expect(host.querySelector('.mem-plan-cta')?.textContent).toBe('登录后继续');
    }
  });
});
