require_relative "../core/statistic"

class CompetitionsPerYearByPerson < Statistic
  def initialize
    @title = "Competitions per year by person"
    @table_header = { "Competitions per year" => :right, "Competitions" => :right, "Years" => :right, "Person" => :left }
  end

  def query
    <<-SQL
      SELECT
        (competitions / years) competitions_per_year,
        competitions,
        years,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link
      FROM (
          SELECT
            COUNT(DISTINCT competition_id) competitions,
            (DATEDIFF(CURDATE(), MIN(start_date)) / 365.25) years,
            person_id wca_id
          FROM results result
          JOIN competitions competition ON competition.id = competition_id
          GROUP BY person_id
          HAVING years >= 1
      ) AS data_by_person
      JOIN persons person ON person.wca_id = data_by_person.wca_id
      ORDER BY competitions_per_year DESC
      LIMIT 100
    SQL
  end

  def transform(query_results)
    query_results.map do |result|
      ["%0.2f" % result["competitions_per_year"], result["competitions"], "%0.2f" % result["years"], result["person_link"]]
    end
  end
end
