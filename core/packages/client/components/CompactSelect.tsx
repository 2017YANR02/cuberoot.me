'use client';

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { usePopoverDismiss } from '@/hooks/usePopoverDismiss';
import './compact-select.css';

export interface CompactSelectItem<T extends string | number> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

interface CompactSelectProps<T extends string | number> {
  label: ReactNode;
  items: readonly CompactSelectItem<T>[];
  value?: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  triggerClassName?: string;
  popupClassName?: string;
  variant?: 'pill' | 'plain';
  footer?: (close: () => void) => ReactNode;
  dataNoTimer?: boolean;
}

/** Compact single-choice menu shared by metric and rolling-stat selectors. */
export function CompactSelect<T extends string | number>({
  label,
  items,
  value,
  onChange,
  ariaLabel,
  className,
  triggerClassName,
  popupClassName,
  variant = 'pill',
  footer,
  dataNoTimer = false,
}: CompactSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  usePopoverDismiss(open, close, panelRef, triggerRef);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const positionPanel = () => {
      const anchor = trigger.getBoundingClientRect();
      const margin = 8;
      const gap = 6;
      const maxLeft = Math.max(margin, window.innerWidth - panel.offsetWidth - margin);
      const left = Math.min(Math.max(margin, anchor.left), maxLeft);
      const below = anchor.bottom + gap;
      const top = below + panel.offsetHeight <= window.innerHeight - margin
        ? below
        : Math.max(margin, anchor.top - gap - panel.offsetHeight);
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.visibility = 'visible';
    };

    positionPanel();
    window.addEventListener('resize', positionPanel);
    window.addEventListener('scroll', positionPanel, true);
    return () => {
      window.removeEventListener('resize', positionPanel);
      window.removeEventListener('scroll', positionPanel, true);
    };
  }, [open, items.length]);

  return (
    <div
      className={[
        'compact-select',
        `compact-select--${variant}`,
        className,
      ].filter(Boolean).join(' ')}
      data-no-timer={dataNoTimer ? '' : undefined}
    >
      <button
        ref={triggerRef}
        type="button"
        className={['compact-select-trigger', triggerClassName].filter(Boolean).join(' ')}
        onClick={() => setOpen(current => !current)}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="compact-select-current">{label}</span>
        <ChevronDown
          size={14}
          strokeWidth={2}
          className={`compact-select-arrow${open ? ' open' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          className={['compact-select-popup', popupClassName].filter(Boolean).join(' ')}
          role="listbox"
          aria-label={ariaLabel}
          data-no-timer={dataNoTimer ? '' : undefined}
        >
          <div className="compact-select-options">
            {items.map(item => {
              const active = item.value === value;
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  key={item.value}
                  className={`compact-select-option${active ? ' active' : ''}`}
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.disabled) return;
                    onChange(item.value);
                    close();
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          {footer?.(close)}
        </div>,
        document.body,
      )}
    </div>
  );
}
