# 快速测试 WrRoundHistory ranking_data 的分批查询
# 只用 333fm 验证 wr_bpa 的 ranking 输出
require_relative "core/database"
require_relative "statistics/wr_bpa"

puts "=== WrRoundHistory ranking_data 测试 ==="

stat = WrBpa.new

# 只测 FMC 的 ranking 查询
event_id = "333fm"
event_rows = Database.client.query(
  "SELECT person_id, value1, value2, value3, value4, value5, average, best,
   CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link
   FROM results
   JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
   WHERE average > 0 AND event_id = '#{event_id}'"
).to_a
puts "FMC rows: #{event_rows.size}"

# compute_metric for BPA (best of 3 from first 4)
best_by_person = {}
event_rows.each do |r|
  values = (1..5).map { |n| r["value#{n}"] }
  metric = stat.compute_metric(values, r)
  next unless metric
  pid = r["person_id"]
  if !best_by_person[pid] || metric < best_by_person[pid][:metric]
    best_by_person[pid] = { metric: metric, person_link: r["person_link"] }
  end
end

top = best_by_person.values
  .sort_by { |v| v[:metric] }
  .first(5)
puts "\nFMC BPA Top 5:"
top.each do |v|
  puts "  #{v[:metric]} | #{v[:person_link]}"
end

puts "\nDone!"
