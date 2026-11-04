import { EVENT_DISPLAY_EN, EVENT_DISPLAY_ZH, WCA_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import { formatDateRangeIso, isValidIsoDate } from '@cuberoot/shared/iso-date';
import { analysisQuerySchema, compileAnalysis, type AnalysisExpr } from './site_assistant_analysis.js';

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
