'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Settings } from '@app-foundation/icons/lucide';
import { ClearButton } from '@/components/ClearButton';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import BoolToggle from '@/components/BoolToggle';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import { usePopoverDismiss } from '@/hooks/usePopoverDismiss';
import { tr } from '@/i18n/tr';
import { persistItem } from '@/lib/safe-storage';
import { useTrainingHost } from '@/lib/training-host';
import './training-settings.css';

const STORAGE_KEY = 'training-auto-advance';
const AUTO_ADVANCE_DELAY_MS = 900;
let current: boolean | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    current = null;
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot(): boolean {
  if (current === null) {
    try {
      current = localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      current = false;
    }
  }
  return current;
}

export function useTrainingAutoAdvance() {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);
  const setEnabled = useCallback((next: boolean) => {
    cancel();
    current = next;
    persistItem(STORAGE_KEY, next ? '1' : '0');
    for (const listener of listeners) listener();
  }, [cancel]);
  const schedule = useCallback((advance: () => void) => {
    cancel();
    if (!enabled) return;
    timerRef.current = setTimeout(advance, AUTO_ADVANCE_DELAY_MS);
  }, [cancel, enabled]);
  useEffect(() => cancel, [cancel]);
  return useMemo(() => ({ enabled, setEnabled, schedule, cancel }), [cancel, enabled, schedule, setEnabled]);
}

function SettingsDialog({ label, panelClassName, onClose, children }: {
  label: string;
  panelClassName?: string;
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
    <div className="settings-dialog-backdrop" {...backdropProps} data-no-timer>
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
          <ClearButton variant="standalone" className="settings-dialog-close" ariaLabel={tr({ zh: '关闭', en: 'Close' })} onClick={onClose} />
          {children}
        </div>
      </div>
    </div>, document.body,
  );
}

export function SettingsPopover({
  label,
  className,
  triggerClassName,
  panelClassName,
  triggerPrefix,
  triggerSuffix,
  iconSize = 18,
  open: controlledOpen,
  onOpenChange,
  ignoreTimer = false,
  hosted = false,
  modal = false,
  children,
}: {
  label: string;
  className?: string;
  triggerClassName?: string;
  panelClassName?: string;
  triggerPrefix?: ReactNode;
  triggerSuffix?: ReactNode;
  iconSize?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  ignoreTimer?: boolean;
  /** Explicit opt-in: specialized trainers keep their own settings placement. */
  hosted?: boolean;
  modal?: boolean;
  children?: ReactNode;
}) {
  const trainingHost = useTrainingHost();
  const settingsHost = hosted ? trainingHost : null;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = useCallback((next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }, [controlledOpen, onOpenChange]);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  usePanelClamp(open && !modal, panelRef);
  usePopoverDismiss(open && !modal, () => setOpen(false), rootRef, triggerRef);
  const close = useCallback(() => setOpen(false), [setOpen]);

  const popover = (
    <div
      ref={rootRef}
      className={`settings-popover${className ? ` ${className}` : ''}`}
      data-no-timer={ignoreTimer || undefined}
    >
      {!settingsHost && triggerPrefix}
      <button
        ref={triggerRef}
        type="button"
        className={`settings-popover-trigger${triggerClassName ? ` ${triggerClassName}` : ''}`}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Settings size={iconSize} aria-hidden="true" />
      </button>
      {!settingsHost && triggerSuffix}
      {open && modal && <SettingsDialog label={label} panelClassName={panelClassName} onClose={close}>{children}</SettingsDialog>}
      {open && !modal && (
        // Nested fixed menus portal into this unfiltered dialog boundary, so
        // outside dismissal and viewport coordinates both remain correct.
        <div role="dialog" aria-label={label}>
          <div
            ref={panelRef}
            className={`settings-popover-panel${panelClassName ? ` ${panelClassName}` : ''}`}
            data-site-surface="popover"
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );

  if (!settingsHost) return popover;
  const context = (triggerPrefix || triggerSuffix) && <div className="settings-popover-context" data-no-timer={ignoreTimer || undefined}>
    {triggerPrefix}
    {triggerSuffix}
  </div>;
  return <>
    {settingsHost.contextPortal ? createPortal(context, settingsHost.contextPortal) : context}
    {settingsHost.settingsPortal ? createPortal(popover, settingsHost.settingsPortal) : null}
  </>;
}

export default function TrainingSettings({ value, onChange, className, children }: {
  value: boolean;
  onChange: (next: boolean) => void;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <SettingsPopover label={tr({ zh: '训练设置', en: 'Training settings' })} className={className}>
      <BoolToggle
        value={value}
        onChange={onChange}
        label={tr({ zh: '答对后自动进入下一题', en: 'Auto-next after a correct answer' })}
      />
      {children}
    </SettingsPopover>
  );
}
