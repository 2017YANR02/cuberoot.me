require_relative "abstract/wr_round_history"

class WrWao5 < WrRoundHistory
  def initialize
    @title = "World record WAo5 (Worst Average of 5) history"
    @title_zh = "世界纪录 WAo5（最差 5 次平均）历史"
    @note = "Worst Average of 5: average of the worst 3 out of all 5 solves in a round."
    @note_zh = "WAo5：一轮中 5 次成绩取最差的 3 次计算平均。"
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right, "Person" => :left, "Competition" => :left, "Date" => :left, "Details" => :left }
  end

  # NOTE: WAo5 = 5次中取最差的3次求均值
  # 需要全部5次都有效
  def compute_metric(values, r)
    return nil unless values.all? { |v| v > 0 }
    worst3 = values.sort.last(3)
    worst3.sum.to_f / 3
  end
end
