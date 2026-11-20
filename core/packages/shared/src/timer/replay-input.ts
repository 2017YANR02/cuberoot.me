/**
 * Extract a `replay` URL parameter from arbitrary user-pasted input.
 *
 * Accepts three forms (in order of preference):
 *   1. Full URL with a `replay` query param:
 *      https://cuberoot.me/timer?replay=ABC123...&foo=bar  →  ABC123...
 *   2. Bare query string fragment (with or without leading `?`):
 *      ?replay=ABC123...   →  ABC123...
 *      replay=ABC123...    →  ABC123...
 *   3. Bare token (heuristic: only base64url chars, length > 30):
 *      ABC123...           →  as-is
 *
 * Returns null when nothing matches. The caller (TimerPage) then runs
 * `decodeReplayParam` for actual schema validation; this function only
 * isolates the candidate string.
 */

export const TIMER_REPLAY_INPUT_COPY = {
  title: { en: 'Paste replay', zh: '粘贴回放' },
  input: { en: 'Replay URL or token', zh: '回放链接或 token' },
  clear: { en: 'Clear', zh: '清除' },
  error: { en: 'Unable to read this replay. Check the link or token and try again.', zh: '无法读取回放，请检查链接或 token 后重试。' },
  loading: { en: 'Loading…', zh: '加载中…' },
  open: { en: 'Open', zh: '打开' },
} as const;

export function timerReplaySearchParams(input: string): URLSearchParams {
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) return new URLSearchParams(trimmed.replace(/^\?/, ''));
  if (typeof URL === 'function') return new URL(trimmed).searchParams;
  const query = trimmed.match(/^https?:\/\/[^/?#\s]+[^?#]*(?:\?([^#]*))?(?:#.*)?$/i);
  return new URLSearchParams(query?.[1] ?? '');
}

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

export function extractReplayParam(input: string): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.includes('=')) {
    try {
      const value = timerReplaySearchParams(trimmed).get('replay');
      if (value) return value;
    } catch { /* Invalid parameters are ignored. */ }
  }
  return trimmed.length > 30 && BASE64URL_RE.test(trimmed) ? trimmed : null;
}
