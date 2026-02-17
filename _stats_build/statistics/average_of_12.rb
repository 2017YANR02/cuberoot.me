require_relative "abstract/average_of_x"

class AverageOf12 < AverageOfX
  def initialize
    super(solve_count: 12)
  end
end
