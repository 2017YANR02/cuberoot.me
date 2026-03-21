require_relative "abstract/average_of_x"

class AverageOf1000 < AverageOfX
  def initialize
    super(solve_count: 1000)
  end
end
