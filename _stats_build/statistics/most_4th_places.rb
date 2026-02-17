require_relative "../core/statistic"

class Most4thPlaces < Statistic
  def initialize
    @title = "Most 4th places"
    @note = "Only finals are taken into account."
    @table_header = { "4th places" => :right, "Person" => :left }
  end

  def query
    <<-SQL
      SELECT
        4th_places_count,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link
      FROM (
        SELECT
          person_id wca_id,
          COUNT(*) 4th_places_count
        FROM results
        JOIN round_types round_type ON round_type.id = round_type_id
        WHERE round_type.final = 1 AND pos = 4 AND best > 0
        GROUP BY person_id
        ORDER BY 4th_places_count DESC
        LIMIT 100
      ) AS 4th_places_count_by_person
      JOIN persons person ON person.wca_id = 4th_places_count_by_person.wca_id AND person.sub_id = 1
      ORDER BY 4th_places_count DESC
    SQL
  end
end
