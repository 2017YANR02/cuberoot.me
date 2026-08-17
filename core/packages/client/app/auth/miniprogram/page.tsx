'use client';

import { useEffect, useRef, useState } from 'react';
import { tr } from '@/i18n/tr';
import { applySession, getSessionToken, useAuthStore } from '@/lib/auth-store';
import {
  MINIPROGRAM_HANDOFF_FALLBACK,
  exchangeMiniProgramWebSession,
  parseMiniProgramHandoff,
  parseMiniProgramLogout,
} from '@/lib/miniprogram-auth-handoff';
import { AuthCallbackStatus } from '../_components/AuthCallbackStatus';

export default function MiniProgramAuthPage() {
  const [error, setError] = useState('');
  const [next, setNext] = useState(MINIPROGRAM_HANDOFF_FALLBACK);
  const [retryNonce, setRetryNonce] = useState(0);
  const [canRetry, setCanRetry] = useState(false);
  const exchangedSession = useRef<Awaited<ReturnType<typeof exchangeMiniProgramWebSession>> | null>(null);
  const [pendingLabel, setPendingLabel] = useState(tr({
    zh: '正在同步登录状态...',
    en: 'Syncing your session...',
  }));

  useEffect(() => {
    let active = true;
    const logout = parseMiniProgramLogout(window.location.hash);
    if (logout) {
      setNext(logout.next);
      setPendingLabel(tr({ zh: '正在退出账号...', en: 'Signing you out...' }));
      useAuthStore.getState().logout();
      window.location.replace(logout.next);
      return () => { active = false; };
    }

    const handoff = parseMiniProgramHandoff(window.location.hash);
    if (!handoff) {
      setCanRetry(false);
      setError(tr({
        zh: '登录凭证无效，请返回小程序重新打开此页面。',
        en: 'The sign-in credential is invalid. Return to the Mini Program and reopen this page.',
      }));
      return () => { active = false; };
    }

    setNext(handoff.next);
    setCanRetry(false);
    void (exchangedSession.current
      ? Promise.resolve(exchangedSession.current)
      : exchangeMiniProgramWebSession(handoff.ticket))
      .then((session) => {
        if (!active) return;
        exchangedSession.current = session;
        if (!applySession(session.token, session.user) || getSessionToken() !== session.token) {
          throw new Error('session persistence failed');
        }
        window.location.replace(handoff.next);
      })
      .catch(() => {
        if (!active) return;
        setCanRetry(true);
        setError(tr({
          zh: '登录衔接失败，可直接重试；若仍失败，请返回小程序重新打开此页面。',
          en: 'Could not continue sign-in. Retry here, or return to the Mini Program and reopen this page.',
        }));
      });

    return () => { active = false; };
  }, [retryNonce]);

  const retry = () => {
    setCanRetry(false);
    setError('');
    setRetryNonce((value) => value + 1);
  };

  return (
    <AuthCallbackStatus
      pendingLabel={pendingLabel}
      error={error}
    >
      <div className="auth-callback-status__actions">
        {canRetry ? (
          <button className="auth-callback-status__retry" type="button" onClick={retry}>
            {tr({ zh: '重试登录', en: 'Retry sign-in' })}
          </button>
        ) : null}
        <a href={next}>
          {tr({ zh: '暂不登录，继续浏览', en: 'Continue without signing in' })}
        </a>
      </div>
    </AuthCallbackStatus>
  );
}
