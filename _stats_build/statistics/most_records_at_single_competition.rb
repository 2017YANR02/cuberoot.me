require_relative "../core/grouped_statistic"

class MostRecordsAtSingleCompetition < GroupedStatistic
  def initialize
    @title = "Most records at a single competition"
    @table_header = { "Records" => :right, "Person" => :left, "Results" => :left }
  end

  def query
    <<-SQL
      SELECT
        regional_single_record,
        regional_average_record,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, '/results/by_person#', person.wca_id, ')') results_link
      FROM results
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      WHERE (regional_single_record IS NOT NULL AND regional_single_record != '')
         OR (regional_average_record IS NOT NULL AND regional_average_record != '')
    SQL
  end

  def transform(query_results)
    {
      "World" => %w(WR),
      "Continental" => %w(AfR AsR NAR SAR ER OcR WR),
      "National" => %w(NR AfR AsR NAR SAR ER OcR WR)
    }.map do |header, record_ids|
      records_at_single_competition = query_results
        .group_by { |result| [result["person_link"], result["results_link"]] } # Group by person and competition.
        .map do |(person_link, results_link), results|
          records_count = results
            .map! do |result|
              result_records = 0
              result_records += 1 if record_ids.include?(result["regional_single_record"])
              result_records += 1 if record_ids.include?(result["regional_average_record"])
              result_records
            end
            .reduce(&:+)
          [records_count, person_link, results_link]
        end
        .sort_by! { |records_count, person_link, results_link| -records_count }
      [header, take_top_n_with_ties(records_at_single_competition, 20, 0)]
    end
  end
end

def take_top_n_with_ties(xs, n, value_index)
  if xs.length > n
    boundary_value = xs[n - 1][value_index]
    xs.first(n).concat(
      xs[n..-1].take_while { |x| x[value_index] == boundary_value }
    )
  else
    xs
  end
end
