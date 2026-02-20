require_relative "abstract/round_metric"

class WrVariance < RoundMetric
  def initialize
    @title = "Variance"
    @note = "Variance: sample variance of all 5 solves in a round (lower = more consistent)."
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right, "Person" => :left, "Competition" => :left, "Date" => :left, "Details" => :left }
  end

  # NOTE: Variance = 5次成绩的样本方差 (n-1)
  # 需要全部5次都有效
  def compute_metric(values, r)
    return nil unless values.all? { |v| v > 0 }
    mean = values.sum.to_f / values.length
    sum_sq = values.sum { |v| (v - mean) ** 2 }
    sum_sq / (values.length - 1)
  end

  # NOTE: 方差值用小数格式显示，不使用 SolveTime 格式化
  def format_metric(metric_value, event_id)
    # 将厘秒方差转换为秒方差（除以 10000）再显示
    variance_seconds = metric_value / 10000.0
    "%.3f" % variance_seconds
  end
end
