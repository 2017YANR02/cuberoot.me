import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const locale = vi.hoisted(() => ({ lang: 'zh' }));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string, en: string) => locale.lang === 'zh' ? zh : en }));
vi.mock('@/components/AppLink', () => ({ default: ({ children, prefetch: _prefetch, ...props }: Record<string, unknown>) => createElement('a', props, children as string) }));
import AuthFlowPage from '@/app/[lang]/dev/auth/page';

describe('account flow documentation', () => {
  it.each(['zh', 'en'])('distinguishes local phone integration, existing-account escape hatch and release acceptance in %s', (lang) => {
    locale.lang = lang;
    const html = renderToStaticMarkup(createElement(AuthFlowPage));
    expect(html).toContain('<figure');
    expect(html).toContain('id="existing-account"');
    expect(html).toContain('href="#existing-account"');
    expect(html).toContain('<details');
    expect(html).toContain(lang === 'zh' ? '待后台与真机验收' : 'platform and device acceptance pending');
    expect(html).toContain(lang === 'zh' ? '手机号实时验证' : 'real-time phone verification');
    expect(html).toContain(lang === 'zh' ? '明确同意注册后' : 'explicit registration consent');
    expect(html).toContain(lang === 'zh' ? '微信和手机号分别属于两个账号' : 'WeChat and phone belong to different accounts');
    expect(html).not.toContain('<form');
  });

  it.each(['zh', 'en'])('documents all platforms and the full account lifecycle without overstating support in %s', (lang) => {
    locale.lang = lang;
    const html = renderToStaticMarkup(createElement(AuthFlowPage));
    for (const id of ['platforms', 'signin', 'app-handoff', 'mini', 'linking', 'merge', 'exit']) {
      expect(html).toContain(`id="${id}"`);
      expect(html).toContain(`<details id="${id}"`);
    }
    for (const platform of ['iOS App', 'Android App', 'HarmonyOS', 'Windows', 'macOS']) expect(html).toContain(platform);
    for (const text of lang === 'zh' ? [
      'B → A', '10 分钟有效', '唯一登录方式不能解绑', '不能承诺两份会员时长自动相加',
      '注销账号 ≠ 取消续费', '无恢复期', '公开讨论和公开复盘匿名保留',
      '登录成功 ≠ 计时记录已云同步', '不是三个账号', '登录码不是合并码', '陌生凭据先问是否已有账号',
      '已领养宠物', '亲密度较高', '不把两份经验相加',
    ] : [
      'B → A', 'valid for 10 minutes', 'only sign-in method cannot be removed', 'durations are not guaranteed to add together',
      'delete account ≠ cancel renewal', 'no grace period', 'public discussions and public reconstructions are anonymized',
      'does not mean timer data is cloud-synced', 'not three accounts', 'sign-in code is not a merge code', 'unknown credentials ask whether you have an account',
      'adopted pets', 'higher bond', 'Experience is not added together',
    ]) expect(html).toContain(text);
    expect(html).not.toContain('type="submit"');
    expect(html).toContain(lang === 'zh' ? '说明范围与发布状态' : 'Scope and release status');
  });

  it('is discoverable from Dev and does not execute an authentication flow', () => {
    const dev = readFileSync(new URL('../app/[lang]/dev/page.tsx', import.meta.url), 'utf8');
    const page = readFileSync(new URL('../app/[lang]/dev/auth/page.tsx', import.meta.url), 'utf8');
    expect(dev).toContain("href: '/dev/auth'");
    expect(page).not.toMatch(/\bfetch\s*\(|account-api|useAuthStore|identity-choice/);
  });

  it.each(['zh', 'en'])('separates checkout ownership and anonymous timer capabilities from sign-in in %s', (lang) => {
    locale.lang = lang;
    const html = renderToStaticMarkup(createElement(AuthFlowPage));
    for (const text of lang === 'zh' ? [
      '网站首付并签约', '付款和签约分别确认', '换号或退出清除订单',
      '不把付款人的微信身份绑定', '计时直播无需登录', '账号退出不代替停止直播',
    ] : [
      'Website payment with enrollment', 'Confirm payment and enrollment separately', 'Account changes or sign-out clear the order',
      'does not bind the payer', 'Live timer sharing requires no sign-in', 'signing out does not replace stopping the stream',
    ]) expect(html).toContain(text);
  });
});
