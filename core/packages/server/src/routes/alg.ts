/**
 * 用户提交算法 (Alg submissions) 路由
 *
 * 任何登录用户可以给某个 (puzzle, set, case_name) 追加 alg。
 * 自己提交的可改/删,admin 可改/删任意条目。
 *
 * 表 `alg_submissions` schema 见 server-deploy 文档 / .password.md 旁的迁移说明。
 */
import { Hono } from 'hono';
import { query } from '../db/connection.js';
import {
  requireAuth, checkRateLimit, ADMIN_WCA_IDS,
} from '../utils/recon_helpers.js';

export const algRoutes = new Hono();

interface AlgSubmissionRow {
  id: number;
  puzzle: string;
  set_slug: string;
  case_name: string;
  alg: string;
  notes: string | null;
  author_id: string;
  author_name: string;
  created_at: string | Date;
}

function rowToJson(row: AlgSubmissionRow) {
  return {
    id: row.id,
    puzzle: row.puzzle,
    setSlug: row.set_slug,
    caseName: row.case_name,
    alg: row.alg,
    notes: row.notes,
    authorId: row.author_id,
    authorName: row.author_name,
    createdAt: typeof row.created_at === 'string' ? row.created_at : row.created_at.toISOString(),
  };
}

function getIp(c: { req: { header: (n: string) => string | undefined } }): string {
  return c.req.header('X-Real-IP') ?? c.req.header('X-Forwarded-For') ?? '0.0.0.0';
}

const ALG_MAX_BYTES = 4096;
const NOTES_MAX_BYTES = 1024;

// GET /api/alg/:puzzle/:set/submissions — 列出该 set 下全部用户提交
algRoutes.get('/api/alg/:puzzle/:set/submissions', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  const puzzle = c.req.param('puzzle');
  const setSlug = c.req.param('set');
  const rows = await query<AlgSubmissionRow>(
    'SELECT * FROM alg_submissions WHERE puzzle = ? AND set_slug = ? ORDER BY id ASC',
    [puzzle, setSlug],
  );
  return c.json(rows.map(rowToJson));
});

// POST /api/alg/:puzzle/:set/:case/submit — 追加一条
algRoutes.post('/api/alg/:puzzle/:set/:case/submit', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);

  const puzzle = c.req.param('puzzle');
  const setSlug = c.req.param('set');
  const caseName = decodeURIComponent(c.req.param('case'));
  const body = await c.req.json<{ alg?: string; notes?: string }>();
  const alg = (body.alg ?? '').trim();
  const notes = (body.notes ?? '').trim() || null;

  if (!alg) return c.json({ error: 'alg required' }, 400);
  if (Buffer.byteLength(alg, 'utf8') > ALG_MAX_BYTES) return c.json({ error: 'alg too long' }, 400);
  if (notes && Buffer.byteLength(notes, 'utf8') > NOTES_MAX_BYTES) return c.json({ error: 'notes too long' }, 400);

  const inserted = await query<AlgSubmissionRow>(
    'INSERT INTO alg_submissions (puzzle, set_slug, case_name, alg, notes, author_id, author_name) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *',
    [puzzle, setSlug, caseName, alg, notes, user.wcaId, user.name],
  );
  return c.json(rowToJson(inserted[0]));
});

// PUT /api/alg/submissions/:id — 改自己的(或 admin)。caseName 仅 admin 可改。
algRoutes.put('/api/alg/submissions/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const body = await c.req.json<{ alg?: string; notes?: string; caseName?: string }>();
  const alg = (body.alg ?? '').trim();
  const notes = (body.notes ?? '').trim() || null;
  if (!alg) return c.json({ error: 'alg required' }, 400);
  if (Buffer.byteLength(alg, 'utf8') > ALG_MAX_BYTES) return c.json({ error: 'alg too long' }, 400);
  if (notes && Buffer.byteLength(notes, 'utf8') > NOTES_MAX_BYTES) return c.json({ error: 'notes too long' }, 400);

  const rows = await query<AlgSubmissionRow>('SELECT * FROM alg_submissions WHERE id = ?', [id]);
  if (rows.length === 0) return c.json({ error: 'Not found' }, 404);
  const isAdmin = ADMIN_WCA_IDS.includes(user.wcaId);
  if (!isAdmin && rows[0].author_id !== user.wcaId) {
    return c.json({ error: 'Cannot edit others alg' }, 403);
  }

  // caseName 是 case 归属变更,只有 admin 能改;非 admin 即使提交也忽略。
  const newCaseName = isAdmin && typeof body.caseName === 'string' ? body.caseName.trim() : null;
  if (newCaseName !== null && !newCaseName) return c.json({ error: 'caseName cannot be empty' }, 400);
  if (newCaseName !== null && newCaseName.length > 128) return c.json({ error: 'caseName too long' }, 400);

  if (newCaseName !== null) {
    await query('UPDATE alg_submissions SET alg = ?, notes = ?, case_name = ? WHERE id = ?', [alg, notes, newCaseName, id]);
  } else {
    await query('UPDATE alg_submissions SET alg = ?, notes = ? WHERE id = ?', [alg, notes, id]);
  }
  const updated = await query<AlgSubmissionRow>('SELECT * FROM alg_submissions WHERE id = ?', [id]);
  return c.json(rowToJson(updated[0]));
});

// DELETE /api/alg/submissions/:id — 删自己的(或 admin)
algRoutes.delete('/api/alg/submissions/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const rows = await query<AlgSubmissionRow>('SELECT author_id FROM alg_submissions WHERE id = ?', [id]);
  if (rows.length === 0) return c.json({ error: 'Not found' }, 404);
  if (!ADMIN_WCA_IDS.includes(user.wcaId) && rows[0].author_id !== user.wcaId) {
    return c.json({ error: 'Cannot delete others alg' }, 403);
  }

  await query('DELETE FROM alg_submissions WHERE id = ?', [id]);
  return c.json({ ok: true });
});
