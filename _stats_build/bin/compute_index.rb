#!/usr/bin/env ruby

require_relative "../statistics/index"

# NOTE: 生成 stats/README.md 索引页，使用 HTML + data-i18n 属性实现双语
puts "Computing statistics index."
build_path = File.expand_path("../../stats", __dir__)

sort_key = ->(pair) { pair[1].title.gsub(/\d+/) { |n| n.rjust(10, "0") } }

# NOTE: 被合并到聚合页面的统计 ID，不在索引页单独列出
MERGED_INTO_METRIC = %w[
  wr_single_history wr_average_history
  wr_bao5 wr_wao5 wr_mo5 wr_bpa wr_wpa
  wr_median wr_best_counting wr_worst_counting wr_worst
  wr_variance wr_best_average_ratio
].freeze

MERGED_INTO_AOXR = %w[wr_ao1r wr_ao2r wr_ao3r wr_ao4r].freeze

ALL_MERGED = (MERGED_INTO_METRIC + MERGED_INTO_AOXR).freeze

# 按 wr_ 前缀将统计分为两组，排除被合并的
wr_stats, general_stats = STATISTICS
  .reject { |id, _| ALL_MERGED.include?(id) }
  .partition { |id, _| id.start_with?("wr_") }

output = ""

# NOTE: 注入 i18n 脚本（语言切换按钮由 i18n.js _injectToggle 自动创建）
output += "<script src=\"../i18n/i18n.js\" defer></script>\n\n"

# WR 分析组
unless wr_stats.empty?
  output += "<h2 data-i18n-en=\"World Record Analysis\" data-i18n-zh=\"世界纪录分析\">World Record Analysis</h2>\n\n"
  output += "<ul>\n"
  wr_stats.sort_by(&sort_key).each do |id, stat|
    zh = stat.title_zh || stat.title
    output += "  <li><a href=\"#{id}\" data-i18n-en=\"#{stat.title}\" data-i18n-zh=\"#{zh}\">#{stat.title}</a></li>\n"
  end
  output += "</ul>\n\n"
end

# 通用统计组
unless general_stats.empty?
  output += "<h2 data-i18n-en=\"General Statistics\" data-i18n-zh=\"通用统计\">General Statistics</h2>\n\n"
  output += "<ul>\n"
  general_stats.sort_by(&sort_key).each do |id, stat|
    zh = stat.title_zh || stat.title
    output += "  <li><a href=\"#{id}\" data-i18n-en=\"#{stat.title}\" data-i18n-zh=\"#{zh}\">#{stat.title}</a></li>\n"
  end
  output += "</ul>\n"
end

destination_path = File.join(build_path, "README.md")
File.write(destination_path, output)
puts "File generated at #{destination_path}"
