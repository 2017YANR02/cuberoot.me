'use client';

import { useState } from 'react';
import { notFound } from 'next/navigation';
import AppLink from '@/components/AppLink';
import RegistrationConsent from '@/components/account/RegistrationConsent';
import { useT } from '@/hooks/useT';
import '@cuberoot/app-ui/account-forms.css';
import '@/components/auth-panel.css';
import '@/components/account/account.css';

export default function RegistrationPreview() {
  const t = useT();
  const [created, setCreated] = useState(false);
  if (process.env.NODE_ENV !== 'development') notFound();
  return <main className="account-page"><div className="auth-flow">
    {created ? <>
      <h2 className="auth-title">{t('模拟注册成功', 'Mock registration complete')}</h2>
      <button className="auth-textbtn" onClick={() => setCreated(false)}>{t('重新预览', 'Restart preview')}</button>
    </> : <>
      <h2 className="auth-title">{t('你有 CubeRoot 账号吗？', 'Do you have a CubeRoot account?')}</h2>
      <p className="auth-hint">{t('保留原账号的会员和资料。', 'Keep your existing membership and profile.')}</p>
      <AppLink className="auth-primary" href="/account">{t('登录已有账号', 'Sign in to an existing account')}</AppLink>
      <RegistrationConsent busy={false} onCreate={() => setCreated(true)} />
      <AppLink className="auth-textbtn" href="/account">{t('取消', 'Cancel')}</AppLink>
    </>}
  </div></main>;
}
