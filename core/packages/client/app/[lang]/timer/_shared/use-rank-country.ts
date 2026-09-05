'use client';

/**
 * useRankCountry — 排名徽章(RankBadge)用的「用户国家」iso2(大写).
 *
 * 有效账号国家优先，否则回退 settings.rankCountry 手选值。
 * 都没有则返回 ''，不查 CR/NR；PR 和 WR 不依赖国家。
 *
 * 只接受 2 字母 iso2,其它一律视为未设(返回 '').
 */
import { useAuthStore } from '@/lib/auth-store';
import { useSettings } from '../_lib/settings';

export function useRankCountry(): string {
  const settings = useSettings();
  const authCountry = useAuthStore((s) => s.user?.country ?? '');
  return [authCountry, settings.rankCountry ?? '']
    .map((country) => country.trim().toUpperCase())
    .find((country) => /^[A-Z]{2}$/.test(country)) ?? '';
}
