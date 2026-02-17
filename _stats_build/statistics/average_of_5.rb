require_relative "abstract/average_of_x"

class AverageOf5 < AverageOfX
  def initialize
    super(solve_count: 5)
  end
end
