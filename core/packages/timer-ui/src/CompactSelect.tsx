'use client';

import { ChevronDown } from 'lucide-react';
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { usePopoverDismiss } from './usePopoverDismiss';

export interface CompactSelectItem<T extends string | number> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export interface CompactSelectProps<T extends string | number> {
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
  /** Fixed content below the popup, such as Mobile's bottom navigation. */
  viewportBottomInset?: number;
}

interface PanelGeometry {
  left: number;
  maxHeight: number;
  maxWidth: number;
  top: number;
}

const VIEWPORT_MARGIN = 8;
const PANEL_GAP = 6;

/**
 * Runtime-agnostic compact single-choice menu. The Web compatibility export
 * and timer-ui consumers share this exact DOM, focus, dismiss, and visual
 * viewport clamping implementation.
 */
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
  viewportBottomInset = 0,
}: CompactSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [geometry, setGeometry] = useState<PanelGeometry | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  usePopoverDismiss(open, close, panelRef, triggerRef);

  useLayoutEffect(() => {
    if (!open) {
      setGeometry(null);
      return;
    }
    const positionPanel = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;

      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? document.documentElement.clientWidth;
      const viewportHeight = viewport?.height ?? document.documentElement.clientHeight;
      const safeLeft = viewportLeft + VIEWPORT_MARGIN;
      const safeRight = viewportLeft + viewportWidth - VIEWPORT_MARGIN;
      const safeTop = viewportTop + VIEWPORT_MARGIN;
      const safeBottom = Math.max(
        safeTop,
        viewportTop + viewportHeight - VIEWPORT_MARGIN - Math.max(0, viewportBottomInset),
      );
      const anchor = trigger.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const safeWidth = Math.max(0, safeRight - safeLeft);
      const naturalWidth = panel.scrollWidth || panelRect.width || anchor.width;
      const desiredWidth = Math.min(naturalWidth, safeWidth);
      const left = Math.min(
        Math.max(anchor.left, safeLeft),
        Math.max(safeLeft, safeRight - desiredWidth),
      );
      const belowTop = anchor.bottom + PANEL_GAP;
      const belowSpace = Math.max(0, safeBottom - belowTop);
      const aboveSpace = Math.max(0, anchor.top - PANEL_GAP - safeTop);
      const desiredHeight = panel.scrollHeight || panelRect.height;
      const placeBelow = belowSpace >= Math.min(desiredHeight, aboveSpace);
      const availableHeight = placeBelow ? belowSpace : aboveSpace;
      const maxHeight = Math.min(Math.max(0, desiredHeight), availableHeight);
      const top = placeBelow
        ? Math.max(safeTop, belowTop)
        : Math.max(safeTop, anchor.top - PANEL_GAP - maxHeight);
      setGeometry({ left, maxHeight, maxWidth: safeWidth, top });
    };

    positionPanel();
    const frame = requestAnimationFrame(positionPanel);
    window.addEventListener('resize', positionPanel);
    window.addEventListener('scroll', positionPanel, true);
    window.visualViewport?.addEventListener('resize', positionPanel);
    window.visualViewport?.addEventListener('scroll', positionPanel);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', positionPanel);
      window.removeEventListener('scroll', positionPanel, true);
      window.visualViewport?.removeEventListener('resize', positionPanel);
      window.visualViewport?.removeEventListener('scroll', positionPanel);
    };
  }, [items.length, open, viewportBottomInset]);

  const panelStyle = geometry ? {
    left: geometry.left,
    maxHeight: geometry.maxHeight,
    maxWidth: geometry.maxWidth,
    top: geometry.top,
    visibility: 'visible',
  } satisfies CSSProperties : undefined;

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

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          className={['compact-select-popup', popupClassName].filter(Boolean).join(' ')}
          role="listbox"
          aria-label={ariaLabel}
          data-no-timer={dataNoTimer ? '' : undefined}
          style={panelStyle}
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
