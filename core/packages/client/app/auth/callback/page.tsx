'use client';

// WCA OAuth Implicit Grant callback — ported from packages/client-vite/src/pages/AuthCallbackPage.tsx.
// Reads access_token from URL hash, calls WCA /me, exchanges for long-lived JWT, then returns to wca_return_url.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api-base';
import {
  applySession,
  exchangeWcaSession,
  persistAuthItem,
  useAuthStore,
} from '@/lib/auth-store';
import { tr } from '@/i18n/tr';
import { AuthCallbackStatus } from '../_components/AuthCallbackStatus';

const ME_URL = 'https://www.worldcubeassociation.org/api/v0/me';

// React StrictMode double-invokes useEffect in dev. Single-shot guard so OAuth state isn't consumed twice.
let callbackProcessed = false;

export default function AuthCallbackPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (callbackProcessed) return;
    callbackProcessed = true;
    void handleOAuthCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleOAuthCallback() {
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
      await handleWcaLink(accessToken, returnUrl);
      return;
    }

    try {
      const res = await fetch(ME_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`WCA /me failed: ${res.status}`);
      const data = await res.json();
      const me = data.me;

      const user = {
        wcaId: me.wca_id,
        name: me.name,
        avatar: me.avatar?.thumb_url || '',
        country: me.country_iso2 || '',
      };
      // Resilient writes: localStorage may be (near-)full on mobile (e.g. iOS
      // Safari's ~5MB quota packed with timer backups). persistAuthItem evicts
      // regenerable caches and retries; a raw setItem here would throw
      // QuotaExceededError ("The quota has been exceeded.") and abort login.
      const persisted =
        persistAuthItem('wca_user', JSON.stringify(user)) &&
        persistAuthItem('wca_access_token', accessToken);
      if (!persisted) {
        setErrorMsg(tr({
          zh: '无法保存登录状态：浏览器存储空间不足或处于隐私模式。请退出隐私模式或清理浏览器存储后重试。',
          en: 'Could not save your session: browser storage is full or in private mode. Exit private browsing or free up storage, then try again.',
        }));
        return;
      }
      // Reflect login in the in-memory store for this tab immediately.
      useAuthStore.getState().refresh();

      // Best effort: exchange short-lived WCA token for long-lived (365d) JWT.
      try {
        await exchangeWcaSession(accessToken);
      } catch {
        // Non-fatal — fall back to raw WCA token (2h).
      }

      const target = returnUrl || '/recon';
      try {
        const u = new URL(target, window.location.href);
        router.replace(u.pathname + u.search + u.hash);
      } catch {
        router.replace('/recon');
      }
    } catch (err) {
      setErrorMsg(tr({ zh: `登录失败: ${(err as Error).message}`, en: `Login failed: ${(err as Error).message}` }));
    }
  }

  async function handleWcaLink(accessToken: string, returnUrl: string | null) {
    try {
      const jwt = localStorage.getItem('cuberoot_jwt');
      if (jwt) {
        const r = await fetch(apiUrl('/v1/auth/link/wca'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
          body: JSON.stringify({ accessToken }),
        });
        if (r.ok) {
          const d = await r.json();
          if (d.token && d.user) applySession(d.token, d.user);
        } else {
          const d = await r.json().catch(() => ({}));
          setErrorMsg(tr({ zh: `绑定失败:${d.error ?? r.status}`, en: `Link failed: ${d.error ?? r.status}` }));
          return;
        }
      }
      const target = returnUrl || '/';
      const u = new URL(target, window.location.href);
      router.replace(u.pathname + u.search + u.hash);
    } catch {
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
