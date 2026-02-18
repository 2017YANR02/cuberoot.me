#!/usr/bin/env ruby

require_relative "../statistics/index"

# NOTE: 将统计分为 WR 分析（自定义）和通用统计两组，方便用户区分
puts "Computing statistics index."
build_path = File.expand_path("../../stats", __dir__)

sort_key = ->(pair) { pair[1].title.gsub(/\d+/) { |n| n.rjust(10, "0") } }

# 按 wr_ 前缀将统计分为两组
wr_stats, general_stats = STATISTICS.partition { |id, _| id.start_with?("wr_") }

output = ""

# WR 分析组：附带 note 说明，让用户理解每个指标
unless wr_stats.empty?
  output += "## World Record Analysis\n\n"
  output += "*Custom statistics analyzing world records from various perspectives.*\n\n"
  wr_stats.sort_by(&sort_key).each do |id, stat|
    output += "- [#{stat.title}](#{id})"
    # 显示 note 作为简要说明
    output += " — *#{stat.note}*" if stat.respond_to?(:note) && stat.note && !stat.note.empty?
    output += "\n"
  end
  output += "\n---\n\n"
end

# 通用统计组
unless general_stats.empty?
  output += "## General Statistics\n\n"
  general_stats.sort_by(&sort_key).each do |id, stat|
    output += "- [#{stat.title}](#{id})\n"
  end
end

destination_path = File.join(build_path, "README.md")
File.write(destination_path, output)
puts "File generated at #{destination_path}"
