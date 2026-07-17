/**
 * /memo/colpi 后端路由 — 字母对 → 关联词的协作数据库。
 *
 * Source of truth: colpi_words (~11.7k 行 seed 自上游 bestsiteever.net/colpi,
 * submitter_wca_id=NULL = 上游) + colpi_votes (每用户每词一票)。
 *
 * 权限矩阵:
 *   提交新词 / 投自己的票  → 任意已登录 WCA 用户
 *   编辑/删除自己提交的词    → owner
 *   编辑/删除任意词(含上游) → admin (ADMIN_WCA_IDS / X-Admin-Key)
 */
import { Hono } from 'hono';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import {
  ADMIN_WCA_IDS, requireAuth, authenticateUser, checkRateLimit,
} from '../utils/recon_helpers.js';

export const colpiRoutes = new Hono();

const CATEGORIES = new Set(['unspecified', 'object', 'person', 'action', 'place', 'other']);
// 41 ISO codes mirrored from bestsiteever.net/colpi (+ 'other' fallback for own submissions)
const LANGUAGES = new Set([
  'af', 'ar', 'bg', 'ca', 'cz', 'da', 'de', 'en', 'es', 'eu',
  'fa', 'fi', 'fr', 'gu', 'he', 'hi', 'hr', 'hu', 'id', 'it',
  'ja', 'kr', 'lt', 'mk', 'ms', 'nl', 'no', 'pl', 'pt', 'ro',
  'ru', 'se', 'sk', 'sl', 'th', 'tr', 'uk', 'uz', 'vi', 'zh', 'zu',
  'other',
]);

/** Auto-detect language from word characters. Han ideograph → zh, ASCII Latin → en, else other. */
function detectLang(word: string): string {
  if (/[一-鿿㐀-䶿豈-﫿]/.test(word)) return 'zh';
  if (/^[A-Z0-9 \-&.()'!?,]+$/.test(word)) return 'en';
  return 'other';
}
const ALPHABET = new Set([
  'A','B','C','D','E','F','G','H','I','J','K','L','M',
  'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
  'ʧ',
]);

function isValidPair(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const chars = [...s];
  return chars.length === 2 && chars.every(c => ALPHABET.has(c));
}

const WORD_RE = /^[\p{L}\p{N}\p{M}\p{P}\s]+$/u;
function validateWord(w: unknown): { ok: true; word: string } | { ok: false; error: string } {
  if (typeof w !== 'string') return { ok: false, error: 'word must be string' };
  const trimmed = w.trim().toUpperCase();
  if (!trimmed) return { ok: false, error: 'word required' };
  if (trimmed.length > 128) return { ok: false, error: 'word too long' };
  if (!WORD_RE.test(trimmed)) return { ok: false, error: 'word contains invalid chars' };
  return { ok: true, word: trimmed };
}

/** Optional explanation field; empty/whitespace → null. */
function normalizeNote(n: unknown): { ok: true; note: string | null } | { ok: false; error: string } {
  if (n === undefined || n === null) return { ok: true, note: null };
  if (typeof n !== 'string') return { ok: false, error: 'note must be string' };
  const trimmed = n.trim();
  if (!trimmed) return { ok: true, note: null };
  if (trimmed.length > 500) return { ok: false, error: 'note too long' };
  return { ok: true, note: trimmed };
}

interface WordRow {
  id: number | string;
  pair: string;
  word: string;
  category: string;
  language: string;
  offensive: boolean;
  submitter_wca_id: string | null;
  submitter_name: string | null;
  submitter_country: string | null;
  note: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

interface WordWithMetaRow extends WordRow {
  score: number | string;
  my_vote: number | string | null;
}

function rowToJson(r: WordWithMetaRow): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: Number(r.id),
    pair: r.pair,
    word: r.word,
    category: r.category,
    language: r.language,
    offensive: r.offensive,
    score: Number(r.score),
    note: r.note ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  if (r.submitter_wca_id) {
    out.submitter = {
      wcaId: r.submitter_wca_id,
      name: r.submitter_name ?? '',
      country: r.submitter_country ?? null,
    };
  }
  if (r.my_vote !== null && r.my_vote !== undefined) {
    out.myVote = Number(r.my_vote);
  }
  return out;
}

// ── GET /v1/colpi/words?lang=<code|all> — bulk fetch grouped by pair ──
// Default lang=en (mirrors upstream UX). lang=all returns every language.
// Auth optional: if authed, includes myVote per word. nginx caches 60s.
colpiRoutes.get('/colpi/words', async (c) => {
  c.header('Cache-Control', 'public, max-age=60');
  const user = await authenticateUser(c.req.header('Authorization'));
  const wcaId = user?.wcaId ?? null;
  const langParam = c.req.query('lang') ?? 'en';
  const langFilter = langParam === 'all' ? null
    : (LANGUAGES.has(langParam) ? langParam : 'en');

  const rows = langFilter === null
    ? await query<WordWithMetaRow>(
        `SELECT w.*,
           COALESCE((SELECT SUM(dir)::int FROM colpi_votes WHERE word_id = w.id), 0) AS score,
           (SELECT dir FROM colpi_votes WHERE word_id = w.id AND voter_wca_id = ?) AS my_vote
         FROM colpi_words w
         ORDER BY w.pair ASC, score DESC, w.id ASC`,
        [wcaId],
      )
    : await query<WordWithMetaRow>(
        `SELECT w.*,
           COALESCE((SELECT SUM(dir)::int FROM colpi_votes WHERE word_id = w.id), 0) AS score,
           (SELECT dir FROM colpi_votes WHERE word_id = w.id AND voter_wca_id = ?) AS my_vote
         FROM colpi_words w
         WHERE w.language = ?
         ORDER BY w.pair ASC, score DESC, w.id ASC`,
        [wcaId, langFilter],
      );

  const grouped: Record<string, Record<string, unknown>[]> = {};
  for (const r of rows) {
    const p = r.pair;
    if (!grouped[p]) grouped[p] = [];
    grouped[p].push(rowToJson(r));
  }
  return c.json(grouped);
});

// ── GET /v1/colpi/lang-counts — # rows per language for picker UI ──
colpiRoutes.get('/colpi/lang-counts', async (c) => {
  c.header('Cache-Control', 'public, max-age=300');
  const rows = await query<{ language: string; n: number | string }>(
    `SELECT language, COUNT(*)::int AS n FROM colpi_words GROUP BY language ORDER BY n DESC`,
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.language] = Number(r.n);
  return c.json(out);
});

// ── GET /v1/colpi/recent — last N user submissions, newest first ──
colpiRoutes.get('/colpi/recent', async (c) => {
  c.header('Cache-Control', 'public, max-age=60');
  const limit = Math.min(50, Math.max(1, Number(c.req.query('limit')) || 20));
  const user = await authenticateUser(c.req.header('Authorization'));
  const wcaId = user?.wcaId ?? null;

  const rows = await query<WordWithMetaRow>(
    `SELECT w.*,
       COALESCE((SELECT SUM(dir)::int FROM colpi_votes WHERE word_id = w.id), 0) AS score,
       (SELECT dir FROM colpi_votes WHERE word_id = w.id AND voter_wca_id = ?) AS my_vote
     FROM colpi_words w
     WHERE submitter_wca_id IS NOT NULL
     ORDER BY created_at DESC
     LIMIT ?`,
    [wcaId, limit],
  );
  return c.json(rows.map(rowToJson));
});

// ── POST /v1/colpi/words — submit new word (requires login) ──
colpiRoutes.post('/colpi/words', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);

  const body = await c.req.json<{
    pair?: unknown; word?: unknown; category?: unknown;
    language?: unknown; country?: unknown; note?: unknown;
  }>();
  if (!isValidPair(body.pair)) return c.json({ error: 'invalid pair' }, 400);
  const v = validateWord(body.word);
  if (!v.ok) return c.json({ error: v.error }, 400);
  const n = normalizeNote(body.note);
  if (!n.ok) return c.json({ error: n.error }, 400);
  const cat = typeof body.category === 'string' && CATEGORIES.has(body.category)
    ? body.category : 'unspecified';
  // Language: client may pass override; otherwise auto-detect from chars.
  const lang = typeof body.language === 'string' && LANGUAGES.has(body.language)
    ? body.language : detectLang(v.word);
  const country = typeof body.country === 'string' && body.country.length <= 8
    ? body.country : null;

  try {
    const inserted = await query<WordRow>(
      `INSERT INTO colpi_words (pair, word, category, language, submitter_wca_id, submitter_name, submitter_country, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [body.pair as string, v.word, cat, lang, user.wcaId, user.name, country, n.note],
    );
    return c.json({ ...rowToJson({ ...inserted[0], score: 0, my_vote: null }) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('duplicate') || msg.includes('uq_colpi_words_pair_word_lang')) {
      return c.json({ error: 'word already exists for this pair + language' }, 409);
    }
    throw e;
  }
});

// ── PATCH /v1/colpi/words/:id — edit own (or any if admin) ──
colpiRoutes.patch('/colpi/words/:id', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);
  const isAdmin = ADMIN_WCA_IDS.includes(user.wcaId);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const existing = await query<WordRow>('SELECT * FROM colpi_words WHERE id = ?', [id]);
  if (existing.length === 0) return c.json({ error: 'not found' }, 404);
  const row = existing[0];
  if (!isAdmin && row.submitter_wca_id !== user.wcaId) {
    return c.json({ error: 'Cannot edit others\' submissions' }, 403);
  }

  const body = await c.req.json<{
    word?: unknown; category?: unknown; language?: unknown; offensive?: unknown; note?: unknown;
  }>();
  let nextWord = row.word;
  let nextCat = row.category;
  let nextLang = row.language;
  let nextOffensive = row.offensive;
  let nextNote: string | null = row.note;
  let wordChanged = false;

  if (body.word !== undefined) {
    const v = validateWord(body.word);
    if (!v.ok) return c.json({ error: v.error }, 400);
    if (v.word !== row.word) wordChanged = true;
    nextWord = v.word;
  }
  if (body.category !== undefined) {
    if (typeof body.category !== 'string' || !CATEGORIES.has(body.category)) {
      return c.json({ error: 'invalid category' }, 400);
    }
    nextCat = body.category;
  }
  if (body.language !== undefined) {
    if (typeof body.language !== 'string' || !LANGUAGES.has(body.language)) {
      return c.json({ error: 'invalid language' }, 400);
    }
    nextLang = body.language;
  } else if (wordChanged) {
    // Re-detect when word text changes and client didn't override.
    nextLang = detectLang(nextWord);
  }
  // 仅 admin 可改 offensive 标记
  if (body.offensive !== undefined) {
    if (!isAdmin) return c.json({ error: 'Admin access required for offensive flag' }, 403);
    nextOffensive = Boolean(body.offensive);
  }
  if (body.note !== undefined) {
    const n = normalizeNote(body.note);
    if (!n.ok) return c.json({ error: n.error }, 400);
    nextNote = n.note;
  }

  try {
    await query(
      `UPDATE colpi_words SET word = ?, category = ?, language = ?, offensive = ?, note = ? WHERE id = ?`,
      [nextWord, nextCat, nextLang, nextOffensive, nextNote, id],
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('duplicate') || msg.includes('uq_colpi_words_pair_word_lang')) {
      return c.json({ error: 'another row with this pair+word already exists' }, 409);
    }
    throw e;
  }

  const updated = await query<WordWithMetaRow>(
    `SELECT w.*,
       COALESCE((SELECT SUM(dir)::int FROM colpi_votes WHERE word_id = w.id), 0) AS score,
       (SELECT dir FROM colpi_votes WHERE word_id = w.id AND voter_wca_id = ?) AS my_vote
     FROM colpi_words w WHERE id = ?`,
    [user.wcaId, id],
  );
  return c.json(rowToJson(updated[0]));
});

// ── DELETE /v1/colpi/words/:id — delete own (or any if admin) ──
colpiRoutes.delete('/colpi/words/:id', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);
  const isAdmin = ADMIN_WCA_IDS.includes(user.wcaId);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const existing = await query<WordRow>('SELECT * FROM colpi_words WHERE id = ?', [id]);
  if (existing.length === 0) return c.json({ error: 'not found' }, 404);
  if (!isAdmin && existing[0].submitter_wca_id !== user.wcaId) {
    return c.json({ error: 'Cannot delete others\' submissions' }, 403);
  }

  await query('DELETE FROM colpi_words WHERE id = ?', [id]);
  return c.json({ ok: true });
});

// ── PUT /v1/colpi/words/:id/vote — set my vote (1 or -1) ──
colpiRoutes.put('/colpi/words/:id/vote', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const body = await c.req.json<{ dir?: unknown }>();
  const dir = Number(body.dir);
  if (dir !== 1 && dir !== -1) return c.json({ error: 'dir must be 1 or -1' }, 400);

  const exists = await query<{ id: number | string }>('SELECT id FROM colpi_words WHERE id = ?', [id]);
  if (exists.length === 0) return c.json({ error: 'not found' }, 404);

  await query(
    `INSERT INTO colpi_votes (word_id, voter_wca_id, dir) VALUES (?, ?, ?)
     ON CONFLICT (word_id, voter_wca_id) DO UPDATE SET dir = EXCLUDED.dir`,
    [id, user.wcaId, dir],
  );
  const score = await query<{ score: number | string }>(
    `SELECT COALESCE(SUM(dir)::int, 0) AS score FROM colpi_votes WHERE word_id = ?`,
    [id],
  );
  return c.json({ ok: true, score: Number(score[0].score), myVote: dir });
});

// ── DELETE /v1/colpi/words/:id/vote — clear my vote ──
colpiRoutes.delete('/colpi/words/:id/vote', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  await query('DELETE FROM colpi_votes WHERE word_id = ? AND voter_wca_id = ?', [id, user.wcaId]);
  const score = await query<{ score: number | string }>(
    `SELECT COALESCE(SUM(dir)::int, 0) AS score FROM colpi_votes WHERE word_id = ?`,
    [id],
  );
  return c.json({ ok: true, score: Number(score[0].score), myVote: null });
});
