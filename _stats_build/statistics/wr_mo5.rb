require_relative "abstract/round_metric"

class WrMo5 < RoundMetric
  def initialize
    @title = "Mo5 (Mean of 5)"
    @note = "Mean of 5: average of all 5 solves in a round (no trimming)."
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right, "Person" => :left, "Date" => :left, "Competition" => :left, "Details" => :left }
  end

  # NOTE: 基于 5 把的指标，不适用于 Mo3 项目
  def target_events = Events::WITH_AO5

  # NOTE: Mo5 = 5次全部求均值，需要全部有效
  def compute_metric(values, r)
    return nil unless values.all? { |v| v > 0 }
    values.sum.to_f / 5
  end
end
