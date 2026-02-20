require_relative "../core/grouped_statistic"
require_relative "../core/events"
require_relative "../core/solve_time"

class LongestStandingRecords < GroupedStatistic
  def initialize
    @title = "Longest standing records"
    @table_header = { "Event" => :left, "Type" => :left, "Days" => :right, "Result" => :right, "Person" => :left, "Competition" => :left }
  end

  def query
    <<-SQL
      SELECT
        regional_single_record,
        regional_average_record,
        best single,
        average,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, '/results/by_person#', person.wca_id, ')') results_link,
        competition.start_date competition_date,
        event_id,
        continent.name continent
      FROM results result
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      JOIN countries country ON country.id = result.country_id
      JOIN continents continent ON continent.id = country.continent_id
      WHERE regional_single_record IN ('AfR', 'AsR', 'ER', 'NAR', 'OcR', 'SAR', 'WR')
         OR regional_average_record IN ('AfR', 'AsR', 'ER', 'NAR', 'OcR', 'SAR', 'WR')
      ORDER BY competition_date
    SQL
  end

  def transform(query_results)
    {
      "World" => %w(WR),
      "Africa" => %w(AfR WR),
      "Asia" => %w(AsR WR),
      "Europe" => %w(ER WR),
      "North America" => %w(NAR WR),
      "Oceania" => %w(OcR WR),
      "South America" => %w(SAR WR)
    }.map do |region, record_ids|
      results = %w(single average).flat_map do |type|
        query_results
          .select do |result|
            record_ids.include?(result["regional_#{type}_record"]) &&
            (region == "World" || region == result["continent"]) &&
            Events::OFFICIAL.has_key?(result["event_id"])
          end
          .group_by { |result| result["event_id"] }
          .flat_map do |event_id, results|
            results.each do |result_1|
              better_result = results.find { |result_2| result_2[type] < result_1[type] }
              better_date = better_result ? better_result["competition_date"] : Date.today
              result_1["days"] = better_date - result_1["competition_date"]
            end
            results
          end
          .map! do |result|
            event_name = Events::ALL[result["event_id"]]
            solve_time = SolveTime.new(result["event_id"], type, result[type])
            [event_name, type.capitalize, result["days"].to_i, solve_time.clock_format, result["person_link"], result["results_link"]]
          end
        end
        .sort_by! { |event, type, days, *rest| -days }
        .take(10)
        .map! { |event, type, days, *rest| [event, type, "**#{days}**", *rest] }
      [region, results]
    end
  end
end
