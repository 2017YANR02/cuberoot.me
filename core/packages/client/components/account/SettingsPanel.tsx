'use client';

import { useEffect, useId, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { parseAsStringEnum, useQueryStates } from 'nuqs';
import { Settings, Sun, ShieldCheck, UserRound, X } from '@app-foundation/icons/lucide';
import AppearanceToggle from '@/components/AppearanceToggle';
import PageBackLink from '@/components/PageBackLink';
import { ClientLoadStatus } from '@/components/StartupStatus';
import { useT } from '@/hooks/useT';
import { openInstalledAppearance, useInlineInstalledAccountSettings, useInstalledAccountDetailNavigation, useInstalledShellNavigation, useInstalledShellSurface } from '@/lib/installed-shell-navigation';
import '@cuberoot/timer-ui/timer-settings-panel.css';
import './settings-panel.css';

// Account forms depend on the browser session and render an empty shell on the
// server. Load them after hydration instead of preloading their admin-only graph.
const AccountSettings = dynamic(() => import('./AccountSettings'), { ssr: false, loading: () => <ClientLoadStatus /> });

/** One settings surface for the account URL and the chat's modal entry. */
export default function SettingsPanel({ embedded = false, onClose }: { embedded?: boolean; onClose?: () => void }) {
  const t = useT();
  const titleId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const [{ settings, view, mini_program }, setQuery] = useQueryStates({
    mini_program: parseAsStringEnum(['space', 'login']),
    settings: parseAsStringEnum(['account', 'general', 'appearance']),
    view: parseAsStringEnum(['main', 'signin', 'delete', 'submissions', 'user']),
  });
  const general = settings === 'general' || settings === 'appearance';
  const shellNavigation = useInstalledShellNavigation();
  const accountShell = useInstalledShellSurface() === 'account';
  const inlineSettings = useInlineInstalledAccountSettings();
  const detailNavigation = useInstalledAccountDetailNavigation();
  const accountDetail = !embedded && (detailNavigation || mini_program === 'space');
  const showHeader = !accountDetail && (!accountShell || inlineSettings);
  const delegateSettings = shellNavigation && (accountDetail || !inlineSettings);
  useEffect(() => {
    if (general && delegateSettings) openInstalledAppearance();
  }, [general, delegateSettings]);
  const security = !general && (view === 'signin' || view === 'delete' || view === 'user');
  // Direct appearance links must not start unrelated auth continuations.
  // Retain an opened account form while browsing General settings.
  const [accountVisited, setAccountVisited] = useState(!general);
  // Derive retention in this render, not in a click/effect update that can land
  // between nuqs's optimistic selection and Next's URL commit and restore the old tab.
  if (!general && !accountVisited) setAccountVisited(true);
  useEffect(() => { contentRef.current?.scrollTo?.({ top: 0 }); }, [settings, view]);

  const select = (section: 'space' | 'security' | 'general') => {
    if (section === 'general') void setQuery({ settings: section });
    else {
      void setQuery({ settings: embedded ? 'account' : null, view: section === 'security' ? 'signin' : null });
    }
  };

  return <section className={`settings-panel${embedded ? ' settings-panel-embedded' : ' settings-panel-page'}${accountDetail ? ' settings-panel-account-detail' : ''}`} data-site-surface="panel" aria-labelledby={showHeader ? titleId : undefined} aria-label={showHeader ? undefined : accountDetail && !general
      ? (security ? t('账号与安全', 'Account & security') : t('我的空间', 'My space')) : t('设置', 'Settings')}>
    {showHeader && <header className="settings-panel-header">
      <div className="settings-panel-heading">
        {!embedded && !accountShell && <PageBackLink className="settings-panel-back" label={t('返回', 'Back')} miniProgramTarget="account"
          onClick={event => {
            const recovery = contentRef.current?.querySelector<HTMLElement>('[data-password-recovery]');
            if (!general && recovery && recovery.dataset.passwordRecovery === window.history.state?.accountPasswordRecovery) {
              event.preventDefault();
              window.history.back();
            }
          }} />}
        <h1 id={titleId}>{t('设置', 'Settings')}</h1>
      </div>
      {onClose && <button type="button" className="settings-panel-close" aria-label={t('关闭设置', 'Close settings')} onClick={onClose}><X size={20} aria-hidden="true" /></button>}
    </header>}
    {!accountDetail && <nav className="settings-panel-nav" aria-label={t('设置分类', 'Settings categories')}>
      {(!accountShell || inlineSettings) && <button type="button" data-mobile-open-settings={inlineSettings ? undefined : 'appearance'} className="settings-panel-nav-item" aria-current={general ? 'page' : undefined} onClick={() => select('general')}><Settings size={18} aria-hidden="true" /><span>{t('设置', 'Settings')}</span></button>}
      <button type="button" className="settings-panel-nav-item" aria-current={!general && !security ? 'page' : undefined} onClick={() => select('space')}><UserRound size={18} aria-hidden="true" /><span>{t('我的空间', 'My space')}</span></button>
      <button type="button" className="settings-panel-nav-item" aria-current={security ? 'page' : undefined} onClick={() => select('security')}><ShieldCheck size={18} aria-hidden="true" /><span>{t('账号与安全', 'Account & security')}</span></button>
    </nav>}
    <div className="settings-panel-content" ref={contentRef}>
      {general && !delegateSettings && <section aria-label={t('设置', 'Settings')} className="settings-general settings-modal">
        <h2>{t('设置', 'Settings')}</h2>
        <section className="settings-section"><div className="settings-section-head"><h4>{t('通用', 'General')}</h4></div><AppearanceToggle embedded section="general" /></section>
        <section className="settings-section"><div className="settings-section-head"><h4>{t('外观', 'Appearance')}</h4></div><AppearanceToggle embedded section="appearance" /></section>
      </section>}
      {general && delegateSettings && <button type="button" className="settings-panel-nav-item" data-mobile-open-settings="appearance"><Sun size={18} aria-hidden="true" /><span>{t('外观', 'Appearance')}</span></button>}
      {(accountVisited || !general) && <div hidden={general}><AccountSettings embedded={embedded} /></div>}
    </div>
  </section>;
}
