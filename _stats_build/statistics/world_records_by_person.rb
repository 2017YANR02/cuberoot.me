require_relative "../core/statistic"

class WorldRecordsByPerson < Statistic
  def initialize
    @title = "World records count by person"
    @table_header = { "WRs" => :right, "Person" => :left }
  end

  def query
    <<-SQL
      SELECT
        wrs_count,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link
      FROM (
        SELECT
          person_id,
          SUM((IF(regional_single_record = 'WR', 1, 0) + IF(regional_average_record = 'WR', 1, 0))) wrs_count
        FROM results
        GROUP BY person_id
        HAVING wrs_count > 0
      ) AS wrs_count_by_person
      JOIN persons person ON person.wca_id = person_id AND sub_id = 1
      ORDER BY wrs_count DESC, person.name
    SQL
  end
end
