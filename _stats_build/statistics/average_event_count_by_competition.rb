require_relative "../core/statistic"

class AverageEventCountByCompetition < Statistic
  def initialize
    @title = "Average event count by competition"
    @note = "In other words, average number of events competitors participated in."
    @table_header = { "Competition" => :left, "Average event count" => :right, "Competitors" => :right, "Country" => :left }
  end

  def query
    <<-SQL
      SELECT
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        AVG(event_count) average_event_count,
        COUNT(*) competitors,
        country.name country
      FROM (
        SELECT
          competition_id,
          person_id,
          COUNT(DISTINCT event_id) event_count
        FROM results
        GROUP BY competition_id, person_id
      ) AS competitors_with_event_count
      JOIN competitions competition ON competition.id = competition_id
      JOIN countries country ON country.id = competition.country_id
      GROUP BY competition_id
      ORDER BY average_event_count DESC
      LIMIT 100
    SQL
  end

  def transform(query_results)
    query_results
      .map do |result|
        [result["competition_link"], "%0.2f" % result["average_event_count"], result["competitors"], result["country"]]
      end
  end
end
