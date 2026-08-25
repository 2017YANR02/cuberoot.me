import { Hono } from 'hono';
import { pingDb } from '../db/connection.js';

/**
 * 健康检查路由
 * GET /v1/health — 返回服务器和数据库状态
 */
export const healthRoutes = new Hono();

healthRoutes.get('/health', async (c) => {
  const dbOk = await pingDb();
  return c.json({
    status: dbOk ? 'ok' : 'degraded',
    timestamp: Date.now(),
    db: dbOk ? 'connected' : 'disconnected',
  });
});
