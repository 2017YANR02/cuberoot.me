require_relative "../core/statistic"

class MostAttendedCompetitionsInSingleMonth < Statistic
  def initialize
    @title = "Most attended competitions in a single month"
    @table_header = { "Competitions" => :right, "Person" => :left, "Month" => :left, "Year" => :left, "List" => :left }
  end

  def query
    <<-SQL
      SELECT
        attended_within_month,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        month_name,
        competitions_year,
        competition_links
      FROM (
        SELECT
          COUNT(*) attended_within_month,
          person_id,
          MONTHNAME(competition.start_date) month_name,
          YEAR(competition.start_date) competitions_year,
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
        GROUP BY person_id, YEAR(competition.start_date), month_name
        HAVING attended_within_month >= 4
      ) AS comps_within_single_month_by_person
      JOIN persons person ON person.wca_id = person_id AND sub_id = 1
      ORDER BY attended_within_month DESC, person.name
    SQL
  end
end
