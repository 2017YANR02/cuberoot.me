import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { AssistantMessage } from '@cuberoot/shared/site-assistant';
import { assistantPlanTimeBounds } from './site_assistant_plan.js';
import { redactAssistantText } from './site_assistant_privacy.js';

// This is private, branch-local conversation memory, NOT evidence or instructions.
// Its lifetime is inherited from assistant_context; reads never renew that TTL.
const passageSchema = z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(1200), omitted: z.boolean() }).strict();
const episodeSchema = z.object({
  id: z.string().max(40), turn: z.number().int().nonnegative(), questionHash: z.string().length(24),
  entities: z.array(z.string().max(80)).max(24), passages: z.array(passageSchema).max(4),
  sourceIds: z.array(z.string().max(200)).max(12),
}).strict();
const preferenceSchema = z.object({
  key: z.enum(['language', 'length']), text: z.string().max(1200), episodeId: z.string().max(40),
}).strict();
export const assistantMemorySchema = z.object({
  version: z.literal(1), nextTurn: z.number().int().nonnegative(),
  episodes: z.array(episodeSchema).max(24),
  edges: z.array(z.object({ from: z.string().max(40), to: z.string().max(40), kind: z.literal('continues') }).strict()).max(24),
  preferences: z.array(preferenceSchema).max(2),
}).strict();
export type AssistantMemory = z.infer<typeof assistantMemorySchema>;
type Episode = AssistantMemory['episodes'][number];
export type AssistantRelevance = 'strong' | 'weak';
export interface AssistantTurn { messages: AssistantMessage[] }
const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 24);
const stopWords = new Set('please explain tell show about what which when where would could should how the and this that with from have does just only more than then also some your answer question hello thanks 你好 谢谢 请问 这个 那个 什么 怎么 如何 为什么 哪些 可以 需要 帮我 告诉 回答 问题 介绍 解释 一下 继续 刚才 之前 现在 还是 如果 不要 只是 请用'.split(' '));
const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });

/** Bounded multilingual entity index; no provider call or external/private query. */
export function assistantMemoryEntities(text: string): string[] {
  const normalized = text.normalize('NFKC').toLowerCase();
  const entities = new Set<string>((normalized.match(/\b\d{4}[a-z]{4}\d{2}\b|\b(?:[234567]x[234567]|[234567]×[234567]|oll|pll|f2l|cfop|roux|zbll|sq1)\b/g) ?? []).slice(0, 24));
  for (const { segment, isWordLike } of segmenter.segment(normalized)) {
    if (isWordLike && segment.length >= 2 && segment.length <= 80 && !stopWords.has(segment) && !/^\d+$/.test(segment)) entities.add(segment);
    if (entities.size >= 24) break;
  }
  return [...entities].slice(0, 24);
}

export function assistantHistoryTurns(history: AssistantMessage[]): AssistantTurn[] {
  const turns: AssistantTurn[] = [];
  for (const message of history) {
    if (message.role === 'user') turns.push({ messages: [message] });
    else if (turns.length) turns.at(-1)!.messages.push(message);
  }
  return turns.filter(turn => turn.messages.some(message => message.role === 'assistant'));
}

function continuation(question: string) {
  return question.length <= 160 && /^(?:(?:现在|这次)(?:允许|改为|改成)|now (?:allow|permit)\b|继续|然后呢|那(?:么|个|这|他|她|它)|再(?:说|讲|解释|详细)|(?:把|将)?刚才|上(?:一轮|面|次)|前面|换成|改成|我说的是|他的|她的|它的|这(?:个|些|场)|第\s*[一二两三四五六七八九十\d]+\s*(?:行|名|位)|continue\b|go on\b|what about\b|and (?:what|how)\b|(?:his|her|their|its)\b|(?:the )?(?:first|second|third) (?:row|person)\b|(?:make|change|translate) (?:it|that|to)\b)/i.test(question.trim());
}
/** A reply can refer to an option or table value introduced only by the assistant. */
export function refersToDisplayedAnswer(question:string, previous?:AssistantMessage):boolean {
  if (previous?.role!=='assistant' || !previous.content.trim() || question.length>200) return false;
  const q=question.trim();
  if (/^(?:其中|前者|后者|这两(?:种|项|个)|第[一二三四五六七八九十0-9]+(?:种|项|步|个)(?:方案|方法|建议|选项|原因)?|(?:the )?(?:former|latter)\b|of those\b|which of (?:the two|those)\b)/i.test(q)) return true;
  // Require the named subject verbatim in the last answer. A standalone new
  // question that merely asks "which" must not activate an older snapshot.
  const named=/^(.{2,40}?)(?:的哪些|具体有哪|分别有哪|怎么操作|为什么更适合)/.exec(q)?.[1];
  return !!named && previous.content.includes(named);
}
function sharedEntities(question: string[], previous: string[]) {
  return question.filter(entity => previous.includes(entity)).length;
}
export function assistantTopicRelevance(question: string, prior: string, hasImages = false): AssistantRelevance {
  if (!prior) return 'weak';
  if (continuation(question) || (hasImages && !question.trim())) return 'strong';
  const current = assistantMemoryEntities(question), previous = assistantMemoryEntities(prior);
  const common = sharedEntities(current, previous);
  return common >= 2 || (common === 1 && (current.length <= 3 || current.some(entity => /\d|^(?:oll|pll|f2l|cfop|roux|zbll|sq1)$/.test(entity) && previous.includes(entity)))) ? 'strong' : 'weak';
}

// Extract complete sentences; unlike recursive generative summaries this never
// manufactures a fact. Omitted coverage is explicit and original turns stay in
// the existing private request log. Assistant text is always attributed as such.
function passages(role: 'user' | 'assistant', value: string): Episode['passages'] {
  const text = redactAssistantText(value);
  const sentences = text.match(/[^。！？.!?\n]+[。！？.!?]?/g) ?? [];
  const selected: string[] = [];
  let size = 0;
  for (const sentence of sentences) {
    if (size + sentence.length > 1200) break;
    selected.push(sentence); size += sentence.length;
  }
  const excerpt = selected.join('').trim();
  return excerpt ? [{ role, text: excerpt, omitted: size < text.length }] : [];
}

/** Deterministic graph update: episode -> entities + bounded continuity edges. */
export function updateAssistantMemory(prior: AssistantMemory | undefined, history: AssistantMessage[], question: string, answer: string, sourceIds: string[] = []): AssistantMemory {
  const graph: AssistantMemory = prior ? structuredClone(prior) : { version: 1, nextTurn: 0, episodes: [], edges: [], preferences: [] };
  const add = (user: string, assistant: string, sources: string[]) => {
    const questionHash = hash(redactAssistantText(user));
    const turn = graph.nextTurn++, id = `turn:${turn}:${questionHash}`;
    const previous = graph.episodes.at(-1);
    const episode: Episode = { id, turn, questionHash, entities: assistantMemoryEntities(redactAssistantText(user)),
      passages: [...passages('user', user), ...passages('assistant', assistant)], sourceIds: sources.slice(0, 12) };
    graph.episodes.push(episode);
    if (previous && assistantTopicRelevance(user, previous.passages.filter(p => p.role === 'user').map(p => p.text).join('\n')) === 'strong') {
      graph.edges.push({ from: id, to: previous.id, kind: 'continues' });
      if (continuation(user)) episode.entities = [...new Set([...episode.entities, ...previous.entities])].slice(0, 24);
    }
    // Only explicit, narrowly typed enduring presentation preferences. Arbitrary
    // claims and assistant-generated facts never become a stable user profile.
    for (const sentence of user.match(/[^。！？.!?\n]+[。！？.!?]?/g) ?? []) {
      if (!/以后|今后|始终|一直|默认|always|from now on|by default/i.test(sentence) || sentence.length > 1200) continue;
      const key = /中文|英文|英语|chinese|english/i.test(sentence) ? 'language'
        : /简短|简洁|详细|concise|brief|detailed/i.test(sentence) ? 'length' : undefined;
      if (key) graph.preferences = [...graph.preferences.filter(item => item.key !== key), { key, text: redactAssistantText(sentence.trim()), episodeId: id }];
    }
  };
  // Seed an existing client conversation once. Subsequently the server parent
  // snapshot owns the graph; resubmitted/edited client prose cannot rewrite it.
  if (!prior) for (const turn of assistantHistoryTurns(history)) {
    const assistant = turn.messages.filter(message => message.role === 'assistant').map(message => message.content).join('\n');
    if (assistant) add(turn.messages[0].content, assistant, []);
  }
  if (question || answer) add(question, answer, sourceIds);
  // Derived memory is expendable; do not enlarge the durable completion journal.
  while (graph.episodes.length > 24 || (Buffer.byteLength(JSON.stringify(graph)) > 20_000 && graph.episodes.length > 1)) {
    const removed = graph.episodes.shift()!;
    graph.edges = graph.edges.filter(edge => edge.from !== removed.id && edge.to !== removed.id);
  }
  const ids = new Set(graph.episodes.map(episode => episode.id));
  graph.edges = graph.edges.filter(edge => ids.has(edge.from) && ids.has(edge.to)).slice(-24);
  return graph;
}

export interface AssistantMemoryLayers {
  slidingSummary: Episode[];
  activeExtracts: Episode[];
  longTermMemory: AssistantMemory['preferences'];
  historicalTopics: Array<{ episodeId: string; entities: string[] }>;
  protectedConstraints: Array<{ source: string; text: string }>;
}
/** Keep provenance and exact excerpts on the wire, not persistence indexes.
 * Window summaries are short extractive sentences; active excerpts and user
 * constraints retain their stored text. The durable graph remains unchanged. */
export function assistantMemoryPayload(layers: AssistantMemoryLayers) {
  const episode = (item: Episode, summary: boolean) => ({ source: item.id, passages: item.passages.map(passage => {
    if (!summary) return passage;
    const selected: string[] = [];
    let size = 0;
    for (const sentence of passage.text.match(/[^。！？.!?\n]+[。！？.!?]?/g) ?? []) {
      if (selected.includes(sentence)) continue;
      if (size + sentence.length > 280) break;
      selected.push(sentence); size += sentence.length;
    }
    const text = selected.join('').trim();
    return { ...passage, text, omitted: passage.omitted || text !== passage.text };
  }).filter(passage => passage.text) });
  return Object.fromEntries(Object.entries({
    slidingSummary: layers.slidingSummary.map(item => episode(item, true)),
    activeExtracts: layers.activeExtracts.map(item => episode(item, false)),
    protectedConstraints: layers.protectedConstraints,
    longTermMemory: layers.longTermMemory,
    historicalTopics: layers.historicalTopics,
  }).filter(([, entries]) => entries.length > 0));
}
const constraintPattern = /不要|不得|不能|不用|仅限|最多|至少|只(?:用|看|要|限|做|练|允许)|先别|do not|don't|must not|only\b|at most\b|at least\b|no more than\b/i;

/** Narrow, auditable arithmetic guard for explicitly bounded minute plans.
 * It does not claim to validate arbitrary natural-language constraints. */
export function assistantDurationLimit(question: string, history: AssistantMessage[], graph?: AssistantMemory) {
  if (!/安排|计划|练习|训练|慢拧|慢慢转|\b(?:plan|activities|practice|training|schedule|drills|exercises|recall|my timer)\b/i.test(question)) return;
  const layers = selectAssistantMemory(question, [], graph, 0);
  const texts = [...layers.protectedConstraints.map(item => item.text),
    ...history.filter(message => message.role === 'user' && assistantTopicRelevance(question, message.content) === 'strong').map(message => message.content), question];
  let limit: { maximumTotalMinutes: number; sourceText: string } | undefined;
  for (const text of texts) {
    if (/时长不限|不限制时长|取消.{0,8}(?:时限|时间限制)|no time limit|remove.{0,10}time limit/i.test(text)) { limit = undefined; continue; }
    const seconds=assistantPlanTimeBounds(text).total;
    if(seconds!==undefined)limit={maximumTotalMinutes:seconds/60,sourceText:text};
  }
  return limit;
}

// Compatibility exports for existing consumers; new code imports the plan module.
export { assistantPlanExceedsDuration, assistantPlanDurationViolation, assistantPlanShape, assistantObservationOnlyPlan, assistantPlanPrerequisites, assistantCubePlanGuidance, assistantPlanWordInstruction, assistantPlanSubsetFallback, assistantPlanPieceFacts, assistantPlanSemanticViolation, assistantPlanShapeViolation } from './site_assistant_plan.js';

export function selectAssistantMemory(question: string, history: AssistantMessage[], graph?: AssistantMemory, recentTurns = 5): AssistantMemoryLayers {
  const turns = assistantHistoryTurns(history);
  const remaining = new Map<string, number>();
  for (const turn of turns.slice(-recentTurns || turns.length)) {
    const key = hash(redactAssistantText(turn.messages[0].content));
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  const recentIds = new Set<string>();
  for (const episode of [...(graph?.episodes ?? [])].reverse()) {
    const count = remaining.get(episode.questionHash) ?? 0;
    if (count) { recentIds.add(episode.id); remaining.set(episode.questionHash, count - 1); }
  }
  const latest = graph?.episodes.at(-1);
  const entities = [...new Set([...assistantMemoryEntities(question), ...(continuation(question) ? latest?.entities ?? [] : [])])];
  const available = (graph?.episodes ?? []).filter(episode => !recentIds.has(episode.id));
  // Matching entities select seed episodes; continuity expands only one hop.
  const selected = new Set(available.filter(episode => sharedEntities(entities, episode.entities) >= 2
    || (sharedEntities(entities, episode.entities) === 1 && entities.length <= 3)).map(episode => episode.id));
  if (continuation(question) && graph?.episodes.length) selected.add(graph.episodes.at(-1)!.id);
  const seeds = new Set(selected);
  for (const edge of graph?.edges ?? []) if (seeds.has(edge.from)) selected.add(edge.to);
  const activeExtracts = available.filter(episode => selected.has(episode.id)).slice(-6);
  const activeIds = new Set(activeExtracts.map(episode => episode.id));
  const slidingSummary = available.filter(episode => !activeIds.has(episode.id)).slice(-6);
  const protectedConstraints: AssistantMemoryLayers['protectedConstraints'] = [];
  // Constraints are exact user excerpts, scoped to retrieved episodes. Never
  // promote assistant output or RAG text into an authorization/instruction.
  for (const episode of activeExtracts) for (const passage of episode.passages) {
    if (passage.role !== 'user') continue;
    for (const sentence of passage.text.match(/[^。！？.!?\n]+[。！？.!?]?/g) ?? []) {
      if (constraintPattern.test(sentence)) protectedConstraints.push({ source: episode.id, text: sentence });
    }
  }
  return { slidingSummary, activeExtracts, protectedConstraints,
    longTermMemory: graph?.preferences.filter(item => !activeIds.has(item.episodeId) && !recentIds.has(item.episodeId)) ?? [],
    historicalTopics: available.filter(episode => !activeIds.has(episode.id) && !slidingSummary.includes(episode)).slice(-8).map(episode => ({ episodeId: episode.id, entities: episode.entities.slice(0, 4) })),
  };
}

/** Conservative text estimate, deliberately not advertised as provider tokens. */
export function estimateAssistantTokens(value: unknown): number {
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? '';
  let ascii = 0, other = 0;
  for (const character of text) character.charCodeAt(0) < 128 ? ascii++ : other++;
  return Math.ceil(ascii / 3) + other * 2;
}

export class AssistantContextBudgetError extends Error {
  constructor(public readonly estimatedTokens: number, public readonly budget: number) {
    super('Assistant protected context exceeds input budget');
  }
}

export interface AssistantContextSelection {
  relevance: AssistantRelevance; history: AssistantMessage[]; layers: AssistantMemoryLayers;
  estimatedTokens: number; inputBudget: number; compressed: string[];
}
/** Layer order is deterministic. Current prompt, system, current tool evidence
 * and protocol transcript are charged through fixedTokens and never truncated. */
export function composeAssistantContext(input: {
  question: string; history: AssistantMessage[]; memory?: AssistantMemory;
  fixedTokens: number; inputBudget: number; hasImages?: boolean;
}): AssistantContextSelection {
  const turns = assistantHistoryTurns(input.history);
  const paired = new Set(turns.flatMap(turn => turn.messages));
  // Unanswered user messages are not complete rounds and cannot be discarded
  // merely because they are outside the round count.
  const unpaired = new Set(input.history.filter(message => message.role === 'user' && !paired.has(message)));
  const priorQuestion = turns.at(-1)?.messages[0].content
    ?? input.memory?.episodes.at(-1)?.passages.find(passage => passage.role === 'user')?.text ?? '';
  const relevance = refersToDisplayedAnswer(input.question,input.history.at(-1)) ? 'strong' : assistantTopicRelevance(input.question, priorQuestion, input.hasImages);
  let kept = Math.min(turns.length, relevance === 'strong' ? 5 : 1);
  const minimum = Math.min(turns.length, relevance === 'strong' ? 2 : 1);
  // Include client-only history in extractive summaries without persisting it or
  // changing the graph snapshot. The current turn is added only upon success.
  const seeded = input.memory ?? updateAssistantMemory(undefined, input.history, '', '');
  const memory = { ...seeded, episodes: seeded.episodes.filter(episode => episode.passages.length > 0) };
  const layers = selectAssistantMemory(input.question, input.history, memory, kept);
  // Also protect exact constraints from user messages that will leave the window.
  const constraintTopic = continuation(input.question) ? priorQuestion : input.question;
  for (const [index, turn] of turns.entries()) {
    const content = turn.messages[0].content;
    if (assistantTopicRelevance(constraintTopic, content) !== 'strong') continue;
    for (const sentence of content.match(/[^。！？.!?\n]+[。！？.!?]?/g) ?? []) {
      if (constraintPattern.test(sentence)) layers.protectedConstraints.push({ source: `history:${index}`, text: sentence });
    }
  }
  layers.protectedConstraints = layers.protectedConstraints.filter((item, index, all) => all.findIndex(other => other.text === item.text) === index);
  const compressed: string[] = [];
  const history = () => {
    const selected = new Set(turns.slice(-kept || turns.length).flatMap(turn => turn.messages));
    return input.history.filter(message => selected.has(message) || unpaired.has(message));
  };
  let selected = history();
  const historyCost = () => estimateAssistantTokens(selected.map(({role, content}) => ({role, content})))
    + selected.reduce((sum, message) => sum + (message.images?.length ?? 0) * 4096, 0);
  let selectedTokens = historyCost();
  let memoryTokens = estimateAssistantTokens(assistantMemoryPayload(layers));
  const size = () => input.fixedTokens + memoryTokens + selectedTokens;
  for (const key of ['historicalTopics', 'longTermMemory', 'activeExtracts', 'slidingSummary'] as const) {
    while (size() > input.inputBudget && layers[key].length) {
      layers[key].shift();
      memoryTokens = estimateAssistantTokens(assistantMemoryPayload(layers));
      if (!compressed.includes(key)) compressed.push(key);
    }
  }
  while (size() > input.inputBudget && kept > minimum) {
    kept--;
    selected = history();
    selectedTokens = historyCost();
    if (!compressed.includes('recentTurns')) compressed.push('recentTurns');
  }
  const estimatedTokens = size();
  if (estimatedTokens > input.inputBudget) throw new AssistantContextBudgetError(estimatedTokens, input.inputBudget);
  return { relevance, history: selected, layers, estimatedTokens, inputBudget: input.inputBudget, compressed };
}
