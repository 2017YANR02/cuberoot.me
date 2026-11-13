import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { getIp } from '../utils/analytics_helpers.js';
import { answerSiteQuestion, assistantConfig } from '../utils/site_assistant.js';
import { reserveAssistantQuestion } from '../utils/site_assistant_quota.js';
import { assistantTimeoutMs, boundAssistantHistory, SITE_ASSISTANT_ARTIFACT_FORMAT, SITE_ASSISTANT_QUESTION_MAX_LENGTH, SITE_ASSISTANT_HISTORY_MESSAGE_MAX_LENGTH, SITE_ASSISTANT_MAX_IMAGES, SITE_ASSISTANT_IMAGE_BYTES, SITE_ASSISTANT_BODY_BYTES, type AssistantAnswer, type AssistantStreamEvent } from '@cuberoot/shared/site-assistant';
import { AssistantFailure, assistantDeadline, assistantFailureCode, assistantStage } from '../utils/site_assistant_diagnostics.js';
import { requireAuth, checkRateLimit } from '../utils/recon_helpers.js';
import { getUserById } from '../utils/account.js';
import { BANNED_WCA_IDS } from '@cuberoot/shared/admin';
import { assistantImageSchema, inlineAssistantImageSchema, readAssistantAttachment, saveAssistantAttachment, resolveAssistantImages } from '../utils/site_assistant_attachments.js';
import { verifySession } from '../utils/session.js';
import { query, type QueryRunner } from '../db/connection.js';
import { startAssistantMonitor, recordAssistantEntry } from '../utils/site_assistant_monitor.js';
import { restoreAssistantContext, type AssistantContext } from '../utils/site_assistant_context.js';
import { withAssistantProgress } from '../utils/site_assistant_progress.js';

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

const imagesSchema = z.array(assistantImageSchema).max(SITE_ASSISTANT_MAX_IMAGES);
const inputSchema = z.object({
  conversationId: z.string().uuid().optional(), parentId: z.string().uuid().optional(), retryOf: z.string().uuid().optional(),
  question: z.string().trim().max(SITE_ASSISTANT_QUESTION_MAX_LENGTH), lang: z.enum(['zh', 'en']),
  thinking: z.enum(['auto', 'fast', 'deep']).default('auto'),
  images: imagesSchema.optional(),
  timeZone: z.string().max(100).refine(zone => { try { new Intl.DateTimeFormat('en', { timeZone: zone }); return true; } catch { return false; } }, 'Invalid time zone').optional(),
  viewerWcaId: z.string().regex(/^\d{4}[A-Z]{4}\d{2}$/).optional(),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(SITE_ASSISTANT_HISTORY_MESSAGE_MAX_LENGTH), images: imagesSchema.optional() }).strict()
    .refine(message => message.role === 'user' || !message.images?.length, { path: ['images'] })).max(10).default([]),
}).strict().refine(input => input.question.length > 0 || !!input.images?.length)
  .refine(input => (input.images?.length ?? 0) + input.history.reduce((count, message) => count + (message.images?.length ?? 0), 0) <= SITE_ASSISTANT_MAX_IMAGES, { path: ['images'] });

// Burst limits are per process; the daily shared limit is atomic and durable.
export function createSiteAssistantRoutes(deps: { answer: typeof answerSiteQuestion; config: typeof assistantConfig; now: () => number; reserve: typeof reserveAssistantQuestion; authenticate: typeof requireAssistantUser; monitor?: typeof startAssistantMonitor; eventsQuery?: QueryRunner; contextQuery?: QueryRunner; entry?: typeof recordAssistantEntry; readAttachment?: typeof readAssistantAttachment; saveAttachment?: typeof saveAssistantAttachment } = { answer: answerSiteQuestion, config: assistantConfig, now: Date.now, reserve: reserveAssistantQuestion, authenticate: requireAssistantUser, monitor: startAssistantMonitor, entry: recordAssistantEntry, readAttachment: readAssistantAttachment, saveAttachment: saveAssistantAttachment }) {
  const routes = new Hono();
  let active = 0;
  let minute = 0;
  let minuteCount = 0;
  const clients = new Map<string, number>();
  routes.use('/site-assistant', async (c, next) => { await next(); c.header('Cache-Control', 'no-store'); });
  routes.use('/site-assistant', bodyLimit({ maxSize: SITE_ASSISTANT_BODY_BYTES, onError: async c => { await deps.entry?.('invalid_image'); return c.json({ error: 'invalid_image' }, 413); } }));
  routes.post('/site-assistant', async c => {
    const requestStarted = performance.now();
    const parsed = inputSchema.safeParse(await c.req.json().catch(error => {
      if (error instanceof SyntaxError) return null;
      throw error;
    }));
    if (!parsed.success) { const error = parsed.error.issues.some(issue => issue.path.includes('images')) ? 'invalid_image' : 'invalid_question'; await deps.entry?.(error); return c.json({ error }, 400); }
    // API and clients deploy independently; older renderers assume every
    // unfamiliar artifact is a table. Preserve formulas without crashing them.
    const present = (result: AssistantAnswer): AssistantAnswer => c.req.query('artifactFormat') === SITE_ASSISTANT_ARTIFACT_FORMAT ? result : {
      ...result, artifacts: result.artifacts?.map(artifact => artifact.kind === 'algorithms' ? {
        kind: 'table', title: artifact.title,
        columns: ['Case', {zh:'公式',en:'Algorithm'}[parsed.data.lang]],
        rows: artifact.cards.map(card => [card.name, card.alg]),
        links: artifact.cards.map(card => card.href),
      } : artifact),
    };
    let history = boundAssistantHistory(parsed.data.history);
    let images = parsed.data.images;
    const hasImages = !!parsed.data.images?.length || history.some(message => !!message.images?.length);
    const config = deps.config(hasImages);
    if (!config) { const error = hasImages ? 'vision_unavailable' : 'unavailable'; await deps.entry?.(error); return c.json({ error }, 503); }
    // Authentication is part of the same total deadline and precedes quota/model work.
    const disconnect = new AbortController();
    const signal = AbortSignal.any([disconnect.signal, c.req.raw.signal, AbortSignal.timeout(assistantTimeoutMs(parsed.data.thinking) - 2000)]);
    let admitted = false, recordingFailed = false;
    let monitor: Awaited<ReturnType<typeof startAssistantMonitor>> | undefined;
    let priorContext: AssistantContext | undefined;
    const answer = (user: { wcaId: string }, emit?: (event: AssistantStreamEvent) => Promise<void>) => {
      const run = () => withAssistantProgress(emit, signal, requestStarted, () => deps.answer(parsed.data.question, parsed.data.lang, config, signal, undefined, history, user.wcaId, emit, parsed.data.timeZone, images, parsed.data.thinking, {}, priorContext));
      return monitor ? monitor.run(run) : run();
    };
    const failure = (error: unknown) => monitor?.finish(disconnect.signal.aborted || c.req.raw.signal.aborted ? 'cancelled' : 'error', assistantFailureCode(error));
    try { return await assistantStage('total',()=>assistantDeadline(async()=>{
      const user = await assistantStage('auth',()=>deps.authenticate(c));
      signal.throwIfAborted();
      const readAttachment = deps.readAttachment ?? readAssistantAttachment;
      images = images ? await resolveAssistantImages(user.uid, images, readAttachment) : undefined;
      history = await Promise.all(history.map(async message => ({ ...message,
        ...(message.images ? { images: await resolveAssistantImages(user.uid, message.images, readAttachment) } : {}),
      })));
      signal.throwIfAborted();
      try { monitor = await deps.monitor?.({ uid: user.uid, startedAt: requestStarted, question: parsed.data.question, lang: parsed.data.lang, model: config.model, streaming: !!c.req.header('Accept')?.includes('text/event-stream'), imageCount: (parsed.data.images?.length ?? 0) + history.reduce((n, m) => n + (m.images?.length ?? 0), 0), historyCount: history.length, conversationId: parsed.data.conversationId, parentId: parsed.data.parentId, retryOf: parsed.data.retryOf, thinking: parsed.data.thinking }); } catch(error) { recordingFailed=true;throw error; }
      if (monitor?.id) c.header('X-Assistant-Request-Id', monitor.id);
      if(parsed.data.conversationId && parsed.data.parentId) {
        priorContext=await restoreAssistantContext(deps.contextQuery ?? query,user.uid,parsed.data.conversationId,parsed.data.parentId).catch(()=>undefined);
      }
      signal.throwIfAborted();
      const now = deps.now();
      if (Math.floor(now / 60000) !== minute) { minute = Math.floor(now / 60000); minuteCount = 0; clients.clear(); }
      const ip = getIp(c);
      const accountKey = `uid:${user.uid}`;
      if ((clients.get(ip) ?? 0) >= 6 || (clients.get(accountKey) ?? 0) >= 6 || minuteCount >= 30 || active >= 4) {
        c.header('Retry-After', '60');
        await monitor?.finish('rejected', 'busy');
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
        await monitor?.finish('rejected', 'daily_limit');
        return c.json({ error: 'daily_limit' }, 429);
      }
      // Keep JSON for existing clients/benchmarks. Auth and quota failures still
      // use HTTP status codes; failures after SSE starts are typed terminal events.
      monitor?.ready?.();
      if (c.req.header('Accept')?.includes('text/event-stream')) {
        c.header('X-Accel-Buffering', 'no');
        admitted = false; // The stream owns the concurrency slot until it closes.
        return streamSSE(c, async stream => {
          stream.onAbort(() => disconnect.abort());
          // A deep model can be silent longer than a proxy's idle-read timeout.
          // SSE comments keep the transport alive without inventing progress or text.
          const heartbeat = setInterval(() => {
            void stream.write(': keepalive\n\n').catch(() => disconnect.abort());
          }, 15_000);
          let emittedAnswer = false;
          const emit = async (event: AssistantStreamEvent) => {
            signal.throwIfAborted();
            await stream.writeSSE({ data: JSON.stringify(event.type === 'done' ? {...event, result: present(event.result)} : event) });
            if (event.type === 'progress') monitor?.progress?.();
            if (event.type === 'answer') { emittedAnswer ||= !!event.answer; monitor?.text(event.answer); }
            if (event.type === 'done') monitor?.text(event.result.answer);
          };
          try {
            await emit({ type: 'status', status: { phase: 'planning' } });
            const result = await assistantStage('total', () => assistantDeadline(() => answer(user, emit), signal));
            if (!emittedAnswer && result.answer) await emit({type:'answer',answer:result.answer,sources:result.sources});
            await monitor?.finish('success', undefined, result);
            await emit({ type: 'done', result });
          } catch (error) {
            await failure(error)?.catch(() => {});
            if (!disconnect.signal.aborted) await stream.writeSSE({ data: JSON.stringify({ type: 'error', error: assistantFailureCode(error) }) });
          } finally { clearInterval(heartbeat); disconnect.abort(); active--; }
        });
      }
      const result = await answer(user);
      signal.throwIfAborted();
      await monitor?.finish('success', undefined, result);
      return c.json(present(result));
    },signal)); } catch(error) {
      // Provider bodies can contain request details. Never expose them to clients/logs.
      await failure(error)?.catch(() => {});
      if (!monitor) await deps.entry?.(recordingFailed ? 'recording_unavailable' : assistantFailureCode(error));
      const code=assistantFailureCode(error);
      return c.json({ error: code }, code==='login_required'?401:code==='wca_link_required'||code==='account_forbidden'?403:code==='timeout'?504:503);
    } finally { if (admitted) active--; }
  });
  routes.use('/site-assistant/attachments*', async (c, next) => {
    c.header('Cache-Control', 'private, no-store'); c.header('X-Robots-Tag', 'noindex, nofollow');
    await next();
  });
  routes.post('/site-assistant/attachments', bodyLimit({ maxSize: 1_100_000 }), async c => {
    let user;
    try { user = await deps.authenticate(c); } catch { return c.json({ error: 'login_required' }, 401); }
    checkRateLimit(String(user.uid), { bucket: 'assistant-attachments', max: 20 });
    const input = z.object({ conversationId: z.string().uuid(), image: inlineAssistantImageSchema }).strict().safeParse(await c.req.json().catch(() => null));
    if (!input.success) return c.json({ error: 'invalid_image' }, 400);
    try { return c.json(await (deps.saveAttachment ?? saveAssistantAttachment)(user.uid, input.data.conversationId, input.data.image)); }
    catch (error) { return c.json({ error: assistantFailureCode(error) }, error instanceof AssistantFailure && error.code === 'request_too_large' ? 413 : 503); }
  });
  routes.get('/site-assistant/attachments/:id', async c => {
    let user;
    try { user = await deps.authenticate(c); } catch { return c.json({ error: 'login_required' }, 401); }
    const id = z.string().uuid().safeParse(c.req.param('id'));
    if (!id.success) return c.json({ error: 'not_found' }, 404);
    const image = await (deps.readAttachment ?? readAssistantAttachment)(user.uid, id.data);
    return image ? c.json(image) : c.json({ error: 'not_found' }, 404);
  });
  routes.delete('/site-assistant/attachments/:id', async c => {
    let user;
    try { user = await deps.authenticate(c); } catch { return c.json({ error: 'login_required' }, 401); }
    const id = z.string().uuid().safeParse(c.req.param('id'));
    if (!id.success) return c.json({ error: 'not_found' }, 404);
    await (deps.eventsQuery ?? query)('UPDATE site_assistant_attachments SET deleted_at=COALESCE(deleted_at,NOW()) WHERE id=? AND user_id=?', [id.data, user.uid]);
    return c.json({ ok: true });
  });
  const eventSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('timing'), timing: z.object({
      firstProgressMs: z.number().int().min(0).max(600_000).optional(), firstAnswerMs: z.number().int().min(0).max(600_000).optional(),
      responseMs: z.number().int().min(0).max(600_000), visibleMs: z.number().int().min(0).max(600_000), renderDelayMs: z.number().int().min(0).max(600_000),
      wasHidden: z.boolean(), transport: z.enum(['sse','json']),
    }).strict().refine(t => t.visibleMs >= t.responseMs && t.renderDelayMs === t.visibleMs - t.responseMs
      && (t.firstAnswerMs === undefined || t.firstAnswerMs <= t.responseMs) && (t.firstProgressMs === undefined || t.firstProgressMs <= t.responseMs)) }).strict(),
    z.object({ type: z.literal('feedback'), value: z.enum(['helpful','incorrect','irrelevant','bad_source','bad_link','other']).nullable() }).strict(),
    z.object({ type: z.literal('click'), kind: z.enum(['action','source']), id: z.string().min(1).max(200) }).strict(),
  ]);
  routes.use('/site-assistant/requests/*', bodyLimit({ maxSize: 2048 }));
  routes.use('/site-assistant/requests/*', async (c, next) => { c.header('Cache-Control', 'private, no-store'); await next(); });
  routes.post('/site-assistant/requests/:id/events', async c => {
    const id = z.string().uuid().safeParse(c.req.param('id'));
    const event = eventSchema.safeParse(await c.req.json().catch(() => null));
    if (!id.success || !event.success) return c.json({ error: 'invalid_event' }, 400);
    let user;
    try { user = await deps.authenticate(c); } catch { return c.json({ error: 'login_required' }, 401); }
    checkRateLimit(String(user.uid), {bucket:event.data.type === 'timing' ? 'assistant-timing' : 'assistant-feedback',max:30});
    const run = deps.eventsQuery ?? query;
    // Ownership and retention are enforced in the mutation, not by a browser ID.
    if (event.data.type === 'timing') {
      // Untrusted browser measurements, stored separately and only once per owned, completed request.
      const rows = await run(`UPDATE site_assistant_requests SET metrics=jsonb_set(COALESCE(metrics,'{}'::jsonb),'{browser}',?::jsonb)
        WHERE id=? AND user_id=? AND scope='chat' AND status='success' AND started_at>NOW()-INTERVAL '30 days'
        AND NOT jsonb_exists(COALESCE(metrics,'{}'::jsonb),'browser') RETURNING id`, [event.data.timing, id.data, user.uid]);
      if (!rows.length && !(await run(`SELECT id FROM site_assistant_requests WHERE id=? AND user_id=? AND scope='chat' AND status='success' AND started_at>NOW()-INTERVAL '30 days'`, [id.data, user.uid])).length) return c.json({ error: 'not_found' }, 404);
    } else if (event.data.type === 'feedback') {
      const rows = await run(`UPDATE site_assistant_requests SET feedback=?,feedback_at=NOW(),review_status='open',review_note=NULL,reviewed_by=NULL,reviewed_at=NULL
        WHERE id=? AND user_id=? AND scope='chat' AND status IN ('success','error','cancelled') AND started_at>NOW()-INTERVAL '30 days'
        AND feedback IS DISTINCT FROM ? RETURNING id`, [event.data.value, id.data, user.uid, event.data.value]);
      // Idempotent repeats still require ownership; do not expose other users' records.
      if (!rows.length && !(await run(`SELECT id FROM site_assistant_requests WHERE id=? AND user_id=? AND scope='chat' AND status IN ('success','error','cancelled') AND started_at>NOW()-INTERVAL '30 days'`, [id.data, user.uid])).length) return c.json({ error: 'not_found' }, 404);
    } else {
      const list = event.data.kind === 'action' ? 'actions' : 'sources';
      const rows = await run(`UPDATE site_assistant_requests SET clicked_actions=clicked_actions || jsonb_build_object(?::text,true)
        WHERE id=? AND user_id=? AND scope='chat' AND started_at>NOW()-INTERVAL '30 days'
        AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(response->'${list}','[]'::jsonb)) item WHERE item->>'id'=?) RETURNING id`, [event.data.kind + ':' + event.data.id, id.data, user.uid, event.data.id]);
      if (!rows.length) return c.json({ error: 'not_found' }, 404);
    }
    return c.json({ ok: true });
  });
  return routes;
}

export const siteAssistantRoutes = createSiteAssistantRoutes();
