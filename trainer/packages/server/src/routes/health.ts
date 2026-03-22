import type { FastifyInstance } from 'fastify';
import { pingDb } from '../db/connection.js';

/**
 * 健康检查路由
 * GET /api/health — 返回服务器和数据库状态
 */
export async function healthRoutes(server: FastifyInstance) {
  server.get('/api/health', async () => {
    const dbOk = await pingDb();
    return {
      status: dbOk ? 'ok' : 'degraded',
      timestamp: Date.now(),
      db: dbOk ? 'connected' : 'disconnected',
    };
  });
}
