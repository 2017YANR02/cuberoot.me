'use client';

// 排名页国家筛选:复用 comp 页的 RegionPicker(带「大洲 / 地区」分组),
// 适配本页 country 取值约定 —— '' = 全球 / WCA continent_id(以 _ 开头,如 _Asia)= 大洲 / 否则 WCA 国家 id。
// RegionPicker 单选内部用 iso2(小写)+ 大洲 slug,这里在边界双向映射,对外仍暴露与 CountrySelect 同款接口。
import { useMemo } from 'react';
import { RegionPicker } from '@/components/RegionPicker/RegionPicker';
import type { CountryOption } from './useCountries';
import { tr } from '@/i18n/tr';
import { countryToIso2 } from '@/lib/country-flags';

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

export function countryToRecordRegion(value: string, countries: CountryOption[]): string {
  if (!value) return 'world';
  if (value.startsWith('_')) return CONTINENT_ID_TO_SLUG[value] ?? 'world';
  return countries.find(c => c.id === value || c.iso2?.toLowerCase() === value.toLowerCase())?.iso2?.toLowerCase()
    || countryToIso2(value) || value;
}

export function recordRegionToCountry(region: string, countries: CountryOption[]): string {
  if (!region || region === 'world') return '';
  return SLUG_TO_CONTINENT_ID[region]
    ?? countries.find(c => c.iso2?.toLowerCase() === region.toLowerCase())?.id ?? region;
}

interface Props {
  hideLabel?: boolean;
  countries: CountryOption[];
  value: string;
  isZh: boolean;
  onChange: (id: string) => void;
}

export default function RegionCountrySelect({ countries, value, isZh, onChange, hideLabel = false }: Props) {
  const restrictTo = useMemo(
    () => countries.map(c => c.iso2).filter((x): x is string => !!x),
    [countries],
  );

  const rpValue = countryToRecordRegion(value, countries);
  const handleChange = (region: string) => onChange(recordRegionToCountry(region, countries));

  return (
    <div className="wse-filter wse-country">
      <label className={hideLabel ? 'sr-only' : undefined}>{tr({ zh: '国家', en: 'Country' })}</label>
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
