'use client';

import { ChevronDown } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

import { usePopoverDismiss } from './usePopoverDismiss';
import { POPOVER_GAP as PANEL_GAP, usePopoverPosition } from './usePopoverPosition';

export interface CompactSelectItem<T extends string | number> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export interface CompactSelectProps<T extends string | number> {
  id?: string;
  disabled?: boolean;
  label: ReactNode;
  items: readonly CompactSelectItem<T>[];
  value?: T;
  /** Multi-selection uses the same menu; onChange toggles the chosen value. */
  selectedValues?: readonly T[];
  onChange: (value: T) => void;
  /** Transient option preview; null restores the committed value. */
  onPreview?: (value: T | null) => void;
  ariaLabel: string;
  valueText?: string;
  title?: string;
  className?: string;
  triggerClassName?: string;
  /** Keep menu behavior while the host supplies the trigger's complete appearance. */
  unstyledTrigger?: boolean;
  popupClassName?: string;
  /** Align option content with an external row containing the trigger. */
  contentAnchorRef?: RefObject<HTMLElement | null>;
  align?: 'start' | 'center';
  /** Prefer above for message actions, or right for sidebars; still clamp to the viewport. */
  side?: 'vertical' | 'right' | 'top';
  variant?: 'pill' | 'plain';
  /** Some icon-only triggers are self-explanatory and do not need a caret. */
  showArrow?: boolean;
  footer?: (close: () => void) => ReactNode;
  /** Replace options with an inline editor, preserving anchoring and dismissal. */
  panelContent?: ReactNode;
  dataNoTimer?: boolean;
  /** Mouse hover opens the menu; touch and keyboard keep click activation. */
  openOnHover?: boolean;
  /** Close immediately outside the trigger/popup, retaining their small crossing gap. Defaults to openOnHover. */
  dismissOnMouseLeave?: boolean;
  /** Fixed content below the popup, such as Mobile's bottom navigation. */
  viewportBottomInset?: number;
  /** Optional host control for modal/back-button coordination. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Host-owned persistent panel, instead of an anchored popup. */
  panelContainer?: HTMLElement | null;
}

/**
 * Runtime-agnostic compact single-choice menu. The Web compatibility export
 * and timer-ui consumers share this exact DOM, focus, dismiss, and visual
 * viewport clamping implementation.
 */
export function CompactSelect<T extends string | number>({
  id,
  disabled = false,
  label,
  items,
  value,
  selectedValues,
  onChange,
  onPreview,
  ariaLabel,
  valueText,
  title,
  className,
  triggerClassName,
  unstyledTrigger = false,
  popupClassName,
  contentAnchorRef,
  align = 'start',
  side = 'vertical',
  variant = 'pill',
  showArrow = false,
  footer,
  panelContent,
  dataNoTimer = false,
  openOnHover = false,
  dismissOnMouseLeave = openOnHover,
  viewportBottomInset = 0,
  open: controlledOpen,
  onOpenChange,
  panelContainer,
}: CompactSelectProps<T>) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean | ((current: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(open) : next;
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(value);
  };
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousOpenRef = useRef(open);
  const close = () => setOpen(false);
  const hasPanelContent = panelContent != null;
  usePopoverDismiss(open && !panelContainer, close, panelRef, triggerRef);

  useEffect(() => {
    const wasOpen = previousOpenRef.current;
    previousOpenRef.current = open;
    if (controlledOpen !== undefined && wasOpen && !open && !disabled && !panelContainer) triggerRef.current?.focus();
  }, [controlledOpen, disabled, open, panelContainer]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open || !dismissOnMouseLeave) return;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      const target = event.target as Node | null;
      if (target && (trigger?.contains(target) || panel?.contains(target))) return;
      if (trigger && panel) {
        const a = trigger.getBoundingClientRect();
        const b = panel.getBoundingClientRect();
        // The popup is a portal separated by PANEL_GAP. Keep only the narrow
        // vertical crossing corridor interactive, not the surrounding toolbar.
        const top = b.top >= a.bottom ? a.bottom : b.bottom;
        const bottom = b.top >= a.bottom ? b.top : a.top;
        if (event.clientX >= Math.max(a.left, b.left)
          && event.clientX <= Math.min(a.right, b.right)
          && event.clientY >= top && event.clientY <= bottom
          && bottom - top <= PANEL_GAP + 1) return;
        if (side === 'right' && event.clientX >= a.right && event.clientX <= b.left
          && event.clientY >= Math.max(a.top, b.top) && event.clientY <= Math.min(a.bottom, b.bottom)
          && b.left - a.right <= PANEL_GAP + 1) return;
      }
      setOpen(false);
    };
    const onWindowLeave = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && !event.relatedTarget) setOpen(false);
    };
    const onBlur = () => setOpen(false);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerout', onWindowLeave);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerout', onWindowLeave);
      window.removeEventListener('blur', onBlur);
    };
  }, [open, dismissOnMouseLeave, side]);

  const panelStyle = usePopoverPosition({
    open: open && !panelContainer, triggerRef, panelRef, contentAnchorRef, align, side, viewportBottomInset,
    contentKey: String(items.length) + ':' + hasPanelContent,
  });

  return (
    <div
      className={[
        'compact-select',
        `compact-select--${variant}`,
        className,
      ].filter(Boolean).join(' ')}
      data-no-timer={dataNoTimer ? '' : undefined}
      onKeyDown={event => {
        if (!open || event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        close();
        triggerRef.current?.focus();
      }}
    >
      <button
        ref={triggerRef}
        id={id}
        disabled={disabled}
        type="button"
        className={['compact-select-trigger', unstyledTrigger && 'compact-select-trigger--unstyled', triggerClassName].filter(Boolean).join(' ')}
        onClick={() => { if (!disabled) setOpen(current => !current); }}
        onPointerEnter={event => {
          if (!disabled && openOnHover && event.pointerType === 'mouse') setOpen(true);
        }}
        aria-label={ariaLabel}
        aria-description={valueText}
        aria-expanded={open && !disabled}
        aria-haspopup={hasPanelContent ? 'dialog' : 'listbox'}
        title={title}
      >
        <span className="compact-select-current">{label}</span>
        {showArrow && (
          <ChevronDown
            size={14}
            strokeWidth={2}
            className={`compact-select-arrow${open ? ' open' : ''}`}
            aria-hidden="true"
          />
        )}
      </button>

      {open && !disabled && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          className={['compact-select-popup', popupClassName].filter(Boolean).join(' ')}
          popover={triggerRef.current?.closest('dialog, [role="dialog"]') ? 'manual' : undefined}
          data-site-surface="popover"
          role={hasPanelContent ? 'dialog' : 'listbox'}
          aria-multiselectable={!hasPanelContent && selectedValues ? true : undefined}
          aria-label={ariaLabel}
          data-no-timer={dataNoTimer ? '' : undefined}
          style={panelStyle}
        >
          {panelContent ?? <div className="compact-select-options">
            {items.map(item => {
              const active = selectedValues ? selectedValues.includes(item.value) : item.value === value;
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  key={item.value}
                  className={`compact-select-option${active ? ' active' : ''}`}
                  disabled={item.disabled}
                  onPointerEnter={event => {
                    if (!item.disabled && event.pointerType === 'mouse') onPreview?.(item.value);
                  }}
                  onPointerLeave={() => onPreview?.(null)}
                  onFocus={() => { if (!item.disabled) onPreview?.(item.value); }}
                  onBlur={() => onPreview?.(null)}
                  onClick={() => {
                    if (item.disabled) return;
                    onChange(item.value);
                    if (!panelContainer) close();
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>}
          {footer?.(close)}
        </div>,
        // Native modal dialogs make the rest of the document inert. Keep the
        // shared, viewport-clamped popup in its trigger's top-layer surface.
        panelContainer ?? triggerRef.current?.closest('dialog, [role="dialog"]') ?? document.body,
      )}
    </div>
  );
}
