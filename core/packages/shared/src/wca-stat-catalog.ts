/** Route contract shared by the statistics publisher and Web.
 * Only categorized IDs have standalone pages. Data-only statistics remain generated
 * for embedded views; removed IDs remain hard 404s without aliases or redirects.
 */
export interface WcaStatCategory {
  nameEn: string; nameZh: string; iconName: string;
  preserveOrder?: boolean; ids: readonly string[];
}

export const WCA_STAT_CATEGORIES: readonly WcaStatCategory[] = [
  {
    nameEn: 'World Record Analysis', nameZh: '世界纪录分析',
    iconName: 'Trophy',
    preserveOrder: true,
    // NOTE: top10_history 不单独注册——其 bar chart race 已嵌入 wr_metric 第 0 个 panel
    // NOTE: wr_current(当前世界纪录)已退役 2026-06-22 —— 移植进 /wca/records 的「当前」视图(支持全部区域)
    // NOTE: wr_metric(指标)已退役 2026-06-22 —— 移植进 /wca/results 的「指标」视图(?view=metric);
    //   wr_metric.json 仍照常生成(被 /wca/results 嵌入 + fetch_upcoming_comps / gen_wr_ids 消费),只是不再单独成页/列卡。
    ids: ['wr_aoxr', 'wr_dominance', 'round_top3_sum', 'wr_non_pr', 'wr_newcomer',
          'average_of', 'consecutive_sub_5_average'],
  },
  {
    nameEn: 'Results & Records', nameZh: '成绩与纪录',
    iconName: 'BarChart3',
    ids: ['best_potential_fmc_mean', 'best_round', 'keatoned_records', 'most_frequent_results',
          'moving_average', 'smallest_diff_between_single_and_average', 'yearly_rankings',
          'date_match_pr'],
  },
  {
    nameEn: 'Podiums & Honors', nameZh: '领奖台与荣誉',
    iconName: 'Medal',
    ids: ['best_result_off_podium', 'complete_competition_winners', 'most_4th_places',
          'most_competitions_before_winning', 'most_finals',
          'most_podiums_at_single_competition', 'most_podiums_together',
          'tied_podium_results',
          'worst_result_on_podium'],
  },
  {
    nameEn: 'Competitor Journey', nameZh: '选手经历',
    iconName: 'UserRound',
    ids: ['competitions_per_year_by_person', 'longest_competitions_path',
          'competition_streaks',
          'longest_streak_of_competitions_in_own_country',
          'longest_streak_of_personal_records', 'longest_streak_of_podiums',
          'longest_time_to_sub_10',
          'most_attended_competitions_in_single_month',
          'most_attended_competitions_in_single_week',
          'most_competitions_abroad', 'most_completed_solves',
          'most_distinct_dates_competed_on', 'most_solves_before_bld_success',
          'most_visited_continents', 'most_visited_countries',
          'shortest_time_to_get_all_singles',
          'shortest_time_to_get_all_singles_and_averages',
          'shortest_time_to_reach_milestone_in_comps_count'],
  },
  {
    nameEn: 'Competition Statistics', nameZh: '赛事统计',
    iconName: 'Tent',
    ids: ['annual_participation', 'average_event_count_by_competition', 'competition_days_count_by_region',
          'competitions_count_by_week', 'competitions_per_year_by_country',
          'dnf_rate_by_event',
          'most_records_at_single_competition'],
  },
  {
    nameEn: 'Records & Countries', nameZh: '纪录与国家',
    iconName: 'Globe2',
    ids: ['best_medal_collection_from_abroad_by_country',
          'best_medal_collection_from_abroad_by_person',
          'current_world_records_by_country', 'delegated_competition_per_year',
          'first_r_is_wr', 'longest_standing_records', 'longest_streak_of_world_records',
          'most_delegated_competitions', 'potentially_seen_world_records',
          'records_in_most_events', 'winned_week_count',
          'world_championship_podiums_by_country',
          'world_championship_podiums_by_person', 'world_championship_records',
          'world_records_by_country', 'world_records_by_person'],
  },
];

export const WCA_STAT_DATA_ONLY_IDS = [
  'wr_single_history', 'wr_average_history',
  'wr_bao5', 'wr_wao5', 'wr_mo5', 'wr_bpa', 'wr_wpa',
  'wr_median', 'wr_best_counting', 'wr_worst_counting', 'wr_worst',
  'wr_variance', 'wr_best_average_ratio',
  'wr_ao1r', 'wr_ao2r', 'wr_ao3r', 'wr_ao4r',
  'average_of_3', 'average_of_5', 'average_of_12',
  'average_of_25', 'average_of_50', 'average_of_100', 'average_of_1000',
  'top10_history',
  // Their data remains consumed by /wca/results after the standalone pages retired.
  'wr_metric', 'name_stats',
] as const;

export const WCA_STAT_REMOVED_IDS = ['all-results', 'cross_city_competition_streaks'] as const;
export const WCA_STAT_NON_PAGE_IDS = [...WCA_STAT_DATA_ONLY_IDS, ...WCA_STAT_REMOVED_IDS];
export const WCA_STAT_PAGE_IDS = WCA_STAT_CATEGORIES.flatMap(category => category.ids);
const publicIds = new Set(WCA_STAT_PAGE_IDS);

export function isWcaStatPage(id: string): boolean {
  return publicIds.has(id);
}

/** Fail before publishing if a producer or route was changed without its contract. */
export function assertWcaStatRegistry(ids: readonly string[]): void {
  const declared = [...WCA_STAT_PAGE_IDS, ...WCA_STAT_NON_PAGE_IDS];
  if (new Set(declared).size !== declared.length) {
    throw new Error('WCA statistics route contract contains duplicate or conflicting IDs');
  }
  const expected = new Set<string>([...WCA_STAT_PAGE_IDS, ...WCA_STAT_DATA_ONLY_IDS]);
  const actual = new Set(ids);
  const missing = [...expected].filter(id => !actual.has(id));
  const unknown = ids.filter(id => !expected.has(id));
  if (missing.length || unknown.length) {
    throw new Error(
      'WCA statistics registry mismatch: missing producers [' + missing.join(', ')
      + ']; unclassified or removed producers [' + unknown.join(', ') + ']',
    );
  }
}
