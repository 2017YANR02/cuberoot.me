require_relative "../core/grouped_statistic"
require_relative "../core/events"
require_relative "../core/solve_time"
require_relative "../core/tab_ui"

class WrAverageHistory < GroupedStatistic
  include TabUi

  def initialize
    @title = "Average"
    @title_zh = "平均"
    @note = "Shows how world record averages have progressed over time for each event."
    @note_zh = "展示各项目世界纪录平均成绩随时间的变化。"
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right, "Person" => :left, "Competition" => :left, "Date" => :left, "Details" => :left }
  end

  def query
    <<-SQL
      SELECT
        result.event_id,
        average,
        value1, value2, value3, value4, value5,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        competition.start_date
      FROM results result
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      WHERE regional_average_record = 'WR'
      ORDER BY competition.start_date
    SQL
  end

  def transform(query_results)
    # NOTE: 排除没有官方 average 的项目（333bf, 444bf, 555bf, 333mbf）
    events_with_average = Events::WITH_AVERAGE

    @ranking_by_event = {}

    events_with_average.map do |event_id, event_name|
      records = query_results
        .select { |r| r["event_id"] == event_id && r["average"] > 0 }
        .sort_by { |r| r["start_date"] }

      # NOTE: 同一项目可能有多条 WR 记录值相同（平 WR），
      # 这里只保留每个成绩值的第一次出现
      seen_values = {}
      unique_records = records.select do |r|
        val = r["average"]
        if seen_values[val]
          false
        else
          seen_values[val] = true
          true
        end
      end

      # 当前排名：average top 10
      @ranking_by_event[event_name] = build_ranking_from_results(event_id, field: "average", type: :average, cache_name: "wr_average")

      results = unique_records.each_with_index.map do |r, i|
        avg = SolveTime.new(event_id, :average, r["average"])
        [avg.clock_format] + wr_history_row(unique_records, i, event_id) { |r| r["average"] }
      end

      [event_name, results.reverse]
    end
  end

  # NOTE: 用 top + tabbed_grouped_markdown + 公共 RANKING_HEADER 渲染
  def markdown
    # NOTE: 必须先调 data 触发 transform，才能填充 @ranking_by_event
    history_data = data
    ranking_data = @ranking_by_event.transform_values { |rows| ranking_to_arrays(rows) }
    top + tabbed_grouped_markdown(
      ranking_data: ranking_data,
      ranking_header: RANKING_HEADER,
      history_data: history_data,
      history_header: @table_header
    )
  end

end
