// NOTE: 预生成 JSON 的前端类型契约
// 产出方：
//   - all_upcoming_comps.json ← stats-build/src/bin/fetch_upcoming_comps.ts 的 buildAllUpcomingComps()
//   - all_past_comps.json     ← core/packages/stats-build/src/bin/gen_all_comps.ts

import { statsUrl } from './stats-base';

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
  latitude_degrees: number;
  longitude_degrees: number;
  url: string;
  /** event 短码 → 该项目轮次数（来自 WCIF 公开端点）；老 dump 缺时为空对象 */
  rounds?: Record<string, number>;
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
