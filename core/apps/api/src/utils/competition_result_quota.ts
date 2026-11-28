import { query, withTransaction } from '../db/connection.js';

const MINUTE = 60;
const DAY = 86_400;
const SHORT_LIMIT = 30;
const DAILY_LIMIT = 240;

export function resultCompetitionId(pathname: string) {
  // Nginx supplies its normalized URI. Direct Hono requests may still include
  // percent-encoded ASCII. Count rounds, SSE, legacy aliases and snapshots together.
  let path: string;
  try { path = decodeURIComponent(pathname.split('?')[0]); } catch { return null; }
  const match = /^\/(?:api\/comp|v1\/cubing-live(?:-stream)?)\/([A-Za-z0-9_-]{1,128})(?:\/|$)/.exec(path)
    ?? /^\/stats\/comp\/([A-Za-z0-9_-]{1,128})\.json$/.exec(path);
  if (!match || /^\/api\/comp\/access(?:\/|$)/.test(path)) return null;
  return match[1].replace(/-/g, '').toLowerCase() || null;
}

interface ReadRow { reads: Record<string, number>; revoked: boolean }

/** Status-only checks must also reject a revoked cookie so that the browser can verify again. */
export async function competitionSessionRevoked(sessionId: string) {
  const revoked = await query('SELECT 1 FROM competition_result_sessions WHERE session_id = ? AND revoked', [sessionId]);
  return revoked.length !== 0;
}

export function nextCompetitionRead(reads: Record<string, number>, slug: string, now: number) {
  const current = Object.entries(reads).filter(([, seen]) => seen > now - DAY);
  const recent = current.filter(([, seen]) => seen > now - MINUTE);
  const previously = Object.hasOwn(reads, slug) ? reads[slug] : -Infinity;
  if (previously === now) return { retryAfter: 0 };
  let retryAfter = 0;
  if (previously <= now - MINUTE && recent.length >= SHORT_LIMIT) retryAfter = Math.min(...recent.map(([, seen]) => seen)) + MINUTE - now;
  if (previously <= now - DAY && current.length >= DAILY_LIMIT) {
    retryAfter = Math.max(retryAfter, Math.min(...current.map(([, seen]) => seen)) + DAY - now);
  }
  if (retryAfter > 0) return { retryAfter };
  const updated: Record<string, number> = Object.fromEntries([...current, [slug, now]]);
  return { retryAfter: 0, updated };
}

let nextCleanup = 0;
export async function admitCompetitionRead(sessionId: string, expires: number, slug: string) {
  const now = Math.floor(Date.now() / 1000);
  if (now >= nextCleanup) {
    nextCleanup = now + MINUTE;
    void query(`DELETE FROM competition_result_sessions WHERE session_id IN (
      SELECT session_id FROM competition_result_sessions WHERE expires_at <= now() LIMIT 1000
    )`).catch(() => { /* Retried on subsequent activity; admission uses its own transaction. */ });
  }
  return withTransaction(async run => {
    const inserted = await run(`INSERT INTO competition_result_sessions (session_id, expires_at, reads)
      VALUES (?, to_timestamp(?), jsonb_build_object(?::text, ?::bigint))
      ON CONFLICT DO NOTHING RETURNING session_id`, [sessionId, expires, slug, now]);
    if (inserted.length) return 0;
    // Serialize all entrance paths and concurrent requests for just this signed session.
    const [row] = await run<ReadRow>('SELECT reads, revoked FROM competition_result_sessions WHERE session_id = ? FOR UPDATE', [sessionId]);
    if (!row) throw new Error('Competition verification session expired during admission');
    if (row.revoked) return 'revoked';
    const decision = nextCompetitionRead(row.reads, slug, Math.floor(Date.now() / 1000));
    if (decision.updated) await run('UPDATE competition_result_sessions SET reads = ?::jsonb WHERE session_id = ?', [decision.updated, sessionId]);
    if (decision.retryAfter) {
      // An operator can inspect challenged sessions, without logging bearer tokens.
      await run(`UPDATE competition_result_sessions SET last_limited_at = now() WHERE session_id = ?
        AND (last_limited_at IS NULL OR last_limited_at <= now() - INTERVAL '1 minute')`, [sessionId]);
    }
    return decision.retryAfter;
  });
}
