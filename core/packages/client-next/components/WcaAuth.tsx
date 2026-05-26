'use client';

/**
 * WCA login/account control — global.
 * Ported from packages/client/src/components/WcaAuth.tsx.
 * Logged-out: icon-only round button; logged-in: avatar + dropdown.
 */
import { useEffect, useRef, useState } from 'react';
import { Key, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/lib/auth-store';
import './wca_auth.css';

export default function WcaAuth() {
  const { t } = useTranslation();
  const user = useAuthStore(s => s.user);
  const login = useAuthStore(s => s.login);
  const logout = useAuthStore(s => s.logout);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!user) {
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
    <div className="wca-auth-menu" ref={ref}>
      <button
        type="button"
        className="wca-auth-trigger"
        onClick={() => setOpen(o => !o)}
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
      </button>
      {open && (
        <div className="wca-auth-dropdown">
          <div className="wca-auth-id">{user.name} · {user.wcaId}</div>
          <button
            type="button"
            className="wca-auth-item"
            onClick={() => { logout(); setOpen(false); }}
          >
            <LogOut size={14} /> {t('recon.logout')}
          </button>
        </div>
      )}
    </div>
  );
}
