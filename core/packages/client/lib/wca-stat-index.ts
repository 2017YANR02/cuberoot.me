import { statsUrl } from './stats-base';
import { isWcaStatPage } from '@cuberoot/shared/wca-stat-catalog';

export interface MetricEntry { id: string; labelEn: string; labelZh: string }
export interface StatEntry { id: string; titleEn: string; titleZh: string; metrics?: MetricEntry[] }
export interface StatCategory { nameEn: string; nameZh: string; iconName?: string; stats: StatEntry[] }
export interface StatIndex { categories: StatCategory[] }

/** Only this Web version's public pages may become navigation targets. */
export async function fetchWcaStatIndex(signal?: AbortSignal): Promise<StatIndex> {
  const response = await fetch(statsUrl('/stats/index.json'), { signal, cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const index: StatIndex = await response.json();
  return {
    ...index,
    categories: index.categories.map(category => ({
      ...category,
      stats: category.stats.filter(stat => isWcaStatPage(stat.id)),
    })).filter(category => category.stats.length > 0),
  };
}
