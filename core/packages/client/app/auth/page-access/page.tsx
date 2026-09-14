'use client';

import { useEffect } from 'react';
import { tr } from '@/i18n/tr';
import { safeNext } from '@/lib/auth-store';
import { AuthCallbackStatus } from '../_components/AuthCallbackStatus';

/** Existing sign-in return URLs may still point here after page gates were removed. */
export default function PageAccess() {
  useEffect(() => {
    const next = safeNext(new URLSearchParams(window.location.search).get('next')) || '/';
    window.location.replace(next.startsWith('/auth/page-access') ? '/' : next);
  }, []);
  return <AuthCallbackStatus pendingLabel={tr({ zh: '正在打开页面…', en: 'Opening page…' })} />;
}
