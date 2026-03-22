import type { FastifyInstance } from 'fastify';
import { query } from '../db/connection.js';

/**
 * 训练进度 API 路由
 *
 * GET  /api/progress/:algSetId  — 获取某公式集的所有训练记录
 * POST /api/progress/:algSetId  — 批量上传训练记录
 */
export async function progressRoutes(server: FastifyInstance) {

  // 获取训练记录
  server.get<{
    Params: { algSetId: string };
    Querystring: { userId: string };
  }>('/api/progress/:algSetId', async (req) => {
    const { algSetId } = req.params;
    const userId = req.query.userId;

    if (!userId) {
      return { error: 'userId is required' };
    }

    const rows = await query(
      `SELECT case_id, time_ms, correct, created_at
       FROM train_results
       WHERE user_id = ? AND alg_set_id = ?
       ORDER BY created_at DESC
       LIMIT 1000`,
      [userId, algSetId],
    );

    return { data: rows };
  });

  // 批量上传训练记录
  server.post<{
    Params: { algSetId: string };
    Body: {
      userId: string;
      results: Array<{
        caseId: string;
        timeMs: number;
        correct: boolean;
        timestamp: number;
      }>;
    };
  }>('/api/progress/:algSetId', async (req, reply) => {
    const { algSetId } = req.params;
    const { userId, results } = req.body;

    if (!userId || !results?.length) {
      return reply.code(400).send({ error: 'userId and results are required' });
    }

    // 批量插入
    const sql = `INSERT INTO train_results (user_id, alg_set_id, case_id, time_ms, correct, created_at)
                 VALUES (?, ?, ?, ?, ?, FROM_UNIXTIME(? / 1000))`;

    for (const r of results) {
      await query(sql, [userId, algSetId, r.caseId, r.timeMs, r.correct, r.timestamp]);
    }

    return { success: true, count: results.length };
  });
}
