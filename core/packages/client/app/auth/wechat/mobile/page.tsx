'use client';

import { useEffect, useRef, useState } from 'react';
import { tr } from '@/i18n/tr';
import { isWebSessionTicket } from '@cuberoot/shared/auth/web-session';
import { applySession, getSessionToken } from '@/lib/auth-store';
import {
  exchangeWechatBrowserLogin,
  startWechatBrowserLogin,
  type WechatBrowserLoginStart,
} from '@/lib/account-api';
import { takeSocialReturnUrl } from '@/lib/social-auth';
import { AuthCallbackStatus } from '../../_components/AuthCallbackStatus';
import { existingAccountRequired, getIdentityChoice, identityChoiceEntryPath, identityReturnPath, updateIdentityChoice } from '@/lib/identity-choice';

const STORAGE_KEY = 'wechat_browser_login';
const POLL_MS = 1500;

interface PendingLogin extends WechatBrowserLoginStart {
  expiresAt: number;
  existingOnly?: boolean;
}

function readPendingLogin(): PendingLogin | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<PendingLogin> | null;
    if (!value || !isWebSessionTicket(value.ticket) || typeof value.urlLink !== 'string'
      || !value.urlLink.startsWith('https://') || typeof value.expiresAt !== 'number'
      || value.expiresAt <= Date.now() || !!value.existingOnly !== existingAccountRequired()) return null;
    return value as PendingLogin;
  } catch {
    return null;
  }
}

function clearPendingLogin(): void {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* private mode */ }
}

export default function WechatMobileAuthPage() {
  const [error, setError] = useState('');
  const [retryNonce, setRetryNonce] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    const identityAtStart = getIdentityChoice();
    let pending = readPendingLogin();

    const poll = async () => {
      if (!active || !pending) return;
      try {
        const session = await exchangeWechatBrowserLogin(pending.ticket);
        if (!active) return;
        if (!session) {
          timer.current = setTimeout(poll, POLL_MS);
          return;
        }
        if (identityAtStart?.stage === 'authenticate') {
          const current = getIdentityChoice();
          if (current?.ticket !== identityAtStart.ticket || current.stage !== 'authenticate') {
            throw new Error('account choice expired or changed');
          }
        }
        if (!applySession(session.token, session.user) || getSessionToken() !== session.token) {
          throw new Error('session persistence failed');
        }
        clearPendingLogin();
        const choice = getIdentityChoice();
        if (choice?.stage === 'authenticate') updateIdentityChoice(choice.ticket, { stage: 'confirm', expectedUid: session.user.uid, otherIdentityRejected: false });
        const target = identityReturnPath(takeSocialReturnUrl() || '/');
        window.location.replace(choice ? identityChoiceEntryPath() : target);
      } catch {
        if (!active) return;
        clearPendingLogin();
        setError(tr({
          zh: '微信确认已失效或网络连接失败，请重试。',
          en: 'WeChat confirmation expired or the connection failed. Please try again.',
        }));
      }
    };

    void (async () => {
      try {
        if (!pending) {
          const started = await startWechatBrowserLogin();
          if (!active || !isWebSessionTicket(started.ticket)
            || typeof started.urlLink !== 'string' || !started.urlLink.startsWith('https://')
            || !Number.isFinite(started.expiresIn) || started.expiresIn <= 0) {
            throw new Error('invalid login start response');
          }
          pending = { ...started, existingOnly: existingAccountRequired(), expiresAt: Date.now() + started.expiresIn * 1000 };
          try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending)); } catch { /* private mode */ }
          void poll();
          window.location.href = started.urlLink;
          return;
        }
        void poll();
      } catch {
        if (!active) return;
        clearPendingLogin();
        setError(tr({
          zh: '暂时无法打开微信小程序，请重试。',
          en: 'Could not open the WeChat Mini Program. Please try again.',
        }));
      }
    })();

    const pollOnReturn = () => {
      if (document.visibilityState === 'visible' && pending && !timer.current) void poll();
    };
    document.addEventListener('visibilitychange', pollOnReturn);
    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', pollOnReturn);
    };
  }, [retryNonce]);

  return (
    <AuthCallbackStatus
      pendingLabel={tr({
        zh: '正在等待微信确认，完成后将自动登录…',
        en: 'Waiting for WeChat confirmation. You will be signed in automatically…',
      })}
      error={error}
    >
      {error ? (
        <div className="auth-callback-status__actions">
          <button
            className="auth-callback-status__retry"
            type="button"
            onClick={() => { setError(''); setRetryNonce((value) => value + 1); }}
          >
            {tr({ zh: '重新打开微信', en: 'Open WeChat again' })}
          </button>
          <a href="/">
            {tr({ zh: '使用其他方式登录', en: 'Use another sign-in method' })}
          </a>
        </div>
      ) : null}
    </AuthCallbackStatus>
  );
}
