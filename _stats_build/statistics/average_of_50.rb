require_relative "abstract/average_of_x"

class AverageOf50 < AverageOfX
  def initialize
    super(solve_count: 50)
  end
end
