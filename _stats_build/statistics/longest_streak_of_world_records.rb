require_relative "../core/statistic"

class LongestStreakOfWorldRecords < Statistic
  def initialize
    @title = "Longest streak of world records of the same type in the given event"
    @table_header = { "Records" => :right, "Event" => :left, "Type" => :left, "Person" => :left, "Started at" => :left, "Ended at" => :left, "Years" => :right }
  end

  def query
    <<-SQL
      SELECT
        regional_single_record,
        regional_average_record,
        best single,
        average,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        competition.start_date competition_date,
        event_id
      FROM results result
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      WHERE regional_single_record = 'WR' OR regional_average_record = 'WR'
    SQL
  end

  def transform(query_results)
    Events::ALL.flat_map do |event_id, event_name|
      %w(single average).flat_map do |type|
        query_results
          .select { |result| result["event_id"] == event_id && result["regional_#{type}_record"] == "WR" }
          .sort_by! { |result| [result["competition_date"], -result[type]] }
          .reduce([]) do |wr_streaks, result|
            current_wrs_streak = wr_streaks.last || {}
            if result["person_link"] == current_wrs_streak[:person_link]
              current_wrs_streak[:count] += 1
            else
              current_wrs_streak[:last_competition] = result["competition_link"]
              current_wrs_streak[:end_date] = result["competition_date"]
              wr_streaks << {
                count: 1,
                event: event_name,
                type: type.capitalize,
                person_link: result["person_link"],
                start_date: result["competition_date"],
                end_date: Date.today,
                first_competition: result["competition_link"]
              }
            end
            wr_streaks
          end
      end
    end
    .select { |wr_streak| wr_streak[:count] > 1 }
    .sort_by! { |wr_streak| -wr_streak[:count] }
    .map! do |wr_streak|
      years = (wr_streak[:end_date] - wr_streak[:start_date]).to_i / 365.25
      [wr_streak[:count], wr_streak[:event], wr_streak[:type], wr_streak[:person_link], wr_streak[:first_competition], wr_streak[:last_competition], "%0.2f" % years]
    end
  end
end
