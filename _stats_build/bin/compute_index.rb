#!/usr/bin/env ruby

require_relative "../statistics/index"

# NOTE: 生成 stats/README.md 索引页，使用 HTML + data-i18n 属性实现双语
puts "Computing statistics index."
build_path = File.expand_path("../../stats", __dir__)

sort_key = ->(pair) { pair[1].title.gsub(/\d+/) { |n| n.rjust(10, "0") } }

# 按 wr_ 前缀将统计分为两组
wr_stats, general_stats = STATISTICS.partition { |id, _| id.start_with?("wr_") }

output = ""

# NOTE: 注入 i18n 脚本和语言切换按钮（与子页面保持一致）
output += <<~HTML
  <div style="position:fixed;bottom:16px;right:16px;z-index:9999;display:flex;gap:0;border-radius:6px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.15)">
    <button data-i18n-toggle="en" onclick="I18n.setLocale('en')" style="padding:6px 14px;border:none;cursor:pointer;font-size:14px;font-weight:600;background:rgba(255,255,255,0.1);color:#ccc;backdrop-filter:blur(8px)">EN</button>
    <button data-i18n-toggle="zh" onclick="I18n.setLocale('zh')" style="padding:6px 14px;border:none;cursor:pointer;font-size:14px;font-weight:600;background:rgba(255,255,255,0.1);color:#ccc;backdrop-filter:blur(8px)">中文</button>
  </div>
  <script src="../src/i18n/i18n.js" defer></script>

HTML

# WR 分析组：简洁链接列表，与 General Statistics 风格统一
unless wr_stats.empty?
  output += "<h2 data-i18n-en=\"World Record Analysis\" data-i18n-zh=\"世界纪录分析\">World Record Analysis</h2>\n\n"
  output += "<ul>\n"
  wr_stats.sort_by(&sort_key).each do |id, stat|
    zh = stat.title_zh || stat.title
    output += "  <li><a href=\"#{id}\" data-i18n-en=\"#{stat.title}\" data-i18n-zh=\"#{zh}\">#{stat.title}</a></li>\n"
  end
  output += "</ul>\n\n---\n\n"
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

