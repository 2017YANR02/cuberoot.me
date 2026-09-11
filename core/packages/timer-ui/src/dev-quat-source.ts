import { quatNormalize, type Quat } from '@cuberoot/shared/smart-cube/orientation';

// ── Dev-only synthetic source (no hardware in the building) ───────────────

/**
 * What `window.__cuberootFakeQuat` may hold:
 *   - a Quat            → a fixed pose
 *   - (tMs) => Quat     → an animated pose, sampled with performance.now()
 *   - null / undefined  → no synthetic source (production default)
 *
 * Playwright usage (drives a steady yaw):
 *
 *   window.__cuberootFakeQuat = (t) => {
 *     const a = (t / 2000) * Math.PI;          // half a turn per 2 s
 *     return { w: Math.cos(a / 2), x: 0, y: Math.sin(a / 2), z: 0 };
 *   };
 */
export type DevQuatSource = Quat | ((tMs: number) => Quat | null) | null | undefined;

declare global {
  interface Window {
    /** Dev/e2e only — see DevQuatSource. Never set in production code. */
    __cuberootFakeQuat?: DevQuatSource;
  }
}

function isQuatLike(v: unknown): v is Quat {
  if (typeof v !== 'object' || v === null) return false;
  const q = v as Partial<Quat>;
  return [q.w, q.x, q.y, q.z].every((n) => typeof n === 'number' && Number.isFinite(n));
}

/** Read one sample from the synthetic source, or null when none is installed.
 *  Safe to call in SSR (returns null) and safe against a garbage global. */
export function readDevQuatSource(tMs: number): Quat | null {
  if (typeof window === 'undefined') return null;
  const src = window.__cuberootFakeQuat;
  if (src == null) return null;
  try {
    const v = typeof src === 'function' ? src(tMs) : src;
    return isQuatLike(v) ? quatNormalize(v) : null;
  } catch {
    return null;
  }
}
