'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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

export default function TrainingSettings({ value, onChange, className }: {
  value: boolean;
  onChange: (next: boolean) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);
  usePanelClamp(open, panelRef);
  usePopoverDismiss(open, () => setOpen(false), panelRef, triggerRef);

  return (
    <span className={`training-settings${className ? ` ${className}` : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className="training-settings-trigger"
        aria-label={tr({ zh: '训练设置', en: 'Training settings' })}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Settings size={18} aria-hidden="true" />
      </button>
      {open && (
        <span ref={panelRef} className="training-settings-panel">
          <BoolToggle
            value={value}
            onChange={onChange}
            label={tr({ zh: '答对后自动进入下一题', en: 'Auto-next after a correct answer' })}
          />
        </span>
      )}
    </span>
  );
}
