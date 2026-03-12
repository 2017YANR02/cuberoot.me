require_relative "abstract/average_of_x"

# NOTE: Mo3（Mean of 3）— WCA 术语中 ≤3 次用 Mean 而非 Average
# Mean 是纯算术平均（不截断），任一 DNF 即整体 DNF
class AverageOf3 < AverageOfX
  def initialize
    super(solve_count: 3)
    # NOTE: WCA 术语 ≤3 次用 Mean 而非 Average，覆写父类默认值
    @title = "Mean of 3"
    @note = "3 consecutive official attempts are considered (arithmetic mean, no trimming). " \
            "Top N varies by event: 333 top 15, most events top 30, " \
            "333fm/pyram/clock/444bf/555bf/magic/mmagic top 300, " \
            "333bf top 2000."
    @table_header = { "Mo3" => :right, "Person" => :left, "Times" => :left }
  end

  # NOTE: 覆写父类的 trimmed mean，Mo3 不截断
  # 3 次直接算术平均，任一 DNF (Infinity) 即整体 DNF
  def average(solves, event_id)
    return SolveTime::DNF if solves.any? { |s| s == Float::INFINITY }
    mean_value = solves.reduce(:+) / solves.count.to_f
    # NOTE: FMC 成绩单位是 moves（整数），乘 100 统一为厘秒
    mean_value *= 100 if event_id == "333fm"
    SolveTime.new(event_id, :average, mean_value.round)
  end
end
