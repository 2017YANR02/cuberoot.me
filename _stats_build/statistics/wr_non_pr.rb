# NOTE: Non-PR WR — "不是个人纪录的成绩"中历史最佳
# 一条成绩没有刷新选手当时的 PB，但仍然是有史以来最快的 non-PR 成绩
#
# 算法:
#   1. 对每个 event，取所有结果按比赛日期排序
#   2. 逐行扫描，维护每人的 PB：
#      - value <= PB → 更新 PB → 跳过（这是 PR 或平 PR）
#      - value > PB → 这是 Non-PR 结果，纳入统计
#   3. 在所有 Non-PR 结果中追踪 WR 演变（值越来越小）→ History
#   4. 所有 Non-PR 结果中每人最佳 → Ranking（Top 10）
#
# 设计决策:
#   - 逐 event 查询（避免 OOM）
#   - Single 用 results.best（每轮一个值，判定 PR 基于轮 best）
#   - Average 用 results.average
#   - 一次查询同时取 best + average，在 Ruby 中分别处理
require_relative "../core/statistic"
require_relative "../core/events"
require_relative "../core/solve_time"
require_relative "../core/database"
require_relative "../core/stat_panel"
require_relative "../core/metric_layout"

class WrNonPr < Statistic
  include StatPanel
  include MetricLayout

  HISTORY_HEADER = {
    "Result" => :right, "Improvement" => :right, "Days" => :right,
    "Person" => :left, "Date" => :left, "Competition" => :left
  }.freeze

  RANKING_HEADER = {
    "#" => :right, "Person" => :left, "Result" => :right,
    "Country" => :left, "Date" => :left, "Competition" => :left
  }.freeze

  def initialize
    @title = "Non-PR WR"
    @title_zh = "非 PR"
    @note = "Best results that are NOT a personal record — the competitor already had a faster result before."
    @note_zh = "不是个人纪录的最佳成绩——选手之前已经有过更快的成绩。"
  end

  def query
    ""
  end

  def data
    @data ||= fetch_with_cache("WrNonPr") { compute_all }
  end

  def markdown
    md = top
    md += metric_tab_wrap_start

    # NOTE: Single 面板
    md += "<div class=\"metric-panel active\" id=\"metric-single\" data-label-en=\"Single\" data-label-zh=\"单次\">\n"
    md += grouped_panel("single-ranking", true, data[:single][:ranking].to_h, RANKING_HEADER,
                        label_en: "Ranking", label_zh: "排名")
    md += grouped_panel("single-history", false, data[:single][:history].to_h, HISTORY_HEADER,
                        label_en: "History", label_zh: "历史")
    md += "</div>\n"

    # NOTE: Average 面板
    md += "<div class=\"metric-panel\" id=\"metric-average\" data-label-en=\"Avg\" data-label-zh=\"平均\">\n"
    md += grouped_panel("average-ranking", true, data[:average][:ranking].to_h, RANKING_HEADER,
                        label_en: "Ranking", label_zh: "排名")
    md += grouped_panel("average-history", false, data[:average][:history].to_h, HISTORY_HEADER,
                        label_en: "History", label_zh: "历史")
    md += "</div>\n"

    md += metric_tab_wrap_end
    md
  end


  private


  def compute_all
    result = {
      single:  { ranking: [], history: [] },
      average: { ranking: [], history: [] }
    }

    client = Database.client

    Events::ALL.each do |event_id, event_name|
      t = Time.now
      $stdout.write "  Non-PR WR: #{event_id}..."
      rows = fetch_results_for(client, event_id)
      if rows.empty?
        puts " skip"
        next
      end

      # Single
      s = compute_non_pr(rows, "best", event_id)
      result[:single][:history] << [event_name, s[:history]] unless s[:history].empty?
      result[:single][:ranking] << [event_name, s[:ranking]] unless s[:ranking].empty?

      # Average
      a = compute_non_pr(rows, "average", event_id)
      result[:average][:history] << [event_name, a[:history]] unless a[:history].empty?
      result[:average][:ranking] << [event_name, a[:ranking]] unless a[:ranking].empty?

      rows = nil  # 释放内存
      sh = s[:history].size
      ah = a[:history].size
      puts " s=#{sh} a=#{ah} (#{(Time.now - t).round(1)}s)"
    end

    result
  end

  # NOTE: 一次查询同时取 best + average，减少查询次数
  def fetch_results_for(client, event_id)
    sql = <<-SQL
      SELECT
        result.person_id,
        result.best,
        result.average,
        person.country_id,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') comp_link,
        competition.start_date
      FROM results result
      JOIN persons person ON person.wca_id = result.person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = result.competition_id
      WHERE result.event_id = '#{event_id}'
        AND (result.best > 0 OR result.average > 0)
      ORDER BY competition.start_date, result.id
    SQL
    client.query(sql).to_a
  end

  # NOTE: 核心算法——从结果中筛选 non-PR 成绩，追踪 WR 演变
  # value_col: "best" 或 "average"
  # event_id: 用于格式化成绩显示
  def compute_non_pr(rows, value_col, event_id)
    # 每人当前 PB
    pb = {}  # person_id => best value so far
    # 每人最佳 non-PR 成绩（用于 ranking）
    best_non_pr = {}  # person_id => { value:, person_link:, comp_link:, date:, country: }

    # WR 追踪
    wr_best = Float::INFINITY  # 当前 non-PR WR
    wr_records = []  # 按时间正序的 WR 演变记录

    # NOTE: SolveTime 格式化类型
    vtype = (value_col == "best") ? :single : :average

    rows.each do |r|
      val = r[value_col]
      next unless val && val > 0

      pid = r["person_id"]

      if !pb[pid] || val <= pb[pid]
        # 这是 PR（首次出现或刷新/平了 PB）→ 更新 PB，跳过
        pb[pid] = val
        next
      end

      # 到这里说明 val > pb[pid]，即这条成绩没有刷新 PB → Non-PR
      # 更新该选手的最佳 non-PR
      if !best_non_pr[pid] || val < best_non_pr[pid][:value]
        best_non_pr[pid] = {
          value: val,
          person_link: r["person_link"],
          comp_link: r["comp_link"],
          date: r["start_date"],
          country: r["country_id"]
        }
      end

      # 追踪 WR 演变
      if val < wr_best
        wr_best = val
        wr_records << {
          value: val,
          person_link: r["person_link"],
          comp_link: r["comp_link"],
          date: r["start_date"]
        }
      end
    end

    # --- 构建 History 行 ---
    history = wr_records.each_with_index.map do |r, i|
      result_str = SolveTime.new(event_id, vtype, r[:value]).clock_format

      # 进步百分比
      if i > 0
        prev_val = wr_records[i - 1][:value].to_f
        curr_val = r[:value].to_f
        gain_str = "#{((prev_val - curr_val) / prev_val * 100).round(2)}%"
      else
        gain_str = ""
      end

      # 保持天数
      if i < wr_records.size - 1
        days_str = (wr_records[i + 1][:date] - r[:date]).to_i.to_s
      else
        days_str = (Date.today - r[:date].to_date).to_i.to_s
      end

      date_str = r[:date].respond_to?(:strftime) ? r[:date].strftime("%Y-%m-%d") : r[:date].to_s
      [result_str, gain_str, days_str, r[:person_link], date_str, r[:comp_link]]
    end.reverse

    # --- 构建 Ranking 行 ---
    ranking = best_non_pr.values
      .sort_by { |v| v[:value] }
      .first(10)
      .each_with_index.map do |v, i|
        result_str = SolveTime.new(event_id, vtype, v[:value]).clock_format
        date_str = v[:date].respond_to?(:strftime) ? v[:date].strftime("%Y-%m-%d") : v[:date].to_s
        [i + 1, v[:person_link], result_str, v[:country], date_str, v[:comp_link]]
      end

    { history: history, ranking: ranking }
  end
end
