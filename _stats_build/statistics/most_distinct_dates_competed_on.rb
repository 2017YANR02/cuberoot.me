require_relative "../core/statistic"
require "date"

class MostDistinctDatesCompetedOn < Statistic
  def initialize
    @title = "Most distinct dates competed on"
    @table_header = { "Dates" => :right, "Person" => :left, "List" => :left }
  end

  def query
    <<-SQL
      SELECT
        attended_dates,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        dates_list
      FROM (
        SELECT
          COUNT(DISTINCT competition_date) AS attended_dates,
          person_id,
          GROUP_CONCAT(DISTINCT competition_date ORDER BY competition_date ASC SEPARATOR ',') dates_list
        FROM (
          SELECT results.person_id, DATE_FORMAT(competition_dates.competition_date, '%m/%d') competition_date
          FROM results
          JOIN (
            SELECT
              competitions.id AS competition_id,
              DATE_ADD(competitions.start_date, INTERVAL nums.num DAY) AS competition_date
            FROM competitions
            JOIN (
              SELECT 0 AS num UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
            ) AS nums
            WHERE DATE_ADD(competitions.start_date, INTERVAL nums.num DAY) <= competitions.end_date
          ) AS competition_dates ON competition_dates.competition_id = results.competition_id
        ) AS competitions_dates
        GROUP BY person_id
        HAVING attended_dates >= 100
      ) AS comp_dates_by_person
      JOIN persons person ON person.wca_id = person_id AND sub_id = 1
      ORDER BY attended_dates DESC, person.name
    SQL
  end

  def transform(query_results)
    query_results.map do |result|
      dates_list = transform_dates(result["dates_list"])
      [result["attended_dates"], result["person_link"], dates_list]
    end
  end

  def transform_dates(dates_list)
    dates_list
      .split(',')
      .map { |date| date.split('/').map(&:to_i) }
      .group_by { |month, _| month }
      .sort_by { |month, _| month }
      .map do |month, dates|
        month_days = Date.new(2000, month, -1).day
        percentage = 100 * dates.size / month_days
        days = dates.map { |_, day| day }
        "#{Date::MONTHNAMES[month]}: (#{percentage.round}%) #{days.join(", ")}"
      end
      .join("<br />")
  end
end
