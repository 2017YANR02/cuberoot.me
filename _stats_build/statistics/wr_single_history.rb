require_relative "../core/grouped_statistic"
require_relative "../core/events"
require_relative "../core/solve_time"

class WrSingleHistory < GroupedStatistic
  def initialize
    @title = "World record single history"
    @note = "Shows how world record singles have progressed over time for each event."
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right, "Person" => :left, "Competition" => :left, "Date" => :left, "Details" => :left }
  end

  def query
    <<-SQL
      SELECT
        result.event_id,
        best single,
        value1, value2, value3, value4, value5,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        competition.start_date
      FROM results result
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      WHERE regional_single_record = 'WR'
      ORDER BY competition.start_date
    SQL
  end

  def transform(query_results)
    Events::OFFICIAL.map do |event_id, event_name|
      # 按日期正序获取该项目所有 WR single 记录
      records = query_results
        .select { |r| r["event_id"] == event_id && r["single"] > 0 }
        .sort_by { |r| r["start_date"] }

      # NOTE: 同一项目可能有多条 WR 记录值相同（平 WR），
      # 这里只保留每个成绩值的第一次出现（真正打破纪录的那次）
      seen_values = {}
      unique_records = records.select do |r|
        val = r["single"]
        if seen_values[val]
          false
        else
          seen_values[val] = true
          true
        end
      end

      results = unique_records.each_with_index.map do |r, i|
        single = SolveTime.new(event_id, :single, r["single"])

        # 计算 gain（相对前一个 WR 的提升百分比）和 duration（间隔天数）
        if i > 0
          prev = unique_records[i - 1]
          prev_value = prev["single"].to_f
          gain = ((prev_value - r["single"]) / prev_value * 100).round(1)
          gain_str = "-#{gain}%"
          duration = (r["start_date"] - prev["start_date"]).to_i
          days_str = duration.to_s
        else
          gain_str = ""
          days_str = ""
        end

        # 格式化五次成绩详情
        details = (1..5).map { |n| SolveTime.new(event_id, :single, r["value#{n}"]).clock_format }
          .reject(&:empty?)
          .join(', ')

        date_str = r["start_date"].strftime("%Y-%m-%d")

        [single.clock_format, gain_str, days_str, r["person_link"], r["competition_link"], date_str, details]
      end

      # 按时间倒序展示（最新 WR 在最前）
      [event_name, results.reverse]
    end
  end
end
