'use client';

// 国内三方登录(微信/QQ/支付宝)授权回调。各平台把 https://<域>/auth/social/callback 登记为回调地址。
// 读回 code(支付宝为 auth_code)+ state → 对 sessionStorage 校验 CSRF → 交后端换身份(登录/绑定)。
// 结构镜像 WCA 的 app/auth/callback/page.tsx。

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { applySession, getSessionToken, markWcaLinkPrompt } from '@/lib/auth-store';
import { loginSocial, linkSocial, SOCIAL_PROVIDERS, type SocialProvider } from '@/lib/account-api';
import { takeSocialReturnUrl } from '@/lib/social-auth';
import { tr } from '@/i18n/tr';
import { AuthCallbackStatus } from '../../_components/AuthCallbackStatus';

// StrictMode 下 useEffect 会双跑;单次闸门避免 code 被消费两次(授权码单次有效)。
let processed = false;

export default function SocialCallbackPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (processed) return;
    processed = true;
    void handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || params.get('auth_code'); // 支付宝回调用 auth_code
    const state = params.get('state') || '';
    const err = params.get('error') || params.get('error_description');

    // provider / intent 从签名 state 里解出(格式 <nonce>.<provider>.<intent>.<exp>.<sig>),
    // 不依赖 sessionStorage —— 手机唤起支付宝 App 授权后回调常落到另一浏览器上下文,sessionStorage 会丢。
    // 这里只做路由用途(选 login/link 端点),真正的 CSRF 校验是服务端对整个 state 验签。
    const parts = state.split('.');
    const provider = parts[1] as SocialProvider | undefined;
    const intent = parts[2];
    // sessionStorage 优先；OAuth App 把回调送回新的 tab 时用同源 localStorage 兜底。
    const returnUrl = takeSocialReturnUrl();

    if (err) { setErrorMsg(tr({ zh: `授权被拒绝:${err}`, en: `Authorization denied: ${err}` })); return; }
    if (!code) { setErrorMsg(tr({ zh: '未获取到授权码', en: 'No authorization code received' })); return; }
    if (!provider || !(SOCIAL_PROVIDERS as readonly string[]).includes(provider) || parts.length !== 5) {
      setErrorMsg(tr({ zh: '授权校验失败,请重试', en: 'State mismatch, please retry' })); return;
    }

    try {
      if (intent === 'link') {
        if (!getSessionToken()) { setErrorMsg(tr({ zh: '请先登录再绑定', en: 'Sign in before linking' })); return; }
        await linkSocial(provider, code, state);
      } else {
        const r = await loginSocial(provider, code, state);
        applySession(r.token, r.user);
        // 刚注册出来的新账号,回到 /account 时补上「你有 WCA ID 吗」那步(表单那条路是在
        // onDone 里直接切过去的,这条路整页跳走过,只能留个标记)。
        if (r.isNew && !r.user.wcaId) markWcaLinkPrompt();
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : tr({ zh: '登录失败,请重试', en: 'Login failed, please retry' }));
      return;
    }

    const target = returnUrl || '/';
    try {
      const u = new URL(target, window.location.href);
      router.replace(u.pathname + u.search + u.hash);
    } catch {
      router.replace('/');
    }
  }

  return (
    <AuthCallbackStatus
      pendingLabel={tr({ zh: '正在登录...', en: 'Signing in...' })}
      error={errorMsg}
    />
  );
}
