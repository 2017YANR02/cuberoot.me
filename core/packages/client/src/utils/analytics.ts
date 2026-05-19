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
  ticket: string | null;         // HMAC from /pv, required by /dwell
  pendingFor: string | null;     // path being requested — used to dedupe rapid duplicates
  startedAt: number;
  path: string;
}

let current: Current = { id: null, ticket: null, pendingFor: null, startedAt: 0, path: '' };
let lifecycleBound = false;

// SPA route paths that we should NOT track (iframes / upstream HTML mounts).
// LandingPage + every TS page is tracked; only the iframe wrappers are noise.
const EXCLUDE_PREFIXES = ['/cstimer', '/site', '/solver', '/2x2x2', '/alg-trainers'];

function shouldTrack(path: string): boolean {
  return !EXCLUDE_PREFIXES.some(p => path === p || path.startsWith(`${p}/`));
}

async function sendPv(path: string, ref: string): Promise<{ id: number | null; t: string | null }> {
  try {
    const res = await fetch(apiUrl('/v1/analytics/pv'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path, ref }),
      keepalive: true,
      credentials: 'omit',
    });
    if (!res.ok) return { id: null, t: null };
    const j = await res.json() as { id: number | null; t?: string };
    return { id: j.id ?? null, t: j.t ?? null };
  } catch {
    return { id: null, t: null };
  }
}

function sendDwell(id: number, ms: number, ticket: string): void {
  // 不用 sendBeacon — 它硬编码 credentials='include',会触发 CORS preflight 失败.
  // fetch + keepalive 在 pagehide/visibilitychange 上现代浏览器都能可靠送出,
  // payload 仅 ~80B,远低于 64KB keepalive 配额.
  fetch(apiUrl('/v1/analytics/dwell'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, ms, t: ticket }),
    keepalive: true,
    credentials: 'omit',
  }).catch(() => {});
}

function flushPrevious(): void {
  if (current.id != null && current.ticket != null && current.startedAt > 0) {
    const ms = Date.now() - current.startedAt;
    if (ms > 0 && ms < 6 * 60 * 60 * 1000) sendDwell(current.id, ms, current.ticket);
  }
  current.id = null;
  current.ticket = null;
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
  // Snapshot the start time for the closure — if user navigates again before the
  // /pv response lands, we want to record A's dwell using A's startedAt, not B's.
  const snapStartedAt = current.startedAt;
  void sendPv(path, ref ?? document.referrer ?? '').then(({ id, t }) => {
    if (id == null || t == null) return;
    if (current.pendingFor === path) {
      // Still on the same page → keep the id around for the eventual dwell flush.
      current.id = id;
      current.ticket = t;
      current.pendingFor = null;
    } else {
      // User already navigated away; fire the dwell for the page we just registered.
      const ms = Date.now() - snapStartedAt;
      if (ms > 0 && ms < 6 * 60 * 60 * 1000) sendDwell(id, ms, t);
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
