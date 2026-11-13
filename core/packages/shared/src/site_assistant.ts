export const SITE_ASSISTANT_DAILY_LIMIT = 1000;
export { resolveAssistantTime, resolveAssistantYears } from './site_assistant_time';
export const SITE_ASSISTANT_TIMEOUT_MS = 60_000;
/** Match the question and history limits accepted by the assistant API. */
export const SITE_ASSISTANT_QUESTION_MAX_LENGTH = 8000;
export const SITE_ASSISTANT_HISTORY_MESSAGE_MAX_LENGTH = 12000;
export const SITE_ASSISTANT_ANSWER_MAX_LENGTH = 12000;
export type AssistantThinkingMode = 'auto' | 'fast' | 'deep';
export function assistantTimeoutMs(mode: AssistantThinkingMode = 'auto'): number {
  return mode === 'fast' ? 30_000 : mode === 'deep' ? 90_000 : SITE_ASSISTANT_TIMEOUT_MS;
}
export const SITE_ASSISTANT_MAX_IMAGES = 3;
export const SITE_ASSISTANT_IMAGE_BYTES = 768 * 1024;
export const SITE_ASSISTANT_BODY_BYTES = 3_300_000;
/** Saved attachments use an opaque ID and empty data; bytes are resolved only after owner authentication. */
export interface AssistantImage { mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; data: string; attachmentId?: string }
export type AssistantErrorCode = 'request_too_large' | 'invalid_image' | 'vision_unavailable' | 'login_required' | 'wca_link_required' | 'account_forbidden' | 'daily_limit' | 'busy' | 'verification_required' | 'source_verification_required' | 'timeout' | 'network' | 'model_unavailable' | 'model_output_invalid' | 'model_rate_limited' | 'source_unavailable' | 'unavailable';
export interface AssistantSource { id: string; title: string; href: string; read: boolean }
/** Render only adapter-verified source metadata. Never apply this to model-authored links. */
export function isAssistantSourceHref(href: string): boolean {
  if (href.length > 2000 || /[\\\s\u0000-\u001f]/.test(href)) return false;
  if (/^\/(?!\/)/.test(href)) return true;
  try {
    const url = new URL(href), host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !host.includes('.')
      || host.includes(':') || /^[\d.]+$/.test(host) || /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(host)) return false;
    return ![...url.searchParams.keys()].some(key => /^(?:accesstoken|apikey|password|passwd|secret|authorization|token|auth|session|key|signature)$/i.test(key.replace(/[-_]/g, '')));
  } catch { return false; }
}
export interface AssistantTable {
  kind: 'table'; title: string; columns: string[]; rows: string[][];
  /** One canonical source link for each row, supplied by the data adapter. */
  links?: string[];
  /** Additional canonical links by row and column; null supplies no cell-specific link. */
  cellLinks?: Array<Array<string | null>>;
  /** Semantic presentation supplied by the adapter, independent of translated headers. */
  columnKinds?: Array<'text' | 'country' | 'date'>;
}
export interface AssistantChart {
  kind: 'progress'; title: string; event: string; metric: 'single' | 'average';
  points: Array<{ date: string; value: number; label: string; person: string }>;
}
export interface AssistantAlgorithmCard {
  caseId?: number; name: string; href: string;
  puzzle: import('./alg_catalog').AlgPuzzle; set: string;
  alg: string; setup?: string; sticker: import('./alg_types').AlgSticker;
  alternative: number; alternativeCount: number;
}
export interface AssistantAlgorithms {
  kind: 'algorithms'; version: 1; title: string;
  display: 'both' | 'image' | 'text';
  puzzle: import('./alg_catalog').AlgPuzzle; set: string; query?: string; caseId?: number;
  offset: number; total: number; nextOffset?: number;
  cards: AssistantAlgorithmCard[];
}
/** Validate persisted/shared cards before passing their data to a renderer. */
export function isAssistantAlgorithms(value: unknown): value is AssistantAlgorithms {
  if (!value || typeof value !== 'object') return false;
  const a = value as AssistantAlgorithms;
  const text = (v: unknown, max = 4000): v is string => typeof v === 'string' && v.length <= max;
  const index = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
  const puzzle = (v: unknown) => ['2x2','3x3','4x4','5x5','6x6','7x7','sq1','pyraminx','skewb','megaminx','fto'].includes(String(v));
  const set = (v: unknown) => text(v,100) && /^[a-z0-9-]+$/i.test(v);
  const sticker = (v: unknown) => {
    if (!v || typeof v !== 'object') return false;
    const s = v as Record<string,unknown>;
    if (s.kind === 'f2l') return text(s.fl,1000);
    if (s.kind === 'face') return ['us','ub','uf','ul','ur'].every(k=>text(s[k],1000)) && ['mask','scheme'].every(k=>s[k]===undefined || text(s[k],1000));
    if (s.kind !== 'raw' || !text(s.tag,100) || !s.attrs || typeof s.attrs !== 'object' || Array.isArray(s.attrs)) return false;
    const attrs = Object.entries(s.attrs);
    return attrs.length<=30 && attrs.every(([k,v])=>/^[a-zA-Z0-9_-]+$/.test(k) && text(v,2000)
      && (k!=='image' || /^(?:images|alg|puzzles)\/[a-zA-Z0-9_./-]+$/.test(v) && !v.includes('..')));
  };
  return a.kind==='algorithms' && a.version===1 && text(a.title,200) && puzzle(a.puzzle) && set(a.set)
    && ['both','image','text'].includes(a.display) && index(a.offset) && index(a.total)
    && (a.nextOffset===undefined || index(a.nextOffset) && a.nextOffset>a.offset && a.nextOffset<a.total)
    && (a.query===undefined || text(a.query,100)) && (a.caseId===undefined || index(a.caseId))
    && Array.isArray(a.cards) && a.cards.length<=24 && a.cards.every(c=>c && text(c.name,200) && text(c.alg)
      && (c.setup===undefined || text(c.setup)) && puzzle(c.puzzle) && set(c.set) && c.puzzle===a.puzzle && c.set===a.set
      && text(c.href,2000) && /^\/alg\//.test(c.href) && isAssistantSourceHref(c.href)
      && index(c.alternative) && index(c.alternativeCount) && c.alternative<c.alternativeCount
      && (c.caseId===undefined || index(c.caseId)) && sticker(c.sticker));
}
/** Complete snapshots, also used by native clients and follow-up context. */
export function assistantAlgorithmsText(a: AssistantAlgorithms): string {
  return [a.title, `puzzle=${a.puzzle}; set=${a.set}; offset=${a.offset}; total=${a.total}; display=${a.display}${a.query ? `; query=${encodeURIComponent(a.query)}` : ''}`,
    ...a.cards.map((c, i) => `${i + 1}. ${c.name} [caseId=${c.caseId ?? ''}; alternative=${c.alternative}/${c.alternativeCount}] (${c.href})\n${c.alg}`),
    ...(a.nextOffset === undefined ? [] : [`nextOffset=${a.nextOffset}`]),
  ].join('\n');
}
export type AssistantArtifact = AssistantTable | AssistantChart | AssistantAlgorithms | import('./cube-photo/result').CubePhotoArtifact;
export interface AssistantAnswer {
  answer: string; sources: AssistantSource[]; artifacts?: AssistantArtifact[];
  /** Verified destinations selected from site catalogs or public data adapters. */
  actions?: Array<{ id: string; title: string; href: string }>;
}
export interface AssistantMessage { role: 'user' | 'assistant'; content: string; images?: AssistantImage[] }
/** Keep recent complete turns within a bounded context, without summarizing away user meaning. */
export function boundAssistantHistory(history: AssistantMessage[]): AssistantMessage[] {
  const recent = history.slice(-10);
  let size = recent.reduce((sum, message) => sum + message.content.length, 0);
  while (recent.length && size > 40_000) size -= recent.shift()!.content.length;
  if (recent[0]?.role === 'assistant') recent.shift();
  return recent;
}

export type AssistantStatus = { phase: 'planning' | 'querying' | 'writing'; tool?: string };
/** Execution metadata only: never provider reasoning, tool arguments or draft answers. */
export interface AssistantProgress {
  id: number;
  phase: 'model' | 'review' | 'tool';
  state: 'running' | 'complete' | 'partial' | 'error';
  tool?: string;
  elapsedMs: number;
  durationMs?: number;
  sourceCount?: number;
}
/** Browser-reported durations from submission, separate from server measurements. */
export interface AssistantBrowserTiming {
  firstProgressMs?: number;
  firstAnswerMs?: number;
  responseMs: number;
  visibleMs: number;
  renderDelayMs: number;
  wasHidden: boolean;
  transport: 'sse' | 'json';
}
export type AssistantStreamEvent =
  | { type: 'status'; status: AssistantStatus }
  | { type: 'progress'; progress: AssistantProgress }
  | { type: 'answer'; answer: string; sources: AssistantSource[] }
  | { type: 'done'; result: AssistantAnswer }
  | { type: 'error'; error: AssistantErrorCode };

/** Bounded SSE reader shared by the provider adapter and the browser client. */
export async function* readAssistantEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      size += value?.byteLength ?? 0;
      if (size > 8_000_000) throw new Error('assistant stream too large');
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      // Normalize CRLF only once a complete line has arrived (CR can split chunks).
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
        if (data) yield data;
      }
      if (done) break;
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
}

export { assistantAnswerText, assistantAnswerHistory, assistantSpokenText } from './site_assistant_export';

export const ASSISTANT_ERROR_TEXT: Record<AssistantErrorCode, { zh: string; en: string }> = {
  request_too_large: { zh: '内容超过发送上限。请缩小图片或缩短本条消息后重试。', en: 'This message exceeds the sending limit. Reduce image sizes or shorten this message and retry.' },
  invalid_image: { zh: '图片无法发送。请使用 JPG、PNG 或 WebP，每次最多 3 张，并尝试缩小图片。', en: 'Images could not be sent. Use up to 3 JPG, PNG or WebP images and try reducing their size.' },
  vision_unavailable: { zh: '图片识别暂时不可用，请稍后重试。', en: 'Image understanding is temporarily unavailable. Please try again later.' },
  login_required: { zh: '请先登录并绑定 WCA 账号，再使用 AI 问答。普通搜索仍可使用。', en: 'Sign in and link your WCA account to use AI. Regular search is still available.' },
  wca_link_required: { zh: '请在账号页绑定 WCA 账号，再使用 AI 问答。普通搜索仍可使用。', en: 'Link your WCA account on the account page to use AI. Regular search is still available.' },
  account_forbidden: { zh: '当前账号无法使用 AI 问答。', en: 'AI questions are unavailable for this account.' },
  daily_limit: { zh: `全站今日 ${SITE_ASSISTANT_DAILY_LIMIT} 次提问额度已用完，北京时间零点恢复。`, en: `The site’s daily allowance of ${SITE_ASSISTANT_DAILY_LIMIT} questions is used up. It resets at midnight Beijing time (UTC+8).` },
  busy: { zh: '当前提问较多，请稍后重试。', en: 'Too many requests right now. Please try again shortly.' },
  verification_required: { zh: '访问验证已失效，请完成验证后重新提问。', en: 'Access verification is required. Complete verification, then ask again.' },
  source_verification_required: { zh: '资料来源要求验证或拒绝访问，暂时无法读取。请稍后重试。', en: 'A source requires verification or has denied access. Please try again later.' },
  timeout: { zh: '这次查询超时了，请稍后重试。', en: 'This query timed out. Please try again shortly.' },
  network: { zh: '连接中断，请检查网络后重试。', en: 'The connection was interrupted. Check your network and retry.' },
  model_unavailable: { zh: '模型服务暂时无法回答，请稍后重试。', en: 'The model service is temporarily unavailable. Please try again later.' },
  model_output_invalid: { zh: '回答生成未完成，请重试。', en: 'The answer could not be completed. Please try again.' },
  model_rate_limited: { zh: '模型服务当前请求较多，请稍后重试。', en: 'The model service is receiving too many requests. Please try again shortly.' },
  source_unavailable: { zh: '查询资料时发生错误，请稍后重试。', en: 'A data source could not be read. Please try again later.' },
  unavailable: { zh: '问答服务暂时不可用，请稍后重试。', en: 'The assistant is temporarily unavailable. Please try again later.' },
};
