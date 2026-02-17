require_relative "../core/statistic"

class MostVisitedContinents < Statistic
  def initialize
    @title = "Most visited continents"
    @table_header = { "Continents" => :right, "Person" => :left }
  end

  def query
    <<-SQL
      SELECT
        visited_continents,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link
      FROM (
        SELECT
          person_id,
          COUNT(DISTINCT continent_id) visited_continents
        FROM results
        JOIN competitions competition ON competition.id = competition_id
        JOIN countries country ON country.id = competition.country_id
        WHERE continent_id != "_Multiple Continents"
        GROUP BY person_id
        HAVING visited_continents >= 4
      ) AS people_with_visited_continents
      JOIN persons person ON person.wca_id = person_id AND sub_id = 1
      ORDER BY visited_continents DESC
    SQL
  end
end
