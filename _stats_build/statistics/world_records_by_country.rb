require_relative "../core/statistic"

class WorldRecordsByCountry < Statistic
  def initialize
    @title = "World records count by country"
    @table_header = { "WRs" => :right, "Country" => :left }
  end

  def query
    <<-SQL
      SELECT
        wrs_count,
        country.name
      FROM (
        SELECT
          country_id,
          SUM((IF(regional_single_record = 'WR', 1, 0) + IF(regional_average_record = 'WR', 1, 0))) wrs_count
        FROM results
        GROUP BY country_id
        HAVING wrs_count > 0
      ) AS wrs_count_by_country
      JOIN countries country ON country.id = country_id
      ORDER BY wrs_count DESC, country.name
    SQL
  end
end
