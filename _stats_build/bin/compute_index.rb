#!/usr/bin/env ruby

require_relative "../statistics/index"

# NOTE: 生成 stats/index.md 索引页，使用卡片网格布局 + data-i18n 属性实现双语
puts "Computing statistics index."
build_path = File.expand_path("../../stats", __dir__)

# NOTE: 数字填充排序，确保 "Ao5" 排在 "Ao12" 前面
sort_key = ->(pair) { pair[1].title.gsub(/\d+/) { |n| n.rjust(10, "0") } }

# NOTE: 复用 statistic.rb top 方法的翻译优先级: @title_zh > STAT_TRANSLATIONS > @title
resolve_zh = ->(id, stat) {
  trans = STAT_TRANSLATIONS[id] || {}
  stat.title_zh || trans[:title_zh] || stat.title
}

# NOTE: 被合并到聚合页面的统计 ID 已在 index.rb 中统一定义为 ALL_MERGED

# NOTE: 6 个分类卡片的定义——顺序决定页面展示顺序
# accent 用于卡片顶部彩色强调线
STAT_CATEGORIES = [
  {
    name_en: "World Record Analysis", name_zh: "世界纪录分析",
    icon: "🏆", gradient: "linear-gradient(90deg, #f59e0b, #ef4444, #ec4899)",
    # NOTE: preserve_order = true 时保持 ids 数组顺序，不按字母排序
    preserve_order: true,
    ids: %w[wr_current wr_metric wr_aoxr wr_dominance wr_newcomer
            average_of consecutive_sub_5_average]
  },
  {
    name_en: "Results & Records", name_zh: "成绩与纪录",
    icon: "📊", gradient: "linear-gradient(90deg, #3b82f6, #6366f1)",
    ids: %w[best_potential_fmc_mean best_round most_frequent_results
            moving_average smallest_diff_between_single_and_average yearly_rankings]
  },
  {
    name_en: "Podiums & Honors", name_zh: "领奖台与荣誉",
    icon: "🏅", gradient: "linear-gradient(90deg, #a855f7, #ec4899)",
    ids: %w[best_result_off_podium complete_competition_winners most_4th_places
            most_competitions_before_winning most_finals
            most_podiums_at_single_competition most_podiums_together
            worst_result_on_podium]
  },
  {
    name_en: "Competitor Journey", name_zh: "选手经历",
    icon: "🧑", gradient: "linear-gradient(90deg, #14b8a6, #3b82f6)",
    ids: %w[competitions_per_year_by_person longest_competitions_path
            longest_streak_of_competitions_in_own_country
            longest_streak_of_personal_records longest_streak_of_podiums
            longest_time_to_sub_10
            most_attended_competitions_in_single_month
            most_attended_competitions_in_single_week
            most_competitions_abroad most_completed_solves
            most_distinct_dates_competed_on most_solves_before_bld_success
            most_visited_continents most_visited_countries name_parts_count
            shortest_time_to_get_all_singles
            shortest_time_to_get_all_singles_and_averages
            shortest_time_to_reach_milestone_in_comps_count]
  },
  {
    name_en: "Competition Statistics", name_zh: "赛事统计",
    icon: "🎪", gradient: "linear-gradient(90deg, #f97316, #f59e0b)",
    ids: %w[average_event_count_by_competition competition_days_count_by_region
            competitions_count_by_week competitions_per_year_by_country
            dnf_rate_by_event fewest_competitors_contest
            most_records_at_single_competition]
  },
  {
    name_en: "Records & Countries", name_zh: "纪录与国家",
    icon: "🌍", gradient: "linear-gradient(90deg, #22c55e, #14b8a6)",
    ids: %w[best_medal_collection_from_abroad_by_country
            best_medal_collection_from_abroad_by_person
            current_world_records_by_country delegated_competition_per_year
            first_r_is_wr longest_standing_records longest_streak_of_world_records
            most_delegated_competitions potentially_seen_world_records
            records_in_most_events winned_week_count
            world_championship_podiums_by_country
            world_championship_podiums_by_person world_championship_records
            world_records_by_country world_records_by_person]
  }
].freeze

# 可用统计（排除已合并的）
available = STATISTICS.reject { |id, _| ALL_MERGED.include?(id) }

# NOTE: 兜底检查——找出未被任何分类覆盖的统计 ID
all_categorized_ids = STAT_CATEGORIES.flat_map { |c| c[:ids] }
uncategorized = available.keys - all_categorized_ids
unless uncategorized.empty?
  puts "WARNING: #{uncategorized.size} uncategorized stats: #{uncategorized.join(', ')}"
end

output = ""

# NOTE: 注入 i18n 脚本（语言切换按钮由 i18n.js _injectToggle 自动创建）
output += "<script src=\"../i18n/i18n.js\" defer></script>\n\n"

# NOTE: 页面标题
output += "<h2 data-i18n-en=\"WCA Statistics\" data-i18n-zh=\"WCA 统计数据\">WCA Statistics</h2>\n\n"

# NOTE: 卡片网格容器
output += "<div class=\"stats-dashboard\">\n\n"

STAT_CATEGORIES.each do |cat|
  # 筛选本分类中实际存在的统计
  cat_stats = cat[:ids].filter_map { |id| [id, available[id]] if available[id] }
  next if cat_stats.empty?

  output += "<div class=\"glass-card stat-card\" style=\"--card-gradient: #{cat[:gradient]}\">\n"
  output += "<h3 data-i18n-en=\"#{cat[:icon]} #{cat[:name_en]}\" data-i18n-zh=\"#{cat[:icon]} #{cat[:name_zh]}\">"
  output += "#{cat[:icon]} #{cat[:name_en]}</h3>\n"
  output += "<div class=\"stat-links\">\n"

  # NOTE: preserve_order 为 true 的分类保持 ids 数组原始顺序
  sorted = cat[:preserve_order] ? cat_stats : cat_stats.sort_by(&sort_key)
  sorted.each do |id, stat|
    zh = resolve_zh.call(id, stat)
    output += "<a href=\"#{id}\" data-i18n-en=\"#{stat.title}\" data-i18n-zh=\"#{zh}\">#{stat.title}</a>\n"
  end

  output += "</div>\n"
  output += "</div>\n\n"
end

# NOTE: 兜底分类——未归入任何分类的统计
unless uncategorized.empty?
  output += "<div class=\"stat-card\" style=\"border-top-color: #6b7280\">\n"
  output += "<h3 data-i18n-en=\"Other\" data-i18n-zh=\"其他\">"
  output += "<span class=\"card-icon\">📌</span> Other</h3>\n"
  output += "<div class=\"stat-links\">\n"
  uncategorized.sort.each do |id|
    stat = available[id]
    zh = resolve_zh.call(id, stat)
    output += "<a href=\"#{id}\" data-i18n-en=\"#{stat.title}\" data-i18n-zh=\"#{zh}\">#{stat.title}</a>\n"
  end
  output += "</div>\n"
  output += "</div>\n\n"
end

output += "</div>\n"

destination_path = File.join(build_path, "index.md")
File.write(destination_path, output)
puts "File generated at #{destination_path}"
