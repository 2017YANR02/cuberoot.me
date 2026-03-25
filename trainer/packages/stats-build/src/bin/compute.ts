// NOTE: CLI 入口——运行指定统计并输出 JSON
// 用法：npx tsx src/bin/compute.ts <stat_id>
// 示例：npx tsx src/bin/compute.ts current_world_records_by_country
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { closePool } from '../core/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// NOTE: 统计文件注册表——手动添加新统计
// 后续可改为自动扫描 statistics/ 目录
const REGISTRY: Record<string, () => Promise<Record<string, unknown>>> = {
  'best_medal_collection_from_abroad_by_country': () => import('../statistics/best_medal_collection_from_abroad_by_country.js'),
  'best_medal_collection_from_abroad_by_person': () => import('../statistics/best_medal_collection_from_abroad_by_person.js'),
  'complete_competition_winners': () => import('../statistics/complete_competition_winners.js'),
  'current_world_records_by_country': () => import('../statistics/current_world_records_by_country.js'),
  'fewest_competitors_contest': () => import('../statistics/fewest_competitors_contest.js'),
  'most_4th_places': () => import('../statistics/most_4th_places.js'),
  'most_attended_competitions_in_single_month': () => import('../statistics/most_attended_competitions_in_single_month.js'),
  'most_competitions_abroad': () => import('../statistics/most_competitions_abroad.js'),
  'most_delegated_competitions': () => import('../statistics/most_delegated_competitions.js'),
  'most_finals': () => import('../statistics/most_finals.js'),
  'most_podiums_at_single_competition': () => import('../statistics/most_podiums_at_single_competition.js'),
  'most_visited_continents': () => import('../statistics/most_visited_continents.js'),
  'most_visited_countries': () => import('../statistics/most_visited_countries.js'),
  'potentially_seen_world_records': () => import('../statistics/potentially_seen_world_records.js'),
  'world_championship_podiums_by_country': () => import('../statistics/world_championship_podiums_by_country.js'),
  'world_championship_podiums_by_person': () => import('../statistics/world_championship_podiums_by_person.js'),
  'world_records_by_country': () => import('../statistics/world_records_by_country.js'),
  'world_records_by_person': () => import('../statistics/world_records_by_person.js'),
  // NOTE: 阶段 A — Statistic + transform
  'dnf_rate_by_event': () => import('../statistics/dnf_rate_by_event.js'),
  'name_parts_count': () => import('../statistics/name_parts_count.js'),
  'competitions_count_by_week': () => import('../statistics/competitions_count_by_week.js'),
  'average_event_count_by_competition': () => import('../statistics/average_event_count_by_competition.js'),
  'best_potential_fmc_mean': () => import('../statistics/best_potential_fmc_mean.js'),
  'competitions_per_year_by_country': () => import('../statistics/competitions_per_year_by_country.js'),
  'competitions_per_year_by_person': () => import('../statistics/competitions_per_year_by_person.js'),
  'delegated_competition_per_year': () => import('../statistics/delegated_competition_per_year.js'),
  'first_r_is_wr': () => import('../statistics/first_r_is_wr.js'),
  'longest_competitions_path': () => import('../statistics/longest_competitions_path.js'),
  'longest_streak_of_competitions_in_own_country': () => import('../statistics/longest_streak_of_competitions_in_own_country.js'),
  'longest_streak_of_personal_records': () => import('../statistics/longest_streak_of_personal_records.js'),
  'longest_streak_of_podiums': () => import('../statistics/longest_streak_of_podiums.js'),
  'longest_streak_of_world_records': () => import('../statistics/longest_streak_of_world_records.js'),
  'longest_time_to_sub_10': () => import('../statistics/longest_time_to_sub_10.js'),
  'most_attended_competitions_in_single_week': () => import('../statistics/most_attended_competitions_in_single_week.js'),
  'most_distinct_dates_competed_on': () => import('../statistics/most_distinct_dates_competed_on.js'),
  'shortest_time_to_get_all_singles': () => import('../statistics/shortest_time_to_get_all_singles.js'),
  'shortest_time_to_get_all_singles_and_averages': () => import('../statistics/shortest_time_to_get_all_singles_and_averages.js'),
  'wr_current': () => import('../statistics/wr_current.js'),
  // NOTE: 阶段 B — GroupedStatistic 子类
  'most_completed_solves': () => import('../statistics/most_completed_solves.js'),
  'worst_result_on_podium': () => import('../statistics/worst_result_on_podium.js'),
  'best_result_off_podium': () => import('../statistics/best_result_off_podium.js'),
  'best_round': () => import('../statistics/best_round.js'),
  'competition_days_count_by_region': () => import('../statistics/competition_days_count_by_region.js'),
  'longest_standing_records': () => import('../statistics/longest_standing_records.js'),
  'most_competitions_before_winning': () => import('../statistics/most_competitions_before_winning.js'),
  'most_frequent_results': () => import('../statistics/most_frequent_results.js'),
  'most_podiums_together': () => import('../statistics/most_podiums_together.js'),
  'most_records_at_single_competition': () => import('../statistics/most_records_at_single_competition.js'),
  'most_solves_before_bld_success': () => import('../statistics/most_solves_before_bld_success.js'),
  'moving_average': () => import('../statistics/moving_average.js'),
  'records_in_most_events': () => import('../statistics/records_in_most_events.js'),
  'shortest_time_to_reach_milestone_in_comps_count': () => import('../statistics/shortest_time_to_reach_milestone_in_comps_count.js'),
  'smallest_diff_between_single_and_average': () => import('../statistics/smallest_diff_between_single_and_average.js'),
  'winned_week_count': () => import('../statistics/winned_week_count.js'),
  'world_championship_records': () => import('../statistics/world_championship_records.js'),
  // NOTE: 阶段 C — RoundMetric 子类
  'wr_bao5': () => import('../statistics/wr_bao5.js'),
  'wr_wao5': () => import('../statistics/wr_wao5.js'),
  'wr_mo5': () => import('../statistics/wr_mo5.js'),
  'wr_bpa': () => import('../statistics/wr_bpa.js'),
  'wr_wpa': () => import('../statistics/wr_wpa.js'),
  'wr_median': () => import('../statistics/wr_median.js'),
  'wr_variance': () => import('../statistics/wr_variance.js'),
  'wr_best_counting': () => import('../statistics/wr_best_counting.js'),
  'wr_worst_counting': () => import('../statistics/wr_worst_counting.js'),
  'wr_worst': () => import('../statistics/wr_worst.js'),
  'wr_best_average_ratio': () => import('../statistics/wr_best_average_ratio.js'),
  'wr_single_history': () => import('../statistics/wr_single_history.js'),
  'wr_average_history': () => import('../statistics/wr_average_history.js'),
  // NOTE: 阶段 C — AoRounds 子类
  'wr_ao1r': () => import('../statistics/wr_ao1r.js'),
  'wr_ao2r': () => import('../statistics/wr_ao2r.js'),
  'wr_ao3r': () => import('../statistics/wr_ao3r.js'),
  'wr_ao4r': () => import('../statistics/wr_ao4r.js'),
  // NOTE: 阶段 C — AverageOfX 子类
  'average_of_3': () => import('../statistics/average_of_3.js'),
  'average_of_5': () => import('../statistics/average_of_5.js'),
  'average_of_12': () => import('../statistics/average_of_12.js'),
  'average_of_25': () => import('../statistics/average_of_25.js'),
  'average_of_50': () => import('../statistics/average_of_50.js'),
  'average_of_100': () => import('../statistics/average_of_100.js'),
  'average_of_1000': () => import('../statistics/average_of_1000.js'),
  // NOTE: 阶段 D-1 — 简单剩余
  'consecutive_sub_5_average': () => import('../statistics/consecutive_sub_5_average.js'),
  'mbf_average': () => import('../statistics/mbf_average.js'),
  // NOTE: 阶段 D-2 — Rankings 基类
  'yearly_rankings': () => import('../statistics/yearly_rankings.js'),
  // NOTE: 阶段 D-3 — 多维面板统计
  'wr_non_pr': () => import('../statistics/wr_non_pr.js'),
  'wr_dominance': () => import('../statistics/wr_dominance.js'),
  'wr_newcomer': () => import('../statistics/wr_newcomer.js'),
  // NOTE: 阶段 D-4 — 聚合页面
  'wr_metric': () => import('../statistics/wr_metric.js'),
  'wr_aoxr': () => import('../statistics/wr_aoxr.js'),
  'average_of': () => import('../statistics/average_of.js'),
};

async function main() {
  const statId = process.argv[2];

  if (!statId) {
    console.error('用法: npx tsx src/bin/compute.ts <stat_id>');
    console.error('可用统计:', Object.keys(REGISTRY).join(', '));
    process.exit(1);
  }

  if (!REGISTRY[statId]) {
    console.error(`未知统计: ${statId}`);
    console.error('可用统计:', Object.keys(REGISTRY).join(', '));
    process.exit(1);
  }

  console.log(`正在计算: ${statId}`);
  const startTime = Date.now();

  try {
    // NOTE: 动态导入统计模块，取第一个导出的类
    const mod = await REGISTRY[statId]();
    const StatClass = Object.values(mod).find(
      (v): v is new () => import('../core/statistic.js').Statistic =>
        typeof v === 'function' && v.prototype
    );

    if (!StatClass) {
      throw new Error(`模块 ${statId} 中未找到统计类`);
    }

    let stat: InstanceType<typeof StatClass> | null = new StatClass();
    let json: Record<string, unknown> | null = await stat.toJson() as unknown as Record<string, unknown>;

    // NOTE: 照搬 Ruby compute_all.rb 的内存管理：
    // statistic_object.instance_variables.each { |iv| set(iv, nil) }
    // GC.start
    // 释放 stat 实例中的 queryResults 等大型缓存
    stat = null;
    if (global.gc) global.gc();

    // NOTE: 输出 JSON 到 stats/data/ 目录
    const outputDir = resolve(__dirname, '../../../../../stats/data');
    mkdirSync(outputDir, { recursive: true });
    const outputPath = resolve(outputDir, `${statId}.json`);
    writeFileSync(outputPath, JSON.stringify(json, null, 2), 'utf-8');

    // NOTE: JSON 字符串化完成后释放 json 对象
    json = null;
    if (global.gc) global.gc();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    // NOTE: 与 Ruby 日志格式对齐——显示 GC 后的 RSS 内存
    const mem = Math.round(process.memoryUsage.rss() / 1024 / 1024);
    console.log(`完成: ${outputPath} (${duration}s)  [${mem}MB]`);
  } catch (err) {
    console.error('错误:', err);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
