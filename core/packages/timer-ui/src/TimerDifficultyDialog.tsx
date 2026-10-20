import { useEffect, useLayoutEffect, useRef, useId, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { usePopoverDismiss } from './usePopoverDismiss';
import { modalFocusableElements } from './modal-focus';
import './timer-difficulty-dialog.css';

/** Difficulty editors own a draft; closing this shared dialog only cancels it. */
export function TimerDifficultyDialog({ anchorRef, language, disabled, canApply = true, onClose, onApply, onClear, children }: {
  anchorRef: RefObject<HTMLButtonElement | null>;
  language: 'en' | 'zh';
  disabled?: boolean;
  canApply?: boolean;
  onClose(): void;
  onApply(): void;
  onClear(): void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  usePopoverDismiss(true, onClose, panelRef, anchorRef);
  useLayoutEffect(() => {
    const position = () => {
      const panel = panelRef.current;
      const anchor = anchorRef.current;
      if (!panel || !anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = panel.offsetWidth;
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
      panel.style.left = `${Math.max(8, Math.min(rect.left + (rect.width - width) / 2, viewportWidth - width - 8))}px`;
      const top = Math.max(8, Math.min(rect.bottom + 6, viewportHeight - panel.offsetHeight - 8));
      panel.style.top = `${top}px`;
      panel.style.visibility = 'visible';
    };
    position();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(position);
    if (panelRef.current) observer?.observe(panelRef.current);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => { observer?.disconnect(); window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [anchorRef]);
  useEffect(() => {
    const panel = panelRef.current;
    if (panel) (modalFocusableElements(panel)[0] ?? panel).focus();
    return () => {
      if (panel?.contains(document.activeElement)) anchorRef.current?.focus();
    };
  }, [anchorRef]);
  return createPortal(<div ref={panelRef} role="dialog" aria-labelledby={titleId} tabIndex={-1}
    className="timer-room-dialog timer-difficulty-dialog" data-site-surface="popover" data-no-timer
    onKeyUp={event => event.stopPropagation()} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') { onClose(); anchorRef.current?.focus(); }
    }}>
    <header className="timer-room-dialog-head">
      <h2 id={titleId}>{{ en: 'Difficulty', zh: '难度' }[language]}</h2>
      <button type="button" aria-label={{ en: 'Close', zh: '关闭' }[language]} onClick={onClose}><X size={16} /></button>
    </header>
    {children}
    <footer className="timer-difficulty-actions">
      <button type="button" disabled={disabled} onClick={onClear}>
        {{ en: 'Any difficulty', zh: '不限难度' }[language]}
      </button>
      <button type="button" disabled={disabled || !canApply} onClick={onApply} data-primary>
        {{ en: 'Apply', zh: '应用' }[language]}
      </button>
    </footer>
  </div>, document.body);
}
