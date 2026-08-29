'use client';

import { useEffect, useState } from 'react';
import { tr } from '@/i18n/tr';
import { getSessionToken } from '@/lib/auth-store';
import {
  decodeMobileAuthRequest,
  issueMobileAuthTicket,
  mobileAuthAccountHref,
  mobileAuthCallbackHref,
} from '@/lib/mobile-auth-handoff';
import { AuthCallbackStatus } from '../_components/AuthCallbackStatus';

export default function MobileAuthPage() {
  const [error, setError] = useState('');
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let active = true;
    const request = decodeMobileAuthRequest(window.location.search);
    if (!request) {
      setError(tr({
        zh: '移动端登录请求无效，请返回 CubeRoot App 重新开始。',
        en: 'This mobile sign-in request is invalid. Return to the CubeRoot app and try again.',
      }));
      return () => { active = false; };
    }

    const token = getSessionToken();
    if (!token) {
      window.location.replace(mobileAuthAccountHref(request));
      return () => { active = false; };
    }

    setError('');
    void issueMobileAuthTicket(request, token)
      .then(({ ticket }) => {
        if (active) window.location.replace(mobileAuthCallbackHref(request, ticket));
      })
      .catch(() => {
        if (!active) return;
        setError(tr({
          zh: '暂时无法把登录状态交给 App，请重试。',
          en: 'Could not return your session to the app. Please try again.',
        }));
      });

    return () => { active = false; };
  }, [retryNonce]);

  return (
    <AuthCallbackStatus
      pendingLabel={tr({ zh: '正在返回 CubeRoot App…', en: 'Returning to the CubeRoot app…' })}
      error={error}
    >
      {error ? (
        <div className="auth-callback-status__actions">
          <button
            className="auth-callback-status__retry"
            onClick={() => setRetryNonce((value) => value + 1)}
            type="button"
          >
            {tr({ zh: '重试', en: 'Retry' })}
          </button>
        </div>
      ) : null}
    </AuthCallbackStatus>
  );
}
