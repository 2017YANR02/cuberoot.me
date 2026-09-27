import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { modalFocusableElements } from './modal-focus';

export interface TimerRoomDialogProps {
  title: string;
  language: 'en' | 'zh';
  onClose(): void;
  children: ReactNode;
}

export function TimerRoomDialog({ title, language, onClose, children }: TimerRoomDialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFirst = () => (ref.current && (modalFocusableElements(ref.current)[0] ?? ref.current).focus());
    const onFocus = (event: FocusEvent) => {
      if (ref.current && event.target instanceof Node && !ref.current.contains(event.target)) focusFirst();
    };
    focusFirst();
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('focusin', onFocus);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  if (typeof document === 'undefined') return null;
  const close = { en: 'Close', zh: '关闭' }[language];
  return createPortal(<div className="timer-room-overlay" data-no-timer onClick={(event) => {
    if (event.target === event.currentTarget) closeRef.current();
  }}>
    <div className="timer-room-dialog" data-site-surface="panel" role="dialog" aria-modal="true" aria-labelledby={titleId}
      ref={ref} tabIndex={-1} onKeyUp={(event) => event.stopPropagation()} onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
        if (event.key !== 'Tab' || !ref.current) return;
        const elements = modalFocusableElements(ref.current);
        const first = elements[0]; const last = elements[elements.length - 1];
        if (!first) { event.preventDefault(); ref.current.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <header className="timer-room-dialog-head"><h2 id={titleId}>{title}</h2><button type="button" aria-label={close} onClick={onClose}><X size={18} /></button></header>
      {children}
    </div>
  </div>, document.body);
}
