import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { query } from '../db/connection.js';
import { requireAuth, checkRateLimit } from '../utils/recon_helpers.js';

/**
 * /v1/timer/backup — per-user single-snapshot cloud backup of the solo timer DB.
 *
 *   GET    /timer/backup          — pull the caller's snapshot ({ exists:false } when none)
 *   GET    /timer/backup?meta=1   — metadata only (no blob), for the "last synced" label
 *   POST   /timer/backup          — replace the caller's snapshot ({ blob, solveCount })
 *   DELETE /timer/backup          — wipe the caller's snapshot
 *
 * Identity always comes from requireAuth(c).wcaId (Bearer JWT) — the client never
 * asserts a userId (unlike the legacy /progress endpoint). `blob` is the verbatim
 * exportJson() string; the client restores it via importJson() (full replace).
 * Upsert shape mirrors routes/recon.ts timer-sync.
 */
export const timerBackupsRoutes = new Hono();

/** Client IP for rate limiting (Nginx reverse-proxy sets X-Real-IP). */
function getIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header('X-Real-IP') ?? c.req.header('X-Forwarded-For') ?? '0.0.0.0';
}

// 16 MB — full DBs run ~0.7-3.5 MB, tens of MB with Bluetooth move streams.
// (timer_sessions' 500KB guard is for a single event/session, far too small here.)
const MAX_BLOB_BYTES = 16 * 1024 * 1024;

// Reject oversized bodies BEFORE c.req.json() buffers + parses them — the host is
// memory-tight, so the byte check below is only a secondary precise bound. The
// extra 64KB covers JSON envelope overhead around the blob.
const backupBodyLimit = bodyLimit({
  maxSize: MAX_BLOB_BYTES + 64 * 1024,
  onError: (c) => c.json({ error: 'Payload too large (max 16MB)' }, 413),
});

interface BackupRow {
  blob: string;
  byte_size: number;
  solve_count: number;
  updated_at: number;
}

timerBackupsRoutes.get('/timer/backup', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const metaOnly = c.req.query('meta') === '1';
  const cols = metaOnly
    ? 'byte_size, solve_count, updated_at'
    : 'blob, byte_size, solve_count, updated_at';
  const rows = await query<BackupRow>(
    `SELECT ${cols} FROM timer_backups WHERE wca_id = ?`,
    [authUser.wcaId],
  );
  if (rows.length === 0) return c.json({ exists: false });
  const r = rows[0];
  const out: Record<string, unknown> = {
    exists: true,
    byteSize: Number(r.byte_size),
    solveCount: Number(r.solve_count),
    updatedAt: Number(r.updated_at),
  };
  if (!metaOnly) out.blob = String(r.blob);
  return c.json(out);
});

timerBackupsRoutes.post('/timer/backup', backupBodyLimit, async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  let body: { blob?: string; solveCount?: number };
  try {
    body = await c.req.json<{ blob?: string; solveCount?: number }>();
  } catch {
    return c.json({ error: 'invalid json' }, 400);
  }

  if (typeof body.blob !== 'string' || body.blob.length === 0) {
    return c.json({ error: 'blob is required' }, 400);
  }
  const byteSize = Buffer.byteLength(body.blob, 'utf8');
  if (byteSize > MAX_BLOB_BYTES) {
    return c.json({ error: 'Payload too large (max 16MB)' }, 413);
  }
  const solveCount = Number.isFinite(body.solveCount)
    ? Math.max(0, Math.floor(body.solveCount as number))
    : 0;
  const now = Math.floor(Date.now() / 1000);
  await query(
    `INSERT INTO timer_backups (wca_id, blob, byte_size, solve_count, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (wca_id) DO UPDATE SET
       blob = EXCLUDED.blob,
       byte_size = EXCLUDED.byte_size,
       solve_count = EXCLUDED.solve_count,
       updated_at = EXCLUDED.updated_at`,
    [authUser.wcaId, body.blob, byteSize, solveCount, now],
  );
  return c.json({ ok: true, updatedAt: now, byteSize, solveCount });
});

timerBackupsRoutes.delete('/timer/backup', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  await query('DELETE FROM timer_backups WHERE wca_id = ?', [authUser.wcaId]);
  return c.json({ ok: true });
});
