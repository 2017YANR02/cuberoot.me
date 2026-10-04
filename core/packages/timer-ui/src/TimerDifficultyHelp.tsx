import { CircleHelp, Info } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePanelClamp } from './usePanelClamp';
import { usePopoverDismiss } from './usePopoverDismiss';

export function TimerDifficultyHelp({ content, label, hover = false, question = false }: {
  content: string;
  label: string;
  hover?: boolean;
  question?: boolean;
}) {
  const id = useId();
  const Icon = question ? CircleHelp : Info;
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelLeave = () => {
    if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  };
  useEffect(() => cancelLeave, []);
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const button = buttonRef.current;
      const panel = panelRef.current;
      if (!button || !panel) return;
      const anchor = button.getBoundingClientRect();
      const height = panel.offsetHeight;
      const viewportHeight = document.documentElement.clientHeight;
      const below = anchor.bottom + 4;
      const top = below + height <= viewportHeight - 8 ? below : anchor.top - height - 4;
      panel.style.setProperty('--difficulty-help-left', `${anchor.left}px`);
      panel.style.setProperty('--difficulty-help-top', `${Math.max(8, top)}px`);
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open]);
  usePanelClamp(open, panelRef);
  usePopoverDismiss(open, () => setOpen(false), panelRef, buttonRef);
  return (
    <span
      className="timer-random-difficulty-help"
      onPointerEnter={(event) => {
        cancelLeave();
        if (hover && event.pointerType === 'mouse') setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (hover && event.pointerType === 'mouse') {
          cancelLeave();
          leaveTimer.current = setTimeout(() => setOpen(false), 120);
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        aria-label={label}
        className="timer-random-difficulty-help-trigger"
        onClick={() => setOpen((value) => !value)}
        ref={buttonRef}
        type="button"
      ><Icon aria-hidden="true" size={12} /></button>
      {open && createPortal(
        <div className="timer-random-difficulty-help-panel" data-site-surface="popover" id={id} ref={panelRef} role="tooltip">
          {content.split('\n').map((line) => <div key={line}>{line}</div>)}
        </div>,
        document.body,
      )}
    </span>
  );
}
