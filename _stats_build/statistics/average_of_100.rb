require_relative "abstract/average_of_x"

class AverageOf100 < AverageOfX
  def initialize
    super(solve_count: 100)
  end
end
