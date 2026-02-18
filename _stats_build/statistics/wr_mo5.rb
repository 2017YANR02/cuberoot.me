require_relative "abstract/wr_round_history"

class WrMo5 < WrRoundHistory
  def initialize
    @title = "World record Mo5 (Mean of 5) history"
    @title_zh = "世界纪录 Mo5（5 次均值）历史"
    @note = "Mean of 5: average of all 5 solves in a round (no trimming)."
    @note_zh = "Mo5：一轮中 5 次成绩的算术平均（不去头尾）。"
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right, "Person" => :left, "Competition" => :left, "Date" => :left, "Details" => :left }
  end

  # NOTE: Mo5 = 5次全部求均值，需要全部有效
  def compute_metric(values, r)
    return nil unless values.all? { |v| v > 0 }
    values.sum.to_f / 5
  end
end
