/** @module Anonymous download-entry clicks, recorded in the existing structured log. */
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { diagnosticLog } from '../observability/request.js';
import { getIp } from '../utils/analytics_helpers.js';
import { checkRateLimit, RateLimitError } from '../utils/rate_limit.js';

export const downloadRoutes = new Hono();

downloadRoutes.post('/downloads/events', bodyLimit({ maxSize: 256 }), async (c) => {
  c.header('Cache-Control', 'no-store');
  try {
    checkRateLimit(getIp(c), { bucket: 'download-clicks', max: 30 });
  } catch (error) {
    if (!(error instanceof RateLimitError)) throw error;
    c.header('Retry-After', String(error.retryAfterSeconds));
    return c.json({ error: 'Too many requests' }, 429);
  }
  let body: unknown;
  try { body = JSON.parse(await c.req.text()); }
  catch { return c.json({ error: 'Invalid JSON' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Invalid download event' }, 400);
  }
  const event = body as Record<string, unknown>;
  if (Object.keys(event).some((key) => key !== 'channel' && key !== 'language')
    || !['play', 'apk', 'windows-installer', 'windows-portable'].includes(event.channel as string)
    || !['en', 'zh'].includes(event.language as string)) {
    return c.json({ error: 'Invalid download event' }, 400);
  }
  diagnosticLog('download_click', { platform: String(event.channel).startsWith('windows-') ? 'windows' : 'android', channel: event.channel, language: event.language });
  return c.body(null, 204);
});
