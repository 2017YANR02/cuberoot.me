// /scramble/stats 难度页 3x3 族「各国占比条」数据:每 (变体,阶段,底色,步数) 的 top 国家计数。
// 键 = WCA country_id(= comp_countries.json 的值;compCountryId(compId) 相等比较筛选)。目前只含合并 WCA 池 'wca'。
// 生产端:scramble-stats-build/src/build.ts(改 shape 必须两处同步 + bump V)。懒加载(点柱才拉),缺失优雅降级。
import { statsUrl } from '@/lib/stats-base';

// sets[setKey][variant][stage][subset][bin] = { country_id: count }
export interface ScrambleCountryDistJson {
  meta: { generated_at: string };
  sets: Record<string,
    Record<string,
      Record<string,
        Record<string,
          Record<string, Record<string, number>>>>>>;
}

// shape 变更或数据全量重灌时 bump(防缓存旧 JSON)
const V = '20260709';

export async function fetchScrambleCountryDist(): Promise<ScrambleCountryDistJson> {
  const r = await fetch(statsUrl('/stats/scramble/scramble_country_dist.json') + `?v=${V}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<ScrambleCountryDistJson>;
}
