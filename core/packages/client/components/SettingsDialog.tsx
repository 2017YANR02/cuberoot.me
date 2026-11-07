'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ClearButton } from '@/components/ClearButton';
import { useDialogMotion, useModalDismiss } from '@/hooks/useModalDismiss';
import { tr } from '@/i18n/tr';
import './training-settings.css';

export default function SettingsDialog({ label, heading = false, panelClassName, onClose: onClosed, children }: {
  label: string;
  heading?: boolean;
  panelClassName?: string;
  onClose: () => void;
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const { motionRef, close: onClose } = useDialogMotion(onClosed);
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
    <div ref={motionRef} className="settings-dialog-backdrop" {...backdropProps} data-no-timer>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
        className="settings-dialog" onKeyDown={event => {
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
          {heading ? <header className="settings-dialog-heading"><h2>{label}</h2>
            <ClearButton variant="standalone" ariaLabel={tr({ zh: '关闭', en: 'Close' })} onClick={onClose} />
          </header> : <ClearButton variant="standalone" className="settings-dialog-close" ariaLabel={tr({ zh: '关闭', en: 'Close' })} onClick={onClose} />}
          {typeof children === 'function' ? children(onClose) : children}
        </div>
      </div>
    </div>, document.body,
  );
}
