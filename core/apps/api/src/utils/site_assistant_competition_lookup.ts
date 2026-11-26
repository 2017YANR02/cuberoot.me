import { isKnownCompetitionCity } from '@cuberoot/shared/city-localize';
import { resolveAssistantTime, type AssistantAnswer } from '@cuberoot/shared/site-assistant';
import { competitionRoundTiming } from './site_assistant_competition_schedule.js';
import { toolCallSchema, type AssistantToolCall, type ToolResult } from './site_assistant_tools.js';

import { readAssistantBatch } from './site_assistant_execution.js';

const LOOKUP_LIMIT = 3;

/** Narrow direct path. Other date/place phrasing still has access to the same read tools. */
export function weekendCompetitionRequest(question: string) {
  const [search, timing, previous, ...extra] = question.normalize('NFKC').trim().split(/[?？。；;\n]+/).map(part => part.trim()).filter(Boolean);
  if (!search || extra.length) return;
  const placeAndDate = /^(?:请问[，, ]*)?([\p{Script=Han}\s]{4,28}?)\s*(?:有(?:哪[些几](?:场|个)?|什么)?|哪[些几](?:场|个)?)\s*(?:WCA\s*)?(?:(?:还)?(?:能|可以|可)\s*报名的\s*(?:WCA\s*)?(?:正式)?比赛|(?:正式)?比赛\s*(?:目前\s*|现在\s*)?(?:还)?(?:能|可以|可)\s*报名)$/iu.exec(search)?.[1].trim();
  if (!placeAndDate) return;
  const dateFirst = /^(本周末|这(?:个)?周末|周末|下(?:个)?周末)\s*(?:在\s*)?([\p{Script=Han}]{2,14})$/u.exec(placeAndDate);
  const cityFirst = /^([\p{Script=Han}]{2,14}?)\s*(本周末|这(?:个)?周末|周末|下(?:个)?周末)$/u.exec(placeAndDate);
  const city = dateFirst?.[2] ?? cityFirst?.[1];
  const phrase = dateFirst?.[1] ?? cityFirst?.[2];
  if (!city || !phrase) return;
  if (!isKnownCompetitionCity(city)) return;
  const roundTiming = timing ? competitionRoundTiming(timing) : undefined;
  if (timing && (!roundTiming?.event || /几组|报名|候补|名额|教程|练习/.test(timing))) return;
  const latest = !!previous && /^(?:我)?(?:上次|最近一次)(?:参加(?:过)?的|参赛的)那场(?:比赛)?(?:呢|怎么样)?$/.test(previous);
  if (previous && !latest) return;
  return { phrase, city, roundTiming, latest };
}

type WeekendRequest = NonNullable<ReturnType<typeof weekendCompetitionRequest>>;
type WeekendCall = Extract<AssistantToolCall, { tool: 'competitions' | 'competition_schedule' | 'person_competitions' }>;
type Run = (call: WeekendCall) => Promise<ToolResult>;
type Candidate = { id: string; name: string };

export async function weekendCompetitionAnswer(
  request: WeekendRequest, when: ReturnType<typeof resolveAssistantTime>, lang: 'zh' | 'en', run: Run, viewerWcaId?: string, signal?: AbortSignal,
): Promise<AssistantAnswer | undefined> {
  const phrase = request.phrase === '周末' ? '本周末' : request.phrase;
  const period = when.periods.find(period => period.unit === 'weekend' && period.phrase === phrase);
  if (!period) return;
  const label = (zh: string, en: string) => ({ zh, en })[lang];
  const catalogCall = { tool: 'competitions', query: '', upcoming: true, city: request.city, country: '', from: period.start, to: period.end, limit: LOOKUP_LIMIT } as const;
  const readLatest = request.latest && viewerWcaId
    ? run({ tool: 'person_competitions', wcaId: viewerWcaId, view: 'latest' }) : undefined;
  const [catalog, latest] = await Promise.allSettled([run(catalogCall), readLatest]);
  const answer: AssistantAnswer = { answer: '', sources: [], artifacts: [], actions: [] };
  const lines = [label(`${request.city} · ${period.start} 至 ${period.end}`, `${request.city} · ${period.start} to ${period.end}`)];
  const add = (result: ToolResult, includeTables: boolean) => {
    answer.sources.push(...result.sources);
    if (includeTables) answer.artifacts!.push(...result.artifacts);
  };
  const checkSchedule = async (candidate: Candidate, registration: boolean) => {
    const call = toolCallSchema.safeParse({ tool: 'competition_schedule', compId: candidate.id, ...request.roundTiming, schedule: !!request.roundTiming, registration });
    if (!call.success || call.data.tool !== 'competition_schedule') return;
    return run(call.data);
  };
  const addSchedule = (candidate: Candidate, result: ToolResult) => {
    add(result, true);
    for (const {id, title, href} of result.sources) answer.actions!.push({id, title, href});
    lines.push(result.factualSummary?.replace(/^[^\n]+? · /, `${candidate.name} · `) ?? candidate.name);
  };
  if (catalog.status === 'fulfilled') {
    const { competitions, total } = catalog.value.evidence as { competitions: Candidate[]; total: number };
    add(catalog.value, false);
    if (!competitions.length) lines.push(label('已导入的赛事目录中没有找到该城市和日期匹配的比赛。', 'No matching competition appears in the imported catalog for this city and date.'));
    // Bound concurrent official reads, even on a weekend with many candidate events.
    let verifiedOpen = false;
    const results = await readAssistantBatch(competitions, 2, candidate => checkSchedule(candidate, true), signal);
    for (const [index, result] of results.entries()) {
      const candidate = competitions[index];
      if (result.status === 'fulfilled' && result.value) {
        const { registrationState } = result.value.evidence as { registrationState?: string };
        verifiedOpen ||= registrationState === 'open';
        addSchedule(candidate, result.value);
      }
      else lines.push(label(`${candidate.name} 的公开资料暂时无法核实。`, `Could not verify ${candidate.name} right now.`));
    }
    if (competitions.length && !verifiedOpen) lines.push(label('本次核对暂未确认有仍可线上报名的赛事。', 'This check did not confirm any competition still open for online entry.'));
    if (total > competitions.length) lines.push(label(`赛事目录还有 ${total - competitions.length} 场匹配赛事，报名和赛程未逐一核实。`, `${total - competitions.length} other catalog matches were not individually checked.`));
  } else {
    lines.push(label('暂时读不到赛事目录，请稍后再试。', 'The competition catalog could not be retrieved right now.'));
  }
  if (request.latest) {
    if (!viewerWcaId) lines.push(label('绑定 WCA ID 后可以查询你最近一场有正式成绩的比赛。', 'Link a WCA ID to look up your latest competition with official results.'));
    else if (latest.status !== 'fulfilled' || !latest.value) lines.push(label('暂时读不到你的正式参赛记录。', 'Your official competition history could not be retrieved right now.'));
    else {
      const evidence = latest.value.evidence as { latest: Candidate[]; updated?: string; unknownDateCompetitions: number };
      add(latest.value, true);
      const citation = `[[${latest.value.sources[0].id}]]`;
      lines.push(evidence.latest.length
        ? label(`最近有正式成绩的赛事按比赛开始日期判断。 ${citation}`, `The latest competition with official results is determined by its start date. ${citation}`)
        : label(`已导入的记录中没有带有效日期的正式参赛成绩。 ${citation}`, `No dated official competition result appears in the imported records. ${citation}`));
      if (typeof evidence.updated === 'string' && Number.isFinite(Date.parse(evidence.updated))) lines.push(label(`成绩数据最近导入于 ${evidence.updated.slice(0, 10)}。`, `Results were last imported on ${evidence.updated.slice(0, 10)}.`));
      if (evidence.unknownDateCompetitions) lines.push(label('部分历史记录缺少日期，无法确认它们的先后顺序。', 'Some past records lack dates, so their order is unknown.'));
      if (request.roundTiming && evidence.latest.length === 1 && !evidence.unknownDateCompetitions) {
        const candidate = evidence.latest[0];
        const result = await checkSchedule(candidate, false).catch(() => undefined);
        if (result) addSchedule(candidate, result);
        else lines.push(label(`${candidate.name} 的历史赛程暂时无法核实。`, `The past schedule for ${candidate.name} could not be verified.`));
      } else if (request.roundTiming && evidence.latest.length > 1) {
        lines.push(label('有多场比赛同日开始，请选一场查看该项目的赛程。', 'Multiple competitions started on the same date. Choose one to view its event schedule.'));
      }
    }
  }
  answer.answer = lines.join('\n\n');
  return answer;
}
