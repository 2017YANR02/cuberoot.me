'use client';

/**
 * useRankCountry — 排名徽章(RankBadge)用的「用户国家」iso2(大写).
 *
 * 与账号页共用 WCA 选手国家表，账号国家缺失时回退 settings.rankCountry 手选值。
 * 都没有则返回 ''，不查 CR/NR；PR 和 WR 不依赖国家。
 *
 * 只接受 2 字母 iso2,其它一律视为未设(返回 '').
 */
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { loadFlagData, personFlagIso2 } from '@/lib/country-flags';
import { WCA_ID_REGEX } from '@/lib/wca-api';
import { useSettings } from '../_lib/settings';

export function useRankCountry(): { country: string; accountCountry: string } {
  const settings = useSettings();
  const user = useAuthStore((s) => s.user);
  const wcaId = user?.wcaId?.trim().toUpperCase() ?? '';
  const [, setFlagVersion] = useState(0);
  useEffect(() => {
    if (!WCA_ID_REGEX.test(wcaId)) return;
    let cancelled = false;
    void loadFlagData().then((version) => {
      if (!cancelled) setFlagVersion(version);
    });
    return () => { cancelled = true; };
  }, [wcaId]);

  const accountCountry = [WCA_ID_REGEX.test(wcaId) ? personFlagIso2(wcaId) : '', user?.country ?? '']
    .map((country) => country.trim().toUpperCase())
    .find((country) => /^[A-Z]{2}$/.test(country)) ?? '';
  const manualCountry = (settings.rankCountry ?? '').trim().toUpperCase();
  return {
    country: accountCountry || (/^[A-Z]{2}$/.test(manualCountry) ? manualCountry : ''),
    accountCountry,
  };
}
