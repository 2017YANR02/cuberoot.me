import { Hono } from 'hono';
import { getIp } from '../utils/analytics_helpers.js';
import { bodyLimit } from 'hono/body-limit';
import { query } from '../db/connection.js';
import { requireAuth, checkRateLimit } from '../utils/recon_helpers.js';

/**
 * /v1/paint/drawings — per-user cloud library for the /paint vector editor.
 *
 *   GET    /paint/drawings        — caller's drawings, metadata only (no doc), newest first
 *   GET    /paint/drawings/:id    — one drawing incl. the full doc JSON
 *   POST   /paint/drawings        — create { title?, doc, thumbnail? } → { id }
 *   PUT    /paint/drawings/:id    — update any of { title, doc, thumbnail }
 *   DELETE /paint/drawings/:id    — delete
 *
 * Identity always comes from requireAuth(c).wcaId (Bearer JWT) — the client never
 * asserts a wca_id. Every row is scoped to the caller (WHERE wca_id = ?), so a
 * user can only ever read/write/delete their own drawings. `doc` is the verbatim
 * JSON.stringify(PaintDoc) string (stored TEXT, never parsed server-side).
 */
export const paintRoutes = new Hono();

const MAX_DOC_BYTES = 4 * 1024 * 1024;     // 4 MB doc JSON (a big drawing is far smaller)
const MAX_THUMB_BYTES = 512 * 1024;        // 512 KB thumbnail dataURL (downscaled PNG)
const MAX_DRAWINGS_PER_USER = 300;
const MAX_TITLE_LEN = 120;

// Reject oversized bodies BEFORE c.req.json() buffers them (host is memory-tight).
const paintBodyLimit = bodyLimit({
  maxSize: MAX_DOC_BYTES + MAX_THUMB_BYTES + 64 * 1024,
  onError: (c) => c.json({ error: 'Payload too large' }, 413),
});

function parseId(raw: string | undefined): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** A valid PaintDoc JSON string: parses to an object with `shapes` map + `order` array. */
function isValidDoc(s: unknown): s is string {
  if (typeof s !== 'string' || s.length === 0) return false;
  try {
    const d = JSON.parse(s) as { shapes?: unknown; order?: unknown };
    return !!d && typeof d === 'object' && !!d.shapes && typeof d.shapes === 'object' && Array.isArray(d.order);
  } catch {
    return false;
  }
}

/** Optional thumbnail: a data:image/* URL within the size cap, or null. */
function cleanThumbnail(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  if (!raw.startsWith('data:image/')) return null;
  if (Buffer.byteLength(raw, 'utf8') > MAX_THUMB_BYTES) return null;
  return raw;
}

function cleanTitle(raw: unknown): string {
  const t = (typeof raw === 'string' ? raw : '').trim().slice(0, MAX_TITLE_LEN);
  return t || 'Untitled';
}

interface MetaRow {
  id: number;
  title: string;
  thumbnail: string | null;
  byte_size: number;
  created_at: string | number;
  updated_at: string | number;
}
interface FullRow extends MetaRow {
  doc: string;
}

function toMeta(r: MetaRow) {
  return {
    id: Number(r.id),
    title: r.title,
    thumbnail: r.thumbnail ?? null,
    byteSize: Number(r.byte_size),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

paintRoutes.get('/paint/drawings', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const rows = await query<MetaRow>(
    `SELECT id, title, thumbnail, byte_size, created_at, updated_at
       FROM paint_drawings WHERE wca_id = ? ORDER BY updated_at DESC`,
    [authUser.wcaId],
  );
  return c.json({ drawings: rows.map(toMeta) });
});

paintRoutes.get('/paint/drawings/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const id = parseId(c.req.param('id'));
  if (!id) return c.json({ error: 'invalid id' }, 400);
  const rows = await query<FullRow>(
    `SELECT id, title, doc, thumbnail, byte_size, created_at, updated_at
       FROM paint_drawings WHERE id = ? AND wca_id = ?`,
    [id, authUser.wcaId],
  );
  if (rows.length === 0) return c.json({ error: 'not found' }, 404);
  const r = rows[0];
  return c.json({ drawing: { ...toMeta(r), doc: String(r.doc) } });
});

paintRoutes.post('/paint/drawings', paintBodyLimit, async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);

  let body: { title?: unknown; doc?: unknown; thumbnail?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid json' }, 400);
  }
  if (!isValidDoc(body.doc)) return c.json({ error: 'doc is required' }, 400);
  const byteSize = Buffer.byteLength(body.doc, 'utf8');
  if (byteSize > MAX_DOC_BYTES) return c.json({ error: 'doc too large' }, 413);

  const cnt = await query<{ n: number }>(
    'SELECT COUNT(*)::int AS n FROM paint_drawings WHERE wca_id = ?',
    [authUser.wcaId],
  );
  if ((cnt[0]?.n ?? 0) >= MAX_DRAWINGS_PER_USER) {
    return c.json({ error: 'drawing limit reached' }, 409);
  }

  const now = Date.now();
  const title = cleanTitle(body.title);
  const thumbnail = cleanThumbnail(body.thumbnail);
  const rows = await query<{ id: number }>(
    `INSERT INTO paint_drawings (wca_id, title, doc, thumbnail, byte_size, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [authUser.wcaId, title, body.doc, thumbnail, byteSize, now, now],
  );
  return c.json({ id: Number(rows[0]?.id), title, createdAt: now, updatedAt: now });
});

paintRoutes.put('/paint/drawings/:id', paintBodyLimit, async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const id = parseId(c.req.param('id'));
  if (!id) return c.json({ error: 'invalid id' }, 400);

  let body: { title?: unknown; doc?: unknown; thumbnail?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid json' }, 400);
  }

  const sets: string[] = [];
  const vals: unknown[] = [];
  if (body.title !== undefined) {
    sets.push('title = ?');
    vals.push(cleanTitle(body.title));
  }
  if (body.doc !== undefined) {
    if (!isValidDoc(body.doc)) return c.json({ error: 'invalid doc' }, 400);
    const byteSize = Buffer.byteLength(body.doc, 'utf8');
    if (byteSize > MAX_DOC_BYTES) return c.json({ error: 'doc too large' }, 413);
    sets.push('doc = ?', 'byte_size = ?');
    vals.push(body.doc, byteSize);
  }
  if (body.thumbnail !== undefined) {
    sets.push('thumbnail = ?');
    vals.push(cleanThumbnail(body.thumbnail));
  }
  if (sets.length === 0) return c.json({ error: 'nothing to update' }, 400);

  const now = Date.now();
  sets.push('updated_at = ?');
  vals.push(now);
  vals.push(id, authUser.wcaId);

  const rows = await query<{ id: number }>(
    `UPDATE paint_drawings SET ${sets.join(', ')} WHERE id = ? AND wca_id = ? RETURNING id`,
    vals,
  );
  if (rows.length === 0) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true, updatedAt: now });
});

paintRoutes.delete('/paint/drawings/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const id = parseId(c.req.param('id'));
  if (!id) return c.json({ error: 'invalid id' }, 400);
  await query('DELETE FROM paint_drawings WHERE id = ? AND wca_id = ?', [id, authUser.wcaId]);
  return c.json({ ok: true });
});
