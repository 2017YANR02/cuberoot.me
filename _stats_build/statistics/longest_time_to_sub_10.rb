require_relative "../core/statistic"

class LongestTimeToSub10 < Statistic
  def initialize
    @title = "Longest time to achieve sub 10 3x3x3 average"
    @table_header = { "Person" => :left, "Years" => :right }
  end

  def query
    <<-SQL
      SELECT
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        (DATEDIFF(first_sub_10_competition.start_date, first_competition.start_date) / 365.25) years
      FROM (
        SELECT person_id
        FROM ranks_average
        WHERE event_id = '333' AND best < 1000
      ) AS sub_10_person
      JOIN (
        SELECT person_id, MIN(start_date) start_date
        FROM results
        JOIN competitions competition ON competition.id = competition_id
        GROUP BY person_id
      ) AS first_competition ON first_competition.person_id = sub_10_person.person_id
      JOIN (
        SELECT person_id, MIN(start_date) start_date
        FROM results
        JOIN competitions competition ON competition.id = competition_id
        WHERE event_id = '333' AND average > 0 AND average < 1000
        GROUP BY person_id
      ) AS first_sub_10_competition ON first_sub_10_competition.person_id = sub_10_person.person_id
      JOIN persons person ON person.wca_id = sub_10_person.person_id AND sub_id = 1
      ORDER BY years DESC
      LIMIT 100
    SQL
  end

  def transform(query_results)
    query_results.map do |result|
      [result["person_link"], "%0.2f" % result["years"]]
    end
  end
end
