// NOTE: 预生成 JSON 的前端类型契约
// 产出方：
//   - all_upcoming_comps.json ← scripts/fetch_upcoming_comps.py 的 build_all_upcoming_comps()
//   - all_past_comps.json     ← core/packages/stats-build/src/bin/gen_all_comps.ts

export interface UpcomingCompRecord {
  id: string;
  name: string;
  city: string;
  country: string;           // ISO 3166-1 alpha-2
  start_date: string;        // YYYY-MM-DD
  end_date: string;
  events: string[];          // 短名，见 EVENT_DISPLAY_ORDER
  competitor_limit: number;
  latitude_degrees: number;
  longitude_degrees: number;
  url: string;
}

export interface PastCompRecord {
  id: string;
  name: string;
  city: string;
  country: string;
  latitude_degrees: number;
  longitude_degrees: number;
  start_date: string;
  end_date: string;
  events: string[];
}

export async function fetchAllUpcomingCompsJson(): Promise<UpcomingCompRecord[]> {
  const r = await fetch('/stats/data/all_upcoming_comps.json');
  if (!r.ok) throw new Error(`all_upcoming_comps ${r.status}`);
  return r.json() as Promise<UpcomingCompRecord[]>;
}

export async function fetchAllPastCompsJson(): Promise<PastCompRecord[]> {
  const r = await fetch('/stats/data/all_past_comps.json');
  if (!r.ok) throw new Error(`all_past_comps ${r.status}`);
  return r.json() as Promise<PastCompRecord[]>;
}
