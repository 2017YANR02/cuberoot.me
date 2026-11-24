// @vitest-environment jsdom
import { act, createElement, type AnchorHTMLAttributes } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ listPlans: vi.fn(), getEnv: vi.fn(), login: vi.fn(), directApp: false }));
vi.mock('@/lib/wechat-js-sdk', () => ({
  loadWeChatJsSdk: async () => ({ miniProgram: { navigateTo: vi.fn(), getEnv: mocks.getEnv } }),
}));
vi.mock('@/i18n/tr', () => ({ useLang: () => 'zh', tr: ({ zh }: { zh: string }) => zh }));
vi.mock('next/navigation', () => ({ usePathname: () => '/zh/membership', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('nuqs', () => ({ useQueryState: () => [null, vi.fn()] }));
vi.mock('@/lib/auth-store', () => ({
  useAuthUser: () => null, hasAdminAccess: () => false, authActions: { login: mocks.login }, useAuthStore: (select: (state: unknown) => unknown) => select({ user: null, login: mocks.login }),
  isAdmin: () => false, getSessionToken: () => null, getWcaToken: () => null,
}));
vi.mock('@/lib/apple-membership-bridge', () => ({ isIosMembershipSurface: () => false, useAppleMembershipAvailable: () => false }));
vi.mock('@/lib/web-membership-bridge', () => ({ useWebMembershipAvailable: () => mocks.directApp, webMembershipAvailable: () => mocks.directApp }));
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
    mocks.login.mockReset();
    mocks.directApp = false;
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
    expect(host.querySelector('[role="status"][aria-busy="true"]')?.getAttribute('aria-label')).toBe('正在加载套餐');
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
      expect(host.querySelector('.mem-plan-cta')?.textContent).toBe('立即开通');
      expect((host.querySelector('.mem-plan-cta') as HTMLButtonElement).disabled).toBe(false);
      await act(async () => (host.querySelector('.mem-plan-cta') as HTMLButtonElement).click());
      expect(mocks.login).toHaveBeenCalledTimes(1);
      expect(host.querySelectorAll('.mem-plan-cta')).toHaveLength(1);
      const toggle = host.querySelector<HTMLButtonElement>('[role="switch"][aria-label="自动续费"]')!;
      expect(toggle.getAttribute('aria-checked')).toBe('true');
      expect(host.querySelector('.mem-plan-amount')?.textContent).toBe('¥29.99');
      await act(async () => toggle.click());
      expect(toggle.getAttribute('aria-checked')).toBe('false');
      expect(host.querySelector('.mem-plan-amount')?.textContent).toBe('¥39.99');
      expect(host.textContent).toContain('单次购买，无后续扣款');
      expect(host.querySelector('.mem-plan-cta')?.textContent).toBe('立即开通');
      await act(async () => (host.querySelector('.mem-plan-cta') as HTMLButtonElement).click());
      expect(mocks.login).toHaveBeenCalledTimes(2);
      await act(async () => toggle.click());
      expect(toggle.getAttribute('aria-checked')).toBe('true');
      expect(host.querySelector('.mem-plan-amount')?.textContent).toBe('¥29.99');
    }
  });

  it('selects between monthly and annual pricing with one checkout and collapsed benefits', async () => {
    const plan = { currency: 'CNY', perks: [], periodCount: 1 };
    mocks.listPlans.mockResolvedValueOnce({ plans: [], renewalPlans: [
      { ...plan, slug: 'monthly_auto_renew', period: 'month', priceCents: 2999 },
      { ...plan, slug: 'yearly_auto_renew', period: 'year', priceCents: 29900 },
    ] });
    await act(async () => root.render(createElement(MembershipPage)));
    await act(async () => reply({ miniprogram: false }));
    const section = host.querySelector('#personal-plans-title')!;
    const [month, year] = section.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    expect(month.checked).toBe(true);
    await act(async () => year.click());
    expect(year.checked).toBe(true);
    expect(mocks.login).not.toHaveBeenCalled();
    expect(section.querySelectorAll('.mem-plan-cta')).toHaveLength(1);
    expect(section.querySelector('details')?.open).toBe(false);
  });

  it('offers only single purchases in the direct Android app', async () => {
    mocks.directApp = true;
    await act(async () => root.render(createElement(MembershipPage)));
    await act(async () => reply({ miniprogram: false }));
    expect(host.querySelector('[role="switch"][aria-label="自动续费"]')).toBeNull();
    expect(host.querySelector('.mem-plan-amount')?.textContent).toBe('¥39.99');
    expect(host.textContent).not.toContain('自动续费服务协议');
  });
});
