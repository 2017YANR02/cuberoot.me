import { Hono } from 'hono';
import { query } from '../db/connection.js';

/**
 * 训练进度 API 路由
 *
 * GET  /v1/progress/:algSetId  — 获取某公式集的所有训练记录
 * POST /v1/progress/:algSetId  — 批量上传训练记录
 */
export const progressRoutes = new Hono();

// 获取训练记录
progressRoutes.get('/progress/:algSetId', async (c) => {
  const algSetId = c.req.param('algSetId');
  const userId = c.req.query('userId');

  if (!userId) {
    return c.json({ error: 'userId is required' });
  }

  const rows = await query(
    `SELECT case_id, time_ms, correct, created_at
     FROM train_results
     WHERE user_id = ? AND alg_set_id = ?
     ORDER BY created_at DESC
     LIMIT 1000`,
    [userId, algSetId],
  );

  return c.json({ data: rows });
});

// 批量上传训练记录
progressRoutes.post('/progress/:algSetId', async (c) => {
  const algSetId = c.req.param('algSetId');
  const body = await c.req.json<{
    userId: string;
    results: Array<{
      caseId: string;
      timeMs: number;
      correct: boolean;
      timestamp: number;
    }>;
  }>();
  const { userId, results } = body;

  if (!userId || !results?.length) {
    return c.json({ error: 'userId and results are required' }, 400);
  }

  // 批量插入
  const sql = `INSERT INTO train_results (user_id, alg_set_id, case_id, time_ms, correct, created_at)
               VALUES (?, ?, ?, ?, ?, to_timestamp(?::numeric / 1000.0) AT TIME ZONE 'UTC')`;

  for (const r of results) {
    // correct 列 PG 端是 SMALLINT,driver 不接 boolean,前端来的 true/false → 1/0
    await query(sql, [userId, algSetId, r.caseId, r.timeMs, r.correct ? 1 : 0, r.timestamp]);
  }

  return c.json({ success: true, count: results.length });
});
