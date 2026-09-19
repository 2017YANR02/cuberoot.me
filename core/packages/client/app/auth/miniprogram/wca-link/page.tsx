'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { AuthCallbackStatus } from '../../_components/AuthCallbackStatus';
import { tr } from '@/i18n/tr';

export default function MiniProgramWcaLinkPage() {
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    const ticket = new URLSearchParams(window.location.search).get('ticket')?.trim() ?? '';
    if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) { setInvalid(true); return; }
    sessionStorage.setItem('wca_mini_link_ticket', ticket);
    sessionStorage.setItem('wca_oauth_intent', 'mini_wca_link');
    useAuthStore.getState().loginWithWca('/auth/miniprogram/wca-link');
  }, []);

  return (
    <AuthCallbackStatus
      pendingLabel={tr({ zh: '正在打开 WCA 授权页…', en: 'Opening WCA authorization…' })}
      error={invalid ? tr({ zh: '绑定请求无效，请返回小程序重试。', en: 'This link request is invalid. Return to the Mini Program and retry.' }) : ''}
    />
  );
}
