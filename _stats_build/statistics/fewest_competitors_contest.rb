require_relative "../core/statistic"

class FewestCompetitorsContest < Statistic
  def initialize
    @title = "Fewest competitors contest"
    @table_header = { "Competitors" => :right, "Competition" => :left }
  end

  def query
    <<-SQL
      SELECT
        competitors_count,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition
      FROM (
        SELECT
          COUNT(DISTINCT person_id) competitors_count,
          competition_id
        FROM results
        GROUP BY competition_id
        HAVING competitors_count <= 15
      ) AS competitors_count_by_competition
      JOIN competitions competition ON competition.id = competition_id
      ORDER BY competitors_count
    SQL
  end
end
