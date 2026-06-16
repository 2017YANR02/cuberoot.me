'use client';

import { Brush, LogIn } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useAuthStore } from '@/lib/auth-store';

// /paint is login-gated: drawings live in the user's cloud library (server-side,
// visible across devices), so an account is required to use the editor at all.
export default function PaintGate() {
  const t = useT();
  const login = useAuthStore((s) => s.login);
  return (
    <div className="paint-gate">
      <div className="paint-gate-card">
        <Brush size={32} className="paint-gate-icon" />
        <h1 className="paint-gate-title">{t('绘制', 'Paint')}</h1>
        <p className="paint-gate-text">
          {t(
            '登录后即可使用矢量编辑器。你的作品会保存到云端作品库,换设备登录也能继续编辑。',
            'Sign in to use the vector editor. Your drawings are saved to a cloud library you can reopen on any device.',
          )}
        </p>
        <button type="button" className="paint-btn paint-btn--accent paint-gate-login" onClick={login}>
          <LogIn size={16} />
          <span>{t('用 WCA 账号登录', 'Sign in with WCA')}</span>
        </button>
      </div>
    </div>
  );
}
