# NOTE: 新人统计合并页 = wr_newcomer + wr_1st_wr
# 两个维度:
#   1) 指标 (metric): Single / Average
#   2) 数据源 (source):
#      - 首次还原 (1st-solve): 首场比赛第一轮的 value1(单次) / average(平均)
#      - 首场比赛 (1st-comp):  首场比赛所有轮次的 MIN(best)(单次) / MIN(average)(平均)
# 每种组合有 Current Ranking + History 双视图
require_relative "../core/grouped_statistic"
require_relative "../core/events"
require_relative "../core/solve_time"
require_relative "../core/tab_ui"
require_relative "../core/metric_selector"
require_relative "../core/database"

class WrNewcomer < GroupedStatistic
  include TabUi
  include MetricSelector

  # NOTE: 指标维度
  METRICS = [
    { label: "Single",  id: "single",  type: :single },
    { label: "Average", id: "average", type: :average },
  ].freeze

  # NOTE: 数据源维度
  SOURCES = [
    { label: "First Solve",       label_zh: "首次还原",  id: "1st-solve" },
    { label: "First Competition", label_zh: "首场比赛",  id: "1st-comp" },
  ].freeze

  # NOTE: History 表头
  HISTORY_HEADER = {
    "Result" => :right, "Improvement" => :right, "Days" => :right,
    "Person" => :left, "Date" => :left, "Competition" => :left
  }.freeze

  def initialize
    @title = "Newcomer"
    @note = "Shows the best results from a person's very first competition for each event."
  end

  def markdown
    # NOTE: 使用单一连接，确保临时表在所有查询中可见
    puts "  [newcomer] Connecting to database..."
    @client = Database.client
    create_first_comp_temp_table(@client)

    md = top

    # --- 指标选择器（第一行：Single / Average）---
    md += metric_selector_styles
    md += newcomer_metric_buttons
    # --- 数据源选择器（第二行：首次还原 / 首场比赛）---
    md += source_selector_styles
    md += tab_styles

    METRICS.each_with_index do |metric, mi|
      m_prefix = metric[:id]
      m_active = mi == 0

      md += "<div class=\"metric-panel#{m_active ? ' active' : ''}\" id=\"metric-#{m_prefix}\">\n"
      md += source_selector_buttons(m_prefix)

      SOURCES.each_with_index do |source, si|
        s_prefix = "#{m_prefix}-#{source[:id]}"
        s_active = si == 0

        md += "<div class=\"source-panel#{s_active ? ' active' : ''}\" id=\"source-#{s_prefix}\">\n"

        # NOTE: 按数据源类型查询
        label = "#{metric[:id]}/#{source[:id]}"
        t = Time.now
        $stdout.write "  [newcomer] Querying #{label}..."
        grouped = if source[:id] == "1st-solve"
          fetch_first_round_data(metric, @client)
        else
          fetch_first_comp_data(metric, @client)
        end
        row_count = grouped.values.sum(&:size)
        puts " #{row_count} rows (#{(Time.now - t).round(1)}s)"

        t2 = Time.now
        $stdout.write "  [newcomer]   Building ranking..."
        ranking = build_ranking(grouped, metric)
        puts " done (#{(Time.now - t2).round(1)}s)"

        t3 = Time.now
        $stdout.write "  [newcomer]   Building history..."
        history = build_history(grouped, metric)
        puts " done (#{(Time.now - t3).round(1)}s)"

        md += tab_buttons(
          "Current Ranking", "当前排名", "#{s_prefix}-ranking",
          "WR History", "历史", "#{s_prefix}-history"
        )
        md += grouped_panel("#{s_prefix}-ranking", true, ranking, RANKING_HEADER)
        md += grouped_panel("#{s_prefix}-history", false, history, HISTORY_HEADER)

        md += "</div>\n"
      end

      md += "</div>\n"
    end

    md += metric_selector_script
    md += source_selector_script
    md += tab_script
    md
  ensure
    puts "  [newcomer] Closing connection..."
    @client&.close
  end

  private

  # ========== UI 组件 ==========

  # NOTE: 指标按钮（Single / Average），分段控件风格
  def newcomer_metric_buttons
    html = "<div class=\"metric-selector\">\n"
    html += "  <span class=\"metric-selector-label\" data-i18n-en=\"Type\">Type</span>\n"
    html += "  <div class=\"metric-selector-group\">\n"
    METRICS.each_with_index do |m, i|
      active = i == 0 ? " active" : ""
      html += "    <button class=\"metric-btn#{active}\" onclick=\"switchMetric('#{m[:id]}')\" "
      html += "data-i18n-en=\"#{m[:label]}\">#{m[:label]}</button>\n"
    end
    html += "  </div>\n"
    html += "</div>\n"
    html
  end

  # NOTE: 数据源选择器样式（分段控件风格，与 metric-selector 一致）
  def source_selector_styles
    <<~HTML
      <style>
      .source-selector{display:flex;align-items:center;gap:0;margin:8px 0 16px}
      .source-selector-label{font-size:14px;font-weight:600;color:#c0c8d8;margin-right:12px}
      .source-selector-group{display:flex;gap:0}
      .source-btn{padding:8px 20px;border:1px solid #4a6785;background:transparent;color:#8ab4f8;cursor:pointer;font-size:14px;font-weight:600;transition:all .2s;border-radius:0}
      .source-btn:first-child{border-radius:6px 0 0 6px}
      .source-btn:last-child{border-radius:0 6px 6px 0}
      .source-btn + .source-btn{border-left:none}
      .source-btn.active{background:#2c4a6e;border-color:#8ab4f8;color:#fff}
      .source-btn:hover:not(.active){background:rgba(138,180,248,0.08)}
      .source-panel{display:none}
      .source-panel.active{display:block}
      </style>
    HTML
  end

  # NOTE: 数据源按钮（首次还原 / 首场比赛），每个 metric-panel 内独立一组，分段控件风格
  def source_selector_buttons(metric_prefix)
    html = "<div class=\"source-selector\">\n"
    html += "  <span class=\"source-selector-label\" data-i18n-en=\"Source\">Source</span>\n"
    html += "  <div class=\"source-selector-group\">\n"
    SOURCES.each_with_index do |s, i|
      active = i == 0 ? " active" : ""
      sid = "#{metric_prefix}-#{s[:id]}"
      html += "    <button class=\"source-btn#{active}\" onclick=\"switchSource(this,'#{sid}')\" "
      html += "data-i18n-en=\"#{s[:label]}\" data-i18n-zh=\"#{s[:label_zh]}\">#{s[:label]}</button>\n"
    end
    html += "  </div>\n"
    html += "</div>\n"
    html
  end

  # NOTE: 数据源切换 JS——在当前 metric-panel 内切换 source-panel
  def source_selector_script
    <<~HTML
      <script>
      function switchSource(btn, id){
        var scope = btn.closest('.metric-panel') || document;
        scope.querySelectorAll('.source-btn').forEach(b=>b.classList.remove('active'));
        scope.querySelectorAll('.source-panel').forEach(p=>p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('source-'+id).classList.add('active');
      }
      </script>
    HTML
  end

  # ========== 临时表 ==========

  # NOTE: 创建临时表缓存每人每项目的首场比赛日期
  # 630 万行 results 全表 GROUP BY 只执行一次，后续查询 JOIN 临时表走索引
  def create_first_comp_temp_table(client)
    client.query("DROP TEMPORARY TABLE IF EXISTS tmp_first_comp")

    t1 = Time.now
    $stdout.write "  [newcomer] Creating temp table (GROUP BY results)..."
    client.query(<<-SQL)
      CREATE TEMPORARY TABLE tmp_first_comp AS
      SELECT r.person_id, r.event_id, MIN(c.start_date) AS earliest_date
      FROM results r
      JOIN competitions c ON c.id = r.competition_id
      GROUP BY r.person_id, r.event_id
    SQL
    puts " done (#{(Time.now - t1).round(1)}s)"

    t2 = Time.now
    $stdout.write "  [newcomer]   Adding index..."
    client.query("ALTER TABLE tmp_first_comp ADD INDEX idx_pid_eid_date (person_id, event_id, earliest_date)")
    puts " done (#{(Time.now - t2).round(1)}s)"

    row_count = client.query("SELECT COUNT(*) AS cnt FROM tmp_first_comp").first["cnt"]
    puts "  [newcomer]   Table rows: #{row_count}"
  end

  # ========== 数据查询 ==========

  # NOTE: 数据源 1 —— 首次还原（首场比赛第一轮 value1 / average）
  # 优先取第一轮（round_type_id IN ('1','0','d')），无则回退到决赛轮
  def fetch_first_round_data(metric, client)
    col = metric[:type] == :single ? "value1" : "average"
    filter = metric[:type] == :single ? "r.value1 > 0" : "r.average > 0"
    sql = <<-SQL
      SELECT
        fr.event_id,
        fr.first_result,
        CONCAT('[', p.name, '](https://www.worldcubeassociation.org/persons/', p.wca_id, ')') person_link,
        p.country_id,
        CONCAT('[', c.cell_name, '](https://www.worldcubeassociation.org/competitions/', c.id, ')') competition_link,
        c.start_date
      FROM (
        SELECT r.person_id, r.event_id, r.#{col} AS first_result, r.competition_id,
               ROW_NUMBER() OVER (PARTITION BY r.person_id, r.event_id ORDER BY
                 CASE WHEN r.round_type_id IN ('1','0','d') THEN 0 ELSE 1 END
               ) AS rn
        FROM results r
        JOIN competitions c1 ON c1.id = r.competition_id
        JOIN tmp_first_comp fc ON fc.person_id = r.person_id
             AND fc.event_id = r.event_id
             AND c1.start_date = fc.earliest_date
        WHERE #{filter}
      ) fr
      JOIN persons p ON p.wca_id = fr.person_id AND p.sub_id = 1
      JOIN competitions c ON c.id = fr.competition_id
      WHERE fr.rn = 1
      ORDER BY fr.event_id, fr.first_result
    SQL
    client.query(sql).to_a.group_by { |r| r["event_id"] }
  end

  # NOTE: 数据源 2 —— 首场比赛（首场比赛所有轮次的 MIN(best) / MIN(average)）
  # 用 ROW_NUMBER 窗口函数代替 GROUP BY + MIN，性能提升 ~10 倍
  def fetch_first_comp_data(metric, client)
    col = metric[:type] == :single ? "best" : "average"
    filter = metric[:type] == :single ? "r.best > 0" : "r.average > 0"
    sql = <<-SQL
      SELECT
        fr.event_id,
        fr.first_result,
        CONCAT('[', p.name, '](https://www.worldcubeassociation.org/persons/', p.wca_id, ')') person_link,
        p.country_id,
        CONCAT('[', c.cell_name, '](https://www.worldcubeassociation.org/competitions/', c.id, ')') competition_link,
        c.start_date
      FROM (
        SELECT r.person_id, r.event_id, r.#{col} AS first_result, r.competition_id,
               ROW_NUMBER() OVER (PARTITION BY r.person_id, r.event_id ORDER BY r.#{col}) AS rn
        FROM results r
        JOIN competitions c1 ON c1.id = r.competition_id
        JOIN tmp_first_comp fc ON fc.person_id = r.person_id
             AND fc.event_id = r.event_id
             AND c1.start_date = fc.earliest_date
        WHERE #{filter}
      ) fr
      JOIN persons p ON p.wca_id = fr.person_id AND p.sub_id = 1
      JOIN competitions c ON c.id = fr.competition_id
      WHERE fr.rn = 1
      ORDER BY fr.event_id, fr.first_result
    SQL
    client.query(sql).to_a.group_by { |r| r["event_id"] }
  end

  # ========== 数据变换 ==========

  # NOTE: Current Ranking（每项目 Top 10）
  def build_ranking(grouped, metric)
    Events::OFFICIAL.map do |event_id, event_name|
      event_rows = (grouped[event_id] || []).first(10)
        .each_with_index.map do |r, i|
          result_str = SolveTime.new(event_id, metric[:type], r["first_result"]).clock_format
          date_str = fmt_date(r["start_date"])
          [i + 1, r["person_link"], result_str, r["country_id"], date_str, r["competition_link"]]
        end
      [event_name, event_rows]
    end
  end

  # NOTE: History（严格递减序列，最新在最上面）
  def build_history(grouped, metric)
    Events::OFFICIAL.map do |event_id, event_name|
      all = (grouped[event_id] || [])
        .sort_by { |r| [r["start_date"], r["first_result"]] }

      min_so_far = Float::INFINITY
      nwr = all.select { |r| r["first_result"] < min_so_far && (min_so_far = r["first_result"]) }

      results = nwr.each_with_index.map do |r, i|
        result_str = SolveTime.new(event_id, metric[:type], r["first_result"]).clock_format
        gain_str = i > 0 ? "#{((nwr[i-1]["first_result"].to_f - r["first_result"].to_f) / nwr[i-1]["first_result"].to_f * 100).round(1)}%" : ""
        days = i < nwr.size - 1 ? (nwr[i+1]["start_date"].to_date - r["start_date"].to_date).to_i : (Date.today - r["start_date"].to_date).to_i
        [result_str, gain_str, days.to_s, r["person_link"], fmt_date(r["start_date"]), r["competition_link"]]
      end

      [event_name, results.reverse]
    end
  end

  def fmt_date(d)
    d.respond_to?(:strftime) ? d.strftime("%Y-%m-%d") : d.to_s
  end
end
