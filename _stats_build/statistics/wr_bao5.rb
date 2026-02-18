require_relative "abstract/wr_round_history"

class WrBao5 < WrRoundHistory
  def initialize
    @title = "World record BAo5 (Best Average of 5) history"
    @note = "Best Average of 5: average of the best 3 out of all 5 solves in a round."
    @table_header = { "Result" => :right, "Gain" => :right, "Days" => :right, "Person" => :left, "Competition" => :left, "Date" => :left, "Details" => :left }
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
