// 「去过的省份」聚合:中国比赛按省份(从 WCA comp.city 串解析),国外比赛按国家/地区。
// 复刻 cubingchina visitedProvinces。HK/Macau/Taiwan 走自己的 country_iso2(hk/mo/tw)落国家分支,
// 与 cubingchina「province_id 2/3/4 排除出大陆省份」效果一致。
//
// 省份来源:WCA cityName 对中国比赛是「城市, 省份」(直辖市裸名,偶有 " Province" 后缀 / 裸城市)。
// 逐段规范化后查 CN_PLACE_PROVINCE(城市 + 省份都收录,源自 cubingchina region 种子表)。
// 查不到(多地点比赛 / 新城市)回退到国家「中国」,不丢数据。

import { countryName } from '@/lib/country-name';
import { CN_PLACE_PROVINCE } from '@/lib/data/cn-region';
import type { WcaCompetition } from '@/lib/wca-person-api';

export interface RegionStat {
  key: string;
  label: string;
  iso2: string | null; // 国家分支带该国旗;中国省份分支带 CN 国旗;XW/X* 伪代码为 null
  count: number;
}

// 与 gen-cn-region.mjs 必须同一套规范化
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

function cnProvince(city: string): { zh: string; en: string } | null {
  if (!city) return null;
  for (const seg of city.split(',')) {
    const hit = CN_PLACE_PROVINCE[norm(seg)];
    if (hit) return hit;
  }
  return CN_PLACE_PROVINCE[norm(city)] ?? null;
}

export function buildRegionStats(comps: WcaCompetition[], isZh: boolean): RegionStat[] {
  const m = new Map<string, RegionStat>();
  for (const c of comps) {
    const iso2 = (c.country_iso2 || '').toUpperCase();
    const prov = iso2 === 'CN' ? cnProvince(c.city || '') : null;
    let key: string;
    let label: string;
    let flag: string | null;
    if (prov) {
      key = `P:${prov.en}`;
      // 国际站语境下省份单写「广东」歧义,统一加中国国旗 + 「中国」前缀
      label = isZh ? `中国${prov.zh}` : `${prov.en}, China`;
      flag = 'CN';
    } else {
      key = `C:${iso2}`;
      label = iso2 ? countryName(iso2, isZh) : '—';
      // WCA 多国/大洲伪代码(XW 全球 / XA-XO 各洲,如 FMC 同时多国)无国旗,只显名称
      flag = iso2 && !iso2.startsWith('X') ? iso2 : null;
    }
    const cur = m.get(key);
    if (cur) cur.count++;
    else m.set(key, { key, label, iso2: flag, count: 1 });
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
