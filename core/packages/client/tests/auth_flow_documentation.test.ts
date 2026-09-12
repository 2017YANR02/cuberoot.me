import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const locale = vi.hoisted(() => ({ lang: 'zh' }));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string, en: string) => locale.lang === 'zh' ? zh : en }));
vi.mock('@/components/AppLink', () => ({ default: ({ children, prefetch: _prefetch, ...props }: Record<string, unknown>) => createElement('a', props, children as string) }));
import AuthFlowPage from '@/app/[lang]/dev/auth/page';

describe('account flow documentation', () => {
  it.each(['zh', 'en'])('distinguishes the proposal, existing-account escape hatch and current implementation in %s', (lang) => {
    locale.lang = lang;
    const html = renderToStaticMarkup(createElement(AuthFlowPage));
    expect(html).toContain('<figure');
    expect(html).toContain('id="existing-account"');
    expect(html).toContain('href="#existing-account"');
    expect(html).toContain('<details');
    expect(html).toContain(lang === 'zh' ? '手机号授权尚未接入' : 'phone authorization not implemented');
    expect(html).toContain(lang === 'zh' ? '明确同意注册后' : 'explicit registration consent');
    expect(html).toContain(lang === 'zh' ? '微信和手机号分别属于两个账号' : 'WeChat and phone belong to different accounts');
    expect(html).not.toContain('<form');
  });

  it('is discoverable from Dev and does not execute an authentication flow', () => {
    const dev = readFileSync(new URL('../app/[lang]/dev/page.tsx', import.meta.url), 'utf8');
    const page = readFileSync(new URL('../app/[lang]/dev/auth/page.tsx', import.meta.url), 'utf8');
    expect(dev).toContain("href: '/dev/auth'");
    expect(page).not.toMatch(/\bfetch\s*\(|account-api|useAuthStore|identity-choice/);
  });
});
