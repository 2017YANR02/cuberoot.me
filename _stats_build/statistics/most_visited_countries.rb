require_relative "../core/statistic"

class MostVisitedCountries < Statistic
  def initialize
    @title = "Most visited countries"
    @table_header = { "Countries" => :right, "Person" => :left }
  end

  def query
    <<-SQL
      SELECT
        visited_countries,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link
      FROM (
        SELECT
          person_id,
          COUNT(DISTINCT competition.country_id) visited_countries
        FROM results result
        JOIN competitions competition ON competition.id = competition_id
        WHERE competition.country_id -- Ignore Multiple Countries used for continental FMC competitions.
          NOT IN ('XA', 'XE', 'XF', 'XM', 'XN', 'XO', 'XS', 'XW')
        GROUP BY person_id
        ORDER BY visited_countries DESC
        LIMIT 100
      ) AS visited_countries_by_person
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      ORDER BY visited_countries DESC
    SQL
  end
end
