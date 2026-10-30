'use client';

import { useEffect, useRef } from 'react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import SettingsPanel from '@/components/account/SettingsPanel';
import { ClientLoadStatus } from '@/components/StartupStatus';
import { useModalBackdrop } from '@/hooks/useModalDismiss';
import { useT } from '@/hooks/useT';

/** The persistent root host keeps conversations alive while settings are open. */
export default function ChatPage() {
  const t = useT();
  const [settings, setSettings] = useQueryState('settings', parseAsStringEnum(['account', 'general', 'appearance']));
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => { void setSettings(null); };
  const backdrop = useModalBackdrop(close);
  useEffect(() => {
    if (!settings) return;
    return () => { document.querySelector<HTMLButtonElement>('.chat-account-trigger')?.focus(); };
  }, [Boolean(settings)]);
  useEffect(() => {
    const element = dialog.current;
    if (settings && element && !element.open) element.showModal();
    else if (!settings && element?.open) element.close();
  }, [settings]);

  return <>
    <main className="chat-route-placeholder"><ClientLoadStatus /></main>
    {settings && <dialog className="chat-settings-dialog" ref={dialog} aria-label={t('设置', 'Settings')}
      {...backdrop} onCancel={event => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        close();
      }}>
      <SettingsPanel embedded onClose={close} />
    </dialog>}
  </>;
}
