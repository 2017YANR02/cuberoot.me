'use client';

// WCA OAuth Implicit Grant callback — ported from packages/client-vite/src/pages/AuthCallbackPage.tsx.
// The WCA assertion is exchanged for a canonical session before anything is persisted.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api-base';
import {
  applySession,
  getRolePreview,
  getSessionToken,
} from '@/lib/auth-store';
import { tr } from '@/i18n/tr';
import { AuthCallbackStatus } from '../_components/AuthCallbackStatus';
import { loginWca } from '@/lib/account-api';
import { AccountChoiceRequired, getIdentityChoice, identityChoiceEntryPath, identityReturnPath, rememberIdentityChoice, updateIdentityChoice } from '@/lib/identity-choice';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState('');
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    if (!request.current) {
      request.current = new AbortController();
      void handleOAuthCallback(request.current.signal);
    }
    return () => {
      mounted.current = false;
      queueMicrotask(() => { if (!mounted.current) request.current?.abort(); });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleOAuthCallback(signal: AbortSignal) {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const state = params.get('state');
    const error = params.get('error');

    // 一次性读取并清空所有 OAuth 会话标记 —— 无论走哪条早退分支(error / 无 token / state
    // 不匹配)都不残留脏 intent。否则一次中断的绑定会把 intent='link' 卡在 sessionStorage,
    // 误导下一次普通 WCA 登录走 link 路径、无 jwt 时静默失败(用户走完授权却仍是登出态)。
    const savedState = sessionStorage.getItem('wca_oauth_state');
    const intent = sessionStorage.getItem('wca_oauth_intent');
    const returnUrl = sessionStorage.getItem('wca_return_url');
    sessionStorage.removeItem('wca_oauth_state');
    sessionStorage.removeItem('wca_oauth_intent');
    sessionStorage.removeItem('wca_return_url');

    if (getRolePreview()) {
      setErrorMsg(tr({ zh: '请先退出角色测试，再登录或绑定账号。', en: 'Exit role testing before signing in or linking accounts.' }));
      return;
    }

    if (error) {
      setErrorMsg(tr({ zh: `授权被拒绝: ${error}`, en: `Authorization denied: ${error}` }));
      return;
    }
    if (!accessToken) {
      setErrorMsg(tr({ zh: '未获取到 access_token', en: 'No access_token received'
    }));
      return;
    }
    if (!savedState || savedState !== state) {
      setErrorMsg(tr({ zh: 'OAuth state 不匹配，请重试', en: 'OAuth state mismatch, please retry'
    }));
      return;
    }

    // 「绑定 WCA」意图:当前已登录(邮箱/手机账号),把 WCA 加为身份而非重新登录。
    if (intent === 'link') {
      await handleWcaLink(accessToken, returnUrl, signal);
      return;
    }

    try {
      const result = await loginWca(accessToken, signal);
      if (!mounted.current || signal.aborted) return;
      if (!applySession(result.token, result.user)) throw new Error(tr({ zh: '无法保存登录状态，请检查浏览器存储后重试。', en: 'Could not save your session. Check browser storage and retry.' }));
      const pending = getIdentityChoice();
      if (pending?.stage === 'authenticate' && result.user.uid) updateIdentityChoice(pending.ticket, { stage: 'confirm', expectedUid: result.user.uid, otherIdentityRejected: false });
      router.replace(pending ? identityChoiceEntryPath() : identityReturnPath(returnUrl || '/recon'));
    } catch (err) {
      if (!mounted.current || signal.aborted) return;
      if (err instanceof AccountChoiceRequired) {
        try { rememberIdentityChoice(err, returnUrl || '/recon'); router.replace(identityChoiceEntryPath()); }
        catch { setErrorMsg(tr({ zh: '无法保存登录步骤，请允许浏览器使用存储后重试。', en: 'Could not save the sign-in step. Allow browser storage and retry.' })); }
        return;
      }
      setErrorMsg(tr({ zh: `登录失败: ${(err as Error).message}`, en: `Login failed: ${(err as Error).message}` }));
    }
  }

  async function handleWcaLink(accessToken: string, returnUrl: string | null, signal: AbortSignal) {
    try {
      const jwt = getSessionToken();
      if (!jwt) throw new Error('Sign in before linking');
      if (jwt) {
        const r = await fetch(apiUrl('/v1/auth/link/wca'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
          body: JSON.stringify({ accessToken }),
          signal,
        });
        if (r.ok) {
          const d = await r.json();
          if (!mounted.current || signal.aborted) return;
          if (d.token && d.user) applySession(d.token, d.user);
        } else {
          const d = await r.json().catch(() => ({}));
          setErrorMsg(tr({ zh: `绑定失败:${d.error ?? r.status}`, en: `Link failed: ${d.error ?? r.status}` }));
          return;
        }
      }
      if (mounted.current && !signal.aborted) router.replace(identityReturnPath(returnUrl || '/'));
    } catch {
      if (!mounted.current || signal.aborted) return;
      setErrorMsg(tr({ zh: '绑定失败,请重试', en: 'Link failed, please retry' }));
    }
  }

  return (
    <AuthCallbackStatus
      pendingLabel={tr({ zh: '正在登录 WCA...', en: 'Signing in to WCA...' })}
      error={errorMsg}
    />
  );
}
