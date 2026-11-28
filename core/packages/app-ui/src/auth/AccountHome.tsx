import { ChevronLeft, ChevronRight, Crown, LogOut, Settings, Shield, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SupportedLanguage } from '../copy';
import type { InstalledAppAuth } from '../platform';
import { InstalledSignIn } from './InstalledSignIn';
import './credential-forms.css';
import './account-home.css';

export type AccountPage = 'home' | 'sign-in' | 'recover-password' | 'profile' | 'security' | 'membership';

export function AccountBack({ language, onBack, label }: { language: SupportedLanguage; label?: string; onBack: () => void }) {
  return <button className="installed-account-back" aria-label={label ?? { zh: '返回「我的」', en: 'Back to My account' }[language]}
    type="button" onClick={onBack}><ChevronLeft aria-hidden="true" size={22} /></button>;
}

export function AccountHome({ auth, language, page, onNavigate, onSettings, onLogout, openPolicy }: {
  auth: InstalledAppAuth;
  language: SupportedLanguage;
  page: 'home' | 'sign-in' | 'recover-password';
  onNavigate: (page: AccountPage) => void;
  onSettings: () => void;
  onLogout: () => void;
  openPolicy: (policy: 'terms' | 'privacy') => void;
}) {
  const t = (zh: string, en: string) => ({ zh, en })[language];
  const user = auth.session?.user;
  const avatar = user?.avatar;
  const avatarUrl = avatar?.startsWith('/') && !avatar.startsWith('//') ? `https://cuberoot.me${avatar}` : avatar;
  if (page !== 'home') {
    const recovering = page === 'recover-password';
    const title = recovering ? t('找回密码', 'Reset password') : t('登录 / 注册', 'Sign in / up');
    return <section className="installed-account" aria-label={title}>
      <div className="installed-account-content">
        <header className="installed-account-header">
          <AccountBack language={language} label={recovering ? t('返回登录', 'Back to sign-in') : undefined} onBack={() => onNavigate(recovering ? 'sign-in' : 'home')} />
          <h1>{title}</h1>
        </header>
        <InstalledSignIn recovering={recovering} onRecoveryChange={open => onNavigate(open ? 'recover-password' : 'sign-in')} auth={auth} language={language} onClose={() => onNavigate('home')} openPolicy={openPolicy} />
      </div>
    </section>;
  }
  return (
    <section className="installed-account" aria-label={t('我的', 'My account')}>
      <div className="installed-account-content">
        <header className="installed-account-header"><h1>{t('我的', 'My account')}</h1></header>
        {auth.loading ? <p className="auth-hint" role="status">{t('正在读取账号…', 'Loading account…')}</p>
          : auth.accountReadError ? (
            <div>
              <p className="auth-error" role="alert">{t('暂时无法读取账号，请重试。', 'Could not read your account. Please retry.')}</p>
              <button className="auth-primary installed-account-login" type="button" onClick={() => void auth.retryAccountRead()}>
                {t('重试', 'Retry')}
              </button>
            </div>
          )
          : user ? (
            <div className="installed-account-identity">
              {avatarUrl && /^https:\/\//i.test(avatarUrl)
                ? <img className="installed-account-avatar" src={avatarUrl} alt="" />
                : <span className="installed-account-avatar"><UserRound aria-hidden="true" size={25} /></span>}
              <div><strong>{user.name || t('CubeRoot 用户', 'CubeRoot user')}</strong>
                <span>{user.wcaId || `ID ${user.uid}`}</span></div>
              <button className="installed-account-membership" type="button" onClick={() => onNavigate('membership')}>
                <Crown aria-hidden="true" size={19} />
                {t('订阅 Pro', 'Subscribe to Pro')}
              </button>
            </div>
          ) : <button className="auth-primary installed-account-login" type="button" onClick={() => onNavigate('sign-in')}>
            {t('登录 / 注册', 'Sign in / up')}
          </button>}
        <div className="installed-account-actions">
          {user && <>
            <AccountAction icon={<UserRound />} label={t('我的空间', 'My space')} onClick={() => onNavigate('profile')} />
            <AccountAction icon={<Shield />} label={t('账号与安全', 'Account & security')} onClick={() => onNavigate('security')} />
          </>}
          <AccountAction icon={<Settings />} label={t('设置', 'Settings')} onClick={onSettings} />
          {user && <AccountAction icon={<LogOut />} label={t('退出登录', 'Sign out')} onClick={onLogout} disabled={auth.busy} />}
        </div>
      </div>
    </section>
  );
}

function AccountAction({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className="installed-account-action" onClick={onClick} disabled={disabled}>
    <span aria-hidden="true">{icon}</span>
    {label}
    <ChevronRight aria-hidden="true" size={16} />
  </button>;
}
