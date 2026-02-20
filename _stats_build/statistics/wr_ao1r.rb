require_relative "abstract/ao_rounds"

class WrAo1r < AoRounds
  def initialize
    @title = "World record Ao1R (Average of 1 Round) history"
    @note = "Ao1R: the average from the only round in a competition (single-round events)."
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right, "Person" => :left, "Date" => :left, "Competition" => :left, "Details" => :left }
  end

  def round_count
    1
  end
end
