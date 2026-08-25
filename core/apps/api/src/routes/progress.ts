import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { query } from '../db/connection.js';
import { getIp } from '../utils/analytics_helpers.js';
import { checkRateLimit, requireAuth } from '../utils/recon_helpers.js';

/**
 * 训练进度 API 路由
 *
 * GET  /v1/progress/:algSetId  — 获取当前登录用户某公式集的训练记录
 * POST /v1/progress/:algSetId  — 为当前登录用户批量上传训练记录
 *
 * 身份只取 requireAuth(c).wcaId(ownerKey)。旧客户端传来的 userId 会被忽略，
 * 不能用请求字段选择或冒充记录所有者。历史数据仍是客户端自报成绩，不视为已验证证据。
 */
export const progressRoutes = new Hono();

const MAX_RESULTS_PER_UPLOAD = 200;
const MAX_UPLOAD_BYTES = 64 * 1024;
const MAX_TIME_MS = 60 * 60 * 1000;
const MIN_TIMESTAMP_MS = Date.UTC(2000, 0, 1);
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

const progressBodyLimit = bodyLimit({
  maxSize: MAX_UPLOAD_BYTES,
  onError: (c) => c.json({ error: 'Payload too large' }, 413),
});

interface ProgressResultInput {
  caseId?: unknown;
  timeMs?: unknown;
  correct?: unknown;
  timestamp?: unknown;
}

function parseBoundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length >= 1
    && normalized.length <= maxLength
    && !/[\x00-\x1f\x7f]/.test(normalized)
    ? normalized
    : null;
}

function parseResult(value: unknown, now: number): {
  caseId: string;
  timeMs: number;
  correct: boolean;
  timestamp: number;
} | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as ProgressResultInput;
  const caseId = parseBoundedText(input.caseId, 100);
  if (!caseId) return null;
  if (!Number.isInteger(input.timeMs) || (input.timeMs as number) < 1 || (input.timeMs as number) > MAX_TIME_MS) {
    return null;
  }
  if (typeof input.correct !== 'boolean') return null;
  if (!Number.isSafeInteger(input.timestamp)
    || (input.timestamp as number) < MIN_TIMESTAMP_MS
    || (input.timestamp as number) > now + MAX_FUTURE_SKEW_MS) {
    return null;
  }
  return {
    caseId,
    timeMs: input.timeMs as number,
    correct: input.correct,
    timestamp: input.timestamp as number,
  };
}

progressRoutes.get('/progress/:algSetId', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c), { bucket: 'progress-read-ip', max: 600 });
  const authUser = await requireAuth(c);
  checkRateLimit(authUser.wcaId, { bucket: 'progress-read-user', max: 120 });
  const algSetId = parseBoundedText(c.req.param('algSetId'), 50);
  if (!algSetId) return c.json({ error: 'invalid algSetId' }, 400);

  const rows = await query(
    `SELECT case_id, time_ms, correct, created_at
     FROM train_results
     WHERE user_id = ? AND alg_set_id = ?
     ORDER BY created_at DESC
     LIMIT 1000`,
    [authUser.wcaId, algSetId],
  );

  return c.json({ data: rows });
});

progressRoutes.post('/progress/:algSetId', progressBodyLimit, async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c), { bucket: 'progress-write-ip', max: 120 });
  const authUser = await requireAuth(c);
  checkRateLimit(authUser.wcaId, { bucket: 'progress-write-user', max: 30 });
  const algSetId = parseBoundedText(c.req.param('algSetId'), 50);
  if (!algSetId) return c.json({ error: 'invalid algSetId' }, 400);

  // 先读取受 bodyLimit 保护的原始文本。流式请求超限时，BodyLimitError 必须向外冒泡，
  // 由中间件统一返回 413，不能被 JSON 解析的 400 分支吞掉。
  const rawBody = await c.req.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_UPLOAD_BYTES) {
    return c.json({ error: 'Payload too large' }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.json({ error: 'invalid json' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'invalid body' }, 400);
  }
  const resultsInput = (body as { results?: unknown }).results;
  if (!Array.isArray(resultsInput) || resultsInput.length === 0) {
    return c.json({ error: 'results are required' }, 400);
  }
  if (resultsInput.length > MAX_RESULTS_PER_UPLOAD) {
    return c.json({ error: 'too many results' }, 400);
  }

  const now = Date.now();
  const results = resultsInput.map((result) => parseResult(result, now));
  if (results.some((result) => result === null)) {
    return c.json({ error: 'invalid result' }, 400);
  }

  // 批量插入:单条 multi-row INSERT,200 条 RTT 从 200 次降到 1 次。
  // correct 列 PG 端是 SMALLINT,driver 不接 boolean → 1/0。
  const valuesSql = results
    .map(() => `(?, ?, ?, ?, ?, to_timestamp(?::numeric / 1000.0) AT TIME ZONE 'UTC')`)
    .join(', ');
  const params: unknown[] = [];
  for (const r of results) {
    if (!r) continue;
    params.push(authUser.wcaId, algSetId, r.caseId, r.timeMs, r.correct ? 1 : 0, r.timestamp);
  }
  await query(
    `INSERT INTO train_results (user_id, alg_set_id, case_id, time_ms, correct, created_at)
     VALUES ${valuesSql}`,
    params,
  );

  return c.json({ success: true, count: results.length });
});
