#!/usr/bin/env ruby

require_relative "../statistics/index"

# NOTE: 生成 stats/README.md 索引页，使用 HTML + data-i18n 属性实现双语
puts "Computing statistics index."
build_path = File.expand_path("../../stats", __dir__)

sort_key = ->(pair) { pair[1].title.gsub(/\d+/) { |n| n.rjust(10, "0") } }

# NOTE: 复用 statistic.rb top 方法的翻译优先级: @title_zh > STAT_TRANSLATIONS > @title
# stat.title_zh 只读 @title_zh（多数统计未设置），必须手动查翻译表
resolve_zh = ->(id, stat) {
  trans = STAT_TRANSLATIONS[id] || {}
  stat.title_zh || trans[:title_zh] || stat.title
}

# NOTE: 被合并到聚合页面的统计 ID 已在 index.rb 中统一定义为 ALL_MERGED

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
# NOTE: WR 组内排序——wr_metric 和 wr_aoxr 置顶，其余按标题字母排
  wr_priority = %w[wr_current wr_metric wr_aoxr]
  wr_sorted = wr_stats.sort_by { |id, stat|
    pri = wr_priority.index(id)
    pri ? [0, pri] : [1, stat.title.gsub(/\d+/) { |n| n.rjust(10, "0") }]
  }
  wr_sorted.each do |id, stat|
    zh = resolve_zh.call(id, stat)
    output += "  <li><a href=\"#{id}\" data-i18n-en=\"#{stat.title}\" data-i18n-zh=\"#{zh}\">#{stat.title}</a></li>\n"
  end
  output += "</ul>\n\n"
end

# 通用统计组
unless general_stats.empty?
  output += "<h2 data-i18n-en=\"General Statistics\" data-i18n-zh=\"通用统计\">General Statistics</h2>\n\n"
  output += "<ul>\n"
  general_stats.sort_by(&sort_key).each do |id, stat|
    zh = resolve_zh.call(id, stat)
    output += "  <li><a href=\"#{id}\" data-i18n-en=\"#{stat.title}\" data-i18n-zh=\"#{zh}\">#{stat.title}</a></li>\n"
  end
  output += "</ul>\n"
end

destination_path = File.join(build_path, "README.md")
File.write(destination_path, output)
puts "File generated at #{destination_path}"
