require_relative "../core/grouped_statistic"
require_relative "../core/events"
require_relative "../core/solve_time"

class WorstResultOnPodium < GroupedStatistic
  def initialize
    @title = "Worst result providing a podium"
    @note = "Only finals are taken into account. Results where the main statistic is DNF are ignored."
    @table_header = { "Person" => :left, "Single" => :right, "Average" => :right, "Competition" => :left, "Place" => :center }
  end

  def query
    <<-SQL
      SELECT
        format.sort_by,
        format.sort_by_second,
        results.event_id,
        best single,
        average,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, '/results/podiums#e', results.event_id, ')') podium_link,
        pos place
      FROM results
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      JOIN preferred_formats preferred_format ON preferred_format.event_id = results.event_id AND ranking = 1
      JOIN formats format ON format.id = preferred_format.format_id
      WHERE round_type_id IN ('c', 'f') AND pos <= 3
    SQL
  end

  def transform(query_results)
    Events::ALL.map do |event_id, event_name|
      results = query_results
        .select { |result| result["event_id"] == event_id }
        .each do |result|
          result["single"] = SolveTime.new(event_id, :single, result["single"])
          result["average"] = SolveTime.new(event_id, :average, result["average"])
        end
        .select { |result| result[result["sort_by"]].complete? }
        .sort_by! do |result|
          [result[result["sort_by"]], result[result["sort_by_second"]]]
        end
        .reverse!
        .first(10)
        .map! do |result|
          result[result["sort_by"]] = "**#{result[result["sort_by"]].clock_format}**"
          result[result["sort_by_second"]] = result[result["sort_by_second"]].clock_format
          [result["person_link"], result["single"], result["average"], result["podium_link"], result["place"]]
        end
      [event_name, results]
    end
  end
end
