require_relative "abstract/round_metric"

# NOTE: WR Single 历史——RoundMetric 的退化情况
# compute_metric 直接返回 best 字段，无需从 value1-5 计算
class WrSingleHistory < RoundMetric
  # NOTE: metric = best 字段本身，用高效两步 SQL 排名（不参与 compute_all_rankings）
  def self.batch_ranking? = false
  def initialize
    @title = "Single"
    @title_zh = "单次"
    @note = "Shows how world record singles have progressed over time for each event."
    @note_zh = "展示各项目世界纪录单次成绩随时间的变化。"
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right,
                      "Person" => :left, "Competition" => :left, "Date" => :left, "Details" => :left }
  end

  # NOTE: Single 的 metric 就是 best 字段本身
  def compute_metric(_values, r) = r["best"]
  def format_metric(v, eid) = SolveTime.new(eid, :single, v.round).clock_format
  def target_events = Events::OFFICIAL
  def wr_record_column = "regional_single_record"
  def value_column = "best"
  def value_type = :single
end
