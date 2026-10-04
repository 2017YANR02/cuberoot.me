import { CircleHelp, Info } from 'lucide-react';
import { useId, useRef, useState } from 'react';
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
  usePanelClamp(open, panelRef);
  usePopoverDismiss(open, () => setOpen(false), panelRef, buttonRef);
  return (
    <span
      className="timer-random-difficulty-help"
      onPointerEnter={(event) => {
        if (hover && event.pointerType === 'mouse') setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (hover && event.pointerType === 'mouse') setOpen(false);
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
      {open && (
        <div className="timer-random-difficulty-help-panel" data-site-surface="popover" id={id} ref={panelRef} role="tooltip">
          {content.split('\n').map((line) => <div key={line}>{line}</div>)}
        </div>
      )}
    </span>
  );
}

