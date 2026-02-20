require_relative "../core/statistic"

class MostPodiumsAtSingleCompetition < Statistic
  def initialize
    @title = "Most podiums at a single competition"
    @table_header = { "Podiums" => :right, "Person" => :left }
  end

  def query
    <<-SQL
      SELECT
        podiums_count,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, '/results/podiums)') competition
      FROM (
        SELECT
          COUNT(*) podiums_count,
          person_id,
          competition_id
        FROM results
        WHERE 1
          AND round_type_id IN ('f', 'c')
          AND best > 0
          AND pos IN (1, 2, 3)
        GROUP BY person_id, competition_id
        HAVING podiums_count >= 10
        ORDER BY podiums_count DESC
      ) AS podiums_count_by_person_by_competition
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
    SQL
  end
end
