/**
 * About entry registry — 把 entries/<category>.ts 里的 record 平铺合并。
 *
 * 新增 stat 时:在 entries/<category>.ts 里加键值,这里 spread 进来即可。
 */
import type { AboutEntry } from './types';
import { LOOKUP_ABOUT } from './entries/lookup';
import { WR_ANALYSIS_ABOUT } from './entries/wr_analysis';
import { RESULTS_RECORDS_ABOUT } from './entries/results_records';
import { PODIUMS_ABOUT } from './entries/podiums';
import { JOURNEY_ABOUT } from './entries/journey';
import { COMP_STATS_ABOUT } from './entries/comp_stats';
import { RECORDS_COUNTRIES_ABOUT } from './entries/records_countries';

export const ABOUT_REGISTRY: Record<string, AboutEntry> = {
  ...LOOKUP_ABOUT,
  ...WR_ANALYSIS_ABOUT,
  ...RESULTS_RECORDS_ABOUT,
  ...PODIUMS_ABOUT,
  ...JOURNEY_ABOUT,
  ...COMP_STATS_ABOUT,
  ...RECORDS_COUNTRIES_ABOUT,
};

export function hasAbout(id: string): boolean {
  return id in ABOUT_REGISTRY;
}
