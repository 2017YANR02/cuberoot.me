require_relative "../core/statistic"

class CurrentWorldRecordsByCountry < Statistic
  def initialize
    @title = "Current world records count by country"
    @table_header = { "WRs" => :right, "Country" => :left, "People" => :left }
  end

  def query
    <<-SQL
      SELECT
        wrs_count,
        country.name,
        people
      FROM (
        SELECT
          country_id,
          COUNT(*) wrs_count,
          GROUP_CONCAT(
            DISTINCT CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')')
            ORDER BY person.name
            SEPARATOR ', '
          ) people
        FROM (
          SELECT person_id FROM ranks_single WHERE world_rank = 1
          UNION ALL
          SELECT person_id FROM ranks_average WHERE world_rank = 1
        ) AS ranks
        JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
        GROUP BY country_id
      ) AS wrs_count_by_country
      JOIN countries country ON country.id = country_id
      ORDER BY wrs_count DESC, country.name
    SQL
  end
end
