import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

interface PopoverPositionOptions {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  contentAnchorRef?: RefObject<HTMLElement | null>;
  align?: 'start' | 'center';
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
      const anchor = (contentAnchorRef?.current ?? trigger).getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const optionContent = contentAnchorRef ? panel.querySelector('.compact-select-option')?.firstElementChild : null;
      const contentInset = contentAnchorRef?.current && optionContent
        ? optionContent.getBoundingClientRect().left - panelRect.left
        : 0;
      const rightLeft = Math.max(safeLeft, Math.min(anchor.right + POPOVER_GAP, safeRight));
      const safeWidth = Math.max(0, safeRight - (side === 'right' ? rightLeft : safeLeft));
      const naturalWidth = Math.max(panel.scrollWidth, panelRect.width) || anchor.width;
      const desiredWidth = Math.min(naturalWidth, safeWidth);
      const left = side === 'right' ? rightLeft : Math.min(
        Math.max(align === 'center' ? anchor.left + (anchor.width - desiredWidth) / 2 : anchor.left - contentInset, safeLeft),
        Math.max(safeLeft, safeRight - desiredWidth),
      );
      const belowTop = anchor.bottom + POPOVER_GAP;
      const belowSpace = Math.max(0, safeBottom - belowTop);
      const aboveSpace = Math.max(0, anchor.top - POPOVER_GAP - safeTop);
      const panelCss = getComputedStyle(panel);
      const borderHeight = (parseFloat(panelCss.borderTopWidth) || 0) + (parseFloat(panelCss.borderBottomWidth) || 0);
      // scrollHeight includes padding, but the border-box height also needs both borders.
      const columns = scrollColumnSelector ? [...panel.querySelectorAll<HTMLElement>(scrollColumnSelector)] : [];
      const columnHeight = columns.length ? Math.max(...columns.map(column => column.scrollHeight))
        + (parseFloat(panelCss.paddingTop) || 0) + (parseFloat(panelCss.paddingBottom) || 0) : 0;
      const contentHeight = columnHeight || panel.scrollHeight;
      const desiredHeight = contentHeight ? contentHeight + borderHeight : panelRect.height;
      const placeBelow = side === 'top'
        ? aboveSpace < Math.min(desiredHeight, belowSpace)
        : belowSpace >= Math.min(desiredHeight, aboveSpace);
      const availableHeight = side === 'right' || allowAnchorOverlap
        ? safeBottom - safeTop : placeBelow ? belowSpace : aboveSpace;
      const maxHeight = Math.min(Math.max(0, desiredHeight), availableHeight);
      const top = side === 'right'
        ? Math.max(safeTop, Math.min(anchor.top, safeBottom - maxHeight))
        : placeBelow
        ? Math.max(safeTop, Math.min(belowTop, safeBottom - maxHeight))
        : Math.max(safeTop, anchor.top - POPOVER_GAP - maxHeight);
      setGeometry(previous => previous?.left === left && previous.top === top
        && previous.maxHeight === maxHeight && previous.maxWidth === safeWidth
        ? previous : { left, maxHeight, maxWidth: safeWidth, top });
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
  }, [align, side, contentAnchorRef, contentKey, open, panelRef, triggerRef, viewportBottomInset, allowAnchorOverlap, scrollColumnSelector]);

  return geometry ? {
    left: geometry.left,
    maxHeight: geometry.maxHeight,
    maxWidth: geometry.maxWidth,
    top: geometry.top,
    visibility: 'visible',
  } satisfies CSSProperties : undefined;
}
