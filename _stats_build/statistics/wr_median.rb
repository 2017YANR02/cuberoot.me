require_relative "abstract/round_metric"

class WrMedian < RoundMetric
  def initialize
    @title = "Median"
    @note = "Median: the middle value of all solves in a round. With DNFs, the median shifts to a higher-ranked valid solve."
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right, "Person" => :left, "Competition" => :left, "Date" => :left, "Details" => :left }
  end

  # NOTE: Median = 5次成绩排序后的中位数（第3位）
  # 有 DNF/DNS 时中位数往后移：1个无效→第4位，2个无效→第5位，3个及以上→无效
  def compute_metric(values, r)
    valid = values.select { |v| v > 0 }.sort
    invalid_count = values.count { |v| v <= 0 }
    case invalid_count
    when 0
      valid[2]  # 5个有效，取第3个
    when 1
      valid[2]  # 4个有效，中位数位置从第3升到第3（排序后第3个）
    when 2
      valid[2]  # 3个有效，取最大的
    else
      nil       # 3个及以上无效，无法计算
    end
  end
end
