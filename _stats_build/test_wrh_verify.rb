# WrRoundHistory 三阶验证：正确性 + 性能
require_relative "core/database"
require_relative "core/events"
require_relative "core/solve_time"
require_relative "statistics/index"

# 只测三阶
test_events = Events::WITH_AVERAGE.select { |id, _| id == "333" }
Events.send(:remove_const, :WITH_AVERAGE)
Events.const_set(:WITH_AVERAGE, test_events)

# 挑 3 个差异最大的子类对比
test_classes = %w[wr_bpa wr_mo5 wr_variance]

puts "=== WrRoundHistory 三阶验证 ==="
puts "测试子类: #{test_classes.join(', ')}"

# === 1. 新实现（一次性计算）===
puts "\n--- 1. 新实现 ---"
t0 = Time.now
results_new = {}
test_classes.each do |name|
  stat = STATISTICS[name]
  results_new[name] = stat.ranking_data
  elapsed = ((Time.now - t0) * 1000).round
  puts "  #{name}: #{elapsed}ms"
end
new_total = ((Time.now - t0) * 1000).round
puts "  总计: #{new_total}ms"

# === 2. 独立计算基准 ===
puts "\n--- 2. 独立计算基准（3 次独立查询）---"
t0 = Time.now
rows = nil
baseline = {}
test_classes.each do |name|
  t1 = Time.now
  # 每个子类独立查一次
  rows = Database.client.query(
    "SELECT person_id, value1, value2, value3, value4, value5, average, best,
     CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link
     FROM results
     JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
     WHERE average > 0 AND event_id = '333'"
  ).to_a
  stat = STATISTICS[name]
  best = {}
  rows.each do |r|
    values = (1..5).map { |n| r["value#{n}"] }
    metric = stat.compute_metric(values, r)
    next unless metric
    pid = r["person_id"]
    best[pid] = { metric: metric, link: r["person_link"] } if !best[pid] || metric < best[pid][:metric]
  end
  baseline[name] = best.values.sort_by { |v| v[:metric] }.first(10)
  elapsed = ((Time.now - t1) * 1000).round
  puts "  #{name}: #{rows.size} rows, #{elapsed}ms"
end
baseline_total = ((Time.now - t0) * 1000).round
puts "  总计: #{baseline_total}ms"

# === 3. 正确性对比 ===
puts "\n--- 3. 正确性对比 ---"
all_pass = true
test_classes.each do |name|
  new_top = results_new[name].first[1]  # [[person_link, metric_str], ...]
  ref_top = baseline[name]
  puts "  #{name}:"
  ref_top.first(5).each_with_index do |ref, i|
    new_link = new_top[i]&.first
    match = ref[:link] == new_link
    puts "    ##{i+1}: #{match ? '✅' : '❌'} #{ref[:link][0..40]}..."
    all_pass = false unless match
  end
end

# === 4. 性能总结 ===
puts "\n--- 4. 性能总结 ---"
puts "新实现（1 次查询，11 子类共享）: #{new_total}ms"
puts "独立计算（3 次查询）: #{baseline_total}ms"
# 推算 11 子类全量
estimated_old = (baseline_total.to_f / 3 * 11).round
puts "推算 11 子类独立: ~#{estimated_old}ms"
puts "加速比: ~#{(estimated_old.to_f / new_total).round(1)}x"
puts "预估节省: ~#{((estimated_old - new_total) / 1000.0).round(1)}s"

puts "\n#{all_pass ? '✅ 所有数据一致' : '❌ 存在不一致'}"
