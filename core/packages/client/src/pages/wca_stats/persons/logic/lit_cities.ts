// 选手 "点亮城市":根据他参赛过的 comps,聚合到 (country / city) 粒度并查 lat/lon.
// lat/lon 来自 stats/all_past_comps.json(同站现成数据,GlobePage 已用).

import type { WcaCompetition } from '../wca_api';

export interface CompGeoIndex {
  /** comp.id → lat/lng/country/cityRaw */
  index: Map<string, { lat: number; lng: number; country_iso2: string; city: string }>;
}

export interface LitCity {
  iso2: string;
  city: string;
  count: number;
  lat: number;
  lng: number;
  /** 该国家累积 count(给 globe altitude 用) */
  countryCount: number;
}

export interface LitCountry {
  iso2: string;
  count: number;
  /** 国家中心(选手参赛城市的均值;无定位时用 0/0) */
  lat: number;
  lng: number;
}

export function buildLitFromComps(
  attended: WcaCompetition[],
  geo: CompGeoIndex | null,
): { cities: LitCity[]; countries: LitCountry[] } {
  // 先按 (iso2, city) 聚合
  const byCity = new Map<string, { iso2: string; city: string; count: number; lats: number[]; lngs: number[] }>();
  const byCountry = new Map<string, { iso2: string; count: number; lats: number[]; lngs: number[] }>();

  for (const c of attended) {
    const iso2 = c.country_iso2 || '';
    const city = c.city || '';
    const g = geo?.index.get(c.id);
    const lat = g?.lat ?? Number.NaN;
    const lng = g?.lng ?? Number.NaN;

    const cityKey = `${iso2}::${city}`;
    const cur = byCity.get(cityKey) ?? { iso2, city, count: 0, lats: [], lngs: [] };
    cur.count++;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      cur.lats.push(lat);
      cur.lngs.push(lng);
    }
    byCity.set(cityKey, cur);

    const cn = byCountry.get(iso2) ?? { iso2, count: 0, lats: [], lngs: [] };
    cn.count++;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      cn.lats.push(lat);
      cn.lngs.push(lng);
    }
    byCountry.set(iso2, cn);
  }

  const countries: LitCountry[] = [...byCountry.values()].map((v) => ({
    iso2: v.iso2,
    count: v.count,
    lat: v.lats.length ? avg(v.lats) : 0,
    lng: v.lngs.length ? avg(v.lngs) : 0,
  }));

  const countryCount = new Map(countries.map((c) => [c.iso2, c.count]));

  const cities: LitCity[] = [...byCity.values()]
    .map((v) => ({
      iso2: v.iso2,
      city: v.city,
      count: v.count,
      lat: v.lats.length ? avg(v.lats) : 0,
      lng: v.lngs.length ? avg(v.lngs) : 0,
      countryCount: countryCount.get(v.iso2) ?? v.count,
    }))
    .sort((a, b) => b.count - a.count);

  countries.sort((a, b) => b.count - a.count);

  return { cities, countries };
}

function avg(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
