require_relative "abstract/average_of_x"

class AverageOf25 < AverageOfX
  def initialize
    super(solve_count: 25)
  end
end
