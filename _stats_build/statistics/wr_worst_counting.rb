require_relative "abstract/wr_round_history"

class WrWorstCounting < WrRoundHistory
  def initialize
    @title = "Worst counting solve"
    @title_zh = "最差有效单次"
    @note = "Worst counting solve: the worst single that counts into the Ao5 (excluding the dropped best and worst)."
    @note_zh = "最差有效单次：计入 Ao5 的最差单次（排除去掉的最好和最差成绩）。"
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right, "Person" => :left, "Competition" => :left, "Date" => :left, "Details" => :left }
  end

  # NOTE: Worst Counting = Ao5 中计入平均的3次成绩中的最差一次
  # 即去掉最好和最差后，剩余3次中的最大值
  # 等价于排序后第4个值（0-indexed: sorted[3]）
  def compute_metric(values, r)
    valid = values.select { |v| v > 0 }
    invalid_count = values.count { |v| v <= 0 }

    case invalid_count
    when 0
      # 5个全部有效，去掉最好和最差，取剩余3个中最大的
      sorted = valid.sort
      sorted[3]  # 第4小 = counting 中的最差
    when 1
      # 1个 DNF：DNF 是最差，去掉后从4个中去掉最好，取剩余3个中最大的
      sorted = valid.sort
      sorted[2]  # 4个有效中第3大 = counting 中的最差
    else
      nil  # 2个及以上 DNF，Ao5 本身就是 DNF
    end
  end
end
