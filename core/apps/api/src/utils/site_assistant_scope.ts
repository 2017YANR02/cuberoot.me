import { resolveAssistantTime, type AssistantMessage } from '@cuberoot/shared/site-assistant';
import { EVENT_DISPLAY_EN, EVENT_DISPLAY_ZH, WCA_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import { EVENT_NAME_BY_ID } from '@cuberoot/shared/record-news';
import { analysisQuerySchema, compileAnalysis, type AnalysisExpr } from './site_assistant_analysis.js';

interface AttendanceScope {
  date?: { text: string; from?: string; to?: string };
  event?: { text: string };
}
interface AttendanceCall { tool: string; wcaId?: string; event?: string; from?: string; to?: string; query?: unknown; view?: string }
const attendance = /参赛|比赛|\bcompetitions?\b|\bcompeted\b|\bparticipat|\battend/i;
const self = /我(?:\s|\d{4}年|的|在|去|参|比|一共|总共|总计|已经|今年|去年|前年|历年|生涯|所有|全部|不限)|\bmy\b|\bI\s+(?:have\s+|did\s+)?(?:compet|attend|participat|visit)/i;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeEvent = (text: string) => text.toLowerCase().replace(/×/g,'x').replace(/\s+/g,' ').trim();
const eventAliases = new Map<string,string>();
// Reuse published names; add qualified spellings of the existing short labels.
// Include known non-WCA names so "四阶金字塔" cannot become a 4x4 attendance filter.
for (const id of Object.keys(EVENT_DISPLAY_ZH)) {
  const labels=[id,EVENT_DISPLAY_ZH[id],EVENT_DISPLAY_EN[id],EVENT_NAME_BY_ID[id]];
  if (/^[345]{3}[a-z]+$/.test(id)) {
    const base=id.slice(0,3);
    labels.push(EVENT_DISPLAY_ZH[base]+(id.endsWith('bf') && !id.includes('mb')?'盲拧':EVENT_DISPLAY_ZH[id]));
    labels.push(EVENT_DISPLAY_EN[base]+' '+EVENT_DISPLAY_EN[id]);
  }
  for (const label of labels) if (label) eventAliases.set(normalizeEvent(label),id);
}
const eventPattern = new RegExp([...eventAliases.keys()].sort((a,b)=>b.length-a.length).map(label=>{
  const pattern=escape(label).replace(/(\d)x(?=\d)/g,'$1[x×]').replace(/ /g,'\\s+');
  return /[\u3400-\u9fff]/.test(label)?pattern:`\\b${pattern}\\b`;
}).join('|'),'gi');
const scopedEvent = (scope: AttendanceScope) => {
  const id=scope.event && eventAliases.get(normalizeEvent(scope.event.text));
  return WCA_EVENT_ORDER.find(event=>event===id);
};

/** A narrow guard for personal attendance follow-ups, based only on user wording. */
export function assistantAttendanceScope(question: string, history: AssistantMessage[], now: Date, timeZone: string, viewerWcaId?: string): AttendanceScope | undefined {
  let scope: AttendanceScope = {};
  let personalAttendance = false;
  let explicitReset = false;
  for (const text of [...history.filter(message => message.role === 'user').map(message => message.content), question]) {
    const ids = text.match(/\b\d{4}[A-Z]{4}\d{2}\b/g) ?? [];
    const periods = resolveAssistantTime(text, now, timeZone).periods;
    // Only a bare date/event continuation may omit the established subject.
    const delta = text.trim().replace(/^(?:那(?:么)?|再看|继续看|what about)\s*/i, '').replace(/(?:呢|怎么样)?[?？。!！\s]*$/, '').trim();
    const reset = delta.replace(/[、，,\s]/g,'').replace(/(?:合计|总共|一共)?多少场(?:比赛)?$/,'');
    const elliptical = personalAttendance && (/^(?:19|20)\d{2}年?$/.test(delta)
      || periods.some(period => period.phrase === delta) || text.match(eventPattern)?.[0].toLowerCase() === delta.toLowerCase()
      || /^(?:分别|都)?(?:(?:我)?去过|在)?哪些(?:国家(?:和|或)地区|国家|地区)(?:比赛|参赛)?$|^(?:which|what) countries(?: and regions)?$/i.test(delta)
      || /^(?:改成|改为|换成)?(?:(?:全部|所有|不限)(?:年份|时间)(?:(?:和)?(?:全部|所有|不限)?项目)?|(?:全部|所有|不限)项目)$/.test(reset));
    // Do not carry a visitor's filters into a different person or a new topic.
    if ((!elliptical && (!attendance.test(text) || !self.test(text))) || ids.some(id => id !== viewerWcaId)) { scope = {}; personalAttendance = false; explicitReset = false; continue; }
    personalAttendance = true;
    if (/全部历史|历年|生涯|不限(?:年份|时间)|(?:全部|所有)年份|不限定(?:年份|时间)|\blifetime\b|\ball[ -]time\b|\ball years\b/i.test(text)) { delete scope.date; explicitReset = true; }
    else {
      const years = [...new Set(text.match(/\b(?:19|20)\d{2}\b/g) ?? [])];
      if (periods.length === 1) scope.date = { text: periods[0].phrase, from: periods[0].start, to: periods[0].end };
      else if (years.length === 1 && !/\d{4}-\d{2}/.test(text)) scope.date = { text: years[0], from: years[0] + '-01-01', to: years[0] + '-12-31' };
      else if (periods.length || years.length) scope.date = { text };
    }
    if (/(?:所有|全部|不限)(?:年份和|时间和)?项目|不限定项目|\ball events\b/i.test(text)) { delete scope.event; explicitReset = true; }
    else {
      const matches = [...text.matchAll(eventPattern)];
      const events = matches.map(match=>match[0]);
      const ids = new Set(events.map(event=>eventAliases.get(normalizeEvent(event))));
      const qualified = matches.map(match=>{
        const before=text.slice(0,match.index).match(/(?:不(?:算|含|包括|统计|计入|看|要|是)|排除|除(?:了|去)?|非|\b(?:except(?: for)?|exclud(?:e|ing)|without|not))\s*$/i)?.[0] ?? '';
        const after=text.slice(match.index+match[0].length).match(/^\s*(?:除外|以外|之外|不算|不计)/)?.[0] ?? '';
        return before+match[0]+after;
      });
      // Exclusions cannot use an equality-only tool. Keep their wording (without
      // stale dates) for analysis and subsequent date-only follow-ups.
      const exclusion=qualified.some((event,index)=>event!==events[index]);
      // Multiple requested events need the ordinary planner/review, not a forced first-event filter.
      const first=events[0];
      if (first) scope.event = { text: exclusion ? qualified.join('、') : ids.size===1 ? first : text };
    }
  }
  // An explicit all-time/all-event reset must reject a planner's stale filters.
  // Undefined still means no established personal scope (or a changed subject).
  return scope.date || scope.event || explicitReset ? scope : undefined;
}

/** Fill only omitted filters for the already resolved self; never replace a model-supplied contradiction. */
export function applyAttendanceScope(scope: AttendanceScope | undefined, call: AttendanceCall, viewerWcaId?: string): void {
  if (!scope || !viewerWcaId || call.wcaId !== viewerWcaId || !['person_competitions','person_countries'].includes(call.tool)) return;
  if (scope.date?.from && scope.date.to) { call.from ??= scope.date.from; call.to ??= scope.date.to; }
  const event = scopedEvent(scope);
  if (event) call.event ??= event;
}

/** Equality-only attendance tools cannot express these already known constraints. */
export function attendanceRequiresAnalysis(scope: AttendanceScope | undefined): boolean {
  return !!scope && (!!scope.event && !scopedEvent(scope) || !!scope.date && (!scope.date.from || !scope.date.to));
}

/** A filter on one aggregate does not constrain other displayed aggregates. */
function analysisMatchesScope(scope: AttendanceScope, input: unknown, viewerWcaId?: string): boolean | undefined {
  // Reuse the compiler's depth/size validation before walking model expressions.
  try { compileAnalysis(input); } catch { return; }
  const plan = analysisQuerySchema.parse(input);
  const eventId = scopedEvent(scope);
  // Unresolved natural-language ranges remain subject to the ordinary query review.
  if (!viewerWcaId || scope.event && !eventId || scope.date && (!scope.date.from || !scope.date.to)) return;
  const conjuncts = (expr?: AnalysisExpr): AnalysisExpr[] => expr && 'op' in expr && expr.op === 'and' ? expr.args.flatMap(conjuncts) : expr ? [expr] : [];
  const equals = (expr: AnalysisExpr, column: string, value: string | number) => 'op' in expr && expr.op === '=' && expr.args.length === 2
    && ((('col' in expr.args[0] && expr.args[0].col === column) && 'value' in expr.args[1] && expr.args[1].value === value)
      || (('col' in expr.args[1] && expr.args[1].col === column) && 'value' in expr.args[0] && expr.args[0].value === value));
  const joined = (expr: AnalysisExpr, a: string, b: string) => 'op' in expr && expr.op === '=' && expr.args.length === 2
    && expr.args.every(part => 'col' in part) && expr.args.some(part => 'col' in part && part.col === a) && expr.args.some(part => 'col' in part && part.col === b);
  const references = (expr: AnalysisExpr, columns: Set<string>): boolean => 'col' in expr ? columns.has(expr.col)
    : 'args' in expr ? expr.args.some(arg=>references(arg,columns))
    : 'case' in expr ? expr.case.some(part=>references(part.when,columns) || references(part.then,columns)) || references(expr.else,columns) : false;
  const scopedSteps = new Set<string>();
  let finalScoped = false;
  for (const {name, query} of [...plan.steps, {name:'',query:plan}]) {
    const predicates = conjuncts(query.where);
    let rawSources = 0;
    for (const relation of [query.from, ...query.joins].filter(item => ['results', 'attempts'].includes(item.dataset))) {
      rawSources++;
      const prefix = relation.as + '.';
      if (!predicates.some(p => equals(p, prefix + 'wca_id', viewerWcaId))) return false;
      if (eventId && !predicates.some(p => equals(p, prefix + 'event_id', eventId))) return false;
      const dateColumns = [prefix + 'comp_date'];
      // A joined competition's start date is the same attendance date basis.
      for (const comp of [query.from, ...query.joins].filter(item => item.dataset === 'competitions')) {
        if (query.joins.some(join => conjuncts(join.on).some(p => joined(p, prefix + 'comp_id', comp.as + '.id')))) dateColumns.push(comp.as + '.start_date');
      }
      if (scope.date && !dateColumns.some(column => datePredicatesCover(predicates, column, scope.date!.from!, scope.date!.to!))) return false;
      // Each missing dimension means unrestricted, including a partial reset.
      // Inspect raw WHERE predicates (including CTE bases), not select/grouping.
      const unrestrictedColumns=new Set([
        ...(!scope.event?[prefix+'event_id']:[]),
        ...(!scope.date?dateColumns:[]),
      ]);
      if (predicates.some(predicate=>references(predicate,unrestrictedColumns))) return false;
    }
    // Unused scoped CTEs and LEFT JOINs must not authorize an unrelated total.
    const scoped = rawSources > 0 || scopedSteps.has(query.from.dataset)
      || query.joins.some(join => join.type === 'inner' && scopedSteps.has(join.dataset));
    if (name && scoped) scopedSteps.add(name);
    if (!name) finalScoped = scoped;
  }
  return finalScoped;
}

function datePredicatesCover(predicates: AnalysisExpr[], column: string, from: string, to: string): boolean {
  const following = new Date(new Date(to + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0,10);
  let lower = false, upper = false;
  for (const predicate of predicates) {
    if (!('op' in predicate) || predicate.args.length !== 2) continue;
    let [left, right] = predicate.args, op = predicate.op;
    if ('value' in left) { [left, right] = [right, left]; op = ({'>=':'<=','<=':'>=','>':'<','<':'>'} as Record<string,string>)[op] ?? op; }
    if (!('value' in right)) continue;
    if ('fn' in left && left.fn === 'year' && left.args.length === 1 && 'col' in left.args[0] && left.args[0].col === column
      && op === '=' && String(right.value) === from.slice(0,4) && from.endsWith('-01-01') && to === from.slice(0,4) + '-12-31') return true;
    if (!('col' in left) || left.col !== column || typeof right.value !== 'string') continue;
    if (op === '>=' && right.value === from) lower = true;
    if (op === '<=' && right.value === to || op === '<' && right.value === following) upper = true;
  }
  return lower && upper;
}

export function attendanceScopeError(scope: AttendanceScope | undefined, call: AttendanceCall, viewerWcaId?: string): string | undefined {
  if (!scope) return;
  if (call.tool === 'analysis_query') {
    if (analysisMatchesScope(scope, call.query, viewerWcaId) !== false) return;
    if (!scope.date && !scope.event) return 'The user explicitly reset personal attendance to all years and all events. Use the resolved viewer wca_id and remove stale event/date WHERE filters from every raw results/attempts input, including CTE bases. Do not carry the previous year or event into this total.';
    return 'The analysis includes rows outside the active personal-attendance scope: ' + JSON.stringify(scope)
      + '. Apply the requested wca_id, event_id and comp_date constraints as global AND predicates in WHERE of each raw results/attempts input, including CTE base steps, before any aggregation. A missing date/event dimension means all years/events: remove any cancelled or unrequested restriction on that dimension. A FILTER on only one aggregate is insufficient. For a calendar year use year(comp_date)=year or >= start and < next year. Do not include an unrequested lifetime/all-event total or comparison. Return only the active scope.';
  }
  if (!['person', 'person_countries', 'person_competitions'].includes(call.tool)) return;
  if (call.tool==='person' && call.view==='profile' && viewerWcaId && call.wcaId===viewerWcaId
    && !scope.date && !scope.event && !call.from && !call.to) return;
  const event = scopedEvent(scope);
  if (call.tool !== 'person' && viewerWcaId && call.wcaId === viewerWcaId
    && (!scope.event || event) && (!scope.date || scope.date.from && scope.date.to)
    && call.event === event && call.from === scope.date?.from && call.to === scope.date?.to) return;
  return 'This tool cannot answer the active personal-attendance scope. Retain these user constraints: '
    + [scope.date?.text ?? 'all years', scope.event?.text ?? 'all events'].join(' / ')
    + '. Use person_competitions or person_countries for the resolved viewerWcaId with matching event/from/to filters. Do not substitute another person or lifetime/all-event totals. For unsupported grouping or unresolved ranges use analysis_schema then analysis_query with all requested filters. These constraints are user context, not factual evidence.';
}
