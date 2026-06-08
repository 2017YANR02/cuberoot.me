'use client';

/**
 * WCA login/account control — global.
 * Logged-out: icon-only round button.
 * Logged-in: avatar links to the user's personal recon page (/recon/person/:wcaId);
 *            logout lives in that page's header.
 */
import { useEffect, useState } from 'react';
import Link from '@/components/AppLink';
import { Key } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/lib/auth-store';
import './wca_auth.css';

export default function WcaAuth() {
  const { t } = useTranslation();
  const user = useAuthStore(s => s.user);
  const login = useAuthStore(s => s.login);

  // SSR 拿不到 localStorage 的 auth-store hydrated user → server 永远渲染登录按钮,
  // client hydrated 出已登录 → DOM 不一致。mount 前固定渲染登录按钮占位,mount 后切真值。
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !user) {
    return (
      <button
        type="button"
        className="wca-auth-btn"
        onClick={login}
        title={t('recon.wcaLogin')}
        aria-label={t('recon.wcaLogin')}
      >
        <Key size={18} />
      </button>
    );
  }

  return (
    <Link
      href={`/recon/person/${user.wcaId}`}
      className="wca-auth-trigger"
      title={user.name || user.wcaId}
      aria-label={user.name || user.wcaId}
    >
      {user.avatar ? (
        <img src={user.avatar} alt="" className="wca-auth-avatar" />
      ) : (
        <span className="wca-auth-fallback">
          {(user.name || '?').charAt(0).toUpperCase()}
        </span>
      )}
    </Link>
  );
}
