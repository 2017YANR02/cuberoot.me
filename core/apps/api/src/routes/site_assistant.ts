import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { getIp } from '../utils/analytics_helpers.js';
import { answerSiteQuestion, assistantConfig } from '../utils/site_assistant.js';
import { reserveAssistantQuestion } from '../utils/site_assistant_quota.js';

const inputSchema = z.object({ question: z.string().trim().min(1).max(500), lang: z.enum(['zh', 'en']), viewerWcaId: z.string().regex(/^\d{4}[A-Z]{4}\d{2}$/).optional(), history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(6000) }).strict()).max(10).default([]) }).strict();

// Burst limits are per process; the daily 100-question limit is atomic and durable.
export function createSiteAssistantRoutes(deps = { answer: answerSiteQuestion, config: assistantConfig, now: Date.now, reserve: reserveAssistantQuestion }) {
  const routes = new Hono();
  let active = 0;
  let minute = 0;
  let minuteCount = 0;
  const clients = new Map<string, number>();
  routes.use('/site-assistant', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });
  routes.use('/site-assistant', bodyLimit({ maxSize: 70000, onError: c => c.json({ error: 'invalid_question' }, 413) }));
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
    const ip = getIp(c);
    if ((clients.get(ip) ?? 0) >= 6 || minuteCount >= 30 || active >= 4) {
      c.header('Retry-After', '60');
      return c.json({ error: 'busy' }, 429);
    }
    clients.set(ip, (clients.get(ip) ?? 0) + 1);
    minuteCount++; active++;
    try {
      const quota = await deps.reserve();
      if (!quota.allowed) {
        c.header('Retry-After', String(quota.retryAfter));
        return c.json({ error: 'daily_limit' }, 429);
      }
      const signal = AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(90000)]);
      return c.json(await deps.answer(parsed.data.question, parsed.data.lang, config, signal, undefined, parsed.data.history, parsed.data.viewerWcaId));
    } catch {
      // Provider bodies can contain request details. Never expose them to clients/logs.
      return c.json({ error: 'unavailable' }, 503);
    } finally { active--; }
  });
  return routes;
}

export const siteAssistantRoutes = createSiteAssistantRoutes();
