'use client';

// WCA 国家列表:从 historical-ranks/countries 端点拉全量国家(id / iso2 / 本地化名 / 大洲)。
// 供各 WCA 统计页的国家 / 大洲筛选器(RegionCountrySelect)与页面查表共用。
import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api-base';

export interface CountryOption {
  id: string;
  iso2: string | null;
  name: string;
  continentId?: string;
}

export function useCountries(): CountryOption[] {
  const [list, setList] = useState<CountryOption[]>([]);
  useEffect(() => {
    let alive = true;
    fetch(apiUrl('/v1/wca/historical-ranks/countries'))
      .then(r => r.json())
      .then((j: { countries: CountryOption[] }) => { if (alive) setList(j.countries); })
      .catch(() => { /* leave empty */ });
    return () => { alive = false; };
  }, []);
  return list;
}
