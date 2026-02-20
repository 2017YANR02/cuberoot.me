require_relative "../core/statistic"
require_relative "../core/events"

class DnfRateByEvent < Statistic
  def initialize
    @title = "DNF rate by event"
    @table_header = { "DNF rate" => :right, "Event" => :left, "DNFs" => :right, "Attempts" => :right }
  end

  def query
    <<-SQL
      SELECT
        event_id,
        SUM(
            IF(value1 = -1, 1, 0)
          + IF(value2 = -1, 1, 0)
          + IF(value3 = -1, 1, 0)
          + IF(value4 = -1, 1, 0)
          + IF(value5 = -1, 1, 0)
        ) dnfs,
        SUM(
            IF(value1 NOT IN (-2, 0), 1, 0)
          + IF(value2 NOT IN (-2, 0), 1, 0)
          + IF(value3 NOT IN (-2, 0), 1, 0)
          + IF(value4 NOT IN (-2, 0), 1, 0)
          + IF(value5 NOT IN (-2, 0), 1, 0)
        ) attempts
      FROM results
      GROUP BY event_id
    SQL
  end

  def transform(query_results)
    query_results
      .each { |result| result["dnf_rate"] = 100.0 * result["dnfs"] / result["attempts"] }
      .sort_by! { |result| -result["dnf_rate"] }
      .map! do |result|
        ["%0.2f %%" % result["dnf_rate"], Events::ALL[result["event_id"]], result["dnfs"], result["attempts"]]
      end
  end
end
