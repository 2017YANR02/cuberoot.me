import { RateLimitError } from '../utils/rate_limit.js';
import { durableAssistantStore, durableAssistantWorker } from '../utils/site_assistant_worker.js';
import { AssistantQueueConflict } from '../utils/site_assistant_queue.js';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { getIp } from '../utils/analytics_helpers.js';
import { resolveIpCountry } from '../utils/ip_geolocation.js';
import { assistantOpenAICountrySupported } from '@cuberoot/shared/site-assistant-openai';
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
import { assistantRunStore, watchAssistantRun } from '../utils/site_assistant_runs.js';
import { SITE_ASSISTANT_REFERENCE_MAX_LENGTH } from '@cuberoot/shared/site-assistant';

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
  runId: z.string().uuid().optional(),
  references: z.array(z.object({
    messageId: z.string().min(1).max(100), messageVersion: z.number().int().min(1),
    role: z.enum(['user','assistant']), selectedText: z.string().min(1).max(SITE_ASSISTANT_REFERENCE_MAX_LENGTH),
    sourceStatus: z.enum(['complete','partial','stopped']),
  }).strict()).max(3).optional(),
  conversationId: z.string().uuid().optional(), parentId: z.string().uuid().optional(), retryOf: z.string().uuid().optional(),
  question: z.string().trim().max(SITE_ASSISTANT_QUESTION_MAX_LENGTH), lang: z.enum(['zh', 'en']),
  thinking: z.enum(['auto', 'fast', 'deep']).default('auto'),
  provider: z.enum(['bailian', 'openai']).default('bailian'),
  images: imagesSchema.optional(),
  timeZone: z.string().max(100).refine(zone => { try { new Intl.DateTimeFormat('en', { timeZone: zone }); return true; } catch { return false; } }, 'Invalid time zone').optional(),
  viewerWcaId: z.string().regex(/^\d{4}[A-Z]{4}\d{2}$/).optional(),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(SITE_ASSISTANT_HISTORY_MESSAGE_MAX_LENGTH), images: imagesSchema.optional() }).strict()
    .refine(message => message.role === 'user' || !message.images?.length, { path: ['images'] })).max(10).default([]),
}).strict().refine(input => !input.runId || !!input.conversationId)
  .refine(input => input.question.length > 0 || !!input.images?.length)
  .refine(input => (input.images?.length ?? 0) + input.history.reduce((count, message) => count + (message.images?.length ?? 0), 0) <= SITE_ASSISTANT_MAX_IMAGES, { path: ['images'] });

// Burst limits are per process; the daily shared limit is atomic and durable.
export function createSiteAssistantRoutes(deps: { answer: typeof answerSiteQuestion; config: typeof assistantConfig; country?: typeof resolveIpCountry; now: () => number; reserve: typeof reserveAssistantQuestion; authenticate: typeof requireAssistantUser; monitor?: typeof startAssistantMonitor; queue?: {store:typeof durableAssistantStore;worker:Pick<typeof durableAssistantWorker,'kick'>}; runs?: ReturnType<typeof assistantRunStore>; eventsQuery?: QueryRunner; contextQuery?: QueryRunner; entry?: typeof recordAssistantEntry; readAttachment?: typeof readAssistantAttachment; saveAttachment?: typeof saveAssistantAttachment } = { answer: answerSiteQuestion, config: assistantConfig, now: Date.now, reserve: reserveAssistantQuestion, authenticate: requireAssistantUser, monitor: startAssistantMonitor, entry: recordAssistantEntry, readAttachment: readAssistantAttachment, saveAttachment: saveAssistantAttachment }) {
  const routes = new Hono();
  const runs = deps.runs ?? assistantRunStore();
  const inbox=deps.queue?.store ?? durableAssistantStore,worker=deps.queue?.worker ?? durableAssistantWorker;
  let active = 0;
  let minute = 0;
  let minuteCount = 0;
  const clients = new Map<string, number>();
  routes.use('/site-assistant', async (c, next) => { await next(); c.header('Cache-Control', 'no-store'); });
  routes.use('/site-assistant', bodyLimit({ maxSize: SITE_ASSISTANT_BODY_BYTES, onError: async c => { await deps.entry?.('invalid_image'); return c.json({ error: 'invalid_image' }, 413); } }));
  routes.use('/site-assistant/runs/*', bodyLimit({ maxSize: 1024 }));
  routes.use('/site-assistant/runs/*', async(c,next)=>{c.header('Cache-Control','private, no-store');await next();});
  routes.on(['GET','POST'], ['/site-assistant/runs/:id','/site-assistant/runs/:id/cancel'], async c=>{
    if ((c.req.method==='POST') !== c.req.path.endsWith('/cancel')) return c.notFound();
    let user;
    try { user=await deps.authenticate(c); } catch { return c.json({error:'login_required'},401); }
    const id=z.string().uuid().safeParse(c.req.param('id'));
    if(!id.success) return c.json({error:'not_found'},404);
    try {
      let state;
      if(c.req.method==='POST') {
        checkRateLimit(String(user.uid),{bucket:'assistant-cancel',max:60});
        const body=z.object({conversationId:z.string().uuid()}).strict().safeParse(await c.req.json().catch(()=>null));
        if(!body.success)return c.json({error:'invalid_request'},400);
        state=await runs.cancel(user.uid,body.data.conversationId,id.data);
      } else state=await runs.read(user.uid,id.data);
      return state ? c.json({state}) : c.json({error:'not_found'},404);
    } catch { return c.json({error:'unavailable'},503); }
  });
  routes.use('/site-assistant/conversations/*', bodyLimit({maxSize:200_000}));
  routes.use('/site-assistant/conversations/*',async(c,next)=>{c.header('Cache-Control','private, no-store');await next();});
  routes.on(['GET','POST'], ['/site-assistant/conversations/:conversation','/site-assistant/conversations/:conversation/messages','/site-assistant/conversations/:conversation/stop','/site-assistant/conversations/:conversation/resume'],async c=>{
    let user;
    try {user=await deps.authenticate(c);} catch(error){return c.json({error:assistantFailureCode(error)},401);}
    const conversation=z.string().uuid().safeParse(c.req.param('conversation'));
    if(!conversation.success)return c.json({error:'not_found'},404);
    const action=c.req.path.split('/').at(-1);
    try {
      if(c.req.method==='POST') {
        checkRateLimit(String(user.uid),{bucket:action==='messages'?'assistant-inbox':'assistant-control',max:action==='messages'?30:60});
        if(action==='messages') {
          const body=z.object({id:z.string().uuid(),mode:z.enum(['queue','steer']),input:inputSchema}).strict().safeParse(await c.req.json().catch(()=>null));
          if(!body.success)return c.json({error:'invalid_question'},400);
          const input=body.data.input;
          if(input.images?.some(image=>!('attachmentId' in image)) || input.history.some(message=>message.images?.some(image=>!('attachmentId' in image))))return c.json({error:'invalid_image'},400);
          const config=deps.config(!!input.images?.length || input.history.some(message=>!!message.images?.length),input.provider);
          if(!config)return c.json({error:'provider_unavailable'},503);
          const country=input.provider==='openai'?await (deps.country ?? resolveIpCountry)(getIp(c)).catch(()=>null):undefined;
          if(input.provider==='openai' && !assistantOpenAICountrySupported(country))return c.json({error:'provider_region_unavailable'},403);
          // Verify attachment ownership before accepting a durable message.
          await resolveAssistantImages(user.uid,[...(input.images ?? []),...input.history.flatMap(message=>message.images ?? [])],deps.readAttachment ?? readAssistantAttachment);
          const {question,lang,thinking,provider,timeZone='UTC',images,references}=input;
          await inbox.enqueue(user.uid,conversation.data,body.data.id,body.data.mode,{question,lang,thinking,provider,timeZone,images,references,history:boundAssistantHistory(input.history)},country ?? undefined);
          void worker.kick();
          return c.json({id:body.data.id},202);
        }
        if(action!=='stop' && action!=='resume')return c.notFound();
        await inbox.control(user.uid,conversation.data,action);
        void worker.kick();
      } else if(action!==conversation.data)return c.notFound();
      const after=c.req.query('after');
      if(c.req.method==='GET' && after && /^\d+$/.test(after) && await inbox.revision(user.uid,conversation.data)===Number(after))return c.body(null,304);
      const snapshot=await inbox.snapshot(user.uid,conversation.data);
      return snapshot?c.json(snapshot):c.json({error:'not_found'},404);
    } catch(error) {
      if(error instanceof RateLimitError){c.header('Retry-After',String(error.retryAfterSeconds));return c.json({error:'busy'},429);}
      if(error instanceof AssistantQueueConflict)return c.json({error:error.message},error.message==='not_found'?404:409);
      return c.json({error:assistantFailureCode(error)},503);
    }
  });
  routes.get('/site-assistant/providers', async c => {
    c.header('Cache-Control', 'private, no-store');
    const providers: Array<'bailian' | 'openai'> = [];
    if (deps.config(false, 'bailian')) providers.push('bailian');
    if (deps.config(false, 'openai') && assistantOpenAICountrySupported(await (deps.country ?? resolveIpCountry)(getIp(c)).catch(() => null))) providers.push('openai');
    return c.json({ providers });
  });
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
    const config = deps.config(hasImages, parsed.data.provider);
    if (!config) { const error = parsed.data.provider === 'openai' ? 'provider_unavailable' : hasImages ? 'vision_unavailable' : 'unavailable'; await deps.entry?.(error); return c.json({ error }, 503); }
    // Authentication is part of the same total deadline and precedes quota/model work.
    const disconnect = new AbortController();
    const signal = AbortSignal.any([disconnect.signal, c.req.raw.signal, AbortSignal.timeout(assistantTimeoutMs(parsed.data.thinking) - 2000)]);
    let admitted = false, recordingFailed = false;
    let runOwner: number | undefined;
    let stopWatching: (()=>void) | undefined;
    const finishRun = async (state:'completed'|'cancelled'|'error') => {
      stopWatching?.();
      if(runOwner===undefined || !parsed.data.runId)return state;
      return runs.finish(runOwner,parsed.data.runId,state);
    };
    let monitor: Awaited<ReturnType<typeof startAssistantMonitor>> | undefined;
    let priorContext: AssistantContext | undefined;
    const answer = (user: { wcaId: string }, emit?: (event: AssistantStreamEvent) => Promise<void>) => {
      const run = () => withAssistantProgress(emit, signal, requestStarted, () => deps.answer(parsed.data.question, parsed.data.lang, config, signal, undefined, history, user.wcaId, emit, parsed.data.timeZone, images, parsed.data.thinking, {}, priorContext, parsed.data.references));
      return monitor ? monitor.run(run) : run();
    };
    const failure = async (error: unknown) => {
      const cancelled=disconnect.signal.reason==='user_cancel' || c.req.raw.signal.aborted;
      const state=await finishRun(cancelled ? 'cancelled' : 'error');
      await monitor?.finish(state==='cancelled' ? 'cancelled' : 'error', assistantFailureCode(error));
      return state;
    };
    // Controlled runs retain ownership until their execution promise settles.
    const deadline = <T,>(work:()=>Promise<T>) => parsed.data.runId ? work() : assistantDeadline(work,signal);
    try { return await assistantStage('total',()=>deadline(async()=>{
      const user = await assistantStage('auth',()=>deps.authenticate(c));
      signal.throwIfAborted();
      if (parsed.data.provider === 'openai') {
        const country = await assistantDeadline(() => (deps.country ?? resolveIpCountry)(getIp(c)).catch(() => null), signal);
        if (!assistantOpenAICountrySupported(country)) {
          await deps.entry?.('provider_region_unavailable');
          return c.json({ error: 'provider_region_unavailable' }, 403);
        }
        config.visitorCountry = country!.toUpperCase();
      }
      if(parsed.data.runId && parsed.data.conversationId) {
        if(!await runs.start(user.uid,parsed.data.conversationId,parsed.data.runId)) return c.json({error:'busy'},409);
        runOwner=user.uid;
        stopWatching=watchAssistantRun(runs,user.uid,parsed.data.runId,disconnect);
        signal.throwIfAborted();
      }
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
        await finishRun('error');
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
        await finishRun('error');
        return c.json({ error: 'daily_limit' }, 429);
      }
      // Keep JSON for existing clients/benchmarks. Auth and quota failures still
      // use HTTP status codes; failures after SSE starts are typed terminal events.
      monitor?.ready?.();
      if (c.req.header('Accept')?.includes('text/event-stream')) {
        c.header('X-Accel-Buffering', 'no');
        admitted = false; // The stream owns the concurrency slot until it closes.
        return streamSSE(c, async stream => {
          stream.onAbort(() => disconnect.abort('user_cancel'));
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
            const result = await assistantStage('total', () => deadline(() => answer(user, emit)));
            signal.throwIfAborted();
            if(await finishRun('completed')!=='completed') throw new AssistantFailure('timeout');
            if (!emittedAnswer && result.answer) await emit({type:'answer',answer:result.answer,sources:result.sources});
            await monitor?.finish('success', undefined, result);
            await emit({ type: 'done', result });
          } catch (error) {
            const state=await failure(error).catch(() => undefined);
            if (!c.req.raw.signal.aborted) await stream.writeSSE({ data: JSON.stringify(state==='cancelled' ? {type:'cancelled'} : { type: 'error', error: assistantFailureCode(error) }) }).catch(()=>{});
          } finally { clearInterval(heartbeat); stopWatching?.(); disconnect.abort(); active--; }
        });
      }
      const result = await answer(user);
      signal.throwIfAborted();
      if(await finishRun('completed')!=='completed') throw new AssistantFailure('timeout');
      await monitor?.finish('success', undefined, result);
      return c.json(present(result));
    })); } catch(error) {
      // Provider bodies can contain request details. Never expose them to clients/logs.
      await failure(error).catch(() => {});
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
