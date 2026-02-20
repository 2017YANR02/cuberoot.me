# 快速测试 RoundMetric 合并后的 WrSingleHistory
# 只查 333fm 验证 compute_all_rankings 的分组执行和 6 列输出
require_relative "core/statistic"
require_relative "core/events"
require_relative "core/solve_time"
require_relative "statistics/wr_single_history"
require_relative "statistics/wr_bao5"

puts "=== 测试 WrSingleHistory.ranking_data (333fm) ==="
s = WrSingleHistory.new
rd = s.ranking_data
# 找到 333fm 的排名数据
fm = rd.find { |event_name, _| event_name.include?("Fewest") }
if fm
  puts "项目: #{fm[0]}"
  fm[1].each { |row| puts row.inspect }
else
  puts "未找到 FMC 数据！检查 target_events"
end

puts "\n=== 测试 WrBao5.ranking_data (333fm) ==="
b = WrBao5.new
rd2 = b.ranking_data
fm2 = rd2.find { |event_name, _| event_name.include?("Fewest") }
if fm2
  puts "项目: #{fm2[0]}"
  fm2[1].each { |row| puts row.inspect }
else
  puts "FMC 没有 BAo5 数据（正常，因为 FMC 不在 WITH_AVERAGE 中）"
end
