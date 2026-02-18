require_relative "abstract/ao_rounds"

class WrAo2r < AoRounds
  def initialize
    @title = "World record Ao2R (Average of 2 Rounds) history"
    @title_zh = "世界纪录 Ao2R（双轮平均）历史"
    @note = "Ao2R: average of the 2 round averages (R1 + Final) in a competition."
    @note_zh = "Ao2R：一场比赛中两轮平均成绩的均值（第一轮 + 决赛）。"
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right, "Person" => :left, "Competition" => :left, "Date" => :left, "Details" => :left }
  end

  def round_count
    2
  end
end
