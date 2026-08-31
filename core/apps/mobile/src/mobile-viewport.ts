export const COMPACT_VIEWPORT_HEIGHT_PX = 600;

export interface MobileViewportMetrics {
  innerHeight: number;
  visualViewport?: { height: number } | null;
}

interface ResizeEventTarget {
  addEventListener(type: 'resize', listener: EventListener): void;
  removeEventListener(type: 'resize', listener: EventListener): void;
}

export interface MobileViewportEventSource extends MobileViewportMetrics, ResizeEventTarget {
  visualViewport?: ({ height: number } & ResizeEventTarget) | null;
}

/**
 * Android WebViews normally resize innerHeight for the IME, while overlay
 * keyboards and iOS can expose the smaller usable area only through
 * visualViewport. The native shell must always follow the actually visible
 * height so its bottom navigation stays above the keyboard.
 */
export function visibleViewportHeight(
  metrics: MobileViewportMetrics = window,
): number {
  const visualHeight = metrics.visualViewport?.height;
  const height = typeof visualHeight === 'number'
    && Number.isFinite(visualHeight)
    && visualHeight > 0
    ? visualHeight
    : metrics.innerHeight;
  return Math.max(1, Math.round(height));
}

export function usesCompactViewportLayout(height: number): boolean {
  return height < COMPACT_VIEWPORT_HEIGHT_PX;
}

export function mobileShellViewportLayout(height: number) {
  return {
    classNameSuffix: usesCompactViewportLayout(height) ? ' app-shell--compact-viewport' : '',
    style: { height, minHeight: height },
  } as const;
}

/** Subscribe to both viewport models and emit the current visible height. */
export function observeVisibleViewportHeight(
  onChange: (height: number) => void,
  eventSource: MobileViewportEventSource = window,
): () => void {
  const update = () => onChange(visibleViewportHeight(eventSource));
  eventSource.addEventListener('resize', update);
  eventSource.visualViewport?.addEventListener('resize', update);
  update();
  return () => {
    eventSource.removeEventListener('resize', update);
    eventSource.visualViewport?.removeEventListener('resize', update);
  };
}
