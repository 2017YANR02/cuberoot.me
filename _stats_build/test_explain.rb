require_relative "core/database"

# EXPLAIN 纯 results 查询
puts "=== EXPLAIN: 纯 results ==="
Database.client.query("EXPLAIN SELECT person_id, average, best, value1, value2, value3, value4, value5 FROM results WHERE average > 0 AND event_id = '333'").each { |r| puts r.inspect }

# EXPLAIN 带 JOIN 的完整查询
puts "\n=== EXPLAIN: 带 JOIN ==="
Database.client.query("EXPLAIN SELECT person_id, average, best, value1, value2, value3, value4, value5, CONCAT(person.name) person_link FROM results JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1 WHERE average > 0 AND event_id = '333'").each { |r| puts r.inspect }

# 单独测 纯SQL无JOIN 的速度
puts "\n=== 纯 results（无 JOIN）==="
t0 = Time.now
rows = Database.client.query("SELECT person_id, average, best, value1, value2, value3, value4, value5 FROM results WHERE average > 0 AND event_id = '333'").to_a
puts "  333: #{rows.size} rows, #{((Time.now - t0) * 1000).round}ms"

# 对比：只取 COUNT
puts "\n=== COUNT ==="
t0 = Time.now
r = Database.client.query("SELECT COUNT(*) as c FROM results WHERE average > 0 AND event_id = '333'").first
puts "  333 count: #{r['c']}, #{((Time.now - t0) * 1000).round}ms"

# 查看索引列表
puts "\n=== results 表索引 ==="
Database.client.query("SHOW INDEX FROM results WHERE Key_name LIKE '%event%' OR Key_name LIKE '%avg%'").each { |r| puts "  #{r['Key_name']}: #{r['Column_name']} (#{r['Seq_in_index']})" }
