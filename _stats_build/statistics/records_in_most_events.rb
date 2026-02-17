require_relative "../core/grouped_statistic"

class RecordsInMostEvents < GroupedStatistic
  def initialize
    @title = "Records in the highest number of events"
    @note = "All historical records are taken into account (i.e. not only the current ones)."
    @table_header = { "Events" => :right, "Person" => :left, "List" => :left }
  end

  def query
    <<-SQL
      SELECT
        regional_single_record,
        regional_average_record,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        event.name event_name
      FROM results
      JOIN persons person ON person.wca_id = person_id AND sub_id = 1
      JOIN events event ON event.id = event_id
      WHERE (regional_single_record IS NOT NULL AND regional_single_record != '')
         OR (regional_average_record IS NOT NULL AND regional_average_record != '')
      ORDER BY event.rank
    SQL
  end

  def transform(query_results)
    {
      "World" => %w(WR),
      "Continental" => %w(AfR AsR NAR SAR ER OcR WR),
      "National" => %w(NR AfR AsR NAR SAR ER OcR WR)
    }.map do |header, record_ids|
      events_with_people = query_results
        .group_by { |result| result["person_link"] }
        .map do |person_link, person_results|
          events = person_results
            .select do |result|
              record_ids.include?(result["regional_single_record"]) || record_ids.include?(result["regional_average_record"])
            end
            .map! { |result| result["event_name"] }
            .uniq
          [events.count, person_link, events.join(', ')]
        end
        .sort_by! { |events_count, _, _| -events_count }
        .first(20)
      [header, events_with_people]
    end
  end
end
