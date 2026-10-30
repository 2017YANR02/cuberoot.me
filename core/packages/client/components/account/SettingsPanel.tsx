'use client';

import { useEffect, useId, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { parseAsStringEnum, useQueryStates } from 'nuqs';
import { Settings, Sun, ShieldCheck, UserRound, X } from '@app-foundation/icons/lucide';
import AppearanceToggle from '@/components/AppearanceToggle';
import BackHome from '@/components/BackHome';
import { ClientLoadStatus } from '@/components/StartupStatus';
import { useT } from '@/hooks/useT';
import './settings-panel.css';

// Account forms depend on the browser session and render an empty shell on the
// server. Load them after hydration instead of preloading their admin-only graph.
const AccountSettings = dynamic(() => import('./AccountSettings'), { ssr: false, loading: () => <ClientLoadStatus /> });

/** One settings surface for the account URL and the chat's modal entry. */
export default function SettingsPanel({ embedded = false, onClose }: { embedded?: boolean; onClose?: () => void }) {
  const t = useT();
  const titleId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const [{ settings, view }, setQuery] = useQueryStates({
    settings: parseAsStringEnum(['account', 'general', 'appearance']),
    view: parseAsStringEnum(['main', 'signin', 'delete', 'submissions', 'user']),
  });
  const general = settings === 'general' || settings === 'appearance';
  const appearance = settings === 'appearance';
  const security = !general && (view === 'signin' || view === 'delete' || view === 'user');
  // Direct appearance links must not start unrelated auth continuations.
  // Retain an opened account form while browsing General settings.
  const [accountVisited, setAccountVisited] = useState(!general);
  useEffect(() => { if (!general) setAccountVisited(true); }, [general]);
  useEffect(() => { contentRef.current?.scrollTo?.({ top: 0 }); }, [settings, view]);

  const select = (section: 'space' | 'security' | 'general' | 'appearance') => {
    if (section === 'general' || section === 'appearance') void setQuery({ settings: section });
    else {
      setAccountVisited(true);
      void setQuery({ settings: embedded ? 'account' : null, view: section === 'security' ? 'signin' : null });
    }
  };

  return <section className={`settings-panel${embedded ? ' settings-panel-embedded' : ' settings-panel-page'}`} data-site-surface="panel" aria-labelledby={titleId}>
    <header className="settings-panel-header">
      <div className="settings-panel-heading">
        {!embedded && <BackHome prefetch={false} miniProgramTarget="account" />}
        <h1 id={titleId}>{t('设置', 'Settings')}</h1>
      </div>
      {onClose && <button type="button" className="settings-panel-close" aria-label={t('关闭设置', 'Close settings')} onClick={onClose}><X size={20} aria-hidden="true" /></button>}
    </header>
    <nav className="settings-panel-nav" aria-label={t('设置分类', 'Settings categories')}>
      <button type="button" className="settings-panel-nav-item" aria-current={general && !appearance ? 'page' : undefined} onClick={() => select('general')}><Settings size={18} aria-hidden="true" /><span>{t('通用', 'General')}</span></button>
      <button type="button" className="settings-panel-nav-item" aria-current={appearance ? 'page' : undefined} onClick={() => select('appearance')}><Sun size={18} aria-hidden="true" /><span>{t('外观', 'Appearance')}</span></button>
      <button type="button" className="settings-panel-nav-item" aria-current={!general && !security ? 'page' : undefined} onClick={() => select('space')}><UserRound size={18} aria-hidden="true" /><span>{t('我的空间', 'My space')}</span></button>
      <button type="button" className="settings-panel-nav-item" aria-current={security ? 'page' : undefined} onClick={() => select('security')}><ShieldCheck size={18} aria-hidden="true" /><span>{t('账号与安全', 'Account & security')}</span></button>
    </nav>
    <div className="settings-panel-content" ref={contentRef}>
      {general && <section aria-label={appearance ? t('外观', 'Appearance') : t('通用', 'General')} className="settings-general"><h2>{appearance ? t('外观', 'Appearance') : t('通用', 'General')}</h2><AppearanceToggle embedded section={appearance ? 'appearance' : 'general'} /></section>}
      {(accountVisited || !general) && <div hidden={general}><AccountSettings embedded={embedded} /></div>}
    </div>
  </section>;
}
