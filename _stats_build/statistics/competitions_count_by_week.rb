require_relative "../core/statistic"

class CompetitionsCountByWeek < Statistic
  def initialize
    @title = "Competitions count by week"
    @note = "Week is considered to start on Monday and end on Sunday."
    @table_header = { "Competitions" => :center, "Week start" => :right, "Week end" => :right, "List on WCA" => :center }
  end

  def query
    <<-SQL
      SELECT
        COUNT(*) competitions_count,
        DATE_ADD(start_date, INTERVAL(-WEEKDAY(start_date)) DAY) week_start_date,
        DATE_ADD(start_date, INTERVAL(6 - WEEKDAY(start_date)) DAY) week_end_date,
        CONCAT('[List](https://www.worldcubeassociation.org/competitions?state=custom&from_date=', MIN(start_date), '&to_date=', MAX(end_date), ')') list_link
      FROM competitions
      WHERE show_at_all = 1 AND cancelled_at IS NULL
      GROUP BY week_start_date, week_end_date
      ORDER BY competitions_count DESC, week_start_date DESC
    SQL
  end

  def transform(query_results)
    query_results.map do |result|
      date_format = "%e %b %Y"
      week_start = result["week_start_date"].strftime(date_format)
      week_end = result["week_end_date"].strftime(date_format)
      [result["competitions_count"], week_start, week_end, result["list_link"]]
    end
  end
end
