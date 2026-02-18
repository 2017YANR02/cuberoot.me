require_relative "../core/grouped_statistic"
require_relative "../core/events"
require_relative "../core/solve_time"
require_relative "../core/tab_ui"

class WrSingleHistory < GroupedStatistic
  include TabUi

  def initialize
    @title = "Single"
    @title_zh = "单次"
    @note = "Shows how world record singles have progressed over time for each event."
    @note_zh = "展示各项目世界纪录单次成绩随时间的变化。"
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
    @ranking_by_event = {}

    Events::OFFICIAL.map do |event_id, event_name|
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

      # 当前排名：每个 WR single 值只出现一次，取最后 N 个（最近的纪录 = 当前纪录持有者在最上面）
      # NOTE: 对 WR single/average 历史来说，"当前排名" = 按 single 全量排名 top 10
      @ranking_by_event[event_name] = build_ranking_from_all(event_id)

      # WR 历史表格数据
      results = unique_records.each_with_index.map do |r, i|
        single = SolveTime.new(event_id, :single, r["single"])

        if i > 0
          prev = unique_records[i - 1]
          prev_value = prev["single"].to_f
          gain = ((prev_value - r["single"]) / prev_value * 100).round(1)
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
        [single.clock_format, gain_str, days_str, r["person_link"], r["competition_link"], date_str, details]
      end

      [event_name, results.reverse]
    end
  end

  def markdown
    timestamp = Time.parse(Database.metadata["export_timestamp"])
    updated = timestamp.strftime("%e %B %Y").strip

    wr_data = data

    md = "## #{@title}\n\n"
    md += "*Note: #{@note}*\n" if @note
    md += "*Updated on #{updated}*\n\n"

    md += tab_styles
    md += tab_buttons("当前排名", "ranking", "WR 历史", "history")

    # 当前排名面板
    md += "<div id=\"ranking\" class=\"stat-panel active\">\n"
    @ranking_by_event.each do |event_name, rows|
      next if rows.empty?
      md += "<h3>#{event_name}</h3>\n"
      md += "<table>\n<tr><th style=\"text-align:right\">#</th><th>Person</th><th style=\"text-align:right\">Single</th></tr>\n"
      rows.each_with_index do |row, i|
        md += "<tr><td style=\"text-align:right\">#{i + 1}</td>"
        md += "<td>#{md_link_to_html(row[:person_link])}</td>"
        md += "<td style=\"text-align:right\">#{row[:result_str]}</td></tr>\n"
      end
      md += "</table>\n"
    end
    md += "</div>\n\n"

    # WR 历史面板
    md += "<div id=\"history\" class=\"stat-panel\">\n"
    wr_data.each do |event_name, rows|
      next if rows.empty?
      md += "<h3>#{event_name}</h3>\n"
      md += "<table>\n"
      md += html_table_header(@table_header)
      rows.each { |row| md += html_table_row(row, @table_header) }
      md += "</table>\n"
    end
    md += "</div>\n\n"

    md += tab_script
    md
  end

  private

  # NOTE: 从全量 results 中取每项目 single top 10
  def build_ranking_from_all(event_id)
    require_relative "../core/database"
    # 利用之前 WR 查询的数据不包含全量排名，需要额外查询
    # 使用 WrRoundHistory 的缓存（如果可用），否则单独查
    @@single_ranking_cache ||= begin
      Database.client.query(
        "SELECT event_id, person_id, best,
         CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link
         FROM results
         JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
         WHERE best > 0
         ORDER BY event_id, best"
      ).to_a
    end

    # 每人每项目最佳 single
    best_by_person = {}
    @@single_ranking_cache.each do |r|
      next unless r["event_id"] == event_id
      pid = r["person_id"]
      if !best_by_person[pid] || r["best"] < best_by_person[pid]["best"]
        best_by_person[pid] = r
      end
    end

    best_by_person.values
      .sort_by { |r| r["best"] }
      .first(10)
      .map do |r|
        result_str = SolveTime.new(event_id, :single, r["best"]).clock_format
        { person_link: r["person_link"], result_str: result_str }
      end
  end
end
