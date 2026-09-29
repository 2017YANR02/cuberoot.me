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
  ...await original<typeof import('@/lib/membership-api')>(), listPlans: mocks.listPlans,
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
      plans: [{ slug: 'monthly', nameZh: '月度会员', nameEn: 'Monthly', period: 'month', periodCount: 1, priceCents: 100, currency: 'CNY', perks: [] }],
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
      expect(host.querySelector('.mem-plan-cta')?.textContent).toBe('登录后开通');
    }
  });
});
