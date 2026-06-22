// NOTE: 预生成 JSON 的前端类型契约
// 产出方：
//   - all_upcoming_comps.json ← stats-build/src/bin/fetch_upcoming_comps.ts 的 buildAllUpcomingComps()
//   - all_past_comps.json     ← core/packages/stats-build/src/bin/gen_all_comps.ts

import { statsUrl } from './stats-base';

/**
 * 单个项目 round-1 的 WCIF 配置（紧凑编码，字段缺省即表示无）。
 * 来源：未来比赛走 WCIF 公开端点；过去比赛走 WCA developer dump 的 rounds + competition_events 表
 * （两边 JSON 形状一致）。键尽量短以压体积（过去比赛 ~13 万行）。
 */
export interface RoundMeta {
  tl?: number;            // timeLimit.centiseconds
  cum?: 1;                // timeLimit.cumulativeRoundIds 非空（累计计时）
  co?: [number, number];  // cutoff [numberOfAttempts, attemptResult]
  adv?: string;           // advancementCondition: "r24"=ranking 24 / "p75"=percent 75% / "a1500"=attemptResult 1500
  q?: string;             // qualification "type:resultType:level"（level 可空字符串）
}

/** comp id → (event 短码 → round-1 meta)。大文件、按需懒加载：stats/comp_round_meta.json（过去比赛） */
export type CompRoundMetaMap = Record<string, Record<string, RoundMeta>>;

export interface UpcomingCompRecord {
  id: string;
  name: string;
  city: string;
  country: string;           // ISO 3166-1 alpha-2
  start_date: string;        // YYYY-MM-DD
  end_date: string;
  events: string[];          // 短名，见 EVENT_DISPLAY_ORDER
  competitor_limit: number;
  registration_open?: string | null;   // ISO 8601 UTC, e.g. "2026-04-01T18:00:00.000Z"
  registration_close?: string | null;
  /** 项目修改截止时刻（ISO 8601 UTC，单场端点专属，列表端点不返回，由管道逐场回填）；缺为 null */
  event_change_deadline?: string | null;
  latitude_degrees: number;
  longitude_degrees: number;
  url: string;
  /** event 短码 → 该项目轮次数（来自 WCIF 公开端点）；老 dump 缺时为空对象 */
  rounds?: Record<string, number>;
  /** event 短码 → 该项目报名人数（WCIF persons[].registration.eventIds 聚合）；老 dump 缺省 */
  event_regs?: Record<string, number>;
  /** 已接受报名人数（WCIF accepted persons 总数）；满员 = registered >= competitor_limit；老 dump 缺省 */
  registered?: number;
  /** event 短码 → round-1 WCIF 配置（限时/及格/晋级/资格）；未来比赛内联（量小）；老 dump 缺省 */
  round_meta?: Record<string, RoundMeta>;
}

export interface PastCompRecord {
  id: string;
  name: string;
  city: string;
  country: string;           // ISO 3166-1 alpha-2(多地代码为 XA/XE/.../XW)
  /** 多地代码（XW/XA/XE/...）为 null — 没有真实地理坐标，Globe 端按 != null 过滤 */
  latitude_degrees: number | null;
  longitude_degrees: number | null;
  start_date: string;
  end_date: string;
  events: string[];
  /** event 短码 → 该项目轮次数（含资格 / 决赛全部）；老 dump 没有这字段时缺省 */
  rounds?: Record<string, number>;
  /** 实际参赛人数（results 表 DISTINCT person_id）；老 dump 缺省 */
  competitors?: number;
  /** 人数上限（competitions.competitor_limit）；0 / 缺省 = 无上限 */
  competitor_limit?: number;
  /** event 短码 → 该项目实际参赛人数（results 按 event DISTINCT person_id）；老 dump 缺省 */
  event_regs?: Record<string, number>;
}

export async function fetchAllUpcomingCompsJson(): Promise<UpcomingCompRecord[]> {
  const r = await fetch(statsUrl('/stats/all_upcoming_comps.json'));
  if (!r.ok) throw new Error(`all_upcoming_comps ${r.status}`);
  return r.json() as Promise<UpcomingCompRecord[]>;
}

export async function fetchAllPastCompsJson(): Promise<PastCompRecord[]> {
  const r = await fetch(statsUrl('/stats/all_past_comps.json'));
  if (!r.ok) throw new Error(`all_past_comps ${r.status}`);
  return r.json() as Promise<PastCompRecord[]>;
}

/** 过去比赛的 round-1 meta 大文件（~5MB）；仅列表视图选中限时/及格/晋级/资格时按需加载 */
export async function fetchCompRoundMetaJson(): Promise<CompRoundMetaMap> {
  const r = await fetch(statsUrl('/stats/comp_round_meta.json'));
  if (!r.ok) throw new Error(`comp_round_meta ${r.status}`);
  return r.json() as Promise<CompRoundMetaMap>;
}
