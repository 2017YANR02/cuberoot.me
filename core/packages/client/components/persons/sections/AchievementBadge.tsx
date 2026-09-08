'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ClearButton } from '@/components/ClearButton';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import { usePopoverDismiss } from '@/hooks/usePopoverDismiss';
import { useT } from '@/hooks/useT';
import { AchievementMedal, ACHIEVEMENT_TITLES, type AchievementKind } from './AchievementMedal';

export function AchievementBadge({ kind, event, name, description, children }: {
  kind: AchievementKind; event?: string; name?: string; description: string; children?: ReactNode;
}) {
  const t = useT();
  const id = useId();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinned = useRef(false);
  const keyboard = useRef(false);
  const cancelClose = () => { if (timer.current) clearTimeout(timer.current); };
  const close = () => { cancelClose(); pinned.current = false; setOpen(false); };
  const leave = () => { cancelClose(); if (!pinned.current) timer.current = setTimeout(close, 180); };
  const label = t(ACHIEVEMENT_TITLES[kind].zh, ACHIEVEMENT_TITLES[kind].en);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useLayoutEffect(() => {
    if (!open || !panel.current || !trigger.current) return;
    const position = () => {
      const anchor = trigger.current!.getBoundingClientRect();
      const el = panel.current!;
      const height = el.offsetHeight;
      const below = anchor.bottom + 10;
      const top = below + height <= window.innerHeight - 8 ? below : anchor.top - height - 10;
      el.style.left = `${Math.max(8, anchor.left)}px`;
      el.style.top = `${Math.max(8, Math.min(top, window.innerHeight - height - 8))}px`;
    };
    position();
    if (keyboard.current) { panel.current.querySelector<HTMLButtonElement>('button')?.focus(); keyboard.current = false; }
    const scroll = (e: Event) => { if (!panel.current?.contains(e.target as Node)) close(); };
    window.addEventListener('resize', position);
    window.addEventListener('scroll', scroll, true);
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', scroll, true); };
  }, [open]);
  usePanelClamp(open, panel);
  usePopoverDismiss(open, close, panel, trigger);
  return <>
    <button ref={trigger} type="button" className="wp-achievement"
      aria-label={name ? `${name} ${label}` : label} aria-expanded={open} aria-controls={open ? id : undefined} aria-haspopup="dialog"
      onPointerEnter={e => { if (e.pointerType === 'mouse') { cancelClose(); setOpen(true); } }} onPointerLeave={leave}
      onClick={e => {
        cancelClose();
        if (pinned.current) { close(); return; }
        pinned.current = true;
        keyboard.current = e.detail === 0;
        setOpen(true);
        if (open && keyboard.current) { panel.current?.querySelector<HTMLButtonElement>('button')?.focus(); keyboard.current = false; }
      }}>
      <AchievementMedal kind={kind} event={event} />
      <span className="wp-achievement-label">{label}</span>
    </button>
    {open && createPortal(<div ref={panel} id={id} role="dialog" aria-label={label}
      className={`wp-achievement-card wp-achievement-art-${kind}`} onPointerEnter={cancelClose} onPointerLeave={leave}
      onFocusCapture={() => { pinned.current = true; }}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node) && !trigger.current?.contains(e.relatedTarget as Node)) close(); }}>
      <div className="wp-achievement-card-art">
        <AchievementMedal kind={kind} event={event} />
        <div className="wp-achievement-close"><ClearButton variant="standalone" ariaLabel={t('关闭', 'Close')} onClick={() => { close(); trigger.current?.focus(); }} /></div>
      </div>
      <div className="wp-achievement-card-body">
        <h3>{label}</h3>
        {name && <p className="wp-achievement-card-event">{name}</p>}
        <p>{description}</p>
        {children && <div className="wp-achievement-history">{children}</div>}
      </div>
    </div>, document.body)}
  </>;
}
