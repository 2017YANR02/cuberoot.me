import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { getIp } from '../utils/analytics_helpers.js';
import { answerSiteQuestion, assistantConfig } from '../utils/site_assistant.js';
import { reserveAssistantQuestion } from '../utils/site_assistant_quota.js';
import { SITE_ASSISTANT_TIMEOUT_MS, SITE_ASSISTANT_MAX_IMAGES, SITE_ASSISTANT_IMAGE_BYTES, SITE_ASSISTANT_BODY_BYTES, type AssistantStreamEvent } from '@cuberoot/shared/site-assistant';
import { AssistantFailure, assistantDeadline, assistantFailureCode, assistantStage } from '../utils/site_assistant_diagnostics.js';
import { requireAuth } from '../utils/recon_helpers.js';
import { getUserById } from '../utils/account.js';
import { BANNED_WCA_IDS } from '@cuberoot/shared/admin';
import { rasterImageMime } from '../utils/raster_image.js';
import { verifySession } from '../utils/session.js';

export async function requireAssistantUser(c: Context): Promise<{ uid: number; wcaId: string }> {
  // Paid AI requires a current CubeRoot session. Do not enter the legacy raw-WCA
  // token fallback (network lookup and indefinite cache) for missing/expired JWTs.
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new AssistantFailure('login_required');
  try { verifySession(authorization.slice(7)); }
  catch { throw new AssistantFailure('login_required'); }
  let user;
  try { user = await requireAuth(c); }
  catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') throw new AssistantFailure('login_required');
    if (error instanceof Error && error.message.includes('suspended')) throw new AssistantFailure('account_forbidden');
    throw error;
  }
  // Re-read canonical state: neither an old JWT claim nor a cached raw WCA token
  // can retain AI access after unlinking, merging or deleting the account.
  const account = user.uid == null ? null : await getUserById(user.uid);
  if (!account || account.id !== user.uid) throw new AssistantFailure('login_required');
  if (!account.wca_id || !/^\d{4}[A-Z]{4}\d{2}$/.test(account.wca_id)) throw new AssistantFailure('wca_link_required');
  if (BANNED_WCA_IDS.includes(account.wca_id)) throw new AssistantFailure('account_forbidden');
  return { uid: account.id, wcaId: account.wca_id };
}

const imageSchema = z.object({
  mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  data: z.string().min(4).max(4 * Math.ceil(SITE_ASSISTANT_IMAGE_BYTES / 3)),
}).strict().refine(image => {
  // Reject URLs, noncanonical base64, forged MIME and excessive pixel dimensions.
  const bytes = Buffer.from(image.data, 'base64');
  return bytes.length <= SITE_ASSISTANT_IMAGE_BYTES && bytes.toString('base64') === image.data
    && rasterImageMime(bytes) === image.mediaType;
});
const imagesSchema = z.array(imageSchema).max(SITE_ASSISTANT_MAX_IMAGES);
const inputSchema = z.object({
  question: z.string().trim().max(500), lang: z.enum(['zh', 'en']),
  images: imagesSchema.optional(),
  timeZone: z.string().max(100).refine(zone => { try { new Intl.DateTimeFormat('en', { timeZone: zone }); return true; } catch { return false; } }, 'Invalid time zone').optional(),
  viewerWcaId: z.string().regex(/^\d{4}[A-Z]{4}\d{2}$/).optional(),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(6000), images: imagesSchema.optional() }).strict()
    .refine(message => message.role === 'user' || !message.images?.length, { path: ['images'] })).max(10).default([]),
}).strict().refine(input => input.question.length > 0 || !!input.images?.length)
  .refine(input => (input.images?.length ?? 0) + input.history.reduce((count, message) => count + (message.images?.length ?? 0), 0) <= SITE_ASSISTANT_MAX_IMAGES, { path: ['images'] });

// Burst limits are per process; the daily shared limit is atomic and durable.
export function createSiteAssistantRoutes(deps = { answer: answerSiteQuestion, config: assistantConfig, now: Date.now, reserve: reserveAssistantQuestion, authenticate: requireAssistantUser }) {
  const routes = new Hono();
  let active = 0;
  let minute = 0;
  let minuteCount = 0;
  const clients = new Map<string, number>();
  routes.use('/site-assistant', async (c, next) => { await next(); c.header('Cache-Control', 'no-store'); });
  routes.use('/site-assistant', bodyLimit({ maxSize: SITE_ASSISTANT_BODY_BYTES, onError: c => c.json({ error: 'invalid_image' }, 413) }));
  routes.post('/site-assistant', async c => {
    const parsed = inputSchema.safeParse(await c.req.json().catch(error => {
      if (error instanceof SyntaxError) return null;
      throw error;
    }));
    if (!parsed.success) return c.json({ error: parsed.error.issues.some(issue => issue.path.includes('images')) ? 'invalid_image' : 'invalid_question' }, 400);
    const hasImages = !!parsed.data.images?.length || parsed.data.history.some(message => !!message.images?.length);
    const config = deps.config(hasImages);
    if (!config) return c.json({ error: hasImages ? 'vision_unavailable' : 'unavailable' }, 503);
    // Authentication is part of the same total deadline and precedes quota/model work.
    const disconnect = new AbortController();
    const signal = AbortSignal.any([disconnect.signal, c.req.raw.signal, AbortSignal.timeout(SITE_ASSISTANT_TIMEOUT_MS - 2000)]);
    let admitted = false;
    try { return await assistantStage('total',()=>assistantDeadline(async()=>{
      const user = await assistantStage('auth',()=>deps.authenticate(c));
      signal.throwIfAborted();
      const now = deps.now();
      if (Math.floor(now / 60000) !== minute) { minute = Math.floor(now / 60000); minuteCount = 0; clients.clear(); }
      const ip = getIp(c);
      const accountKey = `uid:${user.uid}`;
      if ((clients.get(ip) ?? 0) >= 6 || (clients.get(accountKey) ?? 0) >= 6 || minuteCount >= 30 || active >= 4) {
        c.header('Retry-After', '60');
        return c.json({ error: 'busy' }, 429);
      }
      clients.set(ip, (clients.get(ip) ?? 0) + 1);
      clients.set(accountKey, (clients.get(accountKey) ?? 0) + 1);
      minuteCount++; active++;
      admitted = true;
      const quota = await assistantStage('quota',()=>deps.reserve());
      signal.throwIfAborted();
      if (!quota.allowed) {
        c.header('Retry-After', String(quota.retryAfter));
        return c.json({ error: 'daily_limit' }, 429);
      }
      // Keep JSON for existing clients/benchmarks. Auth and quota failures still
      // use HTTP status codes; failures after SSE starts are typed terminal events.
      if (c.req.header('Accept')?.includes('text/event-stream')) {
        c.header('X-Accel-Buffering', 'no');
        admitted = false; // The stream owns the concurrency slot until it closes.
        return streamSSE(c, async stream => {
          stream.onAbort(() => disconnect.abort());
          const emit = async (event: AssistantStreamEvent) => {
            signal.throwIfAborted();
            await stream.writeSSE({ data: JSON.stringify(event) });
          };
          try {
            await emit({ type: 'status', status: { phase: 'planning' } });
            const result = await assistantStage('total', () => assistantDeadline(() => deps.answer(parsed.data.question, parsed.data.lang, config, signal, undefined, parsed.data.history, user.wcaId, emit, parsed.data.timeZone, parsed.data.images), signal));
            await emit({ type: 'done', result });
          } catch (error) {
            if (!disconnect.signal.aborted) await stream.writeSSE({ data: JSON.stringify({ type: 'error', error: assistantFailureCode(error) }) });
          } finally { disconnect.abort(); active--; }
        });
      }
      return c.json(await deps.answer(parsed.data.question, parsed.data.lang, config, signal, undefined, parsed.data.history, user.wcaId,undefined,parsed.data.timeZone,parsed.data.images));
    },signal)); } catch(error) {
      // Provider bodies can contain request details. Never expose them to clients/logs.
      const code=assistantFailureCode(error);
      return c.json({ error: code }, code==='login_required'?401:code==='wca_link_required'||code==='account_forbidden'?403:code==='timeout'?504:503);
    } finally { if (admitted) active--; }
  });
  return routes;
}

export const siteAssistantRoutes = createSiteAssistantRoutes();
