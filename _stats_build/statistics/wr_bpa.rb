require_relative "abstract/round_metric"

class WrBpa < RoundMetric
  def initialize
    @title = "BPA (Best Possible Average)"
    @title_zh = "BPA（最佳可能平均）"
    @note = "Best Possible Average: average of the best 3 out of the first 4 solves in a round."
    @note_zh = "BPA：一轮中前 4 次成绩取最好的 3 次计算平均。"
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right, "Person" => :left, "Competition" => :left, "Date" => :left, "Details" => :left }
  end

  # NOTE: BPA = 前4次中取最好的3次求均值
  # 如果前4次中有2个及以上 DNF/DNS，则无效
  def compute_metric(values, r)
    first4 = values[0..3]
    valid = first4.select { |v| v > 0 }
    return nil if valid.length < 3
    # 取最好的3个（最小值）
    best3 = valid.sort.first(3)
    best3.sum.to_f / 3
  end
end
