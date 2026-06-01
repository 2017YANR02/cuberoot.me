'use client';

/**
 * useRankCountry — 排名徽章(RankBadge)用的「用户国家」iso2(大写).
 *
 * Solo / Battle 共用,避免重复:
 *   1. 优先 settings.rankCountry(用户在设置里手选的)
 *   2. 否则回退登录 WCA 账号的国家(auth-store 的 country = country_iso2)
 *   3. 都没有 -> 返回 ''(徽章只显 WR,不查 CR/NR)
 *
 * 只接受 2 字母 iso2,其它一律视为未设(返回 '').
 */
import { useAuthStore } from '@/lib/auth-store';
import { useSettings } from '../_lib/settings';

export function useRankCountry(): string {
  const settings = useSettings();
  const authCountry = useAuthStore((s) => s.user?.country ?? '');
  const c = (settings.rankCountry || authCountry || '').trim();
  return /^[A-Za-z]{2}$/.test(c) ? c.toUpperCase() : '';
}
