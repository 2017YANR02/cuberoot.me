# 测试 MySQL 索引对分批查询速度的影响
require_relative "core/database"

events = %w[333 333fm 777]

puts "=== 无索引基准 ==="
events.each do |eid|
  t0 = Time.now
  rows = Database.client.query(
    "SELECT person_id, value1, value2, value3, value4, value5, average, best,
     CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link
     FROM results
     JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
     WHERE average > 0 AND event_id = '#{eid}'"
  ).to_a
  elapsed = ((Time.now - t0) * 1000).round
  puts "  #{eid}: #{rows.size} rows, #{elapsed}ms"
end

# AoRounds 查询（含 competition join）
puts "\n=== AoRounds 查询 ==="
events.each do |eid|
  t0 = Time.now
  rows = Database.client.query(
    "SELECT result.event_id, result.average, result.round_type_id, result.competition_id,
     CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
     person.wca_id AS person_id,
     CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
     competition.start_date
     FROM results result
     JOIN persons person ON person.wca_id = result.person_id AND person.sub_id = 1
     JOIN competitions competition ON competition.id = result.competition_id
     WHERE result.average > 0 AND result.event_id = '#{eid}'
     ORDER BY competition.start_date"
  ).to_a
  elapsed = ((Time.now - t0) * 1000).round
  puts "  #{eid}: #{rows.size} rows, #{elapsed}ms"
end

puts "\nDone!"
