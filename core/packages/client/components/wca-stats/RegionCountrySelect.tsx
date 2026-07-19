'use client';

// 排名页国家筛选:复用 comp 页的 RegionPicker(带「大洲 / 地区」分组),
// 适配本页 country 取值约定 —— '' = 全球 / WCA continent_id(以 _ 开头,如 _Asia)= 大洲 / 否则 WCA 国家 id。
// RegionPicker 单选内部用 iso2(小写)+ 大洲 slug,这里在边界双向映射,对外仍暴露与 CountrySelect 同款接口。
import { useMemo } from 'react';
import { RegionPicker } from '@/components/RegionPicker/RegionPicker';
import type { CountryOption } from './useCountries';
import { tr } from '@/i18n/tr';

// RegionPicker 大洲 slug ↔ WCA continent_id(DB / 后端口径)。
const SLUG_TO_CONTINENT_ID: Record<string, string> = {
  africa: '_Africa',
  asia: '_Asia',
  europe: '_Europe',
  northAmerica: '_North America',
  oceania: '_Oceania',
  southAmerica: '_South America',
};
const CONTINENT_ID_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SLUG_TO_CONTINENT_ID).map(([slug, id]) => [id, slug]),
);

interface Props {
  countries: CountryOption[];
  value: string;
  isZh: boolean;
  onChange: (id: string) => void;
}

export default function RegionCountrySelect({ countries, value, isZh, onChange }: Props) {
  const byId = useMemo(() => new Map(countries.map(c => [c.id, c])), [countries]);
  const byIso2 = useMemo(
    () => new Map(countries.filter(c => c.iso2).map(c => [c.iso2!.toLowerCase(), c])),
    [countries],
  );
  const restrictTo = useMemo(
    () => countries.map(c => c.iso2).filter((x): x is string => !!x),
    [countries],
  );

  // country(WCA id / continent_id / '')→ RegionPicker 单选值('world' / slug / iso2 小写)
  const rpValue = !value
    ? 'world'
    : value.startsWith('_')
      ? (CONTINENT_ID_TO_SLUG[value] ?? 'world')
      : (byId.get(value)?.iso2?.toLowerCase() ?? 'world');

  const handleChange = (v: string) => {
    if (!v || v === 'world') { onChange(''); return; }
    if (SLUG_TO_CONTINENT_ID[v]) { onChange(SLUG_TO_CONTINENT_ID[v]); return; }
    // iso2 → WCA 国家 id(后端 resolveCountry 也认 iso2,但本页其余逻辑按 id 查表,统一回写 id)
    onChange(byIso2.get(v.toLowerCase())?.id ?? '');
  };

  return (
    <div className="wse-filter wse-country">
      <label>{tr({ zh: '国家', en: 'Country' })}</label>
      <RegionPicker
        isZh={isZh}
        value={rpValue}
        onChange={handleChange}
        restrictTo={restrictTo}
        allLabel={tr({ zh: '全球', en: 'Worldwide' })}
        searchPlaceholder={tr({ zh: '搜索国家...', en: 'Search country...' })}
      />
    </div>
  );
}
