# NOTE: 抽象基类，用于计算跨轮次 average of averages 的 WR 历史
# AoXR = 一场比赛中某人恰好参加了 X 轮时，各轮 average 的均值
# 子类只需指定 round_count 即可
# 支持双视图 Tab：当前排名 + WR 历史
require_relative "../../core/grouped_statistic"
require_relative "../../core/events"
require_relative "../../core/solve_time"
require_relative "../../core/tab_ui"

class AoRounds < GroupedStatistic
  include TabUi

  # NOTE: round_type_id 分类：用于确定各轮在 Details 中的排列顺序
  # 排序权重越小越靠前（R1 < R2 < R3 < Final）
  ROUND_SORT_ORDER = {
    '1' => 1, 'd' => 1,   # First round / Combined first
    '2' => 2, 'e' => 2,   # Second round / Combined second
    '3' => 3, 'g' => 3,   # Semi-final / Combined third
    'c' => 99, 'f' => 99  # Combined final / Final（总是最后）
  }.freeze

  def round_count
    raise "子类必须实现 round_count"
  end

  def query
    <<-SQL
      SELECT
        result.event_id,
        result.average,
        result.round_type_id,
        result.competition_id,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        person.wca_id AS person_id,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        competition.start_date
      FROM results result
      JOIN persons person ON person.wca_id = result.person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = result.competition_id
      ORDER BY result.event_id, competition.start_date
    SQL
  end

  def transform(query_results)
    # NOTE: 排除没有官方 average 的项目
    events = Events::OFFICIAL.reject { |id, _| Events::BLD.key?(id) }

    # 存储排名数据供 markdown 使用
    @ranking_by_event = {}

    events.map do |event_id, event_name|
      event_rows = query_results.select { |r| r["event_id"] == event_id }

      # NOTE: 按 (competition_id, person_id) 分组，收集该人在该比赛的所有轮次记录
      computed = compute_metrics(event_rows, event_id)

      # 排名数据：每人最佳 metric，取 top 10
      @ranking_by_event[event_name] = build_ranking(computed, event_id)

      # WR 历史数据
      wr_results = build_wr_history(computed, event_id)

      [event_name, wr_results]
    end
  end

  def markdown
    timestamp = Time.parse(Database.metadata["export_timestamp"])
    updated = timestamp.strftime("%e %B %Y").strip

    wr_data = data  # WR 历史

    zh = @title_zh || @title
    md = "<h2 data-i18n-en=\"#{@title}\" data-i18n-zh=\"#{zh}\">#{@title}</h2>\n\n"
    if @note
      nzh = @note_zh || @note
      md += "<p><em data-i18n-en=\"#{@note}\" data-i18n-zh=\"#{nzh}\">#{@note}</em></p>\n"
    end
    date_zh = timestamp.strftime("更新于 %Y 年 %-m 月 %-d 日")
    md += "<p><em data-i18n-en=""Updated on #{updated}"" data-i18n-zh=""#{date_zh}"">Updated on #{updated}</em></p>\n\n"

    md += tab_styles
    md += tab_buttons("当前排名", "ranking", "WR 历史", "history")

    # 当前排名面板
    md += "<div id=\"ranking\" class=\"stat-panel active\">\n"
    @ranking_by_event.each do |event_name, rows|
      next if rows.empty?
      ezh = Events.zh(event_name)
      md += "<h3 data-i18n-en=""#{event_name}"" data-i18n-zh=""#{ezh}"">#{event_name}</h3>\n"
      md += "<table>\n<tr><th data-i18n-en=\"Person\" data-i18n-zh=\"选手\">Person</th><th style=\"text-align:right\" data-i18n-en=\"Result\" data-i18n-zh=\"成绩\">Result</th><th>Details</th></tr>\n"
      rows.each do |row|
        md += "<tr><td>#{md_link_to_html(row[:person_link])}</td>"
        md += "<td style=\"text-align:right\">#{row[:metric_str]}</td>"
        md += "<td>#{row[:details]}</td></tr>\n"
      end
      md += "</table>\n"
    end
    md += "</div>\n\n"

    # WR 历史面板
    md += "<div id=\"history\" class=\"stat-panel\">\n"
    wr_data.each do |event_name, rows|
      next if rows.empty?
      ezh = Events.zh(event_name)
      md += "<h3 data-i18n-en=""#{event_name}"" data-i18n-zh=""#{ezh}"">#{event_name}</h3>\n"
      md += "<table>\n"
      md += html_table_header(@table_header)
      rows.each do |row|
        md += html_table_row(row, @table_header)
      end
      md += "</table>\n"
    end
    md += "</div>\n\n"

    md += tab_script
    md
  end

  private

  # NOTE: 计算所有参赛者在每场比赛中的 AoXR
  def compute_metrics(event_rows, event_id)
    grouped = {}
    event_rows.each do |r|
      key = [r["competition_id"], r["person_id"]]
      grouped[key] ||= { "rows" => [], "person_link" => r["person_link"],
                         "person_id" => r["person_id"],
                         "competition_link" => r["competition_link"],
                         "start_date" => r["start_date"], "event_id" => event_id }
      grouped[key]["rows"] << r
    end

    # 筛选：该人在该比赛恰好有 round_count 条记录，且所有 average > 0
    grouped.filter_map do |_key, info|
      rows = info["rows"]
      next unless rows.size == round_count
      next if rows.any? { |r| r["average"].nil? || r["average"] <= 0 }

      # 按轮次排序（R1 < R2 < R3 < Final），提取 average 值
      sorted_rows = rows.sort_by { |r| ROUND_SORT_ORDER[r["round_type_id"]] || 50 }
      values = sorted_rows.map { |r| r["average"] }
      avg = values.sum.to_f / round_count
      info.merge("_metric" => avg, "_round_values" => values)
    end
  end

  # NOTE: 每人最佳 metric，按项目 top 10
  def build_ranking(computed, event_id)
    best_by_person = {}
    computed.each do |r|
      pid = r["person_id"]
      if !best_by_person[pid] || r["_metric"] < best_by_person[pid]["_metric"]
        best_by_person[pid] = r
      end
    end

    best_by_person.values
      .sort_by { |r| r["_metric"] }
      .first(10)
      .map do |r|
        metric_str = SolveTime.new(event_id, :average, r["_metric"].round).clock_format
        details = r["_round_values"].map { |v| SolveTime.new(event_id, :average, v).clock_format }.join(', ')
        { person_link: r["person_link"], metric_str: metric_str, details: details }
      end
  end

  # NOTE: WR 历史——按日期正序扫描，只保留刷新最小值的记录，最终倒序
  def build_wr_history(computed, event_id)
    sorted = computed.sort_by { |r| r["start_date"] }
    min_so_far = Float::INFINITY
    wr_records = sorted.select do |r|
      if r["_metric"] < min_so_far
        min_so_far = r["_metric"]
        true
      else
        false
      end
    end

    results = wr_records.each_with_index.map do |r, i|
      metric_str = SolveTime.new(event_id, :average, r["_metric"].round).clock_format

      if i > 0
        prev = wr_records[i - 1]
        gain = ((prev["_metric"] - r["_metric"]) / prev["_metric"] * 100).round(1)
        gain_str = "#{gain}%"
        duration = (r["start_date"] - prev["start_date"]).to_i
        days_str = duration.to_s
      else
        gain_str = ""
        days_str = ""
      end

      # Details: 显示各轮 average（已按轮次排序）
      details = r["_round_values"].map do |v|
        SolveTime.new(event_id, :average, v).clock_format
      end.join(', ')

      date_str = r["start_date"].strftime("%Y-%m-%d")
      [metric_str, gain_str, days_str, r["person_link"], r["competition_link"], date_str, details]
    end

    results.reverse
  end
end
