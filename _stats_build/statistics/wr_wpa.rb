require_relative "abstract/round_metric"

class WrWpa < RoundMetric
  def initialize
    @title = "WPA (Worst Possible Average)"
    @note = "Worst Possible Average: average of the worst 3 out of the first 4 solves in a round."
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right, "Person" => :left, "Date" => :left, "Competition" => :left, "Details" => :left }
  end

  # NOTE: 基于 5 把的指标，不适用于 Mo3 项目
  def target_events = Events::WITH_AO5

  # NOTE: WPA = 前4次中取最差的3次求均值
  # 需要全部4次都有效（> 0）
  def compute_metric(values, r)
    first4 = values[0..3]
    return nil unless first4.all? { |v| v > 0 }
    # 取最差的3个（最大值）
    worst3 = first4.sort.last(3)
    worst3.sum.to_f / 3
  end
end
