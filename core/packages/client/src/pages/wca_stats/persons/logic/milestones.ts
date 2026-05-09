// 选手里程碑(milestone)规则.独立 TS 实现;输入只依赖 wca_api 暴露的 row / comp / profile 数据形态.
//
// 8 类里程碑(按截图所示):
//   first_competition         首次参赛
//   nth_competition           第 100 / 200 / ... 场
//   significant_improvement   单次或平均成绩相对历史最佳进步 ≥ threshold%
//   first_podium              第一次拿到 1/2/3 名(决赛轮)
//   first_blind_success       首次盲拧成功(333bf/444bf/555bf/333mbf 任一)
//   record_breaker            破 NR / CR(AsR/NAR/SAR/ER/AfR/OcR) / WR
//   grand_slam                完成所有 18 个现役 WCA 项目
//   comeback                  连续两场比赛间隔 ≥ 3 年

import type { WcaResultRow, WcaCompetition, WcaPersonProfile } from '../wca_api';

export type MilestoneType =
  | 'first_competition'
  | 'nth_competition'
  | 'significant_improvement'
  | 'first_podium'
  | 'first_blind_success'
  | 'record_breaker'
  | 'grand_slam'
  | 'comeback';

export interface Milestone {
  type: MilestoneType;
  date: string;                  // 'YYYY-MM-DD'
  /** 描述,允许 isZh 切换;调用方决定显示哪一个 */
  zh: string;
  en: string;
  tags: { kind: 'event' | 'comp' | 'time' | 'medal' | 'record'; label: string; iso2?: string; eventId?: string }[];
  /** 可选副信息(老→新成绩 等),给详情页或 hover 用 */
  note?: { zh: string; en: string };
}

const FINAL_ROUND_TYPES = new Set(['f', 'c', 'b']);

const ACTIVE_18_EVENTS = new Set([
  '333','222','444','555','666','777',
  '333bf','333fm','333oh',
  'minx','pyram','clock','skewb','sq1',
  '444bf','555bf','333mbf',
  '333oh',
]);
const BLIND_EVENTS = new Set(['333bf', '444bf', '555bf', '333mbf']);

const REGIONAL_LABELS: Record<string, { zh: string; en: string }> = {
  WR: { zh: 'WR 世界纪录', en: 'World Record' },
  AfR: { zh: 'AfR 非洲纪录', en: 'African Record' },
  AsR: { zh: 'AsR 亚洲纪录', en: 'Asian Record' },
  ER: { zh: 'ER 欧洲纪录', en: 'European Record' },
  NAR: { zh: 'NAR 北美纪录', en: 'N. American Record' },
  OcR: { zh: 'OcR 大洋洲纪录', en: 'Oceanic Record' },
  SAR: { zh: 'SAR 南美纪录', en: 'S. American Record' },
  NR: { zh: 'NR 国家纪录', en: 'National Record' },
};

interface BuildOpts {
  /** 进步幅度阈值(0-1).默认 0.33,与截图一致. */
  improvementThreshold: number;
  /** 项目 → 中文名(EVENT_ZH).调用方传入避免循环依赖. */
  eventZh: Record<string, string>;
  eventEn: Record<string, string>;
  /** comp.id → 显示名(已 localize). */
  compName: (compId: string) => string;
}

export function buildMilestones(
  profile: WcaPersonProfile,
  results: WcaResultRow[],
  comps: WcaCompetition[],
  opts: BuildOpts,
): Milestone[] {
  const list: Milestone[] = [];
  const { improvementThreshold, eventZh, eventEn, compName } = opts;
  const evName = (eid: string, isZh: boolean) =>
    (isZh ? eventZh[eid] : eventEn[eid]) ?? eid;

  const compById = new Map(comps.map((c) => [c.id, c]));
  const compsAsc = comps.slice().sort((a, b) => a.start_date.localeCompare(b.start_date));

  if (compsAsc.length === 0) return list;

  // 1) first_competition
  {
    const first = compsAsc[0]!;
    list.push({
      type: 'first_competition',
      date: first.start_date,
      zh: '首次参赛',
      en: 'First competition',
      tags: [{ kind: 'comp', label: compName(first.id) }],
    });
  }

  // 2) nth_competition (100 的倍数)
  for (let n = 100; n <= compsAsc.length; n += 100) {
    const c = compsAsc[n - 1]!;
    list.push({
      type: 'nth_competition',
      date: c.start_date,
      zh: `第 ${n} 场比赛`,
      en: `${ordinal(n)} competition`,
      tags: [{ kind: 'comp', label: compName(c.id) }],
    });
  }

  // 3) significant_improvement
  // 按时间升序扫描;对每个 (event, kind) 维护当前最佳;若新成绩较前最佳改进 ≥ threshold,生成里程碑.
  // 同一比赛 single 与 average 都达标 → 合并为一条.
  {
    type Best = { single: number; average: number };
    const best = new Map<string, Best>();
    const sorted = sortResultsByDate(results, compById);
    for (const r of sorted) {
      const key = r.event_id;
      const cur = best.get(key) ?? { single: 0, average: 0 };
      const newSingleOk = r.best > 0 && (cur.single === 0 || r.best < cur.single);
      const newAvgOk = r.average > 0 && (cur.average === 0 || r.average < cur.average);
      const singleImp = cur.single > 0 && newSingleOk
        ? (cur.single - r.best) / cur.single
        : 0;
      const avgImp = cur.average > 0 && newAvgOk
        ? (cur.average - r.average) / cur.average
        : 0;

      if (singleImp >= improvementThreshold || avgImp >= improvementThreshold) {
        const c = compById.get(r.competition_id);
        if (c) {
          const parts: string[] = [];
          if (singleImp >= improvementThreshold) parts.push(`单次 ${(singleImp * 100).toFixed(0)}%`);
          if (avgImp >= improvementThreshold) parts.push(`平均 ${(avgImp * 100).toFixed(0)}%`);
          const partsEn: string[] = [];
          if (singleImp >= improvementThreshold) partsEn.push(`single +${(singleImp * 100).toFixed(0)}%`);
          if (avgImp >= improvementThreshold) partsEn.push(`average +${(avgImp * 100).toFixed(0)}%`);
          list.push({
            type: 'significant_improvement',
            date: c.start_date,
            zh: `${evName(r.event_id, true)} 进步 ${parts.join(' / ')}`,
            en: `${evName(r.event_id, false)} progress ${partsEn.join(' / ')}`,
            tags: [
              { kind: 'event', label: evName(r.event_id, true), eventId: r.event_id },
              { kind: 'comp', label: compName(c.id) },
            ],
          });
        }
      }
      if (newSingleOk) cur.single = r.best;
      if (newAvgOk) cur.average = r.average;
      best.set(key, cur);
    }
  }

  // 4) first_podium  (per (event, kind=gold/silver/bronze))
  {
    const seen = new Set<string>();
    const sorted = sortResultsByDate(results, compById);
    for (const r of sorted) {
      if (!FINAL_ROUND_TYPES.has(r.round_type_id)) continue;
      if (r.pos < 1 || r.pos > 3) continue;
      const key = `${r.event_id}:${r.pos}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const c = compById.get(r.competition_id);
      if (!c) continue;
      const medalZh = r.pos === 1 ? '金牌' : r.pos === 2 ? '银牌' : '铜牌';
      const medalEn = r.pos === 1 ? 'gold' : r.pos === 2 ? 'silver' : 'bronze';
      list.push({
        type: 'first_podium',
        date: c.start_date,
        zh: `首次在 ${evName(r.event_id, true)} 项目获得${medalZh}`,
        en: `First ${medalEn} in ${evName(r.event_id, false)}`,
        tags: [
          { kind: 'medal', label: medalZh },
          { kind: 'event', label: evName(r.event_id, true), eventId: r.event_id },
          { kind: 'comp', label: compName(c.id) },
        ],
      });
    }
  }

  // 5) first_blind_success — 每个 BF 项目首次成功(best > 0)
  {
    const seen = new Set<string>();
    const sorted = sortResultsByDate(results, compById);
    for (const r of sorted) {
      if (!BLIND_EVENTS.has(r.event_id)) continue;
      if (seen.has(r.event_id)) continue;
      // 该比赛存在 best > 0 的尝试 = 首次成功
      if (r.best <= 0) continue;
      seen.add(r.event_id);
      const c = compById.get(r.competition_id);
      if (!c) continue;
      list.push({
        type: 'first_blind_success',
        date: c.start_date,
        zh: `${evName(r.event_id, true)} 首次成功`,
        en: `First valid ${evName(r.event_id, false)}`,
        tags: [
          { kind: 'event', label: evName(r.event_id, true), eventId: r.event_id },
          { kind: 'comp', label: compName(c.id) },
        ],
      });
    }
  }

  // 6) record_breaker — 来自 personal_records.regional_*record(WCA API 不直接给历史 record 标记,需要扫 results)
  // 这里走轻量启发式:profile.records 计数告诉我们破过几次,但不知具体在哪;
  // 真正的 record breaker 由历史排名 API 后端计算更准.前端就用 result 行的 regional_single_record / regional_average_record 字段(若 API 返回).
  for (const r of results) {
    const sr = (r as unknown as { regional_single_record?: string | null }).regional_single_record;
    const ar = (r as unknown as { regional_average_record?: string | null }).regional_average_record;
    const c = compById.get(r.competition_id);
    if (!c) continue;
    if (sr && REGIONAL_LABELS[sr]) {
      list.push({
        type: 'record_breaker',
        date: c.start_date,
        zh: `${evName(r.event_id, true)} 单次破 ${sr}`,
        en: `${evName(r.event_id, false)} single ${REGIONAL_LABELS[sr].en}`,
        tags: [
          { kind: 'record', label: sr },
          { kind: 'event', label: evName(r.event_id, true), eventId: r.event_id },
          { kind: 'comp', label: compName(c.id) },
        ],
      });
    }
    if (ar && REGIONAL_LABELS[ar]) {
      list.push({
        type: 'record_breaker',
        date: c.start_date,
        zh: `${evName(r.event_id, true)} 平均破 ${ar}`,
        en: `${evName(r.event_id, false)} average ${REGIONAL_LABELS[ar].en}`,
        tags: [
          { kind: 'record', label: ar },
          { kind: 'event', label: evName(r.event_id, true), eventId: r.event_id },
          { kind: 'comp', label: compName(c.id) },
        ],
      });
    }
  }

  // 7) grand_slam — 完成所有 18 个现役项目(以 best > 0 或 average > 0 为完成)
  {
    const doneAt = new Map<string, { date: string; compId: string }>();
    const sorted = sortResultsByDate(results, compById);
    for (const r of sorted) {
      if (!ACTIVE_18_EVENTS.has(r.event_id)) continue;
      if (r.best <= 0) continue;
      if (doneAt.has(r.event_id)) continue;
      const c = compById.get(r.competition_id);
      if (!c) continue;
      doneAt.set(r.event_id, { date: c.start_date, compId: c.id });
    }
    if (doneAt.size === ACTIVE_18_EVENTS.size) {
      let latest = { date: '', compId: '' };
      for (const v of doneAt.values()) {
        if (v.date > latest.date) latest = v;
      }
      list.push({
        type: 'grand_slam',
        date: latest.date,
        zh: '大满贯 — 完成全部 18 个现役项目',
        en: 'Grand Slam — completed all 18 active events',
        tags: [{ kind: 'comp', label: compName(latest.compId) }],
      });
    }
  }

  // 8) comeback — 任意两场相邻比赛间隔 ≥ 1095 天
  for (let i = 1; i < compsAsc.length; i++) {
    const prev = compsAsc[i - 1]!;
    const cur = compsAsc[i]!;
    const days = daysBetween(prev.start_date, cur.start_date);
    if (days >= 365 * 3) {
      list.push({
        type: 'comeback',
        date: cur.start_date,
        zh: `回归 — 距上场 ${Math.floor(days / 365)} 年`,
        en: `Comeback after ${Math.floor(days / 365)} years`,
        tags: [{ kind: 'comp', label: compName(cur.id) }],
      });
    }
  }

  // 用 profile 来对里程碑做轻校验(不出错才说明 API 数据完整;无操作).
  void profile;

  return list;
}

function sortResultsByDate(
  results: WcaResultRow[],
  compById: Map<string, WcaCompetition>,
): WcaResultRow[] {
  return results.slice().sort((a, b) => {
    const da = compById.get(a.competition_id)?.start_date ?? '';
    const db = compById.get(b.competition_id)?.start_date ?? '';
    if (da !== db) return da.localeCompare(db);
    return a.id - b.id;
  });
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso + 'T00:00:00Z').getTime();
  const b = new Date(bIso + 'T00:00:00Z').getTime();
  return Math.floor((b - a) / 86400000);
}
