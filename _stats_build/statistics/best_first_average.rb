require_relative "../core/grouped_statistic"
require_relative "../core/events"
require_relative "../core/solve_time"

class BestFirstAverage < GroupedStatistic
  def initialize
    @title = "Best first average"
    @note = "In other words, it's the best average done when participating for the first time in the given event."
    @table_header = { "First average" => :right, "Person": :left }
  end

  def query
    <<-SQL
      SELECT
        event_id,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        average
      FROM results
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      JOIN round_types round_type ON round_type.id = round_type_id
      ORDER BY competition.start_date, round_type.rank
    SQL
  end

  def transform(query_results)
    Events::ALL.map do |event_id, event_name|
      results = query_results
        .select { |result| result["event_id"] == event_id }
        .group_by { |result| result["person_link"] }
        .map { |person_link, results| results.first }
        .select { |result| result["average"] > 0 }
        .sort_by! { |result| result["average"] }
        .first(10)
        .map! do |result|
          average_solve_time = SolveTime.new(event_id, :average, result["average"]).clock_format
          [average_solve_time, result["person_link"]]
        end
      [event_name, results]
    end
  end
end
