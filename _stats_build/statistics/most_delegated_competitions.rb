require_relative "../core/statistic"

class MostDelegatedCompetitions < Statistic
  def initialize
    @title = "Most delegated competitions"
    @table_header = { "Delegated" => :right, "Person" => :left, "List on WCA" => :center }
  end

  def query
    <<-SQL
      SELECT
        delegated_count,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[List](https://www.worldcubeassociation.org/competitions?year=all+years&state=past&delegate=', user.id, ')') list_link
      FROM (
        SELECT
          COUNT(DISTINCT competition_id) delegated_count,
          delegate_id
        FROM competition_delegates
        JOIN competitions competition ON competition.id = competition_id
        WHERE show_at_all = 1 AND cancelled_at IS NULL AND start_date < CURDATE()
        GROUP BY delegate_id
      ) AS delegated_count_by_user
      JOIN users user ON user.id = delegate_id
      JOIN persons person ON person.wca_id = user.wca_id AND person.sub_id = 1
      ORDER BY delegated_count DESC
    SQL
  end
end
