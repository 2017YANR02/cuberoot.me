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

// NOTE: iconName 字段是 lucide-react 组件名，前端映射为 <Icon>。不再用 emoji。
const STAT_CATEGORIES = [
  {
    nameEn: 'World Record Analysis', nameZh: '世界纪录分析',
    iconName: 'Trophy',
    preserveOrder: true,
    ids: ['wr_current', 'wr_metric', 'wr_aoxr', 'wr_dominance', 'wr_non_pr', 'wr_newcomer',
          'average_of', 'consecutive_sub_5_average'],
  },
  {
    nameEn: 'Results & Records', nameZh: '成绩与纪录',
    iconName: 'BarChart3',
    ids: ['best_potential_fmc_mean', 'best_round', 'most_frequent_results',
          'moving_average', 'smallest_diff_between_single_and_average', 'yearly_rankings'],
  },
  {
    nameEn: 'Podiums & Honors', nameZh: '领奖台与荣誉',
    iconName: 'Medal',
    ids: ['best_result_off_podium', 'complete_competition_winners', 'most_4th_places',
          'most_competitions_before_winning', 'most_finals',
          'most_podiums_at_single_competition', 'most_podiums_together',
          'worst_result_on_podium'],
  },
  {
    nameEn: 'Competitor Journey', nameZh: '选手经历',
    iconName: 'UserRound',
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
    iconName: 'Tent',
    ids: ['average_event_count_by_competition', 'competition_days_count_by_region',
          'competitions_count_by_week', 'competitions_per_year_by_country',
          'dnf_rate_by_event', 'fewest_competitors_contest',
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

// NOTE: 集中覆盖个别 stat 的中文译名（原 titleZh 在每个 stat 的 .ts 里，零散且不地道）。
// 这里写一次，compute_index 跑时优先使用本表；新加 stat 默认走 stat 文件的 titleZh。
const TITLE_ZH_OVERRIDES: Record<string, string> = {
  wr_newcomer: '新人首个世界纪录',
  consecutive_sub_5_average: '三阶最多连续 sub-5 平均',
  best_potential_fmc_mean: '理论最佳 FMC 平均',
  smallest_diff_between_single_and_average: '单次与平均差距最小',
  best_result_off_podium: '无缘领奖台的最佳成绩',
  complete_competition_winners: '单场包揽全项冠军',
  most_competitions_before_winning: '首冠前参赛最多',
  most_finals: '决赛次数最多',
  most_podiums_together: '同台登奖次数最多',
  worst_result_on_podium: '登上领奖台的最差成绩',
  competitions_per_year_by_person: '选手每年参赛数',
  longest_competitions_path: '最长连续参赛路径',
  longest_streak_of_competitions_in_own_country: '在本国最长连续参赛',
  longest_streak_of_personal_records: '连续打破个人纪录的最长赛程',
  longest_streak_of_podiums: '最长连续登台',
  longest_time_to_sub_10: '达到三阶 sub-10 用时最长',
  most_attended_competitions_in_single_week: '单周参赛最多',
  most_completed_solves: '累计完成还原数最多',
  most_distinct_dates_competed_on: '累计参赛日数最多',
  most_solves_before_bld_success: '首次盲拧成功前尝试最多',
  most_visited_continents: '参赛大洲最多',
  most_visited_countries: '参赛国家最多',
  name_parts_count: '姓名词数分布',
  shortest_time_to_reach_milestone_in_comps_count: '最快达到参赛数里程碑',
  shortest_time_to_get_all_singles: '最快集齐所有项目单次',
  shortest_time_to_get_all_singles_and_averages: '最快集齐所有项目单次与平均',
  average_event_count_by_competition: '每场比赛平均项目数',
  competition_days_count_by_region: '各地区比赛天数',
  competitions_count_by_week: '每周比赛数',
  competitions_per_year_by_country: '各国每年比赛数',
  best_medal_collection_from_abroad_by_country: '各国海外奖牌榜最佳',
  best_medal_collection_from_abroad_by_person: '选手海外奖牌榜最佳',
  current_world_records_by_country: '各国当前世界纪录数',
  delegated_competition_per_year: '每年执裁比赛数（WCA Delegate）',
  first_r_is_wr: '首破纪录即为世界纪录',
  longest_standing_records: '保持最久的世界纪录',
  longest_streak_of_world_records: '同项目同类型最长连续世界纪录',
  most_delegated_competitions: '执裁比赛最多（WCA Delegate）',
  potentially_seen_world_records: '可能现场见证的世界纪录',
  records_in_most_events: '打破纪录项目数最多',
  winned_week_count: '登顶周数统计',
  world_championship_podiums_by_country: '各国世锦赛登台数',
  world_championship_podiums_by_person: '选手世锦赛登台数',
  world_championship_records: '世锦赛纪录',
  world_records_by_country: '各国世界纪录数',
  world_records_by_person: '选手世界纪录数',
};

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
        return { id, titleEn: t.title, titleZh: TITLE_ZH_OVERRIDES[id] ?? t.titleZh };
      });

    // NOTE: preserveOrder 为 true 保持 ids 数组原始顺序（与 Ruby 一致）
    if (!cat.preserveOrder) {
      stats.sort((a, b) => sortKey(a.titleEn).localeCompare(sortKey(b.titleEn)));
    }

    return {
      nameEn: cat.nameEn,
      nameZh: cat.nameZh,
      iconName: cat.iconName,
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
      iconName: 'Pin',
      stats: uncategorized.sort().map(id => {
        const t = titles.get(id)!;
        return { id, titleEn: t.title, titleZh: TITLE_ZH_OVERRIDES[id] ?? t.titleZh };
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
