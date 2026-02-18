require_relative "abstract/ao_rounds"

class WrAo2r < AoRounds
  def initialize
    @title = "World record Ao2R (Average of 2 Rounds) history"
    @note = "Ao2R: average of the 2 round averages (R1 + Final) in a competition."
    @table_header = { "Result" => :right, "Gain" => :right, "Days" => :right, "Person" => :left, "Competition" => :left, "Date" => :left, "Details" => :left }
  end

  def round_count
    2
  end
end
