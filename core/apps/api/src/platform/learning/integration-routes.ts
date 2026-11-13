import { acceptDouyinOrderWebhook } from '../douyin_order_sync.js';
import { type Hono } from 'hono';

export function registerIntegrationRoutes(platformLearningRoutes: Hono): void {
  platformLearningRoutes.post('/integrations/douyin/events', async (c) => {
    c.header('Cache-Control', 'no-store');
    const result = acceptDouyinOrderWebhook(
      await c.req.text(),
      c.req.header('app-id') ?? '',
      c.req.header('event-sign') ?? '',
    );
    if (result === 'accepted') return c.json({ code: 0, msg: 'success' });
    if (result === 'disabled') return c.json({ code: 1, msg: 'disabled' }, 503);
    if (result === 'invalid_body') return c.json({ code: 1, msg: 'invalid body' }, 400);
    return c.json({ code: 1, msg: 'invalid signature' }, 401);
  });
}
