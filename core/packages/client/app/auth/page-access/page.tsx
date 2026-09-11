'use client';

import { useEffect, useState } from 'react';
import { tr } from '@/i18n/tr';
import { changeAppLanguage } from '@/i18n/i18n-client';
import { getSessionToken, safeNext } from '@/lib/auth-store';
import { syncPageSessionCookie } from '@/lib/home-card-access';
import { verifyPageAdmin } from '@/lib/page-admin-session';
import { AuthCallbackStatus } from '../_components/AuthCallbackStatus';

export default function PageAccess() {
  const [error, setError] = useState('');
  const [login, setLogin] = useState('/account');
  useEffect(() => {
    let active = true;
    const next = safeNext(new URLSearchParams(window.location.search).get('next')) || '/';
    const prefix = next === '/zh' || next.startsWith('/zh/') ? '/zh' : '';
    changeAppLanguage(prefix ? 'zh' : 'en');
    setLogin(`${prefix}/account?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    const token = getSessionToken();
    void verifyPageAdmin(token).then((admin) => {
      if (!active) return;
      if (!admin) {
        syncPageSessionCookie('');
        setError(tr({ zh: '页面开发中，仅管理员可访问。', en: 'This page is in development and available to administrators only.' }));
        return;
      }
      syncPageSessionCookie(token);
      window.location.replace(next.startsWith('/auth/page-access') ? '/' : next);
    }).catch(() => {
      if (active) setError(tr({ zh: '暂时无法验证访问权限，请刷新重试。', en: 'Could not verify access. Please refresh to retry.' }));
    });
    return () => { active = false; };
  }, []);
  return <AuthCallbackStatus pendingLabel={tr({ zh: '正在验证访问权限…', en: 'Checking page access…' })} error={error}>
    <a className="auth-callback-status__retry" href={login}>{tr({ zh: '管理员登录', en: 'Administrator sign-in' })}</a>
  </AuthCallbackStatus>;
}
