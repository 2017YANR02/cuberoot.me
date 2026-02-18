require_relative "abstract/ao_rounds"

class WrAo4r < AoRounds
  def initialize
    @title = "World record Ao4R (Average of 4 Rounds) history"
    @note = "Ao4R: average of the 4 round averages (R1 + R2 + R3 + Final) in a competition."
    @table_header = { "Result" => :right, "Gain" => :right, "Days" => :right, "Person" => :left, "Competition" => :left, "Date" => :left, "Details" => :left }
  end

  def round_count
    4
  end
end
