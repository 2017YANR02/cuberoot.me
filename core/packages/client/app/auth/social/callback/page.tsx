'use client';

// 国内三方登录(微信/QQ/支付宝)授权回调。各平台把 https://<域>/auth/social/callback 登记为回调地址。
// 读回 code(支付宝为 auth_code)+ state → 对 sessionStorage 校验 CSRF → 交后端换身份(登录/绑定)。
// 结构镜像 WCA 的 app/auth/callback/page.tsx。

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { applySession, getSessionToken } from '@/lib/auth-store';
import { loginSocial, linkSocial, SOCIAL_PROVIDERS, type SocialProvider } from '@/lib/account-api';
import { SOCIAL_RETURN_KEY } from '@/lib/social-auth';
import { tr } from '@/i18n/tr';

// StrictMode 下 useEffect 会双跑;单次闸门避免 code 被消费两次(授权码单次有效)。
let processed = false;

export default function SocialCallbackPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = prev; };
  }, []);

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
    // returnUrl 是同上下文回来时的便利项,丢了就回首页,不影响登录成败。
    const returnUrl = (() => { try { const v = sessionStorage.getItem(SOCIAL_RETURN_KEY); sessionStorage.removeItem(SOCIAL_RETURN_KEY); return v; } catch { return null; } })();

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

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 9999,
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    background: 'rgba(0,0,0,0.45)',
    backdropFilter: 'blur(3px)',
    WebkitBackdropFilter: 'blur(3px)',
    color: '#e0e0e0',
    fontFamily: "'Inter', Arial, sans-serif",
  };

  return (
    <>
      <div style={overlayStyle}>
        {errorMsg ? (
          <div style={{ color: '#f87171', fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <X size={18} /> {errorMsg}
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-block', width: 24, height: 24,
              border: '3px solid rgba(255,255,255,0.2)',
              borderTopColor: '#60a5fa', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite', marginBottom: 12,
            }} />
            <div>{tr({ zh: '正在登录...', en: 'Signing in...' })}</div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
