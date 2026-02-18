require_relative "abstract/ao_rounds"

class WrAo1r < AoRounds
  def initialize
    @title = "World record Ao1R (Average of 1 Round) history"
    @title_zh = "世界纪录 Ao1R（单轮平均）历史"
    @note = "Ao1R: the average from the only round in a competition (single-round events)."
    @note_zh = "Ao1R：在只有一轮的比赛中，该轮的平均成绩。"
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right, "Person" => :left, "Competition" => :left, "Date" => :left, "Details" => :left }
  end

  def round_count
    1
  end
end
