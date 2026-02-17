require_relative "../core/statistic"

class MostAttendedCompetitionsInSingleWeek < Statistic
  def initialize
    @title = "Most attended competitions in a single week"
    @table_header = { "Competitions" => :right, "Person" => :left, "Start date" => :left, "End date" => :left, "List" => :left }
  end

  def query
    <<-SQL
      SELECT
        attended_within_week,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        week_start_date,
        week_end_date,
        competition_links
      FROM (
        SELECT
          COUNT(*) attended_within_week,
          person_id,
          DATE_ADD(competition.start_date, INTERVAL(-WEEKDAY(competition.start_date)) DAY) week_start_date,
          DATE_ADD(competition.start_date, INTERVAL(6-WEEKDAY(competition.start_date)) DAY) week_end_date,
          GROUP_CONCAT(
            CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')')
            ORDER BY competition.start_date ASC
            SEPARATOR ', '
          ) competition_links
        FROM (
          SELECT DISTINCT competition_id, person_id
          FROM results
        ) AS results
        JOIN competitions competition ON competition.id = competition_id
        GROUP BY person_id, week_start_date, week_end_date, YEAR(competition.start_date)
        HAVING attended_within_week >= 3
      ) AS comps_within_single_week_by_person
      JOIN persons person ON person.wca_id = person_id AND sub_id = 1
      ORDER BY attended_within_week DESC, person.name
    SQL
  end

  def transform(query_results)
    query_results.map do |result|
      date_format = "%e&nbsp;%b&nbsp;%Y"
      week_start = result["week_start_date"].strftime(date_format)
      week_end = result["week_end_date"].strftime(date_format)
      [result["attended_within_week"], result["person_link"], week_start, week_end, result["competition_links"]]
    end
  end
end
