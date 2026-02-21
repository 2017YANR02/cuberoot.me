require_relative "abstract/round_metric"

class WrWorst < RoundMetric
  def initialize
    @title = "Worst solve in round"
    @note = "Worst solve: the worst (highest) single in a round where all 5 solves are valid."
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right, "Person" => :left, "Date" => :left, "Competition" => :left, "Details" => :left }
  end

  # NOTE: 基于 5 把的指标，不适用于 Mo3 项目
  def target_events = Events::WITH_AO5

  # NOTE: Worst = 5次中的最差成绩（最大值）
  # 需要全部5次都有效（否则无意义）
  def compute_metric(values, r)
    return nil unless values.all? { |v| v > 0 }
    values.max
  end
end
