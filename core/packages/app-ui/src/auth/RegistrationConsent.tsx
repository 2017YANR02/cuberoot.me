import { useId, useRef, useState, type ComponentType, type ReactNode } from 'react';
import BoolToggle, { type BoolToggleProps } from '@cuberoot/timer-ui/BoolToggle';
import { useModalBackdrop } from '@cuberoot/timer-ui/modal-dismiss';
import type { AccountTranslate } from './credential-forms';

export function RegistrationConsent({ busy, onCreate, links, t, Toggle = BoolToggle }: {
  busy: boolean; onCreate: (accepted: true) => void; links: ReactNode;
  t: AccountTranslate; Toggle?: ComponentType<BoolToggleProps>;
}) {
  const [accepted, setAccepted] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const close = () => dialog.current?.close();
  const backdrop = useModalBackdrop(close);
  return <>
    <div className="auth-agreement">
      <Toggle value={accepted} onChange={setAccepted} disabled={busy}
        label={t('我同意', 'I agree to the')}
        ariaLabel={t('同意用户协议及隐私政策', 'Agree to the User Agreement and Privacy Policy')} />
      <span>{links}</span>
    </div>
    <button type="button" className="auth-textbtn" disabled={busy}
      onClick={() => accepted ? onCreate(accepted) : dialog.current?.showModal()}>
      {t('创建新账号', 'Create a new account')}
    </button>
    <dialog ref={dialog} aria-labelledby={titleId} className="auth-consent-dialog" {...backdrop}>
      <div data-site-surface="popover" className="auth-flow">
        <h2 className="auth-title" id={titleId}>{t('是否同意并注册？', 'Agree and create an account?')}</h2>
        <p>{t('创建账号需要你同意', 'To create an account, please agree to the ')}{links}{t('。', '.')}</p>
        <button type="button" className="auth-primary" onClick={() => { close(); setAccepted(true); onCreate(true); }}>
          {t('同意并注册', 'Agree and register')}
        </button>
        <button type="button" className="auth-textbtn" onClick={close}>{t('暂不同意', 'Decline')}</button>
      </div>
    </dialog>
  </>;
}
