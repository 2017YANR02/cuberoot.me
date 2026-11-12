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
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(j => {
        if (!Array.isArray(j?.countries)) return;
        const countries = j.countries.filter((row: unknown): row is CountryOption =>
          row !== null && typeof row === 'object'
          && 'id' in row && typeof row.id === 'string'
          && 'name' in row && typeof row.name === 'string'
          && 'iso2' in row && (row.iso2 === null || typeof row.iso2 === 'string'));
        if (alive) setList(countries);
      })
      .catch(() => { /* leave empty */ });
    return () => { alive = false; };
  }, []);
  return list;
}
