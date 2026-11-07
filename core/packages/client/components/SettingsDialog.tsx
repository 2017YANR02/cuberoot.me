'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ClearButton } from '@/components/ClearButton';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { tr } from '@/i18n/tr';
import './training-settings.css';

export default function SettingsDialog({ label, panelClassName, closing = false, onClose, children }: {
  label: string;
  panelClassName?: string;
  closing?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const backdropProps = useModalDismiss(onClose);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);
  return createPortal(
    <div className="settings-dialog-backdrop" data-state={closing ? 'closing' : 'open'} {...backdropProps} data-no-timer>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
        className="settings-dialog" inert={closing} onKeyDown={event => {
          if (event.key !== 'Tab') return;
          const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')]
            .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
          const first = controls[0];
          const last = controls.at(-1);
          if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
            event.preventDefault(); last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first?.focus();
          }
        }}>
        <div className={`settings-popover-panel settings-dialog-panel${panelClassName ? ` ${panelClassName}` : ''}`} data-site-surface="popover">
          <ClearButton variant="standalone" className="settings-dialog-close" ariaLabel={tr({ zh: '关闭', en: 'Close' })} onClick={onClose} />
          {children}
        </div>
      </div>
    </div>, document.body,
  );
}
