#!/usr/bin/env ruby

require_relative "../statistics/index"

# NOTE: 生成 stats/README.md 索引页，使用卡片网格布局 + data-i18n 属性实现双语
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
            average_of best_single_counting_into_average consecutive_sub_5_average]
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

# NOTE: GitHub Corner —— 右上角章鱼猫链接
output += <<~'GITHUB_CORNER'

<a href="https://github.com/RuiminYan/ruiminyan.github.io" class="github-corner" aria-label="View source on Github"><svg width="80" height="80" viewBox="0 0 250 250" style="fill:#151513; color:#fff; position: absolute; top: 0; border: 0; right: 0;" aria-hidden="true"><path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z"></path><path d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2" fill="currentColor" style="transform-origin: 130px 106px;" class="octo-arm"></path><path d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z" fill="currentColor" class="octo-body"></path></svg></a><style>.github-corner:hover .octo-arm{animation:octocat-wave 560ms ease-in-out}@keyframes octocat-wave{0%,100%{transform:rotate(0)}20%,60%{transform:rotate(-25deg)}40%,80%{transform:rotate(10deg)}}@media (max-width:500px){.github-corner:hover .octo-arm{animation:none}.github-corner .octo-arm{animation:octocat-wave 560ms ease-in-out}}</style>
GITHUB_CORNER

destination_path = File.join(build_path, "README.md")
File.write(destination_path, output)
puts "File generated at #{destination_path}"
