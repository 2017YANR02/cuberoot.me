require_relative "abstract/round_metric"

class WrBestCounting < RoundMetric
  def initialize
    @title = "Best counting solve"
    @note = "Best counting solve: the best single that counts into the Ao5 (excluding the dropped best and worst)."
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right, "Person" => :left, "Competition" => :left, "Date" => :left, "Details" => :left }
  end

  # NOTE: Best Counting = Ao5 中计入平均的3次成绩中的最好一次
  # 即去掉最好和最差后，剩余3次中的最小值
  # 等价于排序后第2个值（0-indexed: sorted[1]）
  def compute_metric(values, r)
    valid = values.select { |v| v > 0 }
    invalid_count = values.count { |v| v <= 0 }

    case invalid_count
    when 0
      # 5个全部有效，去掉最好和最差，取剩余3个中最小的
      sorted = valid.sort
      sorted[1]  # 第2小 = counting 中的最好
    when 1
      # 1个 DNF：DNF 是最差，去掉后从4个中去掉最好，取剩余3个中最小的
      sorted = valid.sort
      sorted[1]
    else
      nil  # 2个及以上 DNF，Ao5 本身就是 DNF
    end
  end
end
