/**
 * /v1/wiki — 魔方术语表 (collaborative)。
 *
 * 模型:
 *   - wiki_terms: source='seed' 来自 glossary.txt 一次性导入,owner_wca_id NULL,
 *                 任何人都不能改主体 (admin 例外)。
 *                 source='user' 由登录用户创建,owner 可改可软删。
 *   - wiki_additions: 任何登录用户都可在任意 term 下增补;只有 owner 或 admin 可改。
 *
 * 软删: deleted_at IS NULL 表"活跃";admin 可硬删 (这里没暴露;走 SQL)。
 */
import { Hono } from 'hono';
import { query } from '../db/connection.js';
import {
  requireAuth,
  requireAdmin,
  authenticateUser,
  ADMIN_WCA_IDS,
  checkRateLimit,
} from '../utils/recon_helpers.js';

export const wikiRoutes = new Hono();

const HEAD_MAX = 200;
const BODY_MAX = 8192;

function getIp(c: { req: { header: (n: string) => string | undefined } }): string {
  return c.req.header('X-Real-IP') ?? c.req.header('X-Forwarded-For') ?? '0.0.0.0';
}

interface TermRow {
  id: number | string;
  letter: string;
  position: number;
  head: string;
  body: string;
  source: string;
  owner_wca_id: string | null;
  owner_name: string;
  created_at: string | Date;
  updated_at: string | Date;
}

interface AdditionRow {
  id: number | string;
  term_id: number | string;
  body: string;
  owner_wca_id: string;
  owner_name: string;
  created_at: string | Date;
  updated_at: string | Date;
}

function termToJson(t: TermRow, additions: AdditionRow[] = []) {
  return {
    id: Number(t.id),
    letter: t.letter,
    position: t.position,
    head: t.head,
    body: t.body,
    source: t.source,
    ownerWcaId: t.owner_wca_id,
    ownerName: t.owner_name,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    additions: additions
      .filter(a => Number(a.term_id) === Number(t.id))
      .map(additionToJson),
  };
}

function additionToJson(a: AdditionRow) {
  return {
    id: Number(a.id),
    termId: Number(a.term_id),
    body: a.body,
    ownerWcaId: a.owner_wca_id,
    ownerName: a.owner_name,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  };
}

function validateLetter(s: unknown): string | null {
  if (typeof s !== 'string' || s.length !== 1) return null;
  if (!/^[#A-Z]$/.test(s)) return null;
  return s;
}

function validateText(s: unknown, max: number, required: boolean): { ok: boolean; v: string; error?: string } {
  if (s === undefined || s === null) {
    return required ? { ok: false, v: '', error: 'required' } : { ok: true, v: '' };
  }
  if (typeof s !== 'string') return { ok: false, v: '', error: 'must be string' };
  const v = s.trim();
  if (required && !v) return { ok: false, v: '', error: 'required' };
  if (v.length > max) return { ok: false, v: '', error: `too long (max ${max})` };
  return { ok: true, v };
}

// GET /v1/wiki/terms — 全量列表,按 letter+position 排;additions inline 一起带回
wikiRoutes.get('/wiki/terms', async (c) => {
  c.header('Cache-Control', 'public, max-age=30');

  const terms = await query<TermRow>(
    `SELECT id, letter, position, head, body, source, owner_wca_id, owner_name,
            created_at, updated_at
     FROM wiki_terms
     WHERE deleted_at IS NULL
     ORDER BY letter, position, id`,
  );
  const additions = await query<AdditionRow>(
    `SELECT id, term_id, body, owner_wca_id, owner_name, created_at, updated_at
     FROM wiki_additions
     WHERE deleted_at IS NULL
     ORDER BY term_id, created_at`,
  );

  // group by letter
  const sectionsMap = new Map<string, ReturnType<typeof termToJson>[]>();
  for (const t of terms) {
    const arr = sectionsMap.get(t.letter) ?? [];
    arr.push(termToJson(t, additions));
    sectionsMap.set(t.letter, arr);
  }
  const sections = Array.from(sectionsMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, entries]) => ({ letter, entries }));

  return c.json({ sections });
});

// POST /v1/wiki/terms — 任何登录用户可创建新 term (作为 source='user')
wikiRoutes.post('/wiki/terms', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);

  const body = await c.req.json<{ letter?: unknown; head?: unknown; body?: unknown }>();
  const letter = validateLetter(body.letter);
  if (!letter) return c.json({ error: 'letter must be one of # A..Z' }, 400);
  const head = validateText(body.head, HEAD_MAX, true);
  if (!head.ok) return c.json({ error: `head: ${head.error}` }, 400);
  const bod = validateText(body.body, BODY_MAX, false);
  if (!bod.ok) return c.json({ error: `body: ${bod.error}` }, 400);

  const maxPos = await query<{ max: number | null }>(
    'SELECT MAX(position) AS max FROM wiki_terms WHERE letter = ?',
    [letter],
  );
  const nextPos = (maxPos[0].max ?? -1) + 1;

  const inserted = await query<TermRow>(
    `INSERT INTO wiki_terms (letter, position, head, body, source, owner_wca_id, owner_name)
     VALUES (?, ?, ?, ?, 'user', ?, ?)
     RETURNING *`,
    [letter, nextPos, head.v, bod.v, user.wcaId, user.name],
  );
  return c.json(termToJson(inserted[0]));
});

// PATCH /v1/wiki/terms/:id — owner 或 admin 改 head/body
wikiRoutes.patch('/wiki/terms/:id', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const found = await query<TermRow>(
    'SELECT * FROM wiki_terms WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  if (found.length === 0) return c.json({ error: 'Not found' }, 404);
  const term = found[0];

  const isAdmin = ADMIN_WCA_IDS.includes(user.wcaId);
  const isOwner = term.owner_wca_id != null && term.owner_wca_id === user.wcaId;
  if (!isAdmin && !isOwner) {
    return c.json({ error: term.source === 'seed' ? 'Cannot edit seed terms' : 'Cannot edit others\' terms' }, 403);
  }

  const body = await c.req.json<{ head?: unknown; body?: unknown }>();
  const head = validateText(body.head, HEAD_MAX, true);
  if (!head.ok) return c.json({ error: `head: ${head.error}` }, 400);
  const bod = validateText(body.body, BODY_MAX, false);
  if (!bod.ok) return c.json({ error: `body: ${bod.error}` }, 400);

  const updated = await query<TermRow>(
    `UPDATE wiki_terms SET head = ?, body = ?, updated_at = NOW()
     WHERE id = ? RETURNING *`,
    [head.v, bod.v, id],
  );
  return c.json(termToJson(updated[0]));
});

// DELETE /v1/wiki/terms/:id — admin 软删 (普通用户不能删 term,只能加增补)
wikiRoutes.delete('/wiki/terms/:id', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  await requireAdmin(c);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const deleted = await query<{ id: number | string }>(
    'UPDATE wiki_terms SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL RETURNING id',
    [id],
  );
  if (deleted.length === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

// POST /v1/wiki/terms/:id/additions — 任何登录用户可在任意 term 下增补
wikiRoutes.post('/wiki/terms/:id/additions', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);

  const termId = Number(c.req.param('id'));
  if (!Number.isFinite(termId)) return c.json({ error: 'invalid id' }, 400);

  // 确认 term 存在 (未软删)
  const exists = await query<{ id: number | string }>(
    'SELECT id FROM wiki_terms WHERE id = ? AND deleted_at IS NULL',
    [termId],
  );
  if (exists.length === 0) return c.json({ error: 'Term not found' }, 404);

  const body = await c.req.json<{ body?: unknown }>();
  const bod = validateText(body.body, BODY_MAX, true);
  if (!bod.ok) return c.json({ error: `body: ${bod.error}` }, 400);

  const inserted = await query<AdditionRow>(
    `INSERT INTO wiki_additions (term_id, body, owner_wca_id, owner_name)
     VALUES (?, ?, ?, ?)
     RETURNING *`,
    [termId, bod.v, user.wcaId, user.name],
  );
  return c.json(additionToJson(inserted[0]));
});

// PATCH /v1/wiki/additions/:id — owner 或 admin 改 body
wikiRoutes.patch('/wiki/additions/:id', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const found = await query<AdditionRow>(
    'SELECT * FROM wiki_additions WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  if (found.length === 0) return c.json({ error: 'Not found' }, 404);

  const isAdmin = ADMIN_WCA_IDS.includes(user.wcaId);
  const isOwner = found[0].owner_wca_id === user.wcaId;
  if (!isAdmin && !isOwner) return c.json({ error: 'Cannot edit others\' additions' }, 403);

  const body = await c.req.json<{ body?: unknown }>();
  const bod = validateText(body.body, BODY_MAX, true);
  if (!bod.ok) return c.json({ error: `body: ${bod.error}` }, 400);

  const updated = await query<AdditionRow>(
    'UPDATE wiki_additions SET body = ?, updated_at = NOW() WHERE id = ? RETURNING *',
    [bod.v, id],
  );
  return c.json(additionToJson(updated[0]));
});

// DELETE /v1/wiki/additions/:id — owner 或 admin 软删自己的增补
wikiRoutes.delete('/wiki/additions/:id', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const found = await query<AdditionRow>(
    'SELECT owner_wca_id FROM wiki_additions WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  if (found.length === 0) return c.json({ error: 'Not found' }, 404);

  const isAdmin = ADMIN_WCA_IDS.includes(user.wcaId);
  const isOwner = found[0].owner_wca_id === user.wcaId;
  if (!isAdmin && !isOwner) return c.json({ error: 'Cannot delete others\' additions' }, 403);

  await query(
    'UPDATE wiki_additions SET deleted_at = NOW() WHERE id = ?',
    [id],
  );
  return c.json({ ok: true });
});

// GET /v1/wiki/me — 返回当前登录态 (前端用来决定显示哪些按钮)
// 与 /v1/auth/me 类似,但这里只透传 wcaId+isAdmin,避免前端再调一次。
wikiRoutes.get('/wiki/me', async (c) => {
  c.header('Cache-Control', 'no-store');
  const user = await authenticateUser(c.req.header('Authorization'));
  if (!user) return c.json({ wcaId: null, isAdmin: false });
  return c.json({
    wcaId: user.wcaId,
    name: user.name,
    isAdmin: ADMIN_WCA_IDS.includes(user.wcaId),
  });
});
