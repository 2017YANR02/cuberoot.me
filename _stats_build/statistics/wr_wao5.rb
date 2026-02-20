require_relative "abstract/round_metric"

class WrWao5 < RoundMetric
  def initialize
    @title = "WAo5 (Worst Average of 5)"
    @note = "Worst Average of 5: average of the worst 3 out of all 5 solves in a round."
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right, "Person" => :left, "Date" => :left, "Competition" => :left, "Details" => :left }
  end

  # NOTE: WAo5 = 5次中取最差的3次求均值
  # 需要全部5次都有效
  def compute_metric(values, r)
    return nil unless values.all? { |v| v > 0 }
    worst3 = values.sort.last(3)
    worst3.sum.to_f / 3
  end
end
