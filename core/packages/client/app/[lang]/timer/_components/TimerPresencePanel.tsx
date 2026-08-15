'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Bluetooth, Timer, Users } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import type { TimerPresenceSnapshot } from '../_lib/presence';

export default function TimerPresencePanel({ snapshot }: { snapshot: TimerPresenceSnapshot | null }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  usePanelClamp(open, panelRef);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const title = tr({ zh: '当前使用人数', en: 'People timing now' });
  const value = (n: number | undefined) => n === undefined ? '—' : String(n);

  return (
    <div className="timer-presence" ref={wrapRef} data-no-timer>
      <button
        type="button"
        className={`timer-presence-trigger${open ? ' is-open' : ''}`}
        onClick={() => setOpen(value => !value)}
        title={title}
        aria-label={title}
        aria-controls={panelId}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Users size={13} />
        <span className="timer-presence-total">{value(snapshot?.total)}</span>
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          className="timer-presence-panel"
          role="dialog"
          aria-label={title}
        >
          <div className="timer-presence-title">{tr({ zh: '当前使用', en: 'Timing now' })}</div>
          <div className="timer-presence-row">
            <Timer size={14} />
            <span>{tr({ zh: '普通魔方', en: 'Regular cube' })}</span>
            <strong>{value(snapshot?.normal)}</strong>
          </div>
          <div className="timer-presence-row is-smart">
            <Bluetooth size={14} />
            <span>{tr({ zh: '智能魔方', en: 'Smart cube' })}</span>
            <strong>{value(snapshot?.smart)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
