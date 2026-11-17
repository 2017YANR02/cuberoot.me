import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { AssistantMessage } from '@cuberoot/shared/site-assistant';
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
  return question.length <= 160 && /^(?:继续|然后呢|那(?:么|个|这|他|她|它)|再(?:说|讲|解释|详细)|(?:把|将)?刚才|上(?:一轮|面|次)|前面|换成|改成|我说的是|他的|她的|它的|这(?:个|些|场)|第\s*[一二两三四五六七八九十\d]+\s*(?:行|名|位)|continue\b|go on\b|what about\b|and (?:what|how)\b|(?:his|her|their|its)\b|(?:the )?(?:first|second|third) (?:row|person)\b|(?:make|change|translate) (?:it|that)\b)/i.test(question.trim());
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
  if (!/安排|计划|练习|训练|\b(?:plan|activities|practice|training|schedule)\b/i.test(question)) return;
  const layers = selectAssistantMemory(question, [], graph, 0);
  const texts = [...layers.protectedConstraints.map(item => item.text),
    ...history.filter(message => message.role === 'user' && assistantTopicRelevance(question, message.content) === 'strong').map(message => message.content), question];
  let limit: { maximumTotalMinutes: number; sourceText: string } | undefined;
  for (const text of texts) {
    if (/时长不限|不限制时长|取消.{0,8}(?:时限|时间限制)|no time limit|remove.{0,10}time limit/i.test(text)) { limit = undefined; continue; }
    const matches = [...text.matchAll(/(?:最多|不超过|上限(?:为|是)?|limited to|at most|no more than)\s*(\d+(?:\.\d+)?)\s*(?:分钟|minutes?|mins?)/gi)];
    for (const match of matches) {
      // Scope belongs to this bound's clause, not to formatting instructions
      // elsewhere ("give each activity a heading" must not erase a total).
      const prefix = text.slice(0, match.index).split(/[，,；;。!?\n]/).at(-1) ?? '';
      const suffix = text.slice(match.index! + match[0].length).split(/[，,；;。!?\n]/)[0];
      const scope = prefix + suffix;
      if (/每项|每个活动|每次|单次|each activity|per activity|per session/i.test(scope)
        && !/总时长|总共|合计|\btotal\b/i.test(scope)) continue;
      if (Number(match[1]) > 0 && Number(match[1]) <= 1440) limit = { maximumTotalMinutes: Number(match[1]), sourceText: text };
    }
  }
  return limit;
}

export function assistantPlanExceedsDuration(answer: string, maximumMinutes: number): boolean {
  // Only numbered/bulleted activity headings, not introductory total statements
  // or minute-per-repetition prose. Unknown formats remain model-checked.
  const headings = [...answer.matchAll(/^([ \t]*)(?:\d+[.)、]|[-*])[ \t]+([^\n]+)/gm)];
  const topIndent = Math.min(...headings.map(match => match[1].length));
  const allocations = headings.filter(match => match[1].length === topIndent).flatMap(match => {
    const duration = match[2].replace(/\*\*/g, '').match(/(\d+(?:\.\d+)?)\s*(?:分钟|minutes?|mins?)/i);
    return duration ? [Number(duration[1])] : [];
  });
  return allocations.reduce((sum, value) => sum + value, 0) > maximumMinutes;
}

/** Only explicit allocations, not elapsed time inferred from instructions.
 * Ambiguous ranges/alternatives must be rewritten, never rounded or guessed. */
function planAllocationRange(line:string):{start:number;end:number}|undefined {
  const text=line.replace(/\*\*/g,'');
  const clock=text.match(/\b(\d+):([0-5]\d)\s*[-–—]\s*(\d+):([0-5]\d)\b/);
  if(clock && !/[：:。.!?]/.test(text.slice(0,clock.index)))return {start:Number(clock[1])*60+Number(clock[2]),end:Number(clock[3])*60+Number(clock[4])};
  const range=text.match(/\b(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*(分钟|秒钟?|minutes?\b|mins?\b|seconds?\b|secs?\b|s\b)/i);
  if(range && !/[：:。.!?]/.test(text.slice(0,range.index))) {
    const scale=/^(?:分|min)/i.test(range[3])?60:1;
    return {start:Number(range[1])*scale,end:Number(range[2])*scale};
  }
}
function planAllocationSeconds(line:string):number|undefined {
  const text=line.replace(/\*\*/g,'');
  const interval=planAllocationRange(text);
  if(interval)return interval.end>interval.start?interval.end-interval.start:undefined;
  // A leading mm:ss allocation followed by an action separator is exact,
  // unlike a clock mentioned in the action or an incomplete time range.
  const clock=text.match(/^(\d+):([0-5]\d)\s+(?:[—–-]|[：:])\s+(?!\d+:)\S/);
  if(clock){const seconds=Number(clock[1])*60+Number(clock[2]);return seconds>0?seconds:undefined;}
  const unit='(?:分钟|分(?!钟)|秒钟|秒|minutes?\\b|mins?\\b|seconds?\\b|secs?\\b|s\\b)';
  const match=text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${unit})(?:\\s*(?:and\\s*)?(\\d+(?:\\.\\d+)?)\\s*(秒钟|秒|seconds?\\b|secs?\\b|s\\b))?`,'i'));
  if(!match)return;
  // An allocation belongs in the heading/prefix, before action prose. This
  // avoids treating "repeat for 30 seconds" in a reason as the step budget.
  const before=text.slice(0,match.index);
  if(/[：:。.!?]/.test(before) || /\d\s*[-–—~至到]\s*$/.test(before) || /(?:约|至少|最多|about|up to|at least)\s*$/i.test(before))return;
  const rest=text.slice(match.index!+match[0].length);
  if(/^\s*(?:[-–—~至到]|或|or\b)/i.test(rest))return;
  const seconds=Number(match[1])*(/^(?:分|min)/i.test(match[2])?60:1)+Number(match[3]??0);
  return seconds>0?seconds:undefined;
}

/** Check direct children against their own parent; never count them twice.
 * Used only when the user explicitly requests timed substeps. */
export function assistantPlanDurationViolation(answer:string, maximumMinutes?:number):string|undefined {
  const lines=[...answer.matchAll(/^([ \t]*)(?:\d+[.)、]|[-*])[ \t]+([^\n]+)/gm)];
  const indent=(line:RegExpMatchArray)=>line[1].replace(/\t/g,'    ').length;
  const level=Math.min(...lines.map(indent));
  const top=lines.flatMap((line,index)=>indent(line)===level?[index]:[]);
  if(!top.length)return 'plan_duration_unverifiable';
  let total=0;
  for(let i=0;i<top.length;i++) {
    const parent=planAllocationSeconds(lines[top[i]][2]);
    const nested=lines.slice(top[i]+1,top[i+1]??lines.length);
    const childLevel=Math.min(...nested.map(indent));
    const childLines=nested.filter(line=>indent(line)===childLevel);
    const children=childLines.map(line=>planAllocationSeconds(line[2]));
    const intervals=childLines.map(line=>planAllocationRange(line[2]));
    if(parent===undefined || !children.length || children.some(value=>value===undefined))return 'plan_duration_unverifiable';
    if(intervals.some(Boolean)) {
      // A numeric range is a timeline only when every child participates in
      // one continuous schedule starting at zero or the prior parents' total.
      // Otherwise it may mean a variable allowance, not exact elapsed time.
      if(intervals.some(value=>!value) || (intervals[0]!.start!==0 && intervals[0]!.start!==total))return 'plan_duration_unverifiable';
      if(intervals.some((value,index)=>index>0 && Math.abs(value!.start-intervals[index-1]!.end)>0.01))return 'plan_duration_mismatch';
    }
    if(Math.abs(children.reduce<number>((sum,value)=>sum+value!,0)-parent)>0.01)return 'plan_duration_mismatch';
    total+=parent;
  }
  if(maximumMinutes!==undefined && total>maximumMinutes*60+0.01)return 'duration_limit_exceeded';
}
/** Extract only explicit exact counts; a maximum/minimum is not an exact count. */
export function assistantPlanShape(question:string) {
  if(!/安排|计划|练习|训练|\b(?:plan|activities|practice|training|schedule)\b/i.test(question))return;
  if(/表格|段落|\b(?:table|JSON|paragraph)\b/i.test(question))return;
  const count='(1[0-2]|[1-9]|十二|十一|十|一|二|两|三|四|五|六|七|八|九|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';
  const number=(text:string)=>Number(text)||({一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10,十一:11,十二:12,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12} as Record<string,number>)[text.toLowerCase()];
  const exact=(pattern:string)=>{
    const matches=[...question.matchAll(new RegExp(pattern,'gi'))];
    if(matches.some(match=>{const at=match.index!+match[0].lastIndexOf(match[1]);return /最多|至少|不超过|不少于|at most|at least|up to|no more than|或|\bor\b/i.test(question.slice(Math.max(0,at-20),at).split(/[，,。；;.!?\n]/).at(-1)!);}))return;
    const values=[...new Set(matches.map(match=>number(match[1])))];
    return values.length===1?values[0]:undefined;
  };
  const activities=exact(`(?<![a-z0-9一二两三四五六七八九十])${count}\\s*(?:项[^。；;\\n]{0,18}?(?:练习|活动|训练)|(?:numbered |observation-only |F2L |static |vocabulary |revision )*activities\\b)`);
  const afterEach=exact(`(?:每项|每个活动|each(?: activity| one)?|under each)[^。；;\\n]{0,100}?${count}\\s*(?:个[^。；;\\n]{0,35}?(?:子步骤|子练习)|(?:indented |timed )*(?:substeps|sub-steps)\\b)`);
  const beforeEach=exact(`${count}\\s+(?:indented |timed )*(?:substeps|sub-steps)\\s+(?:and a reason )?(?:under|for|in) each(?: activity| one)?\\b`);
  const substepsPerActivity=afterEach && beforeEach && afterEach!==beforeEach?undefined:afterEach??beforeEach;
  const wordRange=question.match(/\b(\d{2,4})\s*[-–—]\s*(\d{2,4})\s+(?:English\s+)?words\b/i);
  const englishWords=wordRange && Number(wordRange[1])<=Number(wordRange[2])?{minimum:Number(wordRange[1]),maximum:Number(wordRange[2])}:undefined;
  return activities||substepsPerActivity?{...(activities?{activities}:{}),...(substepsPerActivity?{substepsPerActivity}:{}),...(englishWords?{englishWords}:{})}:undefined;
}

/** Scope static-state guidance; current permission to turn replaces an older observation-only limit. */
export function assistantObservationOnlyPlan(question:string,sourceText=''):boolean {
  if(/(?:允许|可以)(?:慢拧|转层|转动魔方)|不再(?:只|仅)观察|\b(?:allow(?:ed)? slow (?:turns|turning)|(?:can|may) turn (?:the |a )?cube|turning is allowed)\b/i.test(question))return false;
  return /静态|(?:只|仅)(?:做)?观察|不转动魔方|不转层|全程不转动|\bobservation[- ]only\b|\b(?:do not|don't) turn (?:the |a )?cube\b|\bno cube turns\b/i.test(question+' '+sourceText);
}

/** Keep the task's most error-prone prerequisites next to the generation rule. */
function vocabularyPlan(question:string):boolean {
  return /vocabulary|单词|词汇|错题|\b(?:revise|revision|review|practise|practice|learn|study|memorise|memorize|spelling)\b[^.!?\n]{0,50}\bwords?\b|\bwords?\b[^.!?\n]{0,50}\b(?:revision|review|practice|spelling)\b/i.test(question);
}

export function assistantPlanPrerequisites(question:string):string {
  if(vocabularyPlan(question))return ' Vocabulary: give EACH timed child its own concrete action and purpose in that same bullet; a global rationale does not replace child reasons. Make every timed action executable even if there are ZERO mistakes. Use the full existing word list, prioritising weak words; if practising errors only, explicitly use the original list when no errors remain. Do not require a fixed count of weak words. Include preparing cards/materials inside the allocated time. A spoken response is not a written record: if a later step reads or edits sentences, write those sentences within the earlier step.';
  if(/魔方|三阶|\b(?:cube|F2L|OLL|PLL)\b/i.test(question))return ' Cube: a corner needs all THREE colours to identify its home; an edge needs BOTH. A visible non-cross sticker does NOT exclude a hidden cross-colour sticker: leave identity unknown. Current adjacent centres describe location, never hidden colours. Use suppliedPieceFacts without changing any supplied colour. Reuse observable pieces; do not demand an unseen matching piece. For static practice keep the same state; for slow turns include any setup before repeating a solved pair. For supplied diagrams describe inspections, not invented examples: single corner twist is illegal; opposite corner twists satisfy orientation only; overall legality still needs matching corner/edge permutation parity.';
  return '';
}

/** Choose one compatible practice mode; do not mix hidden-state, pairing and
 * completed-stage assumptions into every cube plan. No state is inferred. */
export function assistantCubePlanGuidance(question:string,sourceText=''):string|undefined {
  if(!/魔方|三阶|\b(?:cube|F2L|OLL|PLL|CFOP)\b/i.test(question+' '+sourceText))return;
  const format='Answer the current request with its exact activity/child counts, times, reasons and language. Keep these planning checks inside the requested activities, without a separate tutorial. Without a requested word minimum, give each child one action sentence and one brief reason clause; do not repeat the rules. ';
  if(/diagrams?|图示|示意图/i.test(question))return format+'Use only the supplied diagrams. Apply checks to the full supplied set, never require a nonempty no-cross/error pile in a later timed step; if no error exists, recheck the same diagrams. A last layer has FOUR corners and FOUR edges: label each corner twist 0, 1 or 2 and sum those FOUR VALUES; do NOT use the count of twisted corners modulo 3. Inspect orientations and permutations separately. Three independent necessary conditions: corner twists sum to 0 modulo 3 REGARDLESS of edges; edge flips are even REGARDLESS of corners; corner and edge permutation parities agree. One twisted corner is impossible regardless of edge flips. Two opposite twists cancel and are orientation-compatible. Fully oriented pieces are orientation-compatible, not necessarily a legal permutation or solved cube. Describe checks, not invented example cases or algorithms.';
  if(/只(?:能)?看[见到].{0,12}(?:贴纸|颜色)|(?:其余|另外|其他|两).{0,8}(?:被挡|被遮|遮住)|(?:other|remaining|two|both)[^.!?]{0,30}(?:hidden|occluded|covered)|only one.{0,15}sticker/i.test(question))return format+'The stated piece is incompletely visible. Keep this plan on the SAME visible sticker and its observed location: describe its visible colour/face/position, record the remaining colours as UNKNOWN, then recall and visually recheck those same observations. This is useful F2L observation practice without identifying the whole piece. Do NOT search for a partner, classify F2L membership, assign a home, or use current neighbouring centres to guess candidate colours. Do not require other fully visible pieces: their availability was not supplied. A visible non-cross sticker does not rule out a hidden cross-colour sticker.';
  const facts=assistantPlanPieceFacts(question);
  if(facts?.pieces.length)return format+'Use only the supplied colour identities and suppliedPieceFacts. First compare the complete colour sets to decide which edge matches the corner: both non-cross corner colours must match, and an edge containing the cross colour cannot match. Then recall and recheck those SAME supplied colour sets and the pairing verdict. Their current positions are UNKNOWN. Unless specifically asked for location, do not add home-position or solved-state exercises. If location is requested, each piece belongs at ALL centres matching its own colours, never one centre per piece or the centres currently beside it.';
  if(!assistantObservationOnlyPlan(question,sourceText) && /慢拧|slow (?:turn|turning)/i.test(question+' '+sourceText)){
    if(/(?:两|二|2)项慢拧|(?:two|2) (?:slow[- ]turn(?:ing)? )activities/i.test(question))return format+'The current request requires TWO turning activities. Each activity must actually turn: use ONE familiar pair, include its own setup using known moves within its time, then slowly insert that pair. Repeat with a fresh setup in the second activity. Do not require a full scramble, multiple unsolved pairs, or assume the whole cube is solved after one insertion. Respect no timer/no new algorithm limits.';
    return format+'Use ONE familiar F2L pair. First activity: include preparation of that familiar case within its time, using known moves, then slowly pair and insert it. Second activity: observe and recall the SAME resulting solved pair, its actually visible colours and the turns just performed. Do not repeat insertion without setup, require another pair, or add a home-slot explanation. A corner has three colours, an edge two; its two non-cross corner colours match both partner-edge colours. Keep both activities brief, respect no timer/no new algorithms.';
  }
  return format+'Use a simple observation/recall drill on ONE corner currently in view. Record only its actually visible sticker colours and CURRENT face/location; any unseen colours stay UNKNOWN. No complete identity, home-slot or pairing inference is needed for this drill, so do not require all three stickers to be visible or substitute another object. First activity records the visible information; later activities recall and visually recheck that SAME information (with three activities, separate recall from recheck). Every child has a concrete action even when just one sticker is visible. The cube stays untouched and its starting arrangement is unspecified. Do not add solved-state, home-mapping or algorithm explanations unless the user explicitly requested those.';
}

export function assistantPlanWordInstruction(shape:ReturnType<typeof assistantPlanShape>,draft?:string):string {
  if(!shape?.englishWords)return '';
  const target=Math.max(shape.englishWords.minimum,shape.englishWords.maximum-5);
  const children=(shape.activities??1)*(shape.substepsPerActivity??1);
  const perChild=Math.max(1,Math.floor((target-6*(shape.activities??1))/children));
  const count=draft?.trim().split(/\s+/).filter(Boolean).length;
  return `English length is a hard requirement: ${shape.englishWords.minimum}–${shape.englishWords.maximum} whitespace-separated words INCLUDING headings. Target ${target}; allocate about ${perChild} words to each of the ${children} requested action blocks, with short headings. Give each block the action, a concrete observable check, and its purpose in three short sentences; no filler or extra blocks.`+(count!==undefined?` The rejected draft has ${count} words: ${count<target?`ADD about ${target-count} words by expanding the existing actions/reasons`:`REMOVE about ${count-target} words from repeated explanations`}. Changing synonyms without changing length will fail again.`:'');
}

/** A bounded fallback keeps an error-only drill executable without another model call.
 * Insert into an existing step, never add activities or change time allocations.
 * The caller still validates structure, word limits and time after this edit.
 */
export function assistantPlanSubsetFallback(question:string,answer:string,lang:'zh'|'en'):string {
  if(!vocabularyPlan(question)
    || !/错词|错题|弱词|难词|错的词|说不出的词|记号|红圈|圈出|星号|标记|薄弱|不熟|剩下的词|missed|wrong|incorrect|weak|shaky|marked|circled|ticked|needs work|not yet/i.test(answer)
    || /本计划任一步骤若没有可用错词|In any step, if this subset is empty/i.test(answer))return answer;
  const lines=answer.split('\n');
  const index=lines.findIndex(line=>/^\s+[-*]\s+/.test(line));
  const target=index>=0?index:lines.findIndex(line=>/^\d+[.)、]\s+.+[:：].+/.test(line));
  if(target<0)return answer;
  const outputLanguage=/answer in English|用英文|用英语/i.test(question)?'en':/用中文|answer in Chinese/i.test(question)?'zh':/[\u4e00-\u9fff]/.test(answer)?'zh':/[a-z]/i.test(answer)?'en':lang;
  lines[target]+={zh:' 本计划任一步骤若没有可用错词或数量不足，就用原词表中的可用词继续；词数不够可重复，均在该步骤原定时长内完成。',en:' In any step, if this subset is empty or too small, use available words from the original list; repeat available words as needed within that step’s allotted time.'}[outputLanguage];
  return lines.join('\n');
}

/** Project only explicit colour identities; current locations never fill hidden stickers. */
export function assistantPlanPieceFacts(question:string) {
  const colour='white|yellow|red|orange|blue|green';
  const cross=question.match(new RegExp(`\\b(?:use|with|choose) (${colour}) as (?:the |your |a )?cross colou?r\\b`,'i'))?.[1].toLowerCase();
  const pieces=[...question.matchAll(new RegExp(`\\b((?:${colour})(?:[-–](?:${colour}))+)[ \\t]+(corner|edge)\\b`,'gi'))].map(match=>{
    const colours=match[1].toLowerCase().split(/[-–]/),kind=match[2].toLowerCase();
    return {description:match[0],kind,colours,completeIdentity:new Set(colours).size===colours.length && colours.length===(kind==='corner'?3:2)};
  });
  if(!pieces.length)return;
  const pairs=cross?pieces.filter(p=>p.kind==='corner'&&p.completeIdentity&&p.colours.includes(cross)).flatMap(corner=>pieces.filter(p=>p.kind==='edge'&&p.completeIdentity).map(edge=>{
    const expectedEdgeColours=corner.colours.filter(c=>c!==cross);
    return {corner:corner.description,edge:edge.description,expectedEdgeColours,matches:expectedEdgeColours.every(c=>edge.colours.includes(c))};
  })):[];
  return {basis:'Explicit user descriptions, not verified observations; no colours inferred from position.',crossColour:cross,pieces,pairs};
}

/** Narrow checks for observed regressions; not general natural-language entailment. */
export function assistantPlanSemanticViolation(question:string,answer:string,sourceText=''):string|undefined {
  if(assistantObservationOnlyPlan(question,sourceText) && !/已复原|已还原|已完成|打乱|\b(?:solved|scrambled)\b/i.test(question+' '+sourceText)) {
    for(const line of answer.split('\n'))if(/在(?:已|完全)(?:复原|还原)的魔方上|\bon (?:a |the )?(?:fully )?solved cube\b/i.test(line) && !/若|如果|假如|\bif\b|不要|不假设|do not assume/i.test(line))return 'plan_start_state_assumption';
  }
  if(vocabularyPlan(question)) {
    const numbers:Record<string,number>={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12};
    const count='(\\d+|一|二|两|三|四|五|六|七|八|九|十|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';
    const number=(value:string)=>Number(value)||numbers[value.toLowerCase()]||0;
    const known=question.match(new RegExp(`(?:有\\s*${count}\\s*个?\\s*(?:错词|错题)|have\\s+${count}\\s+(?:missed|wrong|incorrect|weak|shaky)\\s+(?:words|cards|items))`,'i'));
    const available=known?number(known[1]??known[2]):undefined;
    const fallback=/不足|不够|少于|若无|如无|没有(?:错词|错题)|fewer|not enough|subset is empty|too small|if none|if (?:there are|you have) no|top up|otherwise/i.test(answer);
    if(!fallback)for(const line of answer.split('\n')) {
      if(!/错词|错题|标红|红圈|圈出|星号|标记.{0,4}词|薄弱|不熟|missed|wrong|incorrect|weak|shaky|marked|circled|ticked|needs work|not yet/i.test(line))continue;
      // An error-only follow-up can be empty even without a fixed item count.
      if(available===undefined && /(?:只(?:看|针对|练|复习)|\b(?:quiz|review|read|re-show) only\b|\bonly the (?:words|cards|items|ticked|missed|weak)\b)/i.test(line))return 'plan_subset_availability';
      for(const match of line.matchAll(new RegExp(`(?:选|挑|取|用|抽|\\bpick|\\bchoose|\\bselect|\\buse|\\btake)[^。；;.!?\\n]{0,24}?${count}(?![a-z0-9])`,'gi'))) {
        if(/^\s*(?:分钟|分\b|秒|minutes?\b|mins?\b|seconds?\b|secs?\b)/i.test(line.slice(match.index!+match[0].length)))continue;
        if(available===undefined || number(match[1])>available)return 'plan_subset_availability';
      }
    }
  }
  if(/F2L[- ]solved|已完成\s*F2L|F2L\s*已完成/i.test(question)) {
    // A classification can state the observed defect and reject it in the next
    // sentence of the same step. Do not reject that explanation mid-sentence.
    for(const sentence of answer.split(/\n\s*\n/)) {
      const exactExamples=sentence.replace(/\bat least\s+(?:one|1)\s+/gi,'some ').replace(/至少(?:一个|1个)/g,'多个');
      if(/(?:\b(?:one|single|1)\s+(?:(?:twisted|flipped)(?:\s+(?:corner|edge))?|(?:corner|edge)\s+(?:is\s+)?(?:twisted|flipped))\b)|(?:一个|单个|1个).{0,3}(?:角块扭转|棱块翻转)/i.test(exactExamples)
        && !/impossible|illegal|invalid|cannot|inconsistent|misread|不合法|不可能|无效|不能|错误|误读|不可/i.test(sentence))return 'plan_illegal_orientation_example';
    }
  }
}

export function assistantPlanShapeViolation(answer:string, shape:NonNullable<ReturnType<typeof assistantPlanShape>>):string|undefined {
  if(shape.englishWords) {
    const words=answer.trim().split(/\s+/).filter(Boolean).length;
    if(words<shape.englishWords.minimum || words>shape.englishWords.maximum)return 'plan_word_count';
  }
  const lines=[...answer.matchAll(/^([ \t]*)(?:\d+[.)、]|[-*])[ \t]+[^\n]+/gm)];
  if(!lines.length)return 'plan_structure_missing';
  const indent=(line:RegExpMatchArray)=>line[1].replace(/\t/g,'    ').length;
  const level=Math.min(...lines.map(indent));
  const top=lines.flatMap((line,index)=>indent(line)===level?[index]:[]);
  if(shape.activities && top.length!==shape.activities)return 'plan_activity_count';
  if(shape.substepsPerActivity)for(let i=0;i<top.length;i++) {
    const children=lines.slice(top[i]+1,top[i+1]??lines.length);
    const childLevel=Math.min(...children.map(indent));
    if(children.filter(line=>indent(line)===childLevel).length!==shape.substepsPerActivity)return 'plan_substep_count';
  }
}

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
  const relevance = assistantTopicRelevance(input.question, priorQuestion, input.hasImages);
  let kept = Math.min(turns.length, relevance === 'strong' ? 5 : 1);
  const minimum = Math.min(turns.length, relevance === 'strong' ? 2 : 1);
  // Include client-only history in extractive summaries without persisting it or
  // changing the graph snapshot. The current turn is added only upon success.
  const seeded = input.memory ?? updateAssistantMemory(undefined, input.history, '', '');
  const memory = { ...seeded, episodes: seeded.episodes.filter(episode => episode.passages.length > 0) };
  const layers = selectAssistantMemory(input.question, input.history, memory, kept);
  // Also protect exact constraints from user messages that will leave the window.
  for (const [index, turn] of turns.entries()) for (const sentence of turn.messages[0].content.match(/[^。！？.!?\n]+[。！？.!?]?/g) ?? []) {
    if (assistantTopicRelevance(continuation(input.question) ? priorQuestion : input.question, turn.messages[0].content) === 'strong'
      && constraintPattern.test(sentence)) layers.protectedConstraints.push({ source: `history:${index}`, text: sentence });
  }
  layers.protectedConstraints = layers.protectedConstraints.filter((item, index, all) => all.findIndex(other => other.text === item.text) === index);
  const compressed: string[] = [];
  const history = () => {
    const selected = new Set(turns.slice(-kept || turns.length).flatMap(turn => turn.messages));
    return input.history.filter(message => selected.has(message) || unpaired.has(message));
  };
  const size = () => input.fixedTokens + estimateAssistantTokens(assistantMemoryPayload(layers)) + estimateAssistantTokens(history().map(message => ({ role: message.role, content: message.content })))
    + history().reduce((sum, message) => sum + (message.images?.length ?? 0) * 4096, 0);
  // Layer 6 / 7 first, then 5, then 4, then complete turns. Each removal keeps
  // source/role attribution intact; no JSON/string slicing or tool-pair removal.
  for (const key of ['historicalTopics', 'longTermMemory', 'activeExtracts', 'slidingSummary'] as const) {
    while (size() > input.inputBudget && layers[key].length) { layers[key].shift(); if (!compressed.includes(key)) compressed.push(key); }
  }
  while (size() > input.inputBudget && kept > minimum) { kept--; if (!compressed.includes('recentTurns')) compressed.push('recentTurns'); }
  const estimatedTokens = size();
  if (estimatedTokens > input.inputBudget) throw new AssistantContextBudgetError(estimatedTokens, input.inputBudget);
  return { relevance, history: history(), layers, estimatedTokens, inputBudget: input.inputBudget, compressed };
}
