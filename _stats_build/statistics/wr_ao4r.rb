require_relative "abstract/ao_rounds"

class WrAo4r < AoRounds
  def initialize
    @title = "World record Ao4R (Average of 4 Rounds) history"
    @title_zh = "世界纪录 Ao4R（四轮平均）历史"
    @note = "Ao4R: average of the 4 round averages (R1 + R2 + R3 + Final) in a competition."
    @note_zh = "Ao4R：一场比赛中四轮平均成绩的均值（第一轮 + 第二轮 + 第三轮 + 决赛）。"
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right, "Person" => :left, "Competition" => :left, "Date" => :left, "Details" => :left }
  end

  def round_count
    4
  end
end
