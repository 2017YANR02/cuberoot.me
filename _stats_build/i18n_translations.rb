# NOTE: 统计文件中英翻译映射表
# 用于批量注入 @title_zh 和 @note_zh
# 格式: "file_basename" => { title_zh: "...", note_zh: "..." }
STAT_TRANSLATIONS = {
  "average_event_count_by_competition" => {
    title_zh: "每场比赛的平均项目数",
    note_zh: nil
  },
  "average_of_100" => {
    title_zh: "100 次平均",
    note_zh: "取连续 100 次官方成绩计算。仅考虑单次前 200 名的选手。"
  },
  "average_of_12" => {
    title_zh: "12 次平均",
    note_zh: "取连续 12 次官方成绩计算。仅考虑单次前 200 名的选手。"
  },
  "average_of_25" => {
    title_zh: "25 次平均",
    note_zh: "取连续 25 次官方成绩计算。仅考虑单次前 200 名的选手。"
  },
  "average_of_5" => {
    title_zh: "5 次平均",
    note_zh: "取连续 5 次官方成绩计算。仅考虑单次前 200 名的选手。"
  },
  "average_of_50" => {
    title_zh: "50 次平均",
    note_zh: "取连续 50 次官方成绩计算。仅考虑单次前 200 名的选手。"
  },
  "best_first_average" => {
    title_zh: "最佳首次平均",
    note_zh: "即选手在首次参加某项目时取得的最佳平均成绩。"
  },
  "best_first_single" => {
    title_zh: "最佳首次单次",
    note_zh: "即选手在首次参加某项目时取得的最佳单次成绩。"
  },
  "best_medal_collection_from_abroad_by_country" => {
    title_zh: "各国海外最佳奖牌收藏",
    note_zh: "仅统计在海外比赛中获得的奖牌。"
  },
  "best_medal_collection_from_abroad_by_person" => {
    title_zh: "个人海外最佳奖牌收藏",
    note_zh: "仅统计在海外比赛中获得的奖牌。"
  },
  "best_potential_fmc_mean" => {
    title_zh: "最佳潜在 FMC 平均",
    note_zh: "取该轮每次尝试的最佳成绩计算平均。"
  },
  "best_result_off_podium" => {
    title_zh: "未登领奖台的最佳成绩",
    note_zh: "仅统计决赛。"
  },
  "best_single_counting_into_average" => {
    title_zh: "计入 Ao5 的最佳单次",
    note_zh: nil
  },
  "competition_days_count_by_region" => {
    title_zh: "各地区比赛天数",
    note_zh: nil
  },
  "competitions_count_by_week" => {
    title_zh: "每周比赛数量",
    note_zh: "一周从周一开始到周日结束。"
  },
  "competitions_per_year_by_country" => {
    title_zh: "各国每年比赛数量",
    note_zh: nil
  },
  "competitions_per_year_by_person" => {
    title_zh: "个人每年参赛数量",
    note_zh: nil
  },
  "complete_competition_winners" => {
    title_zh: "完全比赛冠军",
    note_zh: "完全获胜指在某场比赛的所有项目中均获得第一名。"
  },
  "consecutive_sub_5_average" => {
    title_zh: "最多连续 sub-5 三阶平均",
    note_zh: "仅考虑官方 3x3x3 平均成绩。按时间顺序统计所有轮次。"
  },
  "current_world_records_by_country" => {
    title_zh: "各国当前世界纪录数量",
    note_zh: nil
  },
  "delegated_competition_per_year" => {
    title_zh: "每年代表比赛数量",
    note_zh: "仅统计至少代表过 5 场比赛的代表。代表时间按首次和最后一次代表比赛之间的差值计算。"
  },
  "dnf_rate_by_event" => {
    title_zh: "各项目 DNF 率",
    note_zh: nil
  },
  "fewest_competitors_contest" => {
    title_zh: "参赛人数最少的比赛",
    note_zh: nil
  },
  "longest_competitions_path" => {
    title_zh: "最长比赛路径",
    note_zh: "按相邻比赛之间的直线距离之和计算。"
  },
  "longest_standing_records" => {
    title_zh: "保持时间最长的纪录",
    note_zh: nil
  },
  "longest_streak_of_competitions_in_own_country" => {
    title_zh: "在本国连续参赛最长纪录",
    note_zh: "每当选手出国参赛，连续纪录即中断。"
  },
  "longest_streak_of_personal_records" => {
    title_zh: "连续创造个人纪录的最长比赛纪录",
    note_zh: nil
  },
  "longest_streak_of_podiums" => {
    title_zh: "连续领奖台最长纪录",
    note_zh: "未举办该项目的比赛不计入。"
  },
  "longest_streak_of_world_records" => {
    title_zh: "同一项目连续世界纪录最长纪录",
    note_zh: nil
  },
  "longest_time_to_sub_10" => {
    title_zh: "达到 sub-10 三阶平均所用最长时间",
    note_zh: nil
  },
  "most_4th_places" => {
    title_zh: "最多第四名",
    note_zh: "仅统计决赛。"
  },
  "most_attended_competitions_in_single_month" => {
    title_zh: "单月参赛最多",
    note_zh: nil
  },
  "most_attended_competitions_in_single_week" => {
    title_zh: "单周参赛最多",
    note_zh: nil
  },
  "most_competitions_abroad" => {
    title_zh: "海外参赛最多",
    note_zh: nil
  },
  "most_competitions_before_winning" => {
    title_zh: "夺冠前参赛最多",
    note_zh: "仅统计举办了该项目的比赛。"
  },
  "most_completed_solves" => {
    title_zh: "完成还原次数最多",
    note_zh: nil
  },
  "most_delegated_competitions" => {
    title_zh: "代表比赛最多",
    note_zh: nil
  },
  "most_distinct_dates_competed_on" => {
    title_zh: "参赛日期最多",
    note_zh: nil
  },
  "most_finals" => {
    title_zh: "进入决赛最多",
    note_zh: nil
  },
  "most_frequent_results" => {
    title_zh: "出现频率最高的成绩",
    note_zh: nil
  },
  "most_podiums_at_single_competition" => {
    title_zh: "单场比赛登台最多",
    note_zh: nil
  },
  "most_podiums_together" => {
    title_zh: "最多次共同登台",
    note_zh: nil
  },
  "most_records_at_single_competition" => {
    title_zh: "单场比赛创纪录最多",
    note_zh: nil
  },
  "most_solves_before_bld_success" => {
    title_zh: "首次盲拧成功前尝试次数最多",
    note_zh: nil
  },
  "most_visited_continents" => {
    title_zh: "去过最多大洲参赛",
    note_zh: nil
  },
  "most_visited_countries" => {
    title_zh: "去过最多国家参赛",
    note_zh: nil
  },
  "moving_average" => {
    title_zh: "滑动平均",
    note_zh: nil
  },
  "name_parts_count" => {
    title_zh: "姓名词数统计",
    note_zh: "括号中的本地名称不计入。"
  },
  "potentially_seen_world_records" => {
    title_zh: "可能亲眼见证的世界纪录",
    note_zh: "「可能」指该选手参加了某场创造世界纪录的比赛。"
  },
  "records_in_most_events" => {
    title_zh: "在最多项目中创造纪录",
    note_zh: "统计所有历史纪录（不仅是当前纪录）。"
  },
  "shortest_time_to_get_all_singles" => {
    title_zh: "最快集齐所有单次成绩",
    note_zh: "仅考虑当前官方项目。"
  },
  "shortest_time_to_get_all_singles_and_averages" => {
    title_zh: "最快集齐所有单次和平均成绩",
    note_zh: "仅考虑当前官方项目。"
  },
  "shortest_time_to_reach_milestone_in_comps_count" => {
    title_zh: "最快达到参赛里程碑",
    note_zh: nil
  },
  "smallest_diff_between_single_and_average" => {
    title_zh: "单次与平均最小差距",
    note_zh: "FMC 不计入，因为其数值为整数。"
  },
  "winned_week_count" => {
    title_zh: "统治周数",
    note_zh: "即选手在该项目排名世界第一期间经过的周数。"
  },
  "world_championship_podiums_by_country" => {
    title_zh: "各国世锦赛领奖台次数",
    note_zh: nil
  },
  "world_championship_podiums_by_person" => {
    title_zh: "个人世锦赛领奖台次数",
    note_zh: nil
  },
  "world_championship_records" => {
    title_zh: "世锦赛纪录",
    note_zh: "此列表包含历届世界锦标赛的最佳成绩，相当于奥运项目中的奥运纪录。"
  },
  "world_records_by_country" => {
    title_zh: "各国世界纪录数量",
    note_zh: nil
  },
  "world_records_by_person" => {
    title_zh: "个人世界纪录数量",
    note_zh: nil
  },
  "worst_result_on_podium" => {
    title_zh: "登上领奖台的最差成绩",
    note_zh: "仅统计决赛。主要成绩为 DNF 的结果不计入。"
  },
  "wr_ao1r" => {
    title_zh: "世界纪录 Ao1R（单轮平均）历史",
    note_zh: "Ao1R：在只有一轮的比赛中，该轮的平均成绩。"
  },
  "wr_ao2r" => {
    title_zh: "世界纪录 Ao2R（双轮平均）历史",
    note_zh: "Ao2R：一场比赛中两轮平均成绩的均值（第一轮 + 决赛）。"
  },
  "wr_ao3r" => {
    title_zh: "世界纪录 Ao3R（三轮平均）历史",
    note_zh: "Ao3R：一场比赛中三轮平均成绩的均值（第一轮 + 第二轮 + 决赛）。"
  },
  "wr_ao4r" => {
    title_zh: "世界纪录 Ao4R（四轮平均）历史",
    note_zh: "Ao4R：一场比赛中四轮平均成绩的均值（第一轮 + 第二轮 + 第三轮 + 决赛）。"
  },
  "wr_average_history" => {
    title_zh: "世界纪录平均历史",
    note_zh: "展示各项目世界纪录平均成绩随时间的变化。"
  },
  "wr_bao5" => {
    title_zh: "世界纪录 BAo5（最佳 5 次平均）历史",
    note_zh: "BAo5：一轮中 5 次成绩取最好的 3 次计算平均。"
  },
  "wr_best_average_ratio" => {
    title_zh: "世界纪录最佳/平均比历史",
    note_zh: "最佳/平均比：一轮中最佳单次与平均的比值（越低代表最佳单次越突出）。"
  },
  "wr_best_counting" => {
    title_zh: "世界纪录最佳有效单次历史",
    note_zh: "最佳有效单次：计入 Ao5 的最佳单次（排除去掉的最好和最差成绩）。"
  },
  "wr_bpa" => {
    title_zh: "世界纪录 BPA（最佳可能平均）历史",
    note_zh: "BPA：一轮中前 4 次成绩取最好的 3 次计算平均。"
  },
  "wr_dominance" => {
    title_zh: "排行榜霸榜（单人霸占前 N 席）",
    note_zh: "选手在全历史成绩排行榜上完全霸占前 N 席。并列成绩不计入。"
  },
  "wr_current" => {
    title_zh: "当前世界纪录",
    note_zh: "显示各官方项目当前的世界纪录单次和平均。"
  },
  "wr_first_comp_wr" => {
    title_zh: "首次参赛即创世界纪录",
    note_zh: "在首次 WCA 比赛中就创造了三阶世界纪录的选手。"
  },
  "wr_median" => {
    title_zh: "世界纪录中位数历史",
    note_zh: "中位数：一轮中所有成绩的中间值。若有 DNF，中位数会偏向排名更高的有效成绩。"
  },
  "wr_mo5" => {
    title_zh: "世界纪录 Mo5（5 次均值）历史",
    note_zh: "Mo5：一轮中 5 次成绩的算术平均（不去头尾）。"
  },
  "wr_newcomer" => {
    title_zh: "最佳首次参赛成绩（新人世界纪录）",
    note_zh: "展示选手在首次三阶比赛中取得的最佳单次成绩。"
  },
  "wr_single_history" => {
    title_zh: "世界纪录单次历史",
    note_zh: "展示各项目世界纪录单次成绩随时间的变化。"
  },
  "wr_variance" => {
    title_zh: "世界纪录方差历史",
    note_zh: "方差：一轮中 5 次成绩的样本方差（越低越稳定）。"
  },
  "wr_wao5" => {
    title_zh: "世界纪录 WAo5（最差 5 次平均）历史",
    note_zh: "WAo5：一轮中 5 次成绩取最差的 3 次计算平均。"
  },
  "wr_worst" => {
    title_zh: "世界纪录最差单次历史",
    note_zh: "最差单次：一轮中 5 次全部有效时的最高（最慢）成绩。"
  },
  "wr_worst_counting" => {
    title_zh: "世界纪录最差有效单次历史",
    note_zh: "最差有效单次：计入 Ao5 的最差单次（排除去掉的最好和最差成绩）。"
  },
  "wr_wpa" => {
    title_zh: "世界纪录 WPA（最差可能平均）历史",
    note_zh: "WPA：一轮中前 4 次成绩取最差的 3 次计算平均。"
  },
  "yearly_rankings" => {
    title_zh: nil,
    note_zh: nil
  }
}.freeze
