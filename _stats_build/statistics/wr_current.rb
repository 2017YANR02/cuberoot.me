require_relative "../core/statistic"
require_relative "../core/events"
require_relative "../core/solve_time"

class WrCurrent < Statistic
  def initialize
    @title = "Current world records"
    @note = "Shows the current world record single and average for each official event."
    @table_header = { "Event" => :left, "Type" => :left, "Result" => :right, "Person" => :left, "Date" => :left, "Competition" => :left }
  end

  def query
    # NOTE: 直接从 results 表查所有 WR 记录，在 Ruby 中筛选当前 WR
    # 避免 ranks 表与 results 表的复杂 JOIN
    <<-SQL
      SELECT
        r.event_id,
        r.best AS single,
        r.average,
        r.regional_single_record,
        r.regional_average_record,
        CONCAT('[', p.name, '](https://www.worldcubeassociation.org/persons/', p.wca_id, ')') person_link,
        CONCAT('[', c.cell_name, '](https://www.worldcubeassociation.org/competitions/', c.id, ')') competition_link,
        c.start_date
      FROM results r
      JOIN persons p ON p.wca_id = r.person_id AND p.sub_id = 1
      JOIN competitions c ON c.id = r.competition_id
      WHERE r.regional_single_record = 'WR'
         OR r.regional_average_record = 'WR'
      ORDER BY r.event_id, c.start_date
    SQL
  end

  def transform(query_results)
    Events::OFFICIAL.flat_map do |event_id, event_name|
      rows = []

      # 当前 WR single = 该项目所有 WR single 中值最小的（WCA 编码保证越小越好）
      single_records = query_results
        .select { |r| r["event_id"] == event_id && r["regional_single_record"] == "WR" && r["single"] > 0 }

      unless single_records.empty?
        # NOTE: 值最小即为当前 WR；若有平局取最新日期
        best = single_records.min_by { |r| [r["single"], -r["start_date"].to_time.to_i] }
        st = SolveTime.new(event_id, :single, best["single"])
        rows << [event_name, "Single", st.clock_format, best["person_link"], best["start_date"].strftime("%Y-%m-%d"), best["competition_link"]]
      end

      # 当前 WR average
      avg_records = query_results
        .select { |r| r["event_id"] == event_id && r["regional_average_record"] == "WR" && r["average"] > 0 }

      unless avg_records.empty?
        best = avg_records.min_by { |r| [r["average"], -r["start_date"].to_time.to_i] }
        st = SolveTime.new(event_id, :average, best["average"])
        rows << [event_name, "Average", st.clock_format, best["person_link"], best["start_date"].strftime("%Y-%m-%d"), best["competition_link"]]
      end

      rows
    end
  end
end
