'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Settings } from 'lucide-react';
import BoolToggle from '@/components/BoolToggle';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import { usePopoverDismiss } from '@/hooks/usePopoverDismiss';
import { tr } from '@/i18n/tr';
import { persistItem } from '@/lib/safe-storage';
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
  children?: ReactNode;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = useCallback((next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }, [controlledOpen, onOpenChange]);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  usePanelClamp(open, panelRef);
  usePopoverDismiss(open, () => setOpen(false), rootRef, triggerRef);

  return (
    <div
      ref={rootRef}
      className={`settings-popover${className ? ` ${className}` : ''}`}
      data-no-timer={ignoreTimer || undefined}
    >
      {triggerPrefix}
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
      {triggerSuffix}
      {open && (
        <div
          ref={panelRef}
          className={`settings-popover-panel${panelClassName ? ` ${panelClassName}` : ''}`}
          role="dialog"
          aria-label={label}
          data-site-surface="popover"
        >
          {children}
        </div>
      )}
    </div>
  );
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
