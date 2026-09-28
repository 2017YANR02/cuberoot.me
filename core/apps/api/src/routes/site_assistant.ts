import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { getIp } from '../utils/analytics_helpers.js';
import { answerSiteQuestion, assistantConfig } from '../utils/site_assistant.js';

const inputSchema = z.object({ question: z.string().trim().min(1).max(500), lang: z.enum(['zh', 'en']) }).strict();

// Deliberately small anonymous allowance. Limits apply per API process and
// reset on restart; provider-side billing limits remain the billing authority.
export function createSiteAssistantRoutes(deps = { answer: answerSiteQuestion, config: assistantConfig, now: Date.now }) {
  const routes = new Hono();
  let active = 0;
  let minute = 0;
  let minuteCount = 0;
  let day = 0;
  let dayCount = 0;
  const clients = new Map<string, number>();
  routes.use('/site-assistant', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });
  routes.use('/site-assistant', bodyLimit({ maxSize: 4096, onError: c => c.json({ error: 'invalid_question' }, 413) }));
  routes.post('/site-assistant', async c => {
    const parsed = inputSchema.safeParse(await c.req.json().catch(error => {
      if (error instanceof SyntaxError) return null;
      throw error;
    }));
    if (!parsed.success) return c.json({ error: 'invalid_question' }, 400);
    const config = deps.config();
    if (!config) return c.json({ error: 'unavailable' }, 503);
    const now = deps.now();
    if (Math.floor(now / 60000) !== minute) { minute = Math.floor(now / 60000); minuteCount = 0; clients.clear(); }
    if (Math.floor(now / 86400000) !== day) { day = Math.floor(now / 86400000); dayCount = 0; }
    const ip = getIp(c);
    if ((clients.get(ip) ?? 0) >= 6 || minuteCount >= 30 || dayCount >= 2000 || active >= 4) {
      c.header('Retry-After', '60');
      return c.json({ error: 'busy' }, 429);
    }
    clients.set(ip, (clients.get(ip) ?? 0) + 1);
    minuteCount++; dayCount++; active++;
    try {
      const signal = AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(30000)]);
      return c.json(await deps.answer(parsed.data.question, parsed.data.lang, config, signal));
    } catch {
      // Provider bodies can contain request details. Never expose them to clients/logs.
      return c.json({ error: 'unavailable' }, 503);
    } finally { active--; }
  });
  return routes;
}

export const siteAssistantRoutes = createSiteAssistantRoutes();
