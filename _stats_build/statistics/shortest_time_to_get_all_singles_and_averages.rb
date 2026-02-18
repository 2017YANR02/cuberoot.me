require_relative "../core/statistic"
require_relative "../core/events"

class ShortestTimeToGetAllSinglesAndAverages < Statistic
  def initialize
    @title = "Shortest time to get all singles and averages"
    @title_zh = "最快集齐所有单次和平均成绩"
    @note = "Only current official events are taken into account."
    @note_zh = "仅考虑当前官方项目。"
    @table_header = { "Days" => :right, "Person" => :left }
  end

  # All events except 3x3x3 MBLD have an average.
  NUM_EVENTS_WITH_AVERAGES = Events::OFFICIAL.length - 1

  def query
    <<-SQL
      SELECT
        event_id,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        start_date,
        best,
        average
      FROM (
        -- NOTE: ranks_single 表为空，改从 results 表直接筛选
        SELECT person_id
        FROM results
        JOIN events event ON event.id = event_id
        WHERE event.rank < 900 AND best > 0
        GROUP BY person_id
        HAVING COUNT(DISTINCT event_id) = #{Events::OFFICIAL.length}
      ) AS all_events_people
      JOIN (
        -- NOTE: ranks_average 表为空，改从 results 表直接筛选
        SELECT person_id
        FROM results
        JOIN events event ON event.id = event_id
        WHERE event.rank < 900 AND average > 0
        GROUP BY person_id
        HAVING COUNT(DISTINCT event_id) = #{NUM_EVENTS_WITH_AVERAGES}
      ) AS all_average_people ON all_average_people.person_id = all_events_people.person_id
      JOIN results result ON result.person_id = all_events_people.person_id
      JOIN persons person ON person.wca_id = result.person_id and person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      ORDER BY start_date
    SQL
  end

  def transform(query_results)
    query_results
      .group_by { |result| result["person_link"] }
      .map do |person_link, results|
        first_competition_date = results[0]["start_date"]
        first_successes = %w(best average).flat_map do |type|
          results
            .select { |result| result[type] > 0 }
            .group_by { |result| result["event_id"] }
            .map { |event_id, results| results.map { |result| result["start_date"] }.min }
        end
        [(first_successes.max - first_competition_date).to_i, person_link]
      end
      .sort_by! { |days, person_link| days }
  end
end
