// NOTE: 生成统计索引 JSON——与 Ruby compute_index.rb 等价
// Ruby 版输出 stats/index.md（Markdown + data-i18n），
// TS 版输出 stats/data/index.json（供 React 前端渲染）
//
// 无需 MySQL 连接——从已生成的统计 JSON 中读取标题
// 用法：npx tsx src/bin/compute_index.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { REGISTRY } from './compute.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../../../../../stats/data');
const OUTPUT_PATH = resolve(DATA_DIR, 'index.json');

// NOTE: 与 Ruby index.rb ALL_MERGED 一致
const ALL_MERGED = new Set([
  'wr_single_history', 'wr_average_history',
  'wr_bao5', 'wr_wao5', 'wr_mo5', 'wr_bpa', 'wr_wpa',
  'wr_median', 'wr_best_counting', 'wr_worst_counting', 'wr_worst',
  'wr_variance', 'wr_best_average_ratio',
  'mbf_average',
  'wr_ao1r', 'wr_ao2r', 'wr_ao3r', 'wr_ao4r',
  'average_of_3', 'average_of_5', 'average_of_12',
  'average_of_25', 'average_of_50', 'average_of_100', 'average_of_1000',
]);

// NOTE: 与 Ruby compute_index.rb STAT_CATEGORIES 完全一致——6 个分类
const STAT_CATEGORIES = [
  {
    nameEn: 'World Record Analysis', nameZh: '世界纪录分析',
    icon: '🏆', gradient: 'linear-gradient(90deg, #f59e0b, #ef4444, #ec4899)',
    preserveOrder: true,
    ids: ['wr_current', 'wr_metric', 'wr_aoxr', 'wr_dominance', 'wr_non_pr', 'wr_newcomer',
          'average_of', 'consecutive_sub_5_average'],
  },
  {
    nameEn: 'Results & Records', nameZh: '成绩与纪录',
    icon: '📊', gradient: 'linear-gradient(90deg, #3b82f6, #6366f1)',
    ids: ['best_potential_fmc_mean', 'best_round', 'most_frequent_results',
          'moving_average', 'smallest_diff_between_single_and_average', 'yearly_rankings'],
  },
  {
    nameEn: 'Podiums & Honors', nameZh: '领奖台与荣誉',
    icon: '🏅', gradient: 'linear-gradient(90deg, #a855f7, #ec4899)',
    ids: ['best_result_off_podium', 'complete_competition_winners', 'most_4th_places',
          'most_competitions_before_winning', 'most_finals',
          'most_podiums_at_single_competition', 'most_podiums_together',
          'worst_result_on_podium'],
  },
  {
    nameEn: 'Competitor Journey', nameZh: '选手经历',
    icon: '🧑', gradient: 'linear-gradient(90deg, #14b8a6, #3b82f6)',
    ids: ['competitions_per_year_by_person', 'longest_competitions_path',
          'longest_streak_of_competitions_in_own_country',
          'longest_streak_of_personal_records', 'longest_streak_of_podiums',
          'longest_time_to_sub_10',
          'most_attended_competitions_in_single_month',
          'most_attended_competitions_in_single_week',
          'most_competitions_abroad', 'most_completed_solves',
          'most_distinct_dates_competed_on', 'most_solves_before_bld_success',
          'most_visited_continents', 'most_visited_countries', 'name_parts_count',
          'shortest_time_to_get_all_singles',
          'shortest_time_to_get_all_singles_and_averages',
          'shortest_time_to_reach_milestone_in_comps_count'],
  },
  {
    nameEn: 'Competition Statistics', nameZh: '赛事统计',
    icon: '🎪', gradient: 'linear-gradient(90deg, #f97316, #f59e0b)',
    ids: ['average_event_count_by_competition', 'competition_days_count_by_region',
          'competitions_count_by_week', 'competitions_per_year_by_country',
          'dnf_rate_by_event', 'fewest_competitors_contest',
          'most_records_at_single_competition'],
  },
  {
    nameEn: 'Records & Countries', nameZh: '纪录与国家',
    icon: '🌍', gradient: 'linear-gradient(90deg, #22c55e, #14b8a6)',
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

// NOTE: 数字填充排序——确保 "Ao5" 排在 "Ao12" 前面（与 Ruby sort_key 一致）
function sortKey(title: string): string {
  return title.replace(/\d+/g, n => n.padStart(10, '0'));
}

interface StatEntry {
  id: string;
  titleEn: string;
  titleZh: string;
}

function main() {
  // NOTE: 可用统计——REGISTRY 中排除 ALL_MERGED
  const availableIds = Object.keys(REGISTRY).filter(id => !ALL_MERGED.has(id));

  // NOTE: 从已生成的 JSON 文件读取标题
  const titles = new Map<string, { title: string; titleZh: string }>();
  for (const id of availableIds) {
    const jsonPath = resolve(DATA_DIR, `${id}.json`);
    if (existsSync(jsonPath)) {
      try {
        const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));
        titles.set(id, { title: data.title || id, titleZh: data.titleZh || data.title || id });
      } catch {
        titles.set(id, { title: id, titleZh: id });
      }
    } else {
      titles.set(id, { title: id, titleZh: id });
    }
  }

  // NOTE: 构建分类数据
  const categories = STAT_CATEGORIES.map(cat => {
    let stats: StatEntry[] = cat.ids
      .filter(id => titles.has(id))
      .map(id => {
        const t = titles.get(id)!;
        return { id, titleEn: t.title, titleZh: t.titleZh };
      });

    // NOTE: preserveOrder 为 true 保持 ids 数组原始顺序（与 Ruby 一致）
    if (!cat.preserveOrder) {
      stats.sort((a, b) => sortKey(a.titleEn).localeCompare(sortKey(b.titleEn)));
    }

    return {
      nameEn: cat.nameEn,
      nameZh: cat.nameZh,
      icon: cat.icon,
      gradient: cat.gradient,
      stats,
    };
  }).filter(cat => cat.stats.length > 0);

  // NOTE: 兜底检查——找出未被分类覆盖的统计
  const allCategorized = new Set(STAT_CATEGORIES.flatMap(c => c.ids));
  const uncategorized = availableIds.filter(id => !allCategorized.has(id));
  if (uncategorized.length > 0) {
    console.warn(`WARNING: ${uncategorized.length} uncategorized stats: ${uncategorized.join(', ')}`);
    // NOTE: 添加兜底分类
    categories.push({
      nameEn: 'Other',
      nameZh: '其他',
      icon: '📌',
      gradient: 'linear-gradient(90deg, #6b7280, #9ca3af)',
      stats: uncategorized.sort().map(id => {
        const t = titles.get(id)!;
        return { id, titleEn: t.title, titleZh: t.titleZh };
      }),
    });
  }

  const output = { categories };
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`Generated ${OUTPUT_PATH} (${categories.length} categories, ` +
    `${categories.reduce((s, c) => s + c.stats.length, 0)} stats)`);


}



main();
