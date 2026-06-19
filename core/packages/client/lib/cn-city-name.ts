// 比赛城市名按段本地化(/zh)。历史上仅大中华区,现统一委托 localizeCity 的全段译逻辑
// (大中华区 + 全球字典 + 兜底)。保留此入口名,选手页「点亮城市」等仍 import 它。
import { localizeCity } from '@/lib/city-localize';

/** 把「City, Province」逐段译成简体(查不到的段保留原文);EN 或缺译时原样返回。 */
export function localizeCityName(city: string, iso2: string | null | undefined, isZh: boolean): string {
  return localizeCity(city, isZh, iso2);
}
