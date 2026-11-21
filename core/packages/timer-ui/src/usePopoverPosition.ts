import { getUsableViewport } from './host-viewport';
import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

interface PopoverPositionOptions {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  contentAnchorRef?: RefObject<HTMLElement | null>;
  align?: 'start' | 'center' | 'end';
  side?: 'vertical' | 'right' | 'top';
  viewportBottomInset?: number;
  /** Use the full viewport when neither side of the trigger fits the menu. */
  allowAnchorOverlap?: boolean;
  /** Reposition when menu content changes without changing its open state. */
  contentKey: string | number;
  /** Cascading menus scroll each column independently. Measure their full content. */
  scrollColumnSelector?: string;
}

interface PanelGeometry {
  left: number;
  maxHeight: number;
  maxWidth: number;
  top: number;
  translate?: string;
}

const VIEWPORT_MARGIN = 8;
export const POPOVER_GAP = 6;

/** Shared viewport positioning for fixed menus, including native top-layer popovers. */
export function usePopoverPosition({
  open, triggerRef, panelRef, contentAnchorRef, align = 'start', side = 'vertical',
  viewportBottomInset = 0, allowAnchorOverlap = false, contentKey, scrollColumnSelector,
}: PopoverPositionOptions): CSSProperties | undefined {
  const [geometry, setGeometry] = useState<PanelGeometry | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      setGeometry(null);
      return;
    }
    // Dialog filters create a containing block and can clip fixed descendants.
    // The top layer preserves viewport positioning while keeping modal focus.
    const popup = panelRef.current;
    if (popup?.hasAttribute('popover') && typeof popup.showPopover === 'function' && !popup.matches(':popover-open')) {
      popup.showPopover();
    }
    const positionPanel = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;

      const viewport = getUsableViewport();
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
      const anchor = (contentAnchorRef?.current ?? trigger).getBoundingClientRect();
      const rightLeft = Math.max(safeLeft, Math.min(anchor.right + POPOVER_GAP, safeRight));
      const safeWidth = Math.max(0, safeRight - (side === 'right' ? rightLeft : safeLeft));
      // A previous search may have shrunk the menu. Measure without that cap:
      // nested flex/scroll containers otherwise report the old, clipped height.
      const previousMaxHeight = panel.style.maxHeight;
      const previousMaxWidth = panel.style.maxWidth;
      panel.style.maxHeight = 'none';
      if (align === 'end') {
        panel.style.maxWidth = `min(${safeWidth}px, var(--popover-max-width, 100%))`;
      }
      const panelRect = panel.getBoundingClientRect();
      const optionContent = contentAnchorRef ? panel.querySelector('.compact-select-option')?.firstElementChild : null;
      const contentInset = contentAnchorRef?.current && optionContent
        ? optionContent.getBoundingClientRect().left - panelRect.left
        : 0;
      const naturalWidth = Math.max(panel.scrollWidth, panelRect.width) || anchor.width;
      const desiredWidth = align === 'end' ? panelRect.width : Math.min(naturalWidth, safeWidth);
      const left = side === 'right' ? rightLeft : Math.min(
        Math.max(align === 'center' ? anchor.left + (anchor.width - desiredWidth) / 2 : anchor.left - contentInset, safeLeft),
        Math.max(safeLeft, safeRight - desiredWidth),
      );
      const belowTop = align === 'end' ? Math.max(safeTop, anchor.bottom + POPOVER_GAP) : anchor.bottom + POPOVER_GAP;
      const aboveBottom = align === 'end' ? Math.min(safeBottom, anchor.top - POPOVER_GAP) : anchor.top - POPOVER_GAP;
      const belowSpace = Math.max(0, safeBottom - belowTop);
      const aboveSpace = Math.max(0, aboveBottom - safeTop);
      const panelCss = getComputedStyle(panel);
      const borderHeight = (parseFloat(panelCss.borderTopWidth) || 0) + (parseFloat(panelCss.borderBottomWidth) || 0);
      // scrollHeight includes padding, but the border-box height also needs both borders.
      const columns = scrollColumnSelector ? [...panel.querySelectorAll<HTMLElement>(scrollColumnSelector)] : [];
      const columnHeight = columns.length ? Math.max(...columns.map(column => column.scrollHeight))
        + (parseFloat(panelCss.paddingTop) || 0) + (parseFloat(panelCss.paddingBottom) || 0) : 0;
      const contentHeight = columnHeight || panel.scrollHeight;
      const desiredHeight = contentHeight ? contentHeight + borderHeight : panelRect.height;
      panel.style.maxHeight = previousMaxHeight;
      if (align === 'end') panel.style.maxWidth = previousMaxWidth;
      const placeBelow = side === 'top'
        ? aboveSpace < Math.min(desiredHeight, belowSpace)
        : belowSpace >= Math.min(desiredHeight, aboveSpace);
      const availableHeight = side === 'right' || allowAnchorOverlap
        ? safeBottom - safeTop : placeBelow ? belowSpace : aboveSpace;
      // Keep the aligned edge fixed if live content changes the panel's size.
      const alignEnd = align === 'end' && side !== 'right';
      const panelRight = Math.min(safeRight, Math.max(safeLeft + desiredWidth, anchor.right));
      const maxWidth = alignEnd ? Math.max(0, panelRight - safeLeft) : safeWidth;
      const maxHeight = alignEnd ? (placeBelow ? belowSpace : aboveSpace) : Math.min(Math.max(0, desiredHeight), availableHeight);
      const top = alignEnd ? (placeBelow ? belowTop : aboveBottom)
        : side === 'right'
        ? Math.max(safeTop, Math.min(anchor.top, safeBottom - maxHeight))
        : placeBelow
        ? Math.max(safeTop, Math.min(belowTop, safeBottom - maxHeight))
        : Math.max(safeTop, anchor.top - POPOVER_GAP - maxHeight);
      const horizontalOrigin = alignEnd ? panelRight : left;
      const translate = alignEnd ? (placeBelow ? '-100% 0' : '-100% -100%') : undefined;
      setGeometry(previous => previous?.left === horizontalOrigin && previous.top === top
        && previous.maxHeight === maxHeight && previous.maxWidth === maxWidth && previous.translate === translate
        ? previous : { left: horizontalOrigin, maxHeight, maxWidth, top, translate });
    };

    const onScroll = (event: Event) => {
      // Internal scrolling does not move the anchor. Uncapping the panel to
      // measure it here resets its scroll containers and interrupts touch inertia.
      if (event.target instanceof Node && panelRef.current?.contains(event.target)) return;
      positionPanel();
    };

    positionPanel();
    const frame = requestAnimationFrame(positionPanel);
    window.addEventListener('resize', positionPanel);
    window.addEventListener('scroll', onScroll, true);
    window.visualViewport?.addEventListener('resize', positionPanel);
    window.visualViewport?.addEventListener('scroll', positionPanel);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', positionPanel);
      window.removeEventListener('scroll', onScroll, true);
      window.visualViewport?.removeEventListener('resize', positionPanel);
      window.visualViewport?.removeEventListener('scroll', positionPanel);
    };
  }, [align, side, contentAnchorRef, contentKey, open, panelRef, triggerRef, viewportBottomInset, allowAnchorOverlap, scrollColumnSelector]);

  return geometry ? {
    left: geometry.left,
    maxHeight: geometry.maxHeight,
    maxWidth: align === 'end'
      ? `min(${geometry.maxWidth}px, var(--popover-max-width, 100%))`
      : geometry.maxWidth,
    top: geometry.top,
    translate: geometry.translate,
    visibility: 'visible',
  } satisfies CSSProperties : undefined;
}
