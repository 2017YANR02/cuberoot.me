# NOTE: "First Record is WR" = 选手首次破纪录（不限项目、不限 single/average）就是 WR
# 逻辑来源: WCA-Statistics/first R is WR.sql
require_relative "../core/statistic"
require_relative "../core/events"
require_relative "../core/solve_time"

class FirstRIsWr < Statistic
  def initialize
    @title = "First record is a World Record"
    @note = "People whose very first record (single or average, any event) was a World Record."
    @table_header = { "#" => :right, "Person" => :left, "Event" => :left, "Type" => :left,
                      "Result" => :right, "Date" => :left, "Competition" => :left }
  end

  def query
    <<-SQL
      SELECT
        ar.person_name,
        ar.person_id,
        ar.event_id,
        ar.record_type,
        ar.result,
        CONCAT('[', c2.cell_name, '](https://www.worldcubeassociation.org/competitions/', ar.competition_id, ')') competition_link,
        CONCAT('[', p.name, '](https://www.worldcubeassociation.org/persons/', ar.person_id, ')') person_link,
        ar.start_date
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY person_id ORDER BY start_date) AS rn
        FROM (
          SELECT r.person_id, r.person_name, r.event_id, r.competition_id,
                 c.start_date,
                 'single' AS record_type, r.best AS result,
                 r.regional_single_record AS record
          FROM results r
          JOIN competitions c ON r.competition_id = c.id
          WHERE r.regional_single_record IS NOT NULL

          UNION ALL

          SELECT r.person_id, r.person_name, r.event_id, r.competition_id,
                 c.start_date,
                 'average' AS record_type, r.average AS result,
                 r.regional_average_record AS record
          FROM results r
          JOIN competitions c ON r.competition_id = c.id
          WHERE r.regional_average_record IS NOT NULL
        ) all_records
      ) ar
      JOIN persons p ON p.wca_id = ar.person_id AND p.sub_id = 1
      JOIN competitions c2 ON c2.id = ar.competition_id
      WHERE ar.rn = 1 AND ar.record = 'WR'
      ORDER BY ar.start_date
    SQL
  end

  def transform(query_results)
    query_results.each_with_index.map do |r, i|
      event_name = Events::ALL[r["event_id"]] || r["event_id"]
      # NOTE: record_type 决定格式化方式（single 或 average）
      type_sym = r["record_type"] == "single" ? :single : :average
      result_str = SolveTime.new(r["event_id"], type_sym, r["result"]).clock_format
      type_str = r["record_type"] == "single" ? "Single" : "Average"
      date_str = r["start_date"].strftime("%Y-%m-%d")
      [i + 1, r["person_link"], event_name, type_str, result_str, date_str, r["competition_link"]]
    end
  end
end
