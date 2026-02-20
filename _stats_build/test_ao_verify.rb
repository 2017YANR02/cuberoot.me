# 三阶验证：数据正确性 + 性能量化
require_relative "core/database"
require_relative "core/events"
require_relative "core/solve_time"
require_relative "statistics/abstract/ao_rounds"

# 只测三阶
test_events = Events::WITH_AVERAGE.select { |id, _| id == "333" }
Events.send(:remove_const, :WITH_AVERAGE)
Events.const_set(:WITH_AVERAGE, test_events)

# === 1. 新实现 ===
puts "=== 1. 新实现（一次性计算）==="
require_relative "statistics/wr_ao1r"
require_relative "statistics/wr_ao2r"
require_relative "statistics/wr_ao3r"
require_relative "statistics/wr_ao4r"

t0 = Time.now
ao1r = WrAo1r.new; ao1r_data = ao1r.data
t1 = Time.now
ao2r = WrAo2r.new; ao2r_data = ao2r.data
t2 = Time.now
ao3r = WrAo3r.new; ao3r_data = ao3r.data
t3 = Time.now
ao4r = WrAo4r.new; ao4r_data = ao4r.data
t4 = Time.now
new_total = ((t4 - t0) * 1000).round
puts "  ao1r: #{((t1 - t0) * 1000).round}ms (触发计算)"
puts "  ao2r: #{((t2 - t1) * 1000).round}ms (缓存)"
puts "  ao3r: #{((t3 - t2) * 1000).round}ms (缓存)"
puts "  ao4r: #{((t4 - t3) * 1000).round}ms (缓存)"
puts "  总计: #{new_total}ms"

# 显示 WR 数
[["ao1r", ao1r_data], ["ao2r", ao2r_data], ["ao3r", ao3r_data], ["ao4r", ao4r_data]].each do |name, d|
  d.each { |ename, wr| puts "  #{name} #{ename}: #{wr.size} WR records" }
end

# === 2. 独立计算基准（模拟修改前：4个子类各自查一次） ===
puts "\n=== 2. 独立计算基准（模拟4次查询）==="
sort_order = { '1'=>1,'d'=>1,'2'=>2,'e'=>2,'3'=>3,'g'=>3,'c'=>99,'f'=>99 }
baseline_wr = {}

t0 = Time.now
[1, 2, 3, 4].each do |rc|
  rows = Database.client.query(
    "SELECT result.event_id, result.average, result.round_type_id, result.competition_id,
     CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
     person.wca_id AS person_id,
     CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
     competition.start_date
     FROM results result
     JOIN persons person ON person.wca_id = result.person_id AND person.sub_id = 1
     JOIN competitions competition ON competition.id = result.competition_id
     WHERE result.average > 0 AND result.event_id = '333'
     ORDER BY competition.start_date"
  ).to_a
  puts "  rc=#{rc}: queried #{rows.size} rows, #{((Time.now - t0) * 1000).round}ms elapsed"

  grouped = {}
  rows.each do |r|
    key = [r["competition_id"], r["person_id"]]
    grouped[key] ||= { "rows" => [], "person_link" => r["person_link"],
                       "person_id" => r["person_id"],
                       "competition_link" => r["competition_link"],
                       "start_date" => r["start_date"] }
    grouped[key]["rows"] << r
  end
  computed = grouped.filter_map do |_, info|
    rs = info["rows"]
    next unless rs.size == rc
    sorted = rs.sort_by { |r| sort_order[r["round_type_id"]] || 50 }
    vals = sorted.map { |r| r["average"] }
    avg = vals.sum.to_f / rc
    info.merge("_metric" => avg, "_round_values" => vals)
  end
  min = Float::INFINITY
  wr = computed.sort_by { |r| r["start_date"] }.select { |r| r["_metric"] < min && (min = r["_metric"]) }
  baseline_wr[rc] = wr.size
end
baseline_total = ((Time.now - t0) * 1000).round
puts "  总计: #{baseline_total}ms"

# === 3. 正确性对比 ===
puts "\n=== 3. 正确性对比 ==="
all_pass = true
{ 1 => ao1r_data, 2 => ao2r_data, 3 => ao3r_data, 4 => ao4r_data }.each do |rc, d|
  d.each do |ename, wr|
    ref = baseline_wr[rc]
    match = wr.size == ref
    puts "  ao#{rc}r 333: WR #{wr.size} vs #{ref} #{match ? '✅' : '❌'}"
    all_pass = false unless match
  end
end

# === 4. 性能总结 ===
puts "\n=== 4. 性能总结 ==="
puts "新实现（1 次查询）: #{new_total}ms"
puts "独立计算（4 次查询）: #{baseline_total}ms"
puts "加速比: #{(baseline_total.to_f / new_total).round(1)}x"
puts "节省: #{baseline_total - new_total}ms (#{((baseline_total - new_total).to_f / 1000).round(1)}s)"
puts "\n#{all_pass ? '✅ 所有数据一致' : '❌ 存在不一致'}"
