require_relative "abstract/ao_rounds"

class WrAo3r < AoRounds
  def initialize
    @title = "World record Ao3R (Average of 3 Rounds) history"
    @note = "Ao3R: average of the 3 round averages (R1 + R2 + Final) in a competition."
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right, "Person" => :left, "Date" => :left, "Competition" => :left, "Details" => :left }
  end

  def round_count
    3
  end
end
