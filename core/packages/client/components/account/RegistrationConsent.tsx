'use client';

import { useId, useRef, useState } from 'react';
import AppLink from '@/components/AppLink';
import { useModalBackdrop } from '@/hooks/useModalDismiss';
import { useT } from '@/hooks/useT';

function PolicyLinks() {
  const t = useT();
  return <>
    <AppLink href="/terms" target="_blank" rel="noopener noreferrer">{t('《用户协议》', 'User Agreement')}</AppLink>
    {t('及', ' and ')}
    <AppLink href="/privacy" target="_blank" rel="noopener noreferrer">{t('《隐私政策》', 'Privacy Policy')}</AppLink>
  </>;
}

export default function RegistrationConsent({ busy, onCreate }: { busy: boolean; onCreate: (accepted: true) => void }) {
  const t = useT();
  const [accepted, setAccepted] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const close = () => dialog.current?.close();
  const backdrop = useModalBackdrop(close);
  return <>
    <label className="auth-agreement">
      <input type="checkbox" checked={accepted} disabled={busy} onChange={e => setAccepted(e.target.checked)} />
      <span>{t('我同意', 'I agree to the ')}<PolicyLinks /></span>
    </label>
    <button type="button" className="auth-textbtn" disabled={busy}
      onClick={() => accepted ? onCreate(accepted) : dialog.current?.showModal()}>
      {t('创建新账号', 'Create a new account')}
    </button>
    <dialog ref={dialog} aria-labelledby={titleId} className="auth-consent-dialog" {...backdrop}>
      <div data-site-surface="popover" className="auth-flow">
        <h2 className="auth-title" id={titleId}>{t('是否同意并注册？', 'Agree and create an account?')}</h2>
        <p>{t('创建账号需要你同意', 'To create an account, please agree to the ')}<PolicyLinks />{t('。', '.')}</p>
        <button type="button" className="auth-primary" onClick={() => { close(); setAccepted(true); onCreate(true); }}>
          {t('同意并注册', 'Agree and register')}
        </button>
        <button type="button" className="auth-textbtn" onClick={close}>{t('暂不同意', 'Decline')}</button>
      </div>
    </dialog>
  </>;
}
