'use client';

/**
 * useRankCountry — 排名徽章(RankBadge)用的「用户国家」iso2(大写).
 *
 * Solo / Battle 共用,避免重复:
 *   1. 登录了就用 WCA 账号的国家(auth-store 的 country = country_iso2)—— 账号是权威来源,
 *      设置面板在登录态下也不再显示手选项,所以旧的手填值不能反过来盖住账号国家
 *   2. 未登录时用 settings.rankCountry(设置里手填的)
 *   3. 都没有 -> 返回 ''(徽章只显 WR,不查 CR/NR)
 *
 * 只接受 2 字母 iso2,其它一律视为未设(返回 '').
 */
import { useAuthStore } from '@/lib/auth-store';
import { useSettings } from '../_lib/settings';

export function useRankCountry(): string {
  const settings = useSettings();
  const authCountry = useAuthStore((s) => s.user?.country ?? '');
  const c = (authCountry || settings.rankCountry || '').trim();
  return /^[A-Za-z]{2}$/.test(c) ? c.toUpperCase() : '';
}
