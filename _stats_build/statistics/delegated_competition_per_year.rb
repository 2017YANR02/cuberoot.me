require_relative "../core/statistic"

class DelegatedCompetitionPerYear < Statistic
  def initialize
    @title = "Delegated competitions per year"
    @note = "Only delegates with at least 5 competitions are taken into account.
             Delegate period is calculated as the difference between first and last delegated competition."
    @table_header = { "Delegated per year" => :right, "Delegated" => :right, "Years" => :right, "Person" => :left, "List on WCA" => :center }
  end

  def query
    <<-SQL
      SELECT
        (delegated_count / years) delegated_per_year,
        delegated_count,
        years,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[List](https://www.worldcubeassociation.org/competitions?year=all+years&state=past&delegate=', user.id, ')') list_link
      FROM (
        SELECT
          COUNT(DISTINCT competition_id) delegated_count,
          (DATEDIFF(MAX(end_date), MIN(start_date)) / 365.25) years,
          delegate_id
        FROM competition_delegates
        JOIN competitions competition ON competition.id = competition_id
        WHERE show_at_all = 1 AND cancelled_at IS NULL AND start_date < CURDATE()
        GROUP BY delegate_id
      ) AS delegated_count_by_user
      JOIN users user ON user.id = delegate_id
      JOIN persons person ON person.wca_id = user.wca_id AND person.sub_id = 1
      WHERE delegated_count >= 5
      ORDER BY delegated_per_year DESC
    SQL
  end

  def transform(query_results)
    query_results.map do |result|
      ["%0.2f" % result["delegated_per_year"], result["delegated_count"], "%0.2f" % result["years"], result["person_link"], result["list_link"]]
    end
  end
end
