require_relative "../core/grouped_statistic"
require_relative "../core/events"
require_relative "../core/solve_time"

class BestSingleCountingIntoAverage < GroupedStatistic
  def initialize
    @title = "Best single counting into an average of 5"
    @table_header = { "Counting" => :right, "Peson" => :left, "Competition" => :left }
  end

  def query
    <<-SQL
      SELECT
        event_id,
        value1, value2, value3, value4, value5,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, '/results/by_person#', person.wca_id, ')') results_link
      FROM results
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      WHERE format_id = 'a'
    SQL
  end

  def transform(query_results)
    Events::ALL.map do |event_id, event_name|
      results = query_results
        .select { |result| result["event_id"] == event_id }
        .flat_map do |result|
          counting_solves = (1..5).map { |n| result["value#{n}"] }.sort_by! { |value| [value > 0 ? 0 : 1, value] }[1...-1]
          counting_solves
            .select { |solve| solve > 0 }
            .map { |solve| [solve, result["person_link"], result["results_link"]] }
        end
        .sort_by! { |solve, person_link, results_link| solve }
        .first(10)
        .map! do |solve, person_link, results_link|
          solve_time = SolveTime.new(event_id, :single, solve)
          [solve_time.clock_format, person_link, results_link]
        end
      [event_name, results]
    end
  end
end
