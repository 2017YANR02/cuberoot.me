# 验证 AoRounds 一次性计算模式
# 测试：ao1r 触发计算后，ao2r 直接取缓存
require_relative "core/database"
require_relative "core/events"
require_relative "core/solve_time"
require_relative "statistics/abstract/ao_rounds"
require_relative "statistics/wr_ao1r"
require_relative "statistics/wr_ao2r"

puts "=== AoRounds 一次性计算模式测试 ==="

# NOTE: 临时 monkey-patch query_for_event，只查 777 和 333fm
class AoRounds
  alias_method :original_query_for_event, :query_for_event
  @@query_count = 0
  def query_for_event(event_id)
    @@query_count += 1
    puts "  [MySQL] 查询 ##{@@query_count}: #{event_id}"
    original_query_for_event(event_id)
  end
  def self.query_count; @@query_count; end
end

# 临时缩小 Events::WITH_AVERAGE 只保留 2 个项目
original_events = Events::WITH_AVERAGE
Events.send(:remove_const, :WITH_AVERAGE)
Events.const_set(:WITH_AVERAGE, original_events.select { |id, _| %w[777 333fm].include?(id) })

puts "\n--- ao1r.data() ---"
t0 = Time.now
ao1r = WrAo1r.new
ao1r_data = ao1r.data
puts "ao1r: #{ao1r_data.size} events, #{((Time.now - t0) * 1000).round}ms"
ao1r_data.each { |name, wr| puts "  #{name}: #{wr.size} WR records" }

puts "\n--- ao2r.data() ---"
t0 = Time.now
ao2r = WrAo2r.new
ao2r_data = ao2r.data
puts "ao2r: #{ao2r_data.size} events, #{((Time.now - t0) * 1000).round}ms"
ao2r_data.each { |name, wr| puts "  #{name}: #{wr.size} WR records" }

puts "\n--- 结果 ---"
puts "总 MySQL 查询次数: #{AoRounds.query_count}"
puts "预期: 2（每个 event 只查一次）"
puts AoRounds.query_count == 2 ? "✅ 通过" : "❌ 失败"

# 恢复
Events.send(:remove_const, :WITH_AVERAGE)
Events.const_set(:WITH_AVERAGE, original_events)
