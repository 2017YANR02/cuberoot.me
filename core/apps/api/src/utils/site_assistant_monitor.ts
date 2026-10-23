import { mkdirSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { LanguageModelUsage } from 'ai';
import { SITE_ASSISTANT_ANSWER_MAX_LENGTH, SITE_ASSISTANT_QUESTION_MAX_LENGTH, type AssistantAnswer, type AssistantThinkingMode } from '@cuberoot/shared/site-assistant';
import postgres from 'postgres';
import { databaseSettings } from '../db/settings.js';
import type { QueryRunner } from '../db/connection.js';
import { assistantOutboxDirectory, replayAssistantFaults, applyAssistantCompletion, saveAssistantCompletion, removeAssistantCompletion, replayAssistantCompletions } from './site_assistant_outbox.js';
import { assistantPrice } from './site_assistant_pricing.js';
import { checkAssistantAlerts, archiveAssistantDays } from './site_assistant_monitor_jobs.js';
import { diagnosticLog } from '../observability/request.js';

// Separate, small pool: monitoring must not consume the application's query slots.
const db = postgres({ ...databaseSettings(), max: 2, connect_timeout: 2, idle_timeout: 20,
  connection: { statement_timeout: 1500, lock_timeout: 500 } });
const write: QueryRunner = async <T>(statement: string, params: unknown[] = []) => {
  let index = 0;
  return await db.unsafe(statement.replace(/\?/g, () => `$${++index}`), params as never[]) as unknown as T[];
};
export interface AssistantMetrics {
  stages: Record<string, { calls: number; ms: number; errors: number }>;
  models: Array<{ model: string; thinking: boolean; input: number | null; output: number | null; cached: number | null; reasoning: number | null; grossCny?: number | null; tariff?: unknown }>;
  embeddings: Array<{ model: string; tokens: number | null; grossCny?: number | null; tariff?: unknown }>;
  searches: Array<{ provider: string; requests: number | null; grossCny: number | null; tariff: unknown }>;
  policy: { version: string; thinking: AssistantThinkingMode };
  tools: Record<string, number>;
  retrievals: Array<{ mode: string; reason?: string; generation?: string; hits: Array<{ id: string; href: string; score?: number }> }>;
  cost?: { grossCny: number; unpricedCalls: number };
}
const scope = new AsyncLocalStorage<AssistantMetrics>();
export function recordAssistantStage(name: string, ms: number, failed: boolean, tool?: string) {
  const metrics = scope.getStore();
  if (!metrics) return;
  const stage = metrics.stages[name] ??= { calls: 0, ms: 0, errors: 0 };
  stage.calls++; stage.ms += Math.round(ms); stage.errors += Number(failed);
  if (tool) metrics.tools[tool] = (metrics.tools[tool] ?? 0) + 1;
}
const token = (value?: number) => Number.isSafeInteger(value) && value! >= 0 ? value! : null;
export function recordAssistantModel(model: string, thinking: boolean, origin = '') {
  const entry = { model, thinking, input: null as number | null, output: null as number | null, cached: null as number | null, reasoning: null as number | null };
  scope.getStore()?.models.push(entry);
  return (usage: LanguageModelUsage) => {
    entry.input = token(usage.inputTokens); entry.output = token(usage.outputTokens);
    entry.cached = token(usage.inputTokenDetails?.cacheReadTokens); entry.reasoning = token(usage.outputTokenDetails?.reasoningTokens);
    Object.assign(entry, assistantPrice(model, origin, entry.input, entry.output));
  };
}
export function recordAssistantEmbedding(model: string, origin = '') {
  const entry = { model, tokens: null as number | null };
  scope.getStore()?.embeddings.push(entry);
  return (tokens?: number) => { entry.tokens = token(tokens); Object.assign(entry, assistantPrice(model, origin, entry.tokens)); };
}

/** Provider search intent counts estimate cost; only the provider bill establishes charges. */
export function recordAssistantSearch(origin: string) {
  const beijing = origin === 'https://dashscope.aliyuncs.com' || /^https:\/\/ws-[a-z0-9]+\.cn-beijing\.maas\.aliyuncs\.com$/.test(origin);
  const entry = { provider: 'bailian-search', requests: null as number | null, grossCny: null as number | null,
    tariff: beijing ? { version: 'bailian-web-turbo-2026-10-23', perRequest: 0.003, basis: 'provider_search_intents_estimate', source: 'https://help.aliyun.com/zh/model-studio/web-search/' } : null };
  scope.getStore()?.searches.push(entry);
  return (count?: number) => {
    entry.requests = token(count);
    entry.grossCny = beijing && entry.requests != null ? entry.requests * 0.003 : null;
  };
}

export function recordAssistantRetrieval(value: AssistantMetrics['retrievals'][number]) {
  const metrics = scope.getStore();
  if (metrics && metrics.retrievals.length < 30) metrics.retrievals.push({ ...value, hits: value.hits.slice(0, 6).map(hit => ({ id: hit.id, href: hit.href, ...(hit.score == null ? {} : { score: Number(hit.score) }) })) });
}

/** Best-effort credential redaction, not a claim that arbitrary prose is anonymous. */
export function redactAssistantText(value: string): string {
  return value.replace(/\u0000/g, '')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]{12,}/g, '[redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted]')
    .replace(/((?:password|passwd|api[_-]?key|access[_-]?token|secret|密码)\s*[=:：]\s*)[^\s&,;"']+/gi, '$1[redacted]');
}
function safeResponse(result: AssistantAnswer) {
  // Explicit allowlist; never serialize a request, history, image or provider object.
  const value = JSON.stringify({ sources: result.sources, actions: result.actions, artifacts: result.artifacts }, (_key, item) => typeof item === 'string' ? redactAssistantText(item) : item);
  // Completion journals cap UTF-8 bytes, not JS string length. Leave room for
  // the full answer and telemetry, including Chinese text and emoji.
  return Buffer.byteLength(value, 'utf8') <= 110_000 ? JSON.parse(value) : { sources: result.sources.slice(0, 12).map(s => ({ ...s, title: redactAssistantText(s.title).slice(0,120), href: redactAssistantText(s.href).slice(0,2000) })), truncated: true };
}
const faultId = randomUUID();
const health = { pendingCompletions: 0, failedWrites: 0, lastFailureAt: null as string | null, lastWriteAt: null as string | null };
export function assistantMonitorHealth() { return { ...health }; }
let pending = 0;
async function bestEffort(run: () => Promise<unknown>) {
  // Bound queued writes too, including when the database is unreachable.
  if (pending >= 8) { failed(); return; }
  pending++;
  try { await run(); health.lastWriteAt = new Date().toISOString(); }
  catch { failed(); }
  finally { pending--; }
}
function failed() {
  health.failedWrites++; health.lastFailureAt = new Date().toISOString();
  if (!process.env.VITEST) {
    try {
      const directory=assistantOutboxDirectory();mkdirSync(directory,{recursive:true,mode:0o700});
      const path=join(directory,faultId+'.fault'),tmp=path+'.tmp';
      const fd=openSync(tmp,'w',0o600);try{writeFileSync(fd,JSON.stringify({id:faultId,failures:health.failedWrites,at:health.lastFailureAt}));fsyncSync(fd);}finally{closeSync(fd);}
      renameSync(tmp,path);
    } catch { /* A simultaneous disk and DB outage is exposed by the external heartbeat. */ }
  }
  diagnosticLog('assistant_monitor_write_failed', { failedWrites: health.failedWrites }, true);
}
export interface AssistantMonitorInput { uid: number | null; question: string; lang: string; model: string; streaming: boolean; imageCount: number; historyCount: number; startedAt?: number; conversationId?: string; parentId?: string; retryOf?: string; scope?: 'chat' | 'index'; thinking?: AssistantThinkingMode }
export async function startAssistantMonitor(input: AssistantMonitorInput, run: QueryRunner = write) {
  const id = randomUUID(), started = input.startedAt ?? performance.now();
  const startedAt = new Date(Date.now() - (performance.now() - started)).toISOString();
  const metrics: AssistantMetrics = { stages: {}, models: [], embeddings: [], searches: [], tools: {}, retrievals: [], policy: { version: '2026-10-23', thinking: input.thinking ?? 'auto' } };
  let firstAnswer: number | null = null, partial = '', finished = false;
  // Admission is durable before consuming quota or calling a paid model.
  try {
    await run(`INSERT INTO site_assistant_requests (id,user_id,status,lang,model,streaming,image_count,history_count,question,started_at,conversation_id,parent_id,retry_of,scope)
      VALUES (?,?,'running',?,?,?,?,?,?,?,?,(SELECT id FROM site_assistant_requests WHERE id=?::uuid AND user_id=? AND conversation_id=?::uuid),(SELECT id FROM site_assistant_requests WHERE id=?::uuid AND user_id=? AND conversation_id=?::uuid),?)`, [id, input.uid, input.lang, input.model, input.streaming, input.imageCount, input.historyCount, redactAssistantText(input.question).slice(0, SITE_ASSISTANT_QUESTION_MAX_LENGTH), startedAt, input.conversationId ?? id, input.parentId ?? null, input.uid, input.conversationId ?? id, input.retryOf ?? null, input.uid, input.conversationId ?? id, input.scope ?? 'chat']);
  } catch { failed(); throw new Error('Assistant monitoring unavailable'); }
  return {
    id,
    run<T>(callback: () => Promise<T>) { return scope.run(metrics, callback); },
    text(answer: string) { if (answer) { firstAnswer ??= Math.round(performance.now() - started); partial = answer.slice(0, SITE_ASSISTANT_ANSWER_MAX_LENGTH); } },
    async finish(status: 'success' | 'error' | 'cancelled' | 'rejected', error?: string, result?: AssistantAnswer) {
      if (finished) return;
      finished = true;
      const duration = Math.round(performance.now() - started);
      const calls = [...metrics.models, ...metrics.embeddings, ...metrics.searches];
      metrics.cost = { grossCny: calls.reduce((n, call) => n + (call.grossCny ?? 0), 0), unpricedCalls: calls.filter(call => call.grossCny == null).length };
      const snapshot = JSON.parse(JSON.stringify(metrics));
      if (Buffer.byteLength(JSON.stringify(snapshot), 'utf8') > 64_000) {
        snapshot.retrievals = snapshot.retrievals.map((item: AssistantMetrics['retrievals'][number]) => ({ ...item, hits: [] }));
        snapshot.retrievalDetailsTruncated = true;
      }
      const item = { id, createdAt: startedAt, params: [status, error ?? null, new Date().toISOString(), duration, firstAnswer, redactAssistantText(result?.answer ?? partial).slice(0, SITE_ASSISTANT_ANSWER_MAX_LENGTH), result ? safeResponse(result) : null, snapshot, id] };
      // Disk journal survives PM2 reloads and DB outages. Test runners supply their own DB.
      let path: string | undefined;
      if (run === write) { try { path = await saveAssistantCompletion(item); } catch { failed(); } }
      try {
        await applyAssistantCompletion(item, run);
        if (path) await removeAssistantCompletion(path);
        health.lastWriteAt = new Date().toISOString();
      } catch {
        failed();
        if (path) health.pendingCompletions++;
        else throw new Error('Assistant completion could not be persisted');
      }
    },
  };
}

/** Pre-auth failures contain no text, images, identity or IP. Bounded code vocabulary only. */
export async function recordAssistantEntry(code: string) {
  if (!['invalid_image','invalid_question','unavailable','vision_unavailable','login_required','wca_link_required','account_forbidden','timeout','recording_unavailable'].includes(code)) code = 'unavailable';
  await bestEffort(() => write(`INSERT INTO site_assistant_entry_daily(day,code,requests) VALUES ((NOW() AT TIME ZONE 'Asia/Shanghai')::date,?,1)
    ON CONFLICT(day,code) DO UPDATE SET requests=site_assistant_entry_daily.requests+1`, [code]));
}

export async function cleanAssistantMonitoring(run: QueryRunner = write) {
  await archiveAssistantDays(run);
  await run(`UPDATE site_assistant_requests SET status='interrupted',error_code='process_interrupted',finished_at=NOW()
    WHERE status='running' AND started_at < NOW() - CASE WHEN scope='index' THEN INTERVAL '20 minutes' ELSE INTERVAL '2 minutes' END`);
  await run(`UPDATE site_assistant_requests SET question=NULL,answer=NULL,response=NULL,review_note=NULL WHERE id IN (
    SELECT id FROM site_assistant_requests WHERE started_at < NOW() - INTERVAL '30 days'
    AND (question IS NOT NULL OR answer IS NOT NULL OR response IS NOT NULL OR review_note IS NOT NULL) ORDER BY started_at LIMIT 1000)`);
  await run(`DELETE FROM site_assistant_requests WHERE id IN (
    SELECT id FROM site_assistant_requests WHERE started_at < NOW() - INTERVAL '90 days' ORDER BY started_at LIMIT 1000)`);
  await run("DELETE FROM site_assistant_audit WHERE at < NOW() - INTERVAL '90 days'");
  await run("DELETE FROM site_assistant_daily WHERE day < CURRENT_DATE - 730");
  await run("DELETE FROM site_assistant_entry_daily WHERE day < CURRENT_DATE - 730");
  await run('UPDATE site_assistant_monitor_state SET last_cleanup_at=NOW() WHERE id=TRUE');
}
export function startAssistantMonitorCleanup() {
  let busy = false;
  const clean = async () => { if (busy) return; busy = true; try { await bestEffort(async () => {
      health.pendingCompletions = await replayAssistantCompletions(write);
      await replayAssistantFaults(write);
      await cleanAssistantMonitoring();
      await checkAssistantAlerts(write, health.pendingCompletions);
    }); } finally { busy = false; } };
  void clean();
  const timer = setInterval(() => { void clean(); }, 60_000);
  timer.unref();
}
