import { resolveAssistantTime, type AssistantMessage } from '@cuberoot/shared/site-assistant';
import { EVENT_DISPLAY_EN, EVENT_DISPLAY_ZH, WCA_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import { analysisQuerySchema, compileAnalysis, type AnalysisExpr } from './site_assistant_analysis.js';

interface AttendanceScope {
  date?: { text: string; from?: string; to?: string };
  event?: { text: string };
}
const attendance = /参赛|比赛|\bcompetitions?\b|\bcompeted\b|\bparticipat|\battend/i;
const self = /我(?:\s|\d{4}年|的|在|去|参|比|一共|总共|总计|已经|今年|去年|前年|历年|所有|全部|不限)|\bmy\b|\bI\s+(?:have\s+|did\s+)?(?:compet|attend|participat|visit)/i;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const eventPattern = new RegExp(WCA_EVENT_ORDER.flatMap(id => [
  escape(EVENT_DISPLAY_ZH[id]), `\\b${escape(EVENT_DISPLAY_EN[id]).replace(/×/g, '[x×]')}\\b`, `\\b${id}\\b`,
]).join('|'), 'i');

/** A narrow guard for personal attendance follow-ups, based only on user wording. */
export function assistantAttendanceScope(question: string, history: AssistantMessage[], now: Date, timeZone: string, viewerWcaId?: string): AttendanceScope | undefined {
  let scope: AttendanceScope = {};
  let personalAttendance = false;
  for (const text of [...history.filter(message => message.role === 'user').map(message => message.content), question]) {
    const ids = text.match(/\b\d{4}[A-Z]{4}\d{2}\b/g) ?? [];
    const periods = resolveAssistantTime(text, now, timeZone).periods;
    // Only a bare date/event continuation may omit the established subject.
    const delta = text.trim().replace(/^(?:那(?:么)?|再看|继续看|what about)\s*/i, '').replace(/(?:呢|怎么样)?[?？。!！\s]*$/, '');
    const elliptical = personalAttendance && (/^(?:19|20)\d{2}年?$/.test(delta)
      || periods.some(period => period.phrase === delta) || text.match(eventPattern)?.[0].toLowerCase() === delta.toLowerCase());
    // Do not carry a visitor's filters into a different person or a new topic.
    if ((!elliptical && (!attendance.test(text) || !self.test(text))) || ids.some(id => id !== viewerWcaId)) { scope = {}; personalAttendance = false; continue; }
    personalAttendance = true;
    if (/全部历史|历年|生涯|不限(?:年份|时间)|所有年份|不限定(?:年份|时间)|\blifetime\b|\ball[ -]time\b|\ball years\b/i.test(text)) delete scope.date;
    else {
      const years = [...new Set(text.match(/\b(?:19|20)\d{2}\b/g) ?? [])];
      if (periods.length === 1) scope.date = { text: periods[0].phrase, from: periods[0].start, to: periods[0].end };
      else if (years.length === 1 && !/\d{4}-\d{2}/.test(text)) scope.date = { text: years[0], from: years[0] + '-01-01', to: years[0] + '-12-31' };
      else if (periods.length || years.length) scope.date = { text };
    }
    if (/所有项目|全部项目|不限(?:年份和|时间和)?项目|不限定项目|\ball events\b/i.test(text)) delete scope.event;
    else {
      const event = text.match(eventPattern)?.[0];
      if (event) scope.event = { text: event };
    }
  }
  return scope.date || scope.event ? scope : undefined;
}

/** A filter on one aggregate does not constrain other displayed aggregates. */
function analysisMatchesScope(scope: AttendanceScope, input: unknown, viewerWcaId?: string): boolean | undefined {
  // Reuse the compiler's depth/size validation before walking model expressions.
  try { compileAnalysis(input); } catch { return; }
  const plan = analysisQuerySchema.parse(input);
  const normalize = (value: string) => value.toLowerCase().replace(/x/g, '×');
  const eventId = scope.event && WCA_EVENT_ORDER.find(id => [id, EVENT_DISPLAY_ZH[id], EVENT_DISPLAY_EN[id]].some(label => normalize(label) === normalize(scope.event!.text)));
  // Unresolved natural-language ranges remain subject to the ordinary query review.
  if (!viewerWcaId || scope.event && !eventId || scope.date && (!scope.date.from || !scope.date.to)) return;
  const conjuncts = (expr?: AnalysisExpr): AnalysisExpr[] => expr && 'op' in expr && expr.op === 'and' ? expr.args.flatMap(conjuncts) : expr ? [expr] : [];
  const equals = (expr: AnalysisExpr, column: string, value: string | number) => 'op' in expr && expr.op === '=' && expr.args.length === 2
    && ((('col' in expr.args[0] && expr.args[0].col === column) && 'value' in expr.args[1] && expr.args[1].value === value)
      || (('col' in expr.args[1] && expr.args[1].col === column) && 'value' in expr.args[0] && expr.args[0].value === value));
  const joined = (expr: AnalysisExpr, a: string, b: string) => 'op' in expr && expr.op === '=' && expr.args.length === 2
    && expr.args.every(part => 'col' in part) && expr.args.some(part => 'col' in part && part.col === a) && expr.args.some(part => 'col' in part && part.col === b);
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
      if (scope.date) {
        const dateColumns = [prefix + 'comp_date'];
        // A joined competition's start date is the same attendance date basis.
        for (const comp of [query.from, ...query.joins].filter(item => item.dataset === 'competitions')) {
          if (query.joins.some(join => conjuncts(join.on).some(p => joined(p, prefix + 'comp_id', comp.as + '.id')))) dateColumns.push(comp.as + '.start_date');
        }
        if (!dateColumns.some(column => datePredicatesCover(predicates, column, scope.date!.from!, scope.date!.to!))) return false;
      }
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

export function attendanceScopeError(scope: AttendanceScope | undefined, call: {tool: string; from?: string; to?: string; query?: unknown}, viewerWcaId?: string): string | undefined {
  if (!scope) return;
  if (call.tool === 'analysis_query') {
    if (analysisMatchesScope(scope, call.query, viewerWcaId) !== false) return;
    return 'The analysis includes rows outside the active personal-attendance scope: ' + JSON.stringify(scope)
      + '. Apply the requested wca_id, event_id and comp_date constraints as global AND predicates in WHERE of each raw results/attempts input, including CTE base steps, before any aggregation. A FILTER on only one aggregate is insufficient. For a calendar year use year(comp_date)=year or >= start and < next year. Do not include an unrequested lifetime/all-event total or comparison. Return only the active scope.';
  }
  if (!['person', 'person_countries', 'person_competitions'].includes(call.tool)) return;
  if (call.tool === 'person_competitions' && !scope.event && scope.date?.from && scope.date.to && call.from === scope.date.from && call.to === scope.date.to) return;
  return 'This tool cannot answer the active personal-attendance scope. Retain these user constraints: '
    + [...new Set([scope.date?.text, scope.event?.text].filter(Boolean))].join(' / ')
    + '. Do not substitute lifetime/all-event totals. Use analysis_schema then analysis_query with the required person, date and event filters; person_competitions is allowed only for date-only scope with matching from/to. These constraints are user context, not factual evidence.';
}
