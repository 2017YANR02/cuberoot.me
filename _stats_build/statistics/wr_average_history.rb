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
      @ranking_by_event[event_name] = build_ranking_from_all(event_id)

      results = unique_records.each_with_index.map do |r, i|
        avg = SolveTime.new(event_id, :average, r["average"])

        if i > 0
          prev = unique_records[i - 1]
          prev_value = prev["average"].to_f
          gain = ((prev_value - r["average"]) / prev_value * 100).round(1)
          gain_str = "#{gain}%"
          duration = (r["start_date"] - prev["start_date"]).to_i
          days_str = duration.to_s
        else
          gain_str = ""
          days_str = ""
        end

        details = (1..5).map { |n| SolveTime.new(event_id, :single, r["value#{n}"]).clock_format }
          .reject(&:empty?)
          .join(', ')

        date_str = r["start_date"].strftime("%Y-%m-%d")
        [avg.clock_format, gain_str, days_str, r["person_link"], r["competition_link"], date_str, details]
      end

      [event_name, results.reverse]
    end
  end

  # NOTE: 用 top + tabbed_grouped_markdown 替换原手写 HTML
  # ranking rows 是 hash，这里归一化为数组并加上排名序号
  def markdown
    ranking_header = { "#" => :right, "Person" => :left, "Average" => :right }
    # NOTE: 必须先调 data 触发 transform，才能填充 @ranking_by_event
    history_data = data
    ranking_data = @ranking_by_event.transform_values do |rows|
      rows.each_with_index.map { |r, i| [i + 1, r[:person_link], r[:result_str]] }
    end
    top + tabbed_grouped_markdown(
      ranking_data: ranking_data,
      ranking_header: ranking_header,
      history_data: history_data,
      history_header: @table_header
    )
  end

  private

  # NOTE: 从全量 results 中取每项目 average top 10
  # 支持磁盘缓存，STATS_USE_CACHE=1 时跳过全量 MySQL 查询
  def build_ranking_from_all(event_id)
    require_relative "../core/database"
    @@average_ranking_cache ||= begin
      cache_file = File.join(Statistic::CACHE_DIR, "wr_average_ranking.marshal")
      if ENV["STATS_USE_CACHE"] == "1" && File.exist?(cache_file)
        Marshal.load(File.binread(cache_file))
      else
        result = Database.client.query(
          "SELECT event_id, person_id, average,
           CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link
           FROM results
           JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
           WHERE average > 0
           ORDER BY event_id, average"
        ).to_a
        FileUtils.mkdir_p(Statistic::CACHE_DIR)
        File.binwrite(cache_file, Marshal.dump(result))
        result
      end
    end

    best_by_person = {}
    @@average_ranking_cache.each do |r|
      next unless r["event_id"] == event_id
      pid = r["person_id"]
      if !best_by_person[pid] || r["average"] < best_by_person[pid]["average"]
        best_by_person[pid] = r
      end
    end

    best_by_person.values
      .sort_by { |r| r["average"] }
      .first(10)
      .map do |r|
        result_str = SolveTime.new(event_id, :average, r["average"]).clock_format
        { person_link: r["person_link"], result_str: result_str }
      end
  end
end
