require_relative "abstract/ao_rounds"

class WrAo3r < AoRounds
  def initialize
    @title = "World record Ao3R (Average of 3 Rounds) history"
    @title_zh = "世界纪录 Ao3R（三轮平均）历史"
    @note = "Ao3R: average of the 3 round averages (R1 + R2 + Final) in a competition."
    @note_zh = "Ao3R：一场比赛中三轮平均成绩的均值（第一轮 + 第二轮 + 决赛）。"
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right, "Person" => :left, "Competition" => :left, "Date" => :left, "Details" => :left }
  end

  def round_count
    3
  end
end
