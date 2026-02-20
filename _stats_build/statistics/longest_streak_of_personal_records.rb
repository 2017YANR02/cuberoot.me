require_relative "../core/statistic"

class LongestStreakOfPersonalRecords < Statistic
  def initialize
    @title = "Longest streak of competitions with a personal record done"
    @table_header = { "Competitions" => :right, "Person" => :left, "Started at" => :left, "Ended at" => :left }
  end

  def query
    <<-SQL
      SELECT
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        event_id,
        best single,
        average
      FROM results
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      JOIN round_types round_type ON round_type.id = round_type_id
      ORDER BY competition.start_date, round_type.rank
    SQL
  end

  def transform(query_results)
    query_results
      .group_by { |result| result["person_link"] }
      .map do |person_link, person_results|
        pbs_by_event = Hash.new { |hash, key| hash[key] = Hash.new(Float::INFINITY) }
        longest_pbs_streak = { count: 0 }
        current_pbs_streak = nil
        person_results.group_by { |result| result["competition_link"] }.each do |competition_link, person_competition_results|
          current_pbs_streak ||= { count: 0, first_competition: competition_link }
          competition_with_pbs = false
          person_competition_results.each do |result|
            pbs = pbs_by_event[result["event_id"]]
            %w(single average).each do |type|
              if result[type] > 0 && result[type] <= pbs[type]
                pbs[type] = result[type]
                competition_with_pbs = true
              end
            end
          end
          if competition_with_pbs
            current_pbs_streak[:count] += 1
            longest_pbs_streak = [longest_pbs_streak, current_pbs_streak].max_by { |pbs_streak| pbs_streak[:count] }
          else
            current_pbs_streak[:last_competition] = competition_link
            current_pbs_streak = nil
          end
        end
        [longest_pbs_streak[:count], person_link, longest_pbs_streak[:first_competition], longest_pbs_streak[:last_competition]]
      end
      .sort_by! { |longest_pbs_streak, _, _, _, _| -longest_pbs_streak }
      .first(100)
  end
end
