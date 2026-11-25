'use client';

import { useEffect, useImperativeHandle, useRef, type CSSProperties, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { ClearButton } from '@/components/ClearButton';
import { useDialogMotion, useModalDismiss } from '@/hooks/useModalDismiss';
import { tr } from '@/i18n/tr';
import './training-settings.css';

export default function SettingsDialog({ ref, label, heading = false, panelClassName, drawer = false, curtain = false, dismissDisabled = false, renderCloseButton, motionDuration, portalContainer, backdropStyle, onCloseStart, onClose: onClosed, children }: {
  ref?: Ref<{ close: () => void }>;
  label: string;
  heading?: ReactNode;
  panelClassName?: string;
  drawer?: boolean;
  curtain?: boolean;
  dismissDisabled?: boolean;
  renderCloseButton?: (close: () => void, closing: boolean) => ReactNode;
  motionDuration?: number;
  portalContainer?: HTMLElement | null;
  backdropStyle?: CSSProperties;
  onCloseStart?: () => void;
  onClose: () => void;
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const { motionRef, close: onClose, isClosing } = useDialogMotion(onClosed, { drawer, curtain, duration: motionDuration, onCloseStart });
  useImperativeHandle(ref, () => ({ close: onClose }), [onClose]);
  const backdropProps = useModalDismiss(onClose, dismissDisabled);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);
  return createPortal(
    <div ref={motionRef} className="settings-dialog-backdrop" style={backdropStyle} {...backdropProps} data-no-timer>
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
          {heading ? <header className="settings-dialog-heading">{heading === true ? <h2>{label}</h2> : heading}
            {renderCloseButton ? renderCloseButton(onClose, isClosing) : <ClearButton variant="standalone" ariaLabel={tr({ zh: '关闭', en: 'Close' })} disabled={dismissDisabled} onClick={onClose} />}
          </header> : <ClearButton variant="standalone" className="settings-dialog-close" ariaLabel={tr({ zh: '关闭', en: 'Close' })} disabled={dismissDisabled} onClick={onClose} />}
          {typeof children === 'function' ? children(onClose) : children}
        </div>
      </div>
    </div>, portalContainer ?? document.body,
  );
}
