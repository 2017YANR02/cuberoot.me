# NOTE: 1stWR = 首场比赛第一轮成绩排名
# 支持 Single（value1，第一次还原）和 Average（首轮平均）两种指标
# 每种指标有 Current Ranking + History 双视图
# 与 wr_newcomer 的区别:
#   - wr_newcomer: 取首场比赛所有轮次的 MIN(best)/MIN(average)
#   - wr_1st_wr:   严格限定首场比赛第一轮（无第一轮则回退到决赛轮）
require_relative "../core/grouped_statistic"
require_relative "../core/events"
require_relative "../core/solve_time"
require_relative "../core/tab_ui"
require_relative "../core/metric_selector"
require_relative "../core/database"

class Wr1stWr < GroupedStatistic
  include TabUi
  include MetricSelector

  # NOTE: 两种指标——Single（value1）和 Average
  MODES = [
    { label: "Single",  id: "single",  col: "value1",  filter: "r.value1 > 0",  type: :single },
    { label: "Average", id: "average", col: "average", filter: "r.average > 0", type: :average },
  ].freeze

  # NOTE: History 表头
  HISTORY_HEADER = {
    "Result" => :right, "Improvement" => :right, "Days" => :right,
    "Person" => :left, "Competition" => :left, "Date" => :left
  }.freeze

  def initialize
    @title = "First round results in first competition"
    @note = "Shows the first solve (single) / average of round 1 in a person's very first competition for each event."
  end

  def markdown
    md = top

    # --- 指标选择器按钮 ---
    md += metric_selector_styles
    md += first_wr_metric_buttons
    md += tab_styles

    MODES.each_with_index do |mode, i|
      prefix = mode[:id]
      active = i == 0

      md += "<div class=\"metric-panel#{active ? ' active' : ''}\" id=\"metric-#{prefix}\">\n"

      # NOTE: 每种 mode 只查一次数据库，ranking 和 history 共享数据
      grouped = fetch_grouped_data(mode)
      ranking = build_ranking(grouped, mode)
      history = build_history(grouped, mode)

      md += tab_buttons(
        "Current Ranking", "当前排名", "#{prefix}-ranking",
        "WR History", "历史", "#{prefix}-history"
      )
      md += grouped_panel("#{prefix}-ranking", true, ranking, RANKING_HEADER)
      md += grouped_panel("#{prefix}-history", false, history, HISTORY_HEADER)

      md += "</div>\n"
    end

    md += metric_selector_script
    md += tab_script
    md
  end

  private

  # NOTE: 生成指标选择器按钮（Single/Average 两个）
  def first_wr_metric_buttons
    html = "<div class=\"metric-selector\">\n"
    MODES.each_with_index do |m, i|
      active = i == 0 ? " active" : ""
      html += "  <button class=\"metric-btn#{active}\" onclick=\"switchMetric('#{m[:id]}')\" "
      html += "data-i18n-en=\"#{m[:label]}\">#{m[:label]}</button>\n"
    end
    html += "</div>\n"
    html
  end

  # NOTE: 一次查询，返回按事件分组的排序结果（ranking + history 共享）
  # 核心逻辑：优先取首场比赛的第一轮，无第一轮则回退到决赛轮
  def fetch_grouped_data(mode)
    col = mode[:col]
    filter = mode[:filter]
    sql = <<-SQL
      SELECT
        fr.event_id,
        fr.first_result,
        CONCAT('[', p.name, '](https://www.worldcubeassociation.org/persons/', p.wca_id, ')') person_link,
        p.country_id,
        CONCAT('[', c.cell_name, '](https://www.worldcubeassociation.org/competitions/', c.id, ')') competition_link,
        c.start_date
      FROM (
        -- NOTE: 每个选手每个项目，优先取第一轮（round_type_id IN ('1','0','d')），无则回退到决赛轮
        SELECT r.person_id, r.event_id, r.#{col} AS first_result, r.competition_id,
               ROW_NUMBER() OVER (PARTITION BY r.person_id, r.event_id ORDER BY
                 CASE WHEN r.round_type_id IN ('1','0','d') THEN 0 ELSE 1 END
               ) AS rn
        FROM results r
        JOIN competitions c1 ON c1.id = r.competition_id
        JOIN (
          -- 子查询: 每个选手在每个项目的首场比赛日期
          SELECT r2.person_id, r2.event_id, MIN(c2.start_date) AS earliest_date
          FROM results r2
          JOIN competitions c2 ON c2.id = r2.competition_id
          GROUP BY r2.person_id, r2.event_id
        ) fc ON fc.person_id = r.person_id
             AND fc.event_id = r.event_id
             AND c1.start_date = fc.earliest_date
        WHERE #{filter}
      ) fr
      JOIN persons p ON p.wca_id = fr.person_id AND p.sub_id = 1
      JOIN competitions c ON c.id = fr.competition_id
      WHERE fr.rn = 1
      ORDER BY fr.event_id, fr.first_result
    SQL
    rows = Database.client.query(sql).to_a

    # 按 event_id 分组
    rows.group_by { |r| r["event_id"] }
  end

  # NOTE: 从分组数据中提取 Current Ranking（每项目 Top 10）
  def build_ranking(grouped, mode)
    Events::OFFICIAL.map do |event_id, event_name|
      event_rows = (grouped[event_id] || []).first(10)
        .each_with_index.map do |r, i|
          result_str = SolveTime.new(event_id, mode[:type], r["first_result"]).clock_format
          date_str = fmt_date(r["start_date"])
          [i + 1, r["person_link"], result_str, r["country_id"], r["competition_link"], date_str]
        end
      [event_name, event_rows]
    end
  end

  # NOTE: 从分组数据中提取 History（严格递减序列，最新在最上面）
  def build_history(grouped, mode)
    Events::OFFICIAL.map do |event_id, event_name|
      all = (grouped[event_id] || [])
        .sort_by { |r| [r["start_date"], r["first_result"]] }

      # 扫描取严格递减序列
      min_so_far = Float::INFINITY
      nwr = all.select { |r| r["first_result"] < min_so_far && (min_so_far = r["first_result"]) }

      results = nwr.each_with_index.map do |r, i|
        result_str = SolveTime.new(event_id, mode[:type], r["first_result"]).clock_format
        gain_str = i > 0 ? "#{((nwr[i-1]["first_result"].to_f - r["first_result"].to_f) / nwr[i-1]["first_result"].to_f * 100).round(1)}%" : ""
        days = i < nwr.size - 1 ? (nwr[i+1]["start_date"].to_date - r["start_date"].to_date).to_i : (Date.today - r["start_date"].to_date).to_i
        [result_str, gain_str, days.to_s, r["person_link"], r["competition_link"], fmt_date(r["start_date"])]
      end

      [event_name, results.reverse]
    end
  end

  def fmt_date(d)
    d.respond_to?(:strftime) ? d.strftime("%Y-%m-%d") : d.to_s
  end
end
