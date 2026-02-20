require_relative "abstract/round_metric"

class WrBao5 < RoundMetric
  def initialize
    @title = "BAo5 (Best Average of 5)"
    @note = "Best Average of 5: average of the best 3 out of all 5 solves in a round."
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right, "Person" => :left, "Date" => :left, "Competition" => :left, "Details" => :left }
  end

  # NOTE: BAo5 = 5次中取最好的3次求均值
  # 至少需要3次有效成绩
  def compute_metric(values, r)
    valid = values.select { |v| v > 0 }
    return nil if valid.length < 3
    best3 = valid.sort.first(3)
    best3.sum.to_f / 3
  end
end
