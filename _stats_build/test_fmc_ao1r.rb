# 快速测试：只用 FMC 数据验证 AoRounds 逻辑
require_relative "core/database"
require_relative "core/solve_time"

puts "=== FMC Ao1R 验证 ==="

# 只查询 FMC 的有效 average 记录
rows = Database.client.query(<<-SQL).to_a
  SELECT
    result.event_id,
    result.average,
    result.round_type_id,
    result.competition_id,
    CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
    person.wca_id AS person_id,
    CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
    competition.start_date
  FROM results result
  JOIN persons person ON person.wca_id = result.person_id AND person.sub_id = 1
  JOIN competitions competition ON competition.id = result.competition_id
  WHERE result.average > 0 AND result.event_id = '333fm'
  ORDER BY competition.start_date
SQL
puts "FMC rows loaded: #{rows.size}"

# 模拟 AoRounds.compute_metrics (round_count=1)
grouped = {}
rows.each do |r|
  key = [r["competition_id"], r["person_id"]]
  grouped[key] ||= { "rows" => [], "person_link" => r["person_link"],
                     "person_id" => r["person_id"],
                     "competition_link" => r["competition_link"],
                     "start_date" => r["start_date"] }
  grouped[key]["rows"] << r
end

# Ao1R: round_count = 1
computed = grouped.filter_map do |_key, info|
  rs = info["rows"]
  next unless rs.size == 1
  next if rs.any? { |r| r["average"].nil? || r["average"] <= 0 }
  values = rs.map { |r| r["average"] }
  avg = values.sum.to_f / 1
  info.merge("_metric" => avg, "_round_values" => values)
end
puts "FMC computed entries (1 round): #{computed.size}"

# WR 历史
sorted = computed.sort_by { |r| r["start_date"] }
min_so_far = Float::INFINITY
wr_records = sorted.select { |r| r["_metric"] < min_so_far && (min_so_far = r["_metric"]) }
puts "FMC WR history entries: #{wr_records.size}"

# 显示前 5 条 WR 历史
puts "\n--- FMC Ao1R WR History (first 5) ---"
wr_records.first(5).each do |r|
  t = SolveTime.new("333fm", :average, r["_metric"].round).clock_format
  puts "#{r['start_date']} | #{t} | #{r['person_link']}"
end

puts "\n--- FMC Ao1R WR History (last 5) ---"
wr_records.last(5).each do |r|
  t = SolveTime.new("333fm", :average, r["_metric"].round).clock_format
  puts "#{r['start_date']} | #{t} | #{r['person_link']}"
end

puts "\nMemory: #{((`wmic process where processid=#{Process.pid} get WorkingSetSize`.split("\n")[1].to_i) / 1024.0 / 1024).round(1)} MB"
