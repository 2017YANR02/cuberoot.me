require_relative "../core/grouped_statistic"
require_relative "../core/events"

class MostFrequentResults < GroupedStatistic
  def initialize
    @title = "Most frequent results"
    @table_header = { "Count" => :right, "Result" => :right }
  end

  def query
    <<-SQL
      SELECT
        event_id,
        #{Database::ATTEMPTS_SUBQUERY} AS attempts
      FROM results result
      WHERE event_id != '333mbo'
    SQL
  end

  def transform(query_results)
    Events::ALL.map do |event_id, event_name|
      counts_with_results = query_results
        .select { |result| result["event_id"] == event_id }
        .flat_map do |result|
          (result["attempts"] || "").split(",").map do |v|
            { "event_id" => result["event_id"], "value" => v.to_i }
          end
        end
        .select { |result| result["value"] > 0 }
        .group_by { |result| result["value"] }
        .map { |value, results| [value, results.length] }
        .sort_by { |value, count| -count }
        .first(10)
        .map { |value, count| [count, SolveTime.new(event_id, :single, value).clock_format] }
      [event_name, counts_with_results]
    end
  end
end
