/**
 * 站内自有流量埋点 — 极简 beacon.
 *
 *   trackPageview(path, ref?)  — 每次 SPA 路由切换调一次. 内部:
 *     1. 若前一次 pv 在飞, 发 dwell(prevId, now - prevStartedAt)
 *     2. POST /v1/analytics/pv, 拿到 id 后存为 current
 *
 *   bindLifecycle()            — 一次性绑 visibilitychange/pagehide,
 *                                 离开前 sendBeacon 上报最后一次的 dwell.
 *
 * 不阻塞渲染. fetch 用 keepalive=true 容忍 tab 切换时仍能完成. 失败静默(不报错).
 */
import { apiUrl } from './api_base';

interface Current {
  id: number | null;
  pendingFor: string | null;     // path being requested — used to dedupe rapid duplicates
  startedAt: number;
  path: string;
}

let current: Current = { id: null, pendingFor: null, startedAt: 0, path: '' };
let lifecycleBound = false;

// SPA route paths that we should NOT track (iframes / upstream HTML mounts).
// LandingPage + every TS page is tracked; only the iframe wrappers are noise.
const EXCLUDE_PREFIXES = ['/cstimer', '/site', '/solver', '/2x2x2', '/alg-trainers'];

function shouldTrack(path: string): boolean {
  return !EXCLUDE_PREFIXES.some(p => path === p || path.startsWith(`${p}/`));
}

async function sendPv(path: string, ref: string): Promise<number | null> {
  try {
    const res = await fetch(apiUrl('/v1/analytics/pv'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path, ref }),
      keepalive: true,
      credentials: 'omit',
    });
    if (!res.ok) return null;
    const j = await res.json() as { id: number | null };
    return j.id ?? null;
  } catch {
    return null;
  }
}

function sendDwell(id: number, ms: number): void {
  const body = JSON.stringify({ id, ms });
  // navigator.sendBeacon is the right tool here — survives page unload.
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(apiUrl('/v1/analytics/dwell'), blob);
      return;
    } catch {
      // fall through to fetch
    }
  }
  // Fallback for very old browsers / sendBeacon disabled.
  fetch(apiUrl('/v1/analytics/dwell'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
    credentials: 'omit',
  }).catch(() => {});
}

function flushPrevious(): void {
  if (current.id != null && current.startedAt > 0) {
    const ms = Date.now() - current.startedAt;
    if (ms > 0 && ms < 6 * 60 * 60 * 1000) sendDwell(current.id, ms);
  }
  current.id = null;
  current.startedAt = 0;
}

export function trackPageview(path: string, ref?: string): void {
  if (!shouldTrack(path)) {
    flushPrevious();
    return;
  }
  // De-dupe: React 18 strict-mode double-effect / rapid re-renders to same path.
  if (current.pendingFor === path || (current.id !== null && current.path === path)) return;

  flushPrevious();
  current.path = path;
  current.pendingFor = path;
  current.startedAt = Date.now();
  void sendPv(path, ref ?? document.referrer ?? '').then(id => {
    // Only adopt the id if user hasn't navigated again in the meantime.
    if (current.pendingFor === path) {
      current.id = id;
      current.pendingFor = null;
    }
  });
}

export function bindLifecycle(): void {
  if (lifecycleBound) return;
  lifecycleBound = true;
  const onHidden = () => {
    if (document.visibilityState === 'hidden') flushPrevious();
  };
  document.addEventListener('visibilitychange', onHidden);
  // pagehide is the most reliable signal for SPA unload (vs unload which is
  // throttled in modern browsers and unreliable on mobile bfcache).
  window.addEventListener('pagehide', flushPrevious);
}
