import type { AnalyticsAction } from '@cuberoot/shared/product-analytics';

// Core tools import only this tiny signal bridge. No storage, IDs, network or
// route catalog is loaded or accessed from their operation handlers.
let receiver: ((action: AnalyticsAction) => void) | null = null;

export function setAnalyticsFeatureReceiver(next: typeof receiver): void { receiver = next; }

/** Optional telemetry must never throw back into a timer, solver or player. */
export function trackFeatureUse(action: AnalyticsAction): void {
  try { receiver?.(action); } catch { /* Best effort; the product always wins. */ }
}
