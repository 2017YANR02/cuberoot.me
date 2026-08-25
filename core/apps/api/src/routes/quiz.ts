/**
 * /quiz 社区题路由:登录用户出题 + 给答案,直接上线;任何登录用户可举报,
 * 管理员补译 / 下架 / 删除。表:quiz_questions / quiz_question_reports(0100)。
 *
 * 没有前置审核队列 —— 上线策略是「直接上线 + 举报」。因此把关全在这三层:
 *   1. 形状校验走 @cuberoot/shared/quiz 的 validateQuizDraft,与出题表单同一份实现
 *      (内置题库那套红线:选项不重复、参考答案自己能被 accept 判对……社区题一样过)。
 *   2. 每人每日出题条数上限(DAILY_CAP),挡住批量灌题。
 *   3. 举报即推送给管理员 —— 没人盯的举报等于没举报。
 *
 * 作者键 = 全站归属键 ownerKey(真 wca_id 或 u<uid>),与 forum_posts.author_id 同语义。
 */
import { Hono } from 'hono';
import {
  QUIZ_LEVELS, normalizeQuizDraft, validateQuizDraft,
  type QuizDraft,
} from '@cuberoot/shared/quiz';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import { requireAuth, checkRateLimit, ADMIN_WCA_IDS } from '../utils/recon_helpers.js';
import type { WcaUser } from '../utils/recon_helpers.js';
import { notify, adminRecipients } from '../utils/notify.js';
import { publicUserIdsForOwnerKeys } from '../utils/account.js';

export const quizRoutes = new Hono();

/** 每人每日新出题上限。没有前置审核,这就是灌题的唯一闸门。 */
const DAILY_CAP = 30;

function isAdmin(user: WcaUser): boolean {
  return ADMIN_WCA_IDS.includes(user.wcaId);
}

/** 用户内容,永远即取即新。 */
function noStore(c: { header: (k: string, v: string) => void }): void {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
}

/**
 * 通知失败不能连累已经落库的写入(用户看到 500 会重试 → 重复举报/重复出题)。
 * 但要 await:写 notifications 表是主路径,邮件才是它内部的旁路。同 forum.ts。
 */
async function notifyBestEffort(input: Parameters<typeof notify>[0]): Promise<void> {
  try {
    await notify(input);
  } catch (e) {
    console.warn('[quiz] notify failed:', (e as Error).message);
  }
}

interface QuestionRow {
  id: number | string;
  cat: string;
  level: string;
  type: string;
  q_zh: string; q_en: string;
  why_zh: string; why_en: string;
  options: { zh: string; en: string }[] | null;
  answer_idx: number;
  answer_zh: string; answer_en: string;
  accept: string[] | null;
  author_key: string; author_name: string;
  status: string;
  hidden_note: string | null;
  report_count: number;
  created_at: Date;
  updated_at: Date;
}

/** 行 → API 形状(camelCase)。omitAuthorKey:公开列表不外发别人的归属键。 */
function toJson(
  r: QuestionRow,
  userIds: ReadonlyMap<string, number>,
  opts: { withKey?: boolean } = {},
) {
  return {
    id: Number(r.id),
    cat: r.cat,
    level: r.level,
    type: r.type,
    qZh: r.q_zh, qEn: r.q_en,
    whyZh: r.why_zh, whyEn: r.why_en,
    options: r.options ?? [],
    answerIdx: Number(r.answer_idx),
    answerZh: r.answer_zh, answerEn: r.answer_en,
    accept: r.accept ?? [],
    authorName: r.author_name,
    authorUserId: userIds.get(r.author_key) ?? null,
    ...(opts.withKey ? { authorKey: r.author_key } : {}),
    status: r.status,
    hiddenNote: r.hidden_note ?? '',
    reportCount: Number(r.report_count),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function rowsToJson(rows: QuestionRow[], opts: { withKey?: boolean } = {}) {
  const userIds = await publicUserIdsForOwnerKeys(rows.map((r) => r.author_key));
  return rows.map((r) => toJson(r, userIds, opts));
}

const COLUMNS = `id, cat, level, type, q_zh, q_en, why_zh, why_en, options, answer_idx,
                 answer_zh, answer_en, accept, author_key, author_name, status, hidden_note,
                 report_count, created_at, updated_at`;

/** 请求体 → QuizDraft(缺字段一律当空,校验交给 shared)。 */
function readDraft(body: Partial<QuizDraft>): QuizDraft {
  return normalizeQuizDraft({
    cat: String(body.cat ?? ''),
    level: String(body.level ?? ''),
    type: String(body.type ?? ''),
    qZh: String(body.qZh ?? ''), qEn: String(body.qEn ?? ''),
    whyZh: String(body.whyZh ?? ''), whyEn: String(body.whyEn ?? ''),
    options: Array.isArray(body.options)
      ? body.options.slice(0, 12).map((o) => ({ zh: String(o?.zh ?? ''), en: String(o?.en ?? '') }))
      : [],
    answerIdx: Number(body.answerIdx ?? 0),
    answerZh: String(body.answerZh ?? ''), answerEn: String(body.answerEn ?? ''),
    accept: Array.isArray(body.accept) ? body.accept.slice(0, 24).map((k) => String(k ?? '')) : [],
  });
}

// ==================== GET /v1/quiz/questions ====================
// 公开:某一档的全部已发布社区题。答题页每局开局拉一次。
quizRoutes.get('/quiz/questions', async (c) => {
  const level = c.req.query('level') ?? '';
  if (!(QUIZ_LEVELS as readonly string[]).includes(level)) {
    return c.json({ error: 'Invalid level' }, 400);
  }
  const rows = await query<QuestionRow>(
    `SELECT ${COLUMNS} FROM quiz_questions
     WHERE status = 'published' AND level = ?
     ORDER BY id`,
    [level],
  );
  // 用户随时会加题,浏览器只缓 60s;共享层同龄,免得刚出的题半天不露面。
  c.header('Cache-Control', 'public, max-age=60, s-maxage=60');
  return c.json({ questions: await rowsToJson(rows) });
});

// ==================== GET /v1/quiz/mine ====================
// 登录:我出的题(含被下架的,带下架理由)。
quizRoutes.get('/quiz/mine', async (c) => {
  noStore(c);
  const user = await requireAuth(c);
  const rows = await query<QuestionRow>(
    `SELECT ${COLUMNS} FROM quiz_questions WHERE author_key = ? ORDER BY id DESC`,
    [user.wcaId],
  );
  return c.json({ questions: await rowsToJson(rows, { withKey: true }) });
});

// ==================== POST /v1/quiz/questions ====================
// 登录:出一道新题,直接上线。
quizRoutes.post('/quiz/questions', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);
  const draft = readDraft(await c.req.json<Partial<QuizDraft>>());
  const bad = validateQuizDraft(draft);
  if (bad) return c.json({ error: `Invalid question: ${bad}`, code: bad }, 400);

  const today = await query<{ n: number | string }>(
    `SELECT COUNT(*)::int AS n FROM quiz_questions
     WHERE author_key = ? AND created_at > NOW() - INTERVAL '24 hours'`,
    [user.wcaId],
  );
  if (Number(today[0]?.n ?? 0) >= DAILY_CAP) {
    return c.json({ error: `Daily limit reached (${DAILY_CAP} questions per day)`, code: 'daily_cap' }, 429);
  }

  const rows = await query<QuestionRow>(
    `INSERT INTO quiz_questions
       (cat, level, type, q_zh, q_en, why_zh, why_en, options, answer_idx,
        answer_zh, answer_en, accept, author_key, author_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?::text[], ?, ?)
     RETURNING ${COLUMNS}`,
    [
      draft.cat, draft.level, draft.type, draft.qZh, draft.qEn, draft.whyZh, draft.whyEn,
      // ::jsonb 参数传裸对象 —— postgres.js 自己序列化,预先 JSON.stringify 会双重编码
      draft.options, draft.answerIdx, draft.answerZh, draft.answerEn, draft.accept,
      user.wcaId, user.name,
    ],
  );
  return c.json({ question: (await rowsToJson(rows, { withKey: true }))[0] });
});

// ==================== PATCH /v1/quiz/questions/:id ====================
// 作者改自己的题;管理员可改任何题(补译、修错)并改 status(下架/恢复)。
quizRoutes.patch('/quiz/questions/:id', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid question id' }, 400);

  const existing = await query<QuestionRow>(`SELECT ${COLUMNS} FROM quiz_questions WHERE id = ?`, [id]);
  if (existing.length === 0) return c.json({ error: 'Question not found' }, 404);
  const admin = isAdmin(user);
  if (!admin && existing[0].author_key !== user.wcaId) {
    return c.json({ error: 'Not your question' }, 403);
  }

  const body = await c.req.json<Partial<QuizDraft> & { status?: string; hiddenNote?: string }>();
  const draft = readDraft(body);
  const bad = validateQuizDraft(draft);
  if (bad) return c.json({ error: `Invalid question: ${bad}`, code: bad }, 400);

  // 下架/恢复只有管理员能改;作者提交的 status 一律忽略(不是报错 —— 表单本就不发这个字段)。
  const status = admin && (body.status === 'hidden' || body.status === 'published')
    ? body.status
    : existing[0].status;
  const hiddenNote = admin ? String(body.hiddenNote ?? '').slice(0, 500) : existing[0].hidden_note;

  const rows = await query<QuestionRow>(
    `UPDATE quiz_questions SET
       cat = ?, level = ?, type = ?, q_zh = ?, q_en = ?, why_zh = ?, why_en = ?,
       options = ?::jsonb, answer_idx = ?, answer_zh = ?, answer_en = ?, accept = ?::text[],
       status = ?, hidden_note = ?, updated_at = NOW()
     WHERE id = ? RETURNING ${COLUMNS}`,
    [
      draft.cat, draft.level, draft.type, draft.qZh, draft.qEn, draft.whyZh, draft.whyEn,
      draft.options, draft.answerIdx, draft.answerZh, draft.answerEn, draft.accept,
      status, hiddenNote || null, id,
    ],
  );

  // 被管理员下架 → 通知作者。不通知的话作者只会发现题「没了」,却不知道为什么。
  if (admin && status === 'hidden' && existing[0].status !== 'hidden'
      && existing[0].author_key !== user.wcaId) {
    await notifyBestEffort({
      recipients: [existing[0].author_key],
      kind: 'quiz_hidden',
      actorKey: user.wcaId,
      actorName: user.name,
      title: existing[0].q_zh || existing[0].q_en,
      excerpt: hiddenNote || '',
      link: '/quiz/mine',
    });
  }
  return c.json({ question: (await rowsToJson(rows, { withKey: true }))[0] });
});

// ==================== DELETE /v1/quiz/questions/:id ====================
// 作者删自己的题;管理员可删任何题。硬删 —— 举报行随 ON DELETE CASCADE 一起走。
quizRoutes.delete('/quiz/questions/:id', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid question id' }, 400);

  const rows = await query<{ author_key: string }>(
    'SELECT author_key FROM quiz_questions WHERE id = ?', [id],
  );
  if (rows.length === 0) return c.json({ error: 'Question not found' }, 404);
  if (!isAdmin(user) && rows[0].author_key !== user.wcaId) {
    return c.json({ error: 'Not your question' }, 403);
  }
  await query('DELETE FROM quiz_questions WHERE id = ?', [id]);
  return c.json({ ok: true });
});

// ==================== POST /v1/quiz/questions/:id/report ====================
// 登录:举报一道题(答错了 / 有争议 / 灌水)。一人一题一条,重复举报更新理由并重新待处理。
quizRoutes.post('/quiz/questions/:id/report', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid question id' }, 400);
  const body = await c.req.json<{ reason?: string }>();
  const reason = (body.reason ?? '').trim();
  if (!reason) return c.json({ error: 'reason is required' }, 400);
  if (reason.length > 500) return c.json({ error: 'reason exceeds 500 characters' }, 400);

  const rows = await query<{ author_key: string; status: string; q_zh: string; q_en: string }>(
    'SELECT author_key, status, q_zh, q_en FROM quiz_questions WHERE id = ?', [id],
  );
  if (rows.length === 0 || rows[0].status !== 'published') {
    return c.json({ error: 'Question not found' }, 404);
  }
  if (rows[0].author_key === user.wcaId) {
    return c.json({ error: 'Cannot report your own question' }, 400);
  }

  await query(
    `INSERT INTO quiz_question_reports (question_id, reporter_key, reporter_name, reason)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (question_id, reporter_key)
     DO UPDATE SET reason = EXCLUDED.reason, created_at = NOW(), resolved_at = NULL`,
    [id, user.wcaId, user.name, reason],
  );
  // report_count 是给管理台排序用的计数,重新算而不是 +1 —— 重复举报不该翻倍。
  await query(
    `UPDATE quiz_questions SET report_count =
       (SELECT COUNT(*) FROM quiz_question_reports WHERE question_id = ?)
     WHERE id = ?`,
    [id, id],
  );

  await notifyBestEffort({
    recipients: adminRecipients(),
    kind: 'quiz_report',
    actorKey: user.wcaId,
    actorName: user.name,
    title: rows[0].q_zh || rows[0].q_en,
    excerpt: reason,
    link: '/quiz/manage',
  });
  return c.json({ ok: true });
});

// ==================== GET /v1/quiz/admin/questions ====================
// 管理员:全部社区题(含已下架),按最新在前。补译 / 下架就在这个列表上做。
quizRoutes.get('/quiz/admin/questions', async (c) => {
  noStore(c);
  const user = await requireAuth(c);
  if (!isAdmin(user)) return c.json({ error: 'Admin access required' }, 403);
  const rows = await query<QuestionRow>(
    `SELECT ${COLUMNS} FROM quiz_questions ORDER BY id DESC LIMIT 500`,
  );
  return c.json({ questions: await rowsToJson(rows, { withKey: true }) });
});

// ==================== GET /v1/quiz/admin/reports ====================
// 管理员:举报列表,默认只看待处理,?all=1 含已处理。
quizRoutes.get('/quiz/admin/reports', async (c) => {
  noStore(c);
  const user = await requireAuth(c);
  if (!isAdmin(user)) return c.json({ error: 'Admin access required' }, 403);
  const all = c.req.query('all') === '1';
  const rows = await query<{
    id: number | string; question_id: number | string;
    reporter_key: string; reporter_name: string; reason: string;
    created_at: Date; resolved_at: Date | null;
    q_zh: string; q_en: string; author_key: string; author_name: string; status: string;
  }>(
    `SELECT r.id, r.question_id, r.reporter_key, r.reporter_name, r.reason,
            r.created_at, r.resolved_at, q.q_zh, q.q_en, q.author_key, q.author_name, q.status
     FROM quiz_question_reports r
     JOIN quiz_questions q ON q.id = r.question_id
     ${all ? '' : 'WHERE r.resolved_at IS NULL'}
     ORDER BY r.created_at DESC LIMIT 200`,
  );
  const userIds = await publicUserIdsForOwnerKeys(rows.flatMap((r) => [r.author_key, r.reporter_key]));
  return c.json({
    reports: rows.map((r) => ({
      id: Number(r.id),
      questionId: Number(r.question_id),
      qZh: r.q_zh, qEn: r.q_en,
      authorName: r.author_name,
      authorUserId: userIds.get(r.author_key) ?? null,
      questionStatus: r.status,
      reporterKey: r.reporter_key, reporterName: r.reporter_name, reason: r.reason,
      reporterUserId: userIds.get(r.reporter_key) ?? null,
      createdAt: r.created_at, resolvedAt: r.resolved_at,
    })),
  });
});

// ==================== POST /v1/quiz/admin/reports/:id/resolve ====================
quizRoutes.post('/quiz/admin/reports/:id/resolve', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);
  if (!isAdmin(user)) return c.json({ error: 'Admin access required' }, 403);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid report id' }, 400);
  await query('UPDATE quiz_question_reports SET resolved_at = NOW() WHERE id = ?', [id]);
  return c.json({ ok: true });
});
