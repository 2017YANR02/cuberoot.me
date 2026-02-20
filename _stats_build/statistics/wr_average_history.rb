require_relative "abstract/round_metric"

# NOTE: WR Average 历史——RoundMetric 的退化情况
# compute_metric 直接返回 average 字段，无需从 value1-5 计算
# value_column/target_events/wr_record_column 与基类默认值相同，无需覆盖
class WrAverageHistory < RoundMetric
  # NOTE: metric = average 字段本身，用高效两步 SQL 排名（不参与 compute_all_rankings）
  def self.batch_ranking? = false
  def initialize
    @title = "Average"
    @note = "Shows how world record averages have progressed over time for each event."
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right,
                      "Person" => :left, "Date" => :left, "Competition" => :left, "Details" => :left }
  end

  # NOTE: Average 的 metric 就是 average 字段本身
  def compute_metric(_values, r) = r["average"]
  def format_metric(v, eid) = SolveTime.new(eid, :average, v.round).clock_format
end
