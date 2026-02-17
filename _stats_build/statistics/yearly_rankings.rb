require_relative "./abstract/rankings"

class YearlyRankings < Rankings
  def initialize
    super(
      title: "Yearly rankings",
      note: "By definition these rankings include only results from the current year.",
      condition: <<-SQL
        WHERE YEAR(competition.start_date) = YEAR(CURDATE())
      SQL
    )
  end
end
