import { Hono } from 'hono';
import { db } from '../db';

export const dailyChallengeRoutes = new Hono();

dailyChallengeRoutes.get('/today', async (c) => {
  const today = new Date().toISOString().slice(0, 10);
  
  const challenge = await db.query(
    `SELECT id, challenge_date, event, scramble FROM daily_challenges WHERE challenge_date = $1`,
    [today]
  );

  if (challenge.rows.length === 0) {
    return c.json({ error: '今日挑战尚未生成' }, 404);
  }

  const userId = c.get('userId'); // 从认证中间件获取
  let myRecord = null;
  if (userId) {
    const record = await db.query(
      `SELECT time_ms, solution FROM daily_records WHERE challenge_id = $1 AND user_id = $2`,
      [challenge.rows[0].id, userId]
    );
    if (record.rows.length > 0) myRecord = record.rows[0];
  }

  return c.json({ 
    challenge: challenge.rows[0], 
    myRecord,
    attemptsLeft: myRecord ? 0 : 3
  });
});

dailyChallengeRoutes.post('/submit', async (c) => {
  const body = await c.req.json<{ challengeId: number; timeMs: number; solution: string }>();
  const userId = c.get('userId');
  
  if (!userId) return c.json({ error: '请先登录' }, 401);

  if (body.timeMs < 500) {
    return c.json({ error: '成绩异常：时间过短' }, 400);
  }

  const stepCount = (body.solution.match(/[URFDLB]/g) || []).length;
  if (stepCount < 15) {
    return c.json({ error: '成绩异常：还原步数过少' }, 400);
  }

  try {
    await db.query(
      `INSERT INTO daily_records (challenge_id, user_id, time_ms, solution) VALUES ($1, $2, $3, $4)`,
      [body.challengeId, userId, body.timeMs, body.solution]
    );
  } catch (e: any) {
    if (e.code === '23505') return c.json({ error: '你今天已经提交过成绩了' }, 409);
    throw e;
  }

  const rankResult = await db.query(
    `SELECT COUNT(*) + 1 AS rank FROM daily_records WHERE challenge_id = $1 AND time_ms < $2`,
    [body.challengeId, body.timeMs]
  );
  const totalResult = await db.query(
    `SELECT COUNT(*) AS total FROM daily_records WHERE challenge_id = $1`,
    [body.challengeId]
  );

  const rank = rankResult.rows[0].rank;
  const total = totalResult.rows[0].total;
  const beatPercent = Math.round(((total - rank) / total) * 100);

  return c.json({ ok: true, rank, beatPercent });
});

dailyChallengeRoutes.get('/leaderboard', async (c) => {
  const today = new Date().toISOString().slice(0, 10);
  
  const result = await db.query(
    `SELECT u.username, dr.time_ms FROM daily_records dr
     JOIN daily_challenges dc ON dc.id = dr.challenge_id
     JOIN users u ON u.id = dr.user_id
     WHERE dc.challenge_date = $1
     ORDER BY dr.time_ms ASC LIMIT 100`,
    [today]
  );

  return c.json({ leaderboard: result.rows });
});
