require_relative "../core/statistic"

class MostCompetitionsAbroad < Statistic
  def initialize
    @title = "Most competitions abroad"
    @table_header = { "Competitions" => :right, "Person" => :left }
  end

  def query
    <<-SQL
      SELECT
        competitions_abroad,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_name
      FROM (
        SELECT
          person_id,
          COUNT(DISTINCT competition_id) competitions_abroad
        FROM results result
        JOIN competitions competition ON competition.id = competition_id
        WHERE 1
          AND result.country_id != competition.country_id
          AND competition.country_id -- Ignore Multiple Countries used for continental FMC competitions.
            NOT IN ('XA', 'XE', 'XF', 'XM', 'XN', 'XO', 'XS', 'XW')
        GROUP BY person_id
        ORDER BY competitions_abroad DESC
        LIMIT 100
      ) AS person_ids_with_competitions_abroad
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      ORDER BY competitions_abroad DESC
    SQL
  end
end
