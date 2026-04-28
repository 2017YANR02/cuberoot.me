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

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

export function extractReplayParam(input: string): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Form 1: full URL — let the URL parser handle scheme + query extraction.
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      const v = u.searchParams.get('replay');
      return v && v.length > 0 ? v : null;
    } catch {
      // Fall through to query-fragment / bare-token attempts below.
    }
  }

  // Form 2: query fragment. Strip a leading `?` if present and parse.
  if (trimmed.includes('=')) {
    const qs = trimmed.startsWith('?') ? trimmed.slice(1) : trimmed;
    try {
      const sp = new URLSearchParams(qs);
      const v = sp.get('replay');
      if (v && v.length > 0) return v;
    } catch {
      // Fall through.
    }
  }

  // Form 3: bare token — base64url charset, reasonable minimum length so we
  // don't false-positive on random short pastes.
  if (trimmed.length > 30 && BASE64URL_RE.test(trimmed)) {
    return trimmed;
  }

  return null;
}
