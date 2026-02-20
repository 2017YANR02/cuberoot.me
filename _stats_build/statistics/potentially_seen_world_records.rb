require_relative "../core/statistic"

class PotentiallySeenWorldRecords < Statistic
  def initialize
    @title = "Potentially seen world records"
    @note = "Potentially means that a person was on a competition and could see a world record being set."
    @table_header = { "WRs" => :right, "Person" => :left }
  end

  def query
    <<-SQL
      SELECT
        potentially_seen_wrs_count,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_name
      FROM (
        SELECT
          person_id,
          SUM(wrs_count) potentially_seen_wrs_count
        FROM (SELECT DISTINCT person_id, competition_id FROM results) AS person_with_competition
        JOIN (
          SELECT
            competition_id,
            SUM((IF(regional_single_record = 'WR', 1, 0) + IF(regional_average_record = 'WR', 1, 0))) wrs_count
          FROM results
          GROUP BY competition_id
          HAVING wrs_count > 0
        ) AS wrs_count_by_competition ON person_with_competition.competition_id = wrs_count_by_competition.competition_id
        GROUP BY person_id
      ) AS potentially_seen_wrs_count_by_person
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      ORDER BY potentially_seen_wrs_count DESC
      LIMIT 100
    SQL
  end
end
