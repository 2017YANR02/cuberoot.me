import { z } from 'zod';
import { isAssistantSourceHref, type AssistantAnswer, type AssistantMessage, type AssistantSource, type AssistantTable } from '@cuberoot/shared/site-assistant';
import type { QueryRunner } from '../db/connection.js';
import { toolCallSchema, type AssistantToolCall, type ToolResult } from './site_assistant_tools.js';

export const ASSISTANT_CONTEXT_VERSION = 1;
export const ASSISTANT_CONTEXT_TTL_MS = 30 * 86400_000;
export const ASSISTANT_CONTEXT_MAX_BYTES = 48_000;
const sourceSchema = z.object({ id: z.string().max(200), title: z.string().max(160), href: z.string().max(2000).refine(isAssistantSourceHref), read: z.boolean() }).strict();
const tableSchema = z.object({ kind: z.literal('table'), title: z.string().max(160), columns: z.array(z.string().max(100)).max(20),
  rows: z.array(z.array(z.string().max(500)).max(20)).max(20), links: z.array(z.string().max(2000).refine(isAssistantSourceHref)).max(20).optional(),
  cellLinks: z.array(z.array(z.string().max(2000).refine(isAssistantSourceHref).nullable()).max(20)).max(20).optional(),
}).strict();
const factKeys = new Set(['wcaId','name','event','country','country_iso2','from','to','count','competitionCount','unknownDateCompetitions','unknownCompetitions','total','updated','importedAt','lastImportedAt','basis','progressionBasis','availability','unit','recordScope','note','metric','type','scope']);
const factSchema = z.record(z.string().max(80), z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]))
  .refine(value => Object.keys(value).length<=24 && Object.keys(value).every(key => factKeys.has(key)));
// Monitoring can import context before the tool schemas finish initializing.
const observationSchema = z.object({ call: z.lazy(()=>toolCallSchema), sourceIds: z.array(z.string().max(200)).min(1).max(12),
  dataVersion: z.string().max(120).nullable(), facts: factSchema, tables: z.array(tableSchema).max(3),
}).strict();
const contextSchema = z.object({ version: z.literal(ASSISTANT_CONTEXT_VERSION), createdAt: z.string().datetime(), expiresAt: z.string().datetime(),
  sources: z.array(sourceSchema).max(12), observations: z.array(observationSchema).max(6),
}).strict();
export type AssistantContext = z.infer<typeof contextSchema>;
export interface AssistantObservation { call: AssistantToolCall; result: ToolResult }
// Internal metadata never enters JSON/SSE, public shares or model-authored answers.
const answerContexts = new WeakMap<AssistantAnswer, AssistantContext>();
export const assistantAnswerContext = (answer: AssistantAnswer) => answerContexts.get(answer);

function tableSnapshot(table: AssistantTable): z.infer<typeof tableSchema> | undefined {
  if (table.columns.length > 20) return;
  const rows: string[][] = [];
  for (const row of table.rows.slice(0, 20)) {
    // Never cut a cell or skip a middle row: ordinal references keep their order.
    if (row.length > 20 || row.some(cell => cell.length > 500)) break;
    rows.push([...row]);
  }
  const links = table.links?.slice(0, rows.length);
  const cellLinks = table.cellLinks?.slice(0, rows.length);
  const parsed = tableSchema.safeParse({ kind: 'table', title: table.title.slice(0, 160), columns: table.columns,
    rows, ...(links ? { links } : {}), ...(cellLinks ? { cellLinks } : {}) });
  return parsed.success ? parsed.data : undefined;
}
function dataVersion(result: ToolResult) {
  if (!result.evidence || typeof result.evidence !== 'object') return null;
  const data = result.evidence as Record<string, unknown>;
  for (const key of ['generation', 'sourceVersion', 'importedAt', 'lastImportedAt', 'updated', 'dataUpdatedAt']) {
    if (typeof data[key] === 'string') return `${key}:${data[key]}`.slice(0, 120);
  }
  return null; // Capture time is never substituted for a source's version.
}
function resultFacts(result: ToolResult) {
  if (!result.evidence || typeof result.evidence !== 'object' || Array.isArray(result.evidence)) return {};
  const input = result.evidence as Record<string, unknown>;
  return Object.fromEntries(Object.entries(input).filter(([key, value]) => factKeys.has(key)
    && (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.length <= 500))).slice(0, 24));
}

/** Only selected adapter results are retained. No assistant prose or client tables. */
export function rememberAssistantContext(answer: AssistantAnswer, observations: AssistantObservation[], prior?: AssistantContext, now = Date.now()): AssistantAnswer {
  const validPrior=prior ? parseAssistantContext(prior,now) : undefined;
  const selected = new Set(answer.sources.map(source => source.id));
  const sources = answer.sources.slice(0, 12).flatMap(source => {
    const parsed = sourceSchema.safeParse({ ...source, title: source.title.slice(0, 160) });
    return parsed.success ? [parsed.data] : [];
  });
  const safeIds = new Set(sources.map(source => source.id));
  const kept: AssistantContext['observations'] = [];
  for (const { call, result } of observations.slice().reverse()) {
    if (['deliberate', 'analysis_schema', 'web_search', 'news'].includes(call.tool)) continue;
    if(result.outcome && !['success','partial'].includes(result.outcome.state)) continue;
    if(result.evidence && typeof result.evidence==='object' && 'notEvidence' in result.evidence && result.evidence.notEvidence) continue;
    const sourceIds = result.sources.filter(source => selected.has(source.id) && safeIds.has(source.id)).map(source => source.id).slice(0, 12);
    if (!sourceIds.length) continue;
    const item = observationSchema.safeParse({ call, sourceIds, dataVersion: dataVersion(result), facts: resultFacts(result),
      tables: result.artifacts.filter((artifact): artifact is AssistantTable => artifact.kind === 'table').slice(0, 3).flatMap(table => tableSnapshot(table) ?? []) });
    if (item.success) kept.unshift(item.data);
    if (kept.length === 6) break;
  }
  // A clarification/general turn can carry a still-valid reference snapshot,
  // without turning the new assistant text into evidence or extending its TTL.
  if (!kept.length && validPrior) { answerContexts.set(answer, validPrior); return answer; }
  if (validPrior) {
    const sourceById = new Map([...validPrior.sources, ...sources].map(source => [source.id, source]));
    const observationsByKey = new Map<string, AssistantContext['observations'][number]>();
    for (const item of [...validPrior.observations, ...kept]) {
      const sourceIds = item.sourceIds.filter(id => sourceById.has(id));
      if (!sourceIds.length) continue;
      const key=JSON.stringify(item.call);
      observationsByKey.delete(key);
      observationsByKey.set(key, { ...item, sourceIds });
    }
    const combinedSources=[...sourceById.values()].slice(-12);
    const availableSources=new Set(combinedSources.map(source=>source.id));
    const combined: AssistantContext = { version: ASSISTANT_CONTEXT_VERSION,
      createdAt: validPrior.createdAt, expiresAt: validPrior.expiresAt,
      sources: combinedSources, observations: [...observationsByKey.values()].slice(-6).map(item=>({...item,sourceIds:item.sourceIds.filter(id=>availableSources.has(id))})).filter(item=>item.sourceIds.length>0) };
    while (combined.observations.length && Buffer.byteLength(JSON.stringify(combined)) > ASSISTANT_CONTEXT_MAX_BYTES) combined.observations.shift();
    if (combined.observations.length) { answerContexts.set(answer, combined); return answer; }
  }
  if (!kept.length) return answer;
  const context: AssistantContext = { version: ASSISTANT_CONTEXT_VERSION, createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ASSISTANT_CONTEXT_TTL_MS).toISOString(), sources, observations: kept };
  while (context.observations.length && Buffer.byteLength(JSON.stringify(context)) > ASSISTANT_CONTEXT_MAX_BYTES) context.observations.shift();
  if (context.observations.length) answerContexts.set(answer, context);
  return answer;
}

export function parseAssistantContext(value: unknown, now = Date.now()): AssistantContext | undefined {
  if (!value || Buffer.byteLength(JSON.stringify(value)) > ASSISTANT_CONTEXT_MAX_BYTES) return;
  const parsed = contextSchema.safeParse(value);
  if (!parsed.success) return;
  const context = parsed.data, created = Date.parse(context.createdAt), expires = Date.parse(context.expiresAt);
  if (created > now || expires <= now || expires - created > ASSISTANT_CONTEXT_TTL_MS || created >= expires) return;
  const ids = new Set(context.sources.map(source => source.id));
  if (context.observations.some(item => item.sourceIds.some(id => !ids.has(id)))) return;
  return context;
}

export async function restoreAssistantContext(run: QueryRunner, uid: number, conversationId?: string, parentId?: string, now = Date.now()) {
  if (!conversationId || !parentId) return;
  const rows = await run<{ assistant_context: unknown }>(`SELECT assistant_context FROM site_assistant_requests
    WHERE id=? AND user_id=? AND conversation_id=? AND scope='chat' AND status='success'
      AND started_at>NOW()-INTERVAL '30 days' AND assistant_context IS NOT NULL`, [parentId, uid, conversationId]);
  return parseAssistantContext(rows[0]?.assistant_context, now);
}

/** Cached cells answer only explicit references to the earlier displayed table.
 * New measures, scope changes and current facts must run their tools again. */
export function assistantSnapshotReference(question: string): boolean {
  return /(?:第\s*[一二两三四五六七八九十\d]+\s*(?:行|名|位)|\b(?:first|second|third|\d+(?:st|nd|rd|th))\s+(?:row|person|place)\b)/i.test(question)
    && !/现在|当前|最新|纪录|改成|换成|去年|今年|平均|城市数|国家数|只看|只算|筛选|中国|世界|亚洲|\b(?:19|20)\d{2}\b|\b(?:current|latest|now|record|average|instead|last year|this year|China|world|Asia|filter)\b/i.test(question);
}

export function assistantContextPeople(context?: AssistantContext) {
  if (!context) return [];
  return [...new Set(context.observations.flatMap(item => [JSON.stringify(item.call), ...Object.values(item.facts).map(String), ...item.tables.flatMap(table => table.rows.flat()),
    ...item.tables.flatMap(table=>[...(table.links ?? []),...(table.cellLinks?.flat().filter((link):link is string=>!!link) ?? [])]),
    ...item.sourceIds].flatMap(text => text.match(/\b\d{4}[A-Z]{4}\d{2}\b/g) ?? [])))];
}

function assistantRankOrdinal(text: string) {
  const match = text.match(/第?\s*([一二两三四五六七八九十\d]+)\s*(?:名|位|行)|\b(first|second|third|\d+(?:st|nd|rd|th))\s+(?:rank|place|row|person)\b/i);
  if (!match) return;
  const value = match[1] ?? ({ first: '1', second: '2', third: '3' }[String(match[2]).toLowerCase()] ?? String(match[2]).replace(/(?:st|nd|rd|th)$/i, ''));
  const ordinal = ordinalValue(value);
  return Number.isInteger(ordinal) && ordinal >= 1 && ordinal <= 20 ? ordinal : undefined;
}

function assistantRankObservation(context?: AssistantContext) {
  return [...(context?.observations ?? [])].reverse().find(item => item.call.tool === 'rankings' && item.tables.length);
}

function assistantRankedPersonId(context: AssistantContext | undefined, ordinal: number) {
  const observation = assistantRankObservation(context);
  if (!observation || observation.call.tool !== 'rankings') return;
  for (const table of [...observation.tables].reverse()) {
    const rankColumn = table.columns.findIndex(column => /^(?:名次|排名|rank)$/i.test(column.trim()));
    const idColumn = table.columns.findIndex(column => /^(?:wca\s*id|wcaid|选手\s*id|person\s*id)$/i.test(column.trim()));
    if (rankColumn < 0 || idColumn < 0) continue;
    const rows = table.rows.filter(row => Number(row[rankColumn]) === ordinal);
    const ids = [...new Set(rows.map(row => row[idColumn]).filter(value => /^\d{4}[A-Z]{4}\d{2}$/.test(value ?? '')))];
    if (ids.length === 1 && rows.length === 1) return { wcaId: ids[0], event: observation.call.event };
  }
}

/** Resolve narrow contextual follow-ups only from server-retained ranking rows. */
export function assistantContextFollowUpCall(question: string, history: AssistantMessage[], context?: AssistantContext): Extract<AssistantToolCall, { tool: 'person' | 'rankings' }> | undefined {
  const ranking = assistantRankObservation(context);
  if (!ranking || ranking.call.tool !== 'rankings') return;
  const fresh = /现在|当前|目前|最新|\b(?:now|current|currently|latest|today)\b/i.test(question);
  if (fresh) {
    const ordinal = assistantRankOrdinal(question);
    if (!ordinal) return;
    return { tool: 'rankings', event: ranking.call.event, type: /平均|\baverage\b/i.test(question) ? 'average' : ranking.call.type,
      country: ranking.call.country, year: new Date().getUTCFullYear(), limit: Math.max(ordinal, ranking.call.limit) };
  }
  if (!/(?:他|她|其)(?:的)?平均|\b(?:his|her|their)\s+average\b/i.test(question)) return;
  const previousUser=[...history].reverse().find(message=>message.role==='user');
  const ordinal=previousUser ? assistantRankOrdinal(previousUser.content) : undefined;
  if (!ordinal) return;
  const person = assistantRankedPersonId(context, ordinal);
  return person ? { tool: 'person', wcaId: person.wcaId, event: person.event, progress: false, view: 'records', metric:'average', rankings:false } : undefined;
}

export function assistantContextSources(context?: AssistantContext): AssistantSource[] {
  if (!context) return [];
  const ids = new Set(context.observations.filter(item => item.tables.length || Object.keys(item.facts).length).flatMap(item => item.sourceIds));
  return context.sources.filter(source => ids.has(source.id));
}

function ordinalValue(value: string) {
  const numeric = Number(value);
  if (Number.isInteger(numeric)) return numeric;
  const chinese: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  if (value === '十') return 10;
  if (value.startsWith('十')) return 10 + (chinese[value.slice(1)] ?? 0);
  if (value.endsWith('十')) return (chinese[value.slice(0, -1)] ?? 1) * 10;
  return chinese[value];
}

/** Resolve only an explicit request for a displayed row/person/result. */
export function resolveAssistantSnapshotAnswer(question: string, context?: AssistantContext, lang:'zh'|'en'='zh') {
  if (!context) return;
  if(/刚才|上(?:一)?轮|之前|previous|earlier/i.test(question) && /(?:表|table).*(?:哪一年|年份|which year)|which year.*table/i.test(question)) {
    const item=[...context.observations].reverse().find(item=>item.tables.length);
    const source=context.sources.find(source=>source.read && item?.sourceIds.includes(source.id));
    if(item?.call.tool==='rankings' && source) return {source,answer:lang==='zh'
      ? `上一轮表格的查询年份是 ${item.call.year} 年。 [[${source.id}]]`
      : `The previous table was queried for ${item.call.year}. [[${source.id}]]`};
    return;
  }
  if (!assistantSnapshotReference(question)) return;
  const match = question.match(/第\s*([一二两三四五六七八九十\d]+)\s*(行|名|位)|\b(first|second|third|\d+(?:st|nd|rd|th))\s+(row|person|place)\b/i);
  if (!match) return;
  const ordinal = ordinalValue(match[1] ?? ({ first: '1', second: '2', third: '3' }[String(match[3]).toLowerCase()] ?? String(match[3]).replace(/(?:st|nd|rd|th)$/i, '')));
  if (!Number.isInteger(ordinal) || ordinal < 1) return;
  const isRow = match[2] === '行' || /\brow\b/i.test(match[4] ?? '');
  const isPerson = /谁|姓名|名字|选手|\b(?:who|name|person|competitor)\b/i.test(question);
  const isResult = /成绩|用时|结果|时间|\b(?:result|time|average|single)\b/i.test(question);
  if (!isPerson && !isResult) return;
  const observation=[...context.observations].reverse().find(item=>item.tables.length);
  if(observation) {
    const source = context.sources.find(item => item.read && observation.sourceIds.includes(item.id));
    if (!source) return;
    // Multiple tables or tied ranks need clarification, never an arbitrary row.
    if(observation.tables.length!==1) return;
    for (const table of observation.tables) {
      const rankColumn = table.columns.findIndex(column => /^(?:名次|排名|rank)$/i.test(column.trim()));
      if(!isRow && (rankColumn<0 || table.rows.filter(row=>Number(row[rankColumn])===ordinal).length!==1)) return;
      const rowIndex = isRow ? ordinal - 1 : table.rows.findIndex(row => Number(row[rankColumn]) === ordinal);
      const row = table.rows[rowIndex];
      if (!row) continue;
      const column = isPerson && !isResult
        ? table.columns.findIndex(value => /选手|姓名|名字|person|competitor|^name$/i.test(value))
        : table.columns.findIndex(value => /成绩|用时|result|time|average|single/i.test(value));
      if (column < 0 || !row[column]) continue;
      const label = isRow ? `第${ordinal}行` : `第${ordinal}名`;
      const answer = lang==='en'
        ? `In the previously displayed ${table.title}, ${isRow?'row':'rank'} ${ordinal}: ${table.columns[column]} — ${row[column]}. [[${source.id}]]`
        : isPerson && !isResult
        ? `上一轮展示的${table.title}中，${label}是 ${row[column]}。 [[${source.id}]]`
        : `上一轮展示的${table.title}中，${label}的${table.columns[column]}为 ${row[column]}。 [[${source.id}]]`;
      return { answer, source };
    }
  }
}
