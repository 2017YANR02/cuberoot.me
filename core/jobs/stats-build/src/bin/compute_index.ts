// NOTE: 生成统计索引 JSON——输出 stats/index.json（供 React 前端渲染）
//
// 无需 MySQL 连接——从已生成的统计 JSON 中读取标题
// 用法：npx tsx src/bin/compute_index.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { REGISTRY } from './compute.js';
import { WCA_STAT_CATEGORIES, WCA_STAT_PAGE_IDS, assertWcaStatRegistry } from '@cuberoot/shared/wca-stat-catalog';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../../../../../stats');
const OUTPUT_PATH = resolve(DATA_DIR, 'index.json');

// NOTE: 集中覆盖个别 stat 的中文译名（原 titleZh 在每个 stat 的 .ts 里，零散且不地道）。
// 这里写一次，compute_index 跑时优先使用本表；新加 stat 默认走 stat 文件的 titleZh。
const TITLE_ZH_OVERRIDES: Record<string, string> = {
  wr_newcomer: '新人首个世界纪录',
  top10_history: '3x3 全历史 TOP 10 演化',
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
  longest_streak_of_personal_records: '连续取得个人纪录的最多参赛场数',
  longest_streak_of_podiums: '最长连续登台',
  longest_time_to_sub_10: '达到三阶 sub-10 用时最长',
  most_attended_competitions_in_single_week: '单周参赛最多',
  most_completed_solves: '累计完成还原数最多',
  most_distinct_dates_competed_on: '累计参赛日数最多',
  most_solves_before_bld_success: '首次盲拧成功前尝试最多',
  most_visited_continents: '参赛大洲最多',
  most_visited_countries: '参赛国家最多',
  name_stats: '姓名统计',
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
  longest_standing_records: '最长保持纪录',
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
  date_match_pr: '日期匹配 PR',
};

// NOTE: 数字填充排序——确保 "Ao5" 排在 "Ao12" 前面
function sortKey(title: string): string {
  return title.replace(/\d+/g, n => n.padStart(10, '0'));
}

interface MetricEntry {
  id: string;
  labelEn: string;
  labelZh: string;
}

interface StatEntry {
  id: string;
  titleEn: string;
  titleZh: string;
  metrics?: MetricEntry[];
}

interface RawMetricPanel { id?: string; labelEn?: string; labelZh?: string }

export function buildStatIndex(readStat: (id: string) => string | undefined = id => {
  const jsonPath = resolve(DATA_DIR, id + '.json');
  return existsSync(jsonPath) ? readFileSync(jsonPath, 'utf-8') : undefined;
}) {
  assertWcaStatRegistry(Object.keys(REGISTRY));
  const availableIds = WCA_STAT_PAGE_IDS;

  // NOTE: 从已生成的 JSON 文件读取标题 + metricPanels(供 LandingSearch 搜指标名)
  const titles = new Map<string, { title: string; titleZh: string; metrics?: MetricEntry[] }>();
  for (const id of availableIds) {
    const raw = readStat(id);
    if (raw !== undefined) {
      try {
        const data = JSON.parse(raw);
        const mp = Array.isArray(data.metricPanels) ? (data.metricPanels as RawMetricPanel[]) : null;
        const metrics = mp
          ? mp.filter(m => m.id && m.labelEn).map(m => ({ id: m.id!, labelEn: m.labelEn!, labelZh: m.labelZh || m.labelEn! }))
          : undefined;
        titles.set(id, { title: data.title || id, titleZh: data.titleZh || data.title || id, metrics });
      } catch {
        titles.set(id, { title: id, titleZh: id });
      }
    } else {
      titles.set(id, { title: id, titleZh: id });
    }
  }

  // NOTE: 构建分类数据
  const categories = WCA_STAT_CATEGORIES.map(cat => {
    let stats: StatEntry[] = cat.ids
      .filter(id => titles.has(id))
      .map(id => {
        const t = titles.get(id)!;
        const entry: StatEntry = { id, titleEn: t.title, titleZh: TITLE_ZH_OVERRIDES[id] ?? t.titleZh };
        if (t.metrics && t.metrics.length > 0) entry.metrics = t.metrics;
        return entry;
      });

    // NOTE: preserveOrder 为 true 保持 ids 数组原始顺序
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

  return { categories };
}

function main() {
  const output = buildStatIndex();
  const { categories } = output;
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`Generated ${OUTPUT_PATH} (${categories.length} categories, ` +
    `${categories.reduce((s, c) => s + c.stats.length, 0)} stats)`);
}

const scriptName = process.argv[1]?.replace(/\\/g, '/') ?? '';
if (scriptName.endsWith('/compute_index.ts') || scriptName.endsWith('/compute_index.js')) main();
