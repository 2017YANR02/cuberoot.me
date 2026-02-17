require_relative "../core/statistic"

class CompleteCompetitionWinners < Statistic
  def initialize
    @title = "Complete competition winners"
    @note = "A complete win means taking the first place in every event on the given competition."
    @table_header = { "Events count" => :right, "Person" => :left, "Citizen of" => :left, "Competition" => :left }
  end

  def query
    <<-SQL
      SELECT
        events_count,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        country.name,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link
      FROM (
        SELECT
          competition_id,
          GROUP_CONCAT(DISTINCT person_id) person_id,
          COUNT(DISTINCT event_id) events_count
        FROM results
        WHERE round_type_id IN ('c', 'f') AND pos = 1 AND best > 0
        GROUP BY competition_id
        HAVING COUNT(DISTINCT person_id) = 1
      ) AS competitions_with_complete_winners
      JOIN persons person ON person.wca_id = person_id AND sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      JOIN countries country ON country.id = person.country_id
      ORDER BY events_count DESC, person.name
    SQL
  end
end
