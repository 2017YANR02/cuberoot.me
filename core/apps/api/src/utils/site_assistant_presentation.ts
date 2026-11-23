import { EVENT_DISPLAY_EN, EVENT_DISPLAY_ZH, WCA_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import { formatDateRangeIso, isValidIsoDate } from '@cuberoot/shared/iso-date';
import { analysisQuerySchema, compileAnalysis, type AnalysisExpr } from './site_assistant_analysis.js';
import type { AssistantStructuredPlan } from './site_assistant_plan.js';

export type AssistantPresentationContract = { json?: boolean; sentences?: number; localTail?: { sentences:number; request:string; separateParagraph?:boolean } };
const sentenceRequest=/(?:用|写|只(?:给|写|用)|仅用)\s*(一|两|二|三|[1-9])\s*句(?:话)?|\b(?:write|give|use|in|using)\s+(?:exactly\s+)?(one|two|three|[1-9])\s+(?:(?:friendly|short|complete|concise)\s+)?sentences?\b/i;
const chineseSeparateParagraph=String.raw`另起一段|单独(?:成段|一段|写成一段)`;
const separateParagraph=new RegExp(String.raw`${chineseSeparateParagraph}|\b(?:separate|standalone|fresh|new) paragraph\b|\bits own paragraph\b|\ba paragraph of its own\b`,'i');
const paragraphOpening=String.raw`(?:in (?:a (?:separate|standalone|fresh|new) paragraph|its own paragraph|a paragraph of its own)\b|${chineseSeparateParagraph})`;
const additionRequest=new RegExp(String.raw`另外|顺便|另(?=写|给)|\balso\b|\bthen(?=\s*,?\s*${paragraphOpening})|(?<=[.!?;。！？；,])\s+\bthen(?=\s+(?:write|give|add)\b)|(?<=[.!?;。！？；\n])\s*(?=(?:(?:最后|末尾|结尾|做完后?|练完后?)[，,\s]*(?:再|请)?\s*|(?:at the end|finally)\s*,?\s*)?${paragraphOpening})`,'gi');
const repeatedAction=/每(?:项|个|步|次|回|做一次)|\b(?:each|per)\s+(?:step|activity|child|turn|repetition|attempt|time)\b/i;
const sentenceNumber=(match:RegExpMatchArray)=>{
  const value=match[1]??match[2],numbers:Record<string,number>={一:1,二:2,两:2,三:3,one:1,two:2,three:3};
  return numbers[value.toLowerCase()]??Number(value);
};
/** Only explicit output requests, never a mention of JSON as the subject. */
export function assistantPresentationContract(question:string, relevantUsers:string[]=[]):AssistantPresentationContract {
  let contract:AssistantPresentationContract={};
  for(const text of [...relevantUsers,question]) {
    if(/(?:不用|不要|取消).{0,8}JSON|\b(?:no|not|stop using) JSON\b|改(?:成|为).{0,5}(?:普通文本|段落)|\b(?:make|change) it (?:a )?(?:paragraph|plain text)\b|\b(?:instead|switch to)\b.{0,12}\b(?:prose|paragraph|plain text)\b/i.test(text))contract={};
    else if(/(?:用|以|按|输出(?:为)?|返回(?:为)?)\s*(?:有效的?)?JSON|\b(?:return|output|respond(?: with| in)?|answer(?: with| in)?|format(?: as)?)\s+(?:only\s+|valid\s+)?JSON\b|\bin JSON(?: format)?\b/i.test(text))contract={json:true};
    const match=text.match(sentenceRequest);
    // A final explicitly additive task gets its own count. Do not reinterpret
    // per-step counts, negated requests or another task after that count.
    const addition=[...text.matchAll(additionRequest)].at(-1);
    const tail=addition?text.slice(addition.index!+addition[0].length).trim():'';
    const local=tail.match(sentenceRequest);
    if(!contract.json && addition && text.slice(0,addition.index).trim() && local
      && !repeatedAction.test(tail)
      && !/不要|不用|无需|别写|\b(?:not|don't|do not)\b|(?:然后|再|并且)(?:查|写|给)|\band (?:then )?(?:write|give|look|explain)\b/i.test(tail)) {
      contract={localTail:{sentences:sentenceNumber(local),request:tail,...(separateParagraph.test(tail)?{separateParagraph:true}:{})}};
      continue;
    }
    // A local count in "define PLL, and also write one birthday sentence"
    // constrains only the extra task, not the entire answer.
    if(match && !contract.json && !repeatedAction.test(text) && !/另外|顺便|同时|另(?:写|给)|\balso\b|\bas well\b/i.test(text)) {
      contract={sentences:sentenceNumber(match)};
    }
  }
  return contract;
}
export function assistantJsonAnswer(answer:string):boolean {
  try { const value:unknown=JSON.parse(answer);return value!==null && typeof value==='object'; } catch { return false; }
}

/** The main reply can have a lead-in and a Markdown list. Treat its list blocks
 * as one unit so the ending still has a meaningful, independently checked boundary. */
export function assistantLocalTailBoundary(answer:string,activities?:number):RegExpMatchArray|undefined {
  const boundaries=[...answer.trimEnd().matchAll(/\r?\n[^\S\r\n]*\r?\n/g)];
  if(boundaries.length<=1)return boundaries[0];
  const last=boundaries.at(-1)!;
  const item=/^(?:(\d+)[.)、]|([-+*]))[ \t]+\S/gm;
  const blocks=answer.slice(0,last.index).split(/\r?\n[^\S\r\n]*\r?\n/);
  const listStart=blocks.findIndex(block=>/^(?:\d+[.)、]|[-+*])[ \t]+\S/.test(block));
  if(listStart<0 || listStart>1 || listStart===1 && (blocks[0].includes('\n') || blocks[0].length>240))return;
  const list=blocks.slice(listStart);
  if(list.some(block=>!/^(?:\d+[.)、]|[-+*])[ \t]+\S/.test(block)))return;
  const headings=[...list.join('\n').matchAll(item)];
  if(headings.length<2 || activities!==undefined && headings.length!==activities)return;
  if(headings.every((m,i)=>Number(m[1])===i+1) || headings.every(m=>m[2]===headings[0][2] && !!m[2]))return last;
}

/** Use the structured activities when the model repeated them in its prose. */
export function assistantPlanSupplement(answer:string,activities?:number,plan?:AssistantStructuredPlan):string {
  if(!activities)return answer;
  const boundary=assistantLocalTailBoundary(answer,activities);
  if(boundary) {
    const main=answer.slice(0,boundary.index).trim();
    const numbered=[...main.matchAll(/^(\d+)[.)、][ \t]+\S/gm)];
    const outline=activities===2 && /\b(?:two|2)\b[^.!?\n]{0,48}\b(?:drills|activities|exercises)\b[^.!?\n]*?:\s*first\b[^\n]*?\bsecond\b/i.test(main);
    if(outline || numbered.length===activities && numbered.every((m,i)=>Number(m[1])===i+1))
      return answer.slice(boundary.index!+boundary[0].length).trim();
  }
  // Structured drafts can mirror their headings in plain prose rather than as
  // a numbered list. Drop the prefix only when every heading and any body
  // matches the actual plan, so an extra paragraph in the ending counts.
  const last=[...answer.matchAll(/\r?\n[^\S\r\n]*\r?\n/g)].at(-1);
  if(!plan || !last)return answer;
  const compact=(text:string)=>text.trim().replace(/\s+/g,' ');
  const heading=(text:string)=>compact(text.replace(/^\s*\d+[.)、]\s*/,'').replaceAll('**','')
    .replace(/\s*[:：]\s*\d+(?:\.\d+)?\s*(?:seconds?|secs?|秒钟?)?\s*$/i,''));
  const lines=answer.slice(0,last.index).split(/\r?\n/);
  let offset=0;
  for(const [index,activity] of plan.activities.entries()) {
    if(heading(lines[offset]??'')!==heading(activity.title))return answer;
    const next=plan.activities[index+1];
    const nextHeading=next && lines.findIndex((line,at)=>at>offset && heading(line)===heading(next.title));
    if(nextHeading===-1)return answer;
    const body=compact(lines.slice(offset+1,nextHeading??lines.length).join(' '));
    if(body && body!==compact(activity.steps.map(step=>step.action).join(' '))
      && body!==compact(activity.steps.map(step=>step.action+' '+step.reason).join(' ')))return answer;
    offset=nextHeading??lines.length;
  }
  return answer.slice(last.index!+last[0].length).trim();
}

export function assistantPresentationViolation(answer:string,contract:AssistantPresentationContract,activities?:number):string|undefined {
  if(contract.json && !assistantJsonAnswer(answer))return 'presentation_json';
  let counted=answer,expected=contract.sentences;
  if(contract.localTail) {
    // Count the entire supplemental part, not just its last paragraph: splitting
    // a two-sentence wish over multiple paragraphs must not bypass the check.
    const boundary=assistantLocalTailBoundary(answer,activities) ?? (!contract.localTail.separateParagraph ? /\n\s*\n/.exec(answer) : undefined);
    if(contract.localTail.separateParagraph && (!boundary || !answer.slice(0,boundary.index).trim() || /\n\s*\n/.test(answer.slice(boundary.index!+boundary[0].length).trim())))return 'presentation_local_sentence_scope';
    if(boundary)counted=answer.slice(boundary.index!+boundary[0].length);
    else {
      // Preserve an already valid compact sourced answer followed by writing.
      // Only an actual citation boundary can separate two inline tasks safely.
      // Start at the first citation group: a citation appended inside the
      // independent task must not hide its earlier sentences from the count.
      const citation=/(?:\[\[[^\]\n]+\]\])(?:\s*\[\[[^\]\n]+\]\])*/.exec(answer);
      if(!citation || !answer.slice(0,citation.index).trim())return 'presentation_local_sentence_scope';
      counted=answer.slice(citation.index!+citation[0].length).replace(/^[\s。.!！?？:：;；]+/u,'');
    }
    expected=contract.localTail.sentences;
    const invitation=/邀请|\binvit(?:e|ing|ation)\b|\bask(?:ing)?\b.*\bto\b/i.test(contract.localTail.request);
    if(invitation && /^(?:(?:then[ ,]+)?in (?:a separate|its own|a standalone) paragraph[,: ]+|(?:最后)?(?:另起一段|单独成段)[，：: ]*)?(?:invite\s+|ask\b[^.!?\n]{0,80}\bto\b|(?:write|draft)\b[^.!?\n]{0,80}\b(?:invit(?:e|ing|ation)|ask(?:ing)?)\b|(?:再|另)?写(?:一|两|二|三|[1-9])句[^。！？\n]{0,36}邀[请约])/i.test(counted.trim()))
      return 'presentation_local_sentence_content';
  }
  if(expected) {
    const prose=counted.replace(/\[\[[^\]\n]+\]\]/g,'').trim();
    const sentences=[...new Intl.Segmenter('en',{granularity:'sentence'}).segment(prose)].filter(s=>/[\p{L}\p{N}]/u.test(s.segment));
    if(sentences.length!==expected)return contract.localTail?'presentation_local_sentence_count':'presentation_sentence_count';
  }
}
export function assistantPresentationInstruction(contract:AssistantPresentationContract):string {
  return contract.json?'The USER-VISIBLE answer string must itself contain one valid JSON object or array, without Markdown fences or text outside it. The outer assistant protocol JSON does not satisfy this request. Preserve any requested keys and put citations inside JSON string values; never append citations after the closing bracket.'
    :contract.localTail?`The final independent task ${JSON.stringify(contract.localTail.request)} requires exactly ${contract.localTail.sentences} sentences in its own final paragraph. Finish the earlier tasks with their evidence and citations before the independent task. If using an activity list, keep its items on separate lines without blank lines between them. Use one blank line before the independent task. The preceding content has no sentence-count limit. Count the entire final task, including greetings such as "Happy birthday!"; integrate greetings into the requested sentences. Do not add another final paragraph, introduction or recap. Never omit the earlier task to satisfy the local count.`
    :contract.sentences?`The complete user-visible answer must contain exactly ${contract.sentences} sentences. A standalone greeting such as "Hey!" counts as a sentence; integrate greetings into a requested sentence. Preserve all requested content without an extra introduction or recap.`:'';
}

const conjuncts = (expr?: AnalysisExpr): AnalysisExpr[] => expr && 'op' in expr && expr.op==='and' ? expr.args.flatMap(conjuncts) : expr ? [expr] : [];
const column = (expr: AnalysisExpr, name: string) => 'col' in expr && expr.col===name;
const equalColumns = (expr: AnalysisExpr, a: string, b: string) => 'op' in expr && expr.op==='=' && expr.args.length===2
  && (column(expr.args[0],a) && column(expr.args[1],b) || column(expr.args[0],b) && column(expr.args[1],a));

/** Literal equality/IN/OR on one column; never treats arbitrary OR as an AND filter. */
function choices(expr: AnalysisExpr, name: string): unknown[] | undefined {
  if(!('op' in expr))return;
  if(expr.op==='or') {
    const parts=expr.args.map(part=>choices(part,name));
    return parts.every(part=>part!==undefined) ? parts.flat() : undefined;
  }
  if(expr.op==='in' && column(expr.args[0],name) && expr.args.slice(1).every(part=>'value' in part))return expr.args.slice(1).map(part=>(part as {value:unknown}).value);
  if(expr.op!=='=' || expr.args.length!==2)return;
  const [a,b]=expr.args;
  if(column(a,name) && 'value' in b)return [b.value];
  if(column(b,name) && 'value' in a)return [a.value];
}

function dateBound(expr: AnalysisExpr, name: string, op: '<='|'>='): string | undefined {
  if(!('op' in expr) || expr.args.length!==2)return;
  let [a,b]=expr.args, actual=expr.op;
  if('value' in a) { [a,b]=[b,a]; actual=actual==='<='?'>=':actual==='>='?'<=':actual; }
  return actual===op && column(a,name) && 'value' in b && typeof b.value==='string' && isValidIsoDate(b.value) ? b.value : undefined;
}

const listValue = (expr: AnalysisExpr): boolean => 'col' in expr || 'value' in expr
  || 'op' in expr && ['+','-','*','/'].includes(expr.op) && expr.args.every(listValue)
  || 'fn' in expr && ['round','abs'].includes(expr.fn) && !expr.over && expr.args.every(listValue);
const escape = (text:string) => text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const eventPattern = (label:string) => /[\u3400-\u9fff]/.test(label) ? new RegExp(escape(label),'gi')
  : new RegExp(`(^|[^a-z0-9])${escape(label)}(?=$|[^a-z0-9])`,'gi');

function plainWinnerRequest(question:string,periodPhrase:string) {
  let remaining=question.toLowerCase().replace(/×/g,'x').replace(new RegExp(escape(periodPhrase.toLowerCase())+"(?:['’]s)?",'g'),' ');
  const events=WCA_EVENT_ORDER.filter(id=>[id,EVENT_DISPLAY_ZH[id],EVENT_DISPLAY_EN[id].toLowerCase().replace(/×/g,'x')]
    .some(label=>eventPattern(label).test(remaining)));
  for(const id of events)for(const label of [id,EVENT_DISPLAY_ZH[id],EVENT_DISPLAY_EN[id].toLowerCase().replace(/×/g,'x')])remaining=remaining.replace(eventPattern(label),' ');
  remaining=remaining.replace(/\bwca\b|比赛|赛事|项目|\b(?:competitions?|events?)\b/gi,' ').replace(/[，。！？、,.!?;；:：]/g,' ').trim();
  // Consume the entire request after its independently parsed date/event.
  // Additional clauses (writing, links, comparisons, etc.) cannot disappear.
  remaining=remaining.replace(/^(?:(?:请|帮我|给我|麻烦)\s*|(?:please|can you|could you|tell me|show me)\s+)*/i,'').trim();
  const chinese=remaining.replace(/\s+/g,'');
  const english=remaining.replace(/\s+/g,' ');
  const plain=/^(?:(?:谁|哪些(?:人|选手))(?:拿|拿到|夺得|获得|赢得)?了?冠军|冠军(?:是(?:谁|哪些人)|有(?:谁|哪些)|名单)?|(?:列出|给出|查看)(?:冠军|获胜者)(?:名单)?)$/.test(chinese)
    || /^(?:who (?:won|were the (?:winners|champions))|(?:list|show) (?:the )?(?:winners|champions)(?: list)?|(?:the )?(?:winners|champions)(?: list)?)$/.test(english);
  return plain ? events : undefined;
}

/** A short list introduction from verified query semantics, never generated prose. */
export function championListPresentation(input: {
  question: string; lang: 'zh'|'en'; hasHistory: boolean;
  periods: readonly {phrase:string;start:string;end:string}[];
  query: unknown; sourceId: string; truncated: unknown; rowCount: number;
}): string | undefined {
  const {question,lang}=input;
  if(input.periods.length!==1 || input.truncated!==false || input.rowCount<1)return;
  const period=input.periods[0];
  const explicitEvents=plainWinnerRequest(question,period.phrase);
  if(!explicitEvents)return;
  // This path deliberately recognizes only a plain, complete joined list.
  // A complex/filtered analysis remains subject to the ordinary answer review.
  try { compileAnalysis(input.query); } catch { return; }
  const plan=analysisQuerySchema.parse(input.query);
  if(plan.from.dataset!=='results' || plan.steps.length || plan.groupBy.length || plan.having || plan.joins.length!==2 || !plan.select.every(item=>listValue(item.expr)))return;
  const results=plan.from.as;
  const competitions=plan.joins.find(join=>join.dataset==='competitions' && join.type==='inner');
  const persons=plan.joins.find(join=>join.dataset==='persons' && join.type==='inner');
  if(!competitions || !persons || !equalColumns(competitions.on,results+'.comp_id',competitions.as+'.id')
    || !equalColumns(persons.on,results+'.wca_id',persons.as+'.wca_id'))return;
  if(![competitions.as+'.name',persons.as+'.name'].every(name=>plan.select.some(item=>column(item.expr,name))))return;
  let event: string|undefined, first=false, finals=false, from: string|undefined, to: string|undefined;
  for(const predicate of conjuncts(plan.where)) {
    const events=choices(predicate,results+'.event_id');
    if(events) {
      const unique=[...new Set(events)];
      if(unique.length!==1 || typeof unique[0]!=='string' || event && event!==unique[0])return;
      event=unique[0];continue;
    }
    const positions=choices(predicate,results+'.pos');
    if(positions) { if(!positions.length || positions.some(value=>value!==1 && value!=='1'))return; first=true;continue; }
    const rounds=choices(predicate,results+'.round_type_id');
    if(rounds) { if(new Set(rounds).size!==2 || !rounds.includes('f') || !rounds.includes('c'))return; finals=true;continue; }
    const lower=dateBound(predicate,competitions.as+'.end_date','>=');
    if(lower) { from=from && from>lower ? from : lower;continue; }
    const upper=dateBound(predicate,competitions.as+'.start_date','<=');
    if(upper) { to=to && to<upper ? to : upper;continue; }
    return; // Do not omit an extra person/location/result restriction from scope.
  }
  if(!event || !WCA_EVENT_ORDER.includes(event as typeof WCA_EVENT_ORDER[number]) || !first || !finals || !from || !to || from>to || from!==period.start || to!==period.end)return;
  if(explicitEvents.length ? explicitEvents.length!==1 || explicitEvents[0]!==event : input.hasHistory || event!=='333')return;
  const range=formatDateRangeIso(from,to), eventName=(lang==='zh'?EVENT_DISPLAY_ZH:EVENT_DISPLAY_EN)[event];
  return lang==='zh'
    ? `${range} 期间举办的比赛，${eventName}决赛冠军如下：[[${input.sourceId}]]`
    : `${eventName} final winners at competitions held during ${range}: [[${input.sourceId}]]`;
}
