# NOTE: 抽象基类，用于基于 WR average 轮次 value1-5 计算衍生指标的 WR 历史
# 子类只需实现 compute_metric(values, event_id) 方法即可
# 支持双视图 Tab：WR 历史 + 当前排名
require_relative "../../core/grouped_statistic"
require_relative "../../core/events"
require_relative "../../core/solve_time"
require_relative "../../core/tab_ui"

class WrRoundHistory < GroupedStatistic
  include TabUi
  def query
    <<-SQL
      SELECT
        result.event_id,
        average,
        best,
        value1, value2, value3, value4, value5,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        person.name person_name,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        competition.cell_name competition_name,
        competition.id competition_id,
        competition.start_date
      FROM results result
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      WHERE regional_average_record = 'WR'
      ORDER BY competition.start_date
    SQL
  end

  # NOTE: 全量查询，用于当前排名。类级别缓存，所有子类共享一次查询
  def self.all_results_cache
    @@all_results_cache ||= begin
      require_relative "../../core/database"
      Database.client.query(
        "SELECT event_id, person_id, value1, value2, value3, value4, value5, average, best,
         CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link
         FROM results
         JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
         WHERE average > 0"
      ).to_a
    end
  end

  # 子类必须实现：从5次成绩的数组中计算指标值
  # values: [v1, v2, v3, v4, v5] 原始 WCA 编码值
  # r: 完整的行数据（包含 average, best 等）
  # 返回: 数值（用于排序和 WR 判断），或 nil 表示无效
  def compute_metric(values, r)
    raise "子类必须实现 compute_metric"
  end

  # 子类可覆盖：格式化指标值为显示字符串
  def format_metric(metric_value, event_id)
    SolveTime.new(event_id, :single, metric_value.round).clock_format
  end

  # 子类可覆盖：决定哪些项目参与（默认为官方项目中有 average 的）
  def target_events
    Events::OFFICIAL.reject { |id, _| Events::BLD.key?(id) }
  end

  def transform(query_results)
    target_events.map do |event_id, event_name|
      records = query_results
        .select { |r| r["event_id"] == event_id && r["average"] > 0 }
        .sort_by { |r| r["start_date"] }

      # 对每条记录计算指标值
      computed = records.filter_map do |r|
        values = (1..5).map { |n| r["value#{n}"] }
        metric = compute_metric(values, r)
        next unless metric
        r.merge("_metric" => metric)
      end

      # 构建 WR 历史：按日期正序扫描，只保留刷新最小值的记录
      min_so_far = Float::INFINITY
      wr_records = computed.select do |r|
        if r["_metric"] < min_so_far
          min_so_far = r["_metric"]
          true
        else
          false
        end
      end

      results = wr_records.each_with_index.map do |r, i|
        metric_str = format_metric(r["_metric"], event_id)

        if i > 0
          prev = wr_records[i - 1]
          # NOTE: .to_f 防止 compute_metric 返回整数时的整数除法问题
          gain = ((prev["_metric"] - r["_metric"]).to_f / prev["_metric"] * 100).round(1)
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

        [metric_str, gain_str, days_str, r["person_link"], r["competition_link"], date_str, details]
      end

      [event_name, results.reverse]
    end
  end

  # NOTE: 当前排名数据——从全量 results 中计算每人每项目最佳 metric
  def ranking_data
    all = self.class.all_results_cache
    target_ids = target_events.map(&:first).to_set

    # 按项目分组计算每人最佳 metric
    best_by_person = {}
    all.each do |r|
      next unless target_ids.include?(r["event_id"])
      values = (1..5).map { |n| r["value#{n}"] }
      metric = compute_metric(values, r)
      next unless metric
      key = [r["event_id"], r["person_id"]]
      if !best_by_person[key] || metric < best_by_person[key][:metric]
        best_by_person[key] = { metric: metric, person_link: r["person_link"] }
      end
    end

    # 按项目分组，每项目 top 10
    target_events.map do |event_id, event_name|
      top = best_by_person
        .select { |k, _| k[0] == event_id }
        .sort_by { |_, v| v[:metric] }
        .first(10)
        .map do |(_eid, _pid), v|
          metric_str = format_metric(v[:metric], event_id)
          [v[:person_link], metric_str]
        end
      [event_name, top]
    end
  end

  # NOTE: 覆盖 markdown 方法，输出带 Tab 的 HTML
  def markdown
    timestamp = Time.parse(Database.metadata["export_timestamp"])
    updated = timestamp.strftime("%e %B %Y").strip

    wr_data = data  # WR 历史
    rank_data = ranking_data  # 当前排名

    zh = @title_zh || @title
    md = "<h2 data-i18n-en=\"#{@title}\" data-i18n-zh=\"#{zh}\">#{@title}</h2>\n\n"
    if @note
      nzh = @note_zh || @note
      md += "<p><em data-i18n-en=\"#{@note}\" data-i18n-zh=\"#{nzh}\">#{@note}</em></p>\n"
    end
    date_zh = timestamp.strftime("更新于 %Y 年 %-m 月 %-d 日")
    md += "<p><em data-i18n-en=\"Updated on #{updated}\" data-i18n-zh=\"#{date_zh}\">Updated on #{updated}</em></p>\n\n"

    # Tab CSS + JS
    md += tab_styles
    md += tab_buttons("当前排名", "ranking", "WR 历史", "history")

    # 当前排名面板
    md += "<div id=\"ranking\" class=\"stat-panel active\">\n"
    rank_data.each do |event_name, rows|
      next if rows.empty?
      ezh = Events.zh(event_name)
      md += "<h3 data-i18n-en=\"#{event_name}\" data-i18n-zh=\"#{ezh}\">#{event_name}</h3>\n"
      md += "<table>\n<tr><th data-i18n-en=\"Person\" data-i18n-zh=\"选手\">Person</th><th style=\"text-align:right\" data-i18n-en=\"Result\" data-i18n-zh=\"成绩\">Result</th></tr>\n"
      rows.each do |person_link, metric_str|
        md += "<tr><td>#{md_link_to_html(person_link)}</td><td style=\"text-align:right\">#{metric_str}</td></tr>\n"
      end
      md += "</table>\n"
    end
    md += "</div>\n\n"

    # WR 历史面板
    md += "<div id=\"history\" class=\"stat-panel\">\n"
    wr_data.each do |event_name, rows|
      next if rows.empty?
      ezh = Events.zh(event_name)
      md += "<h3 data-i18n-en=\"#{event_name}\" data-i18n-zh=\"#{ezh}\">#{event_name}</h3>\n"
      md += "<table>\n<tr>"
      @table_header.each { |k, v| md += "<th#{v == :right ? ' style=\"text-align:right\"' : ''}>#{k}</th>" }
      md += "</tr>\n"
      rows.each do |row|
        md += "<tr>"
        row.each_with_index do |cell, i|
          align = @table_header.values[i] == :right ? ' style="text-align:right"' : ''
          md += "<td#{align}>#{md_link_to_html(cell.to_s)}</td>"
        end
        md += "</tr>\n"
      end
      md += "</table>\n"
    end
    md += "</div>\n\n"

    md += tab_script
    md
  end

  private
end
