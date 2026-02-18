require_relative "abstract/wr_round_history"

class WrWorst < WrRoundHistory
  def initialize
    @title = "World record worst solve in round history"
    @title_zh = "世界纪录最差单次历史"
    @note = "Worst solve: the worst (highest) single in a round where all 5 solves are valid."
    @note_zh = "最差单次：一轮中 5 次全部有效时的最高（最慢）成绩。"
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right, "Person" => :left, "Competition" => :left, "Date" => :left, "Details" => :left }
  end

  # NOTE: Worst = 5次中的最差成绩（最大值）
  # 需要全部5次都有效（否则无意义）
  def compute_metric(values, r)
    return nil unless values.all? { |v| v > 0 }
    values.max
  end
end
