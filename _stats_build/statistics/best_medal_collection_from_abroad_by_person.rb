require_relative "../core/statistic"

class BestMedalCollectionFromAbroadByPerson < Statistic
  def initialize
    @title = "Best medal collection from abroad by person"
    @note = "Only medals got abroad are taken into account."
    @table_header = { "Person" => :left, "Gold" => :center, "Silver" => :center, "Bronze" => :center, "Total" => :center }
  end

  def query
    <<-SQL
      SELECT
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('**', gold_medals, '**'),
        silver_medals,
        bronze_medals,
        gold_medals + silver_medals + bronze_medals total
      FROM (
        SELECT
          person_id,
          SUM(IF(pos = 1, 1, 0)) gold_medals,
          SUM(IF(pos = 2, 1, 0)) silver_medals,
          SUM(IF(pos = 3, 1, 0)) bronze_medals
        FROM results result
        JOIN competitions competition ON competition.id = competition_id
        WHERE 1
          AND round_type_id IN ('c', 'f')
          AND best > 0
          AND competition.country_id != result.country_id
        GROUP BY person_id
      ) AS medals_by_country
      JOIN persons person ON person.wca_id = person_id AND sub_id = 1
      WHERE gold_medals + silver_medals + bronze_medals > 0
      ORDER BY gold_medals DESC, silver_medals DESC, bronze_medals DESC, person.name
      LIMIT 100
    SQL
  end
end
