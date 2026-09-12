'use client';

// 共用第三方授权回调；Apple form_post 先经 API，再只携短期 code/state 回到此页。
// Apple 额外核销同浏览器 state/verifier，再交后端校验 PKCE 并换身份；国内三方保留原契约。
// 结构镜像 WCA 的 app/auth/callback/page.tsx。

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { applySession, getSessionToken, markWcaLinkPrompt } from '@/lib/auth-store';
import { loginSocial, linkSocial, REDIRECT_AUTH_PROVIDERS, type RedirectAuthProvider } from '@/lib/account-api';
import { consumeAppleState, takeSocialReturnUrl, socialCallbackReturnPath } from '@/lib/social-auth';
import { tr } from '@/i18n/tr';
import { AuthCallbackStatus } from '../../_components/AuthCallbackStatus';

export default function SocialCallbackPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState('');
  const [returnPath, setReturnPath] = useState('/account?view=signin');
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    // Keep one request across StrictMode effect replay, not across later visits.
    if (!request.current) {
      request.current = new AbortController();
      void handleCallback(request.current.signal);
    }
    return () => {
      mounted.current = false;
      queueMicrotask(() => { if (!mounted.current) request.current?.abort(); });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCallback(signal: AbortSignal) {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || params.get('auth_code'); // 支付宝回调用 auth_code
    const state = params.get('state') || '';
    const err = params.get('error') || params.get('error_description');

    // provider / intent 从签名 state 里解出(格式 <nonce>.<provider>.<intent>.<exp>.<sig>),
    // 不依赖 sessionStorage —— 手机唤起支付宝 App 授权后回调常落到另一浏览器上下文,sessionStorage 会丢。
    // 路由分流后服务端验签；Apple 另有同浏览器 state + verifier 核销，不走跨 tab 降级。
    const parts = state.split('.');
    const provider = parts[1] as RedirectAuthProvider | undefined;
    const intent = parts[2];
    // sessionStorage 优先；OAuth App 把回调送回新的 tab 时用同源 localStorage 兜底。
    const returnUrl = takeSocialReturnUrl();
    const target = socialCallbackReturnPath(returnUrl, window.location.href);
    const targetUrl = new URL(target, window.location.href);
    // Return to the initiating account screen so a retry creates new state/PKCE.
    // Preserve native handoff and expected_uid; never replay the consumed code.
    setReturnPath(/^\/(zh\/)?account$/.test(targetUrl.pathname) ? target : '/account?view=signin');
    const codeVerifier = provider === 'apple' ? consumeAppleState(state) : undefined;

    if (!provider || !(REDIRECT_AUTH_PROVIDERS as readonly string[]).includes(provider) || parts.length !== 5
      || (intent !== 'login' && intent !== 'link') || (provider === 'apple' && !codeVerifier)) {
      setErrorMsg(tr({ zh: '授权校验失败,请重试', en: 'State mismatch, please retry' })); return;
    }
    if (err) { setErrorMsg(tr({ zh: '授权已取消或被拒绝。你可以返回重新登录。', en: 'Authorization canceled or denied. You can return and try again.' })); return; }
    if (!code) { setErrorMsg(tr({ zh: '未获取到授权码', en: 'No authorization code received' })); return; }

    try {
      if (intent === 'link') {
        if (!getSessionToken()) { setErrorMsg(tr({ zh: '请先登录再绑定', en: 'Sign in before linking' })); return; }
        await linkSocial(provider, code, state, codeVerifier ?? undefined, signal);
      } else {
        const r = await loginSocial(provider, code, state, codeVerifier ?? undefined, signal);
        if (!mounted.current || signal.aborted) return;
        applySession(r.token, r.user);
        // 刚注册出来的新账号,回到 /account 时补上「你有 WCA ID 吗」那步(表单那条路是在
        // onDone 里直接切过去的,这条路整页跳走过,只能留个标记)。
        if (r.isNew && !r.user.wcaId) markWcaLinkPrompt();
      }
    } catch (e) {
      if (!mounted.current || signal.aborted) return;
      setErrorMsg(e instanceof Error ? e.message : tr({ zh: '登录失败,请重试', en: 'Login failed, please retry' }));
      return;
    }

    if (mounted.current && !signal.aborted) router.replace(target);
  }

  function cancel() {
    request.current?.abort();
    setErrorMsg(tr({
      zh: '已停止等待。服务器可能已处理请求；请返回查看账号状态，再重新登录或绑定。',
      en: 'Stopped waiting. The server may have processed the request; return to check your account before signing in or linking again.',
    }));
  }

  return (
    <AuthCallbackStatus
      pendingLabel={tr({ zh: '正在登录...', en: 'Signing in...' })}
      error={errorMsg}
      pendingActions={<div className="auth-callback-status__actions"><button type="button" className="auth-callback-status__retry" onClick={cancel}>{tr({ zh: '取消等待', en: 'Cancel waiting' })}</button></div>}
    >
      <div className="auth-callback-status__actions">
        <a className="auth-callback-status__retry" href={returnPath}>{tr({ zh: '返回账号页面重试', en: 'Return to account and retry' })}</a>
      </div>
    </AuthCallbackStatus>
  );
}
