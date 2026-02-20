# NOTE: Dominance（屠榜）= 选手在某项目全历史成绩排行榜上完全霸占前 N 席
#
# 概念说明:
#   将某项目所有历史 results（每轮的 best 或 average）按成绩值升序排列，
#   如果排行榜前 N 名全部属于同一个人，则该人的 dominance = N。
#   并列成绩排除——只算严格优于他人最佳的部分。
#
# 算法:
#   1. 找到全局成绩最好的选手 P（best_by_person 的最小值）
#   2. 找到非 P 选手中的最佳成绩 others_best（second_best）
#   3. dominance = P 的成绩中严格 < others_best 的数量
#
# WR 历史:
#   按比赛日期正序处理所有 results，每场比赛结束后重新计算 dominance。
#   只记录 dominance 刷新历史最高的时刻，最终倒序输出。
#
# 性能优化:
#   - 每人的成绩用有序数组存储（二分插入 O(log n)）
#   - dominance 计数用 binary search（O(log n)），避免遍历全量
#   - 维护 best_by_person hash 快速找 top/second（O(p)，p=选手数）
#
# 设计决策:
#   - 仅做 WR 历史，不做当前排名 tab（屠榜是早期历史现象，如今意义不大）
#   - Single 和 Average/Mean 均覆盖所有项目（含退役项目如脚拧、八板等）
require_relative "../core/statistic"
require_relative "../core/events"
require_relative "../core/solve_time"
require_relative "../core/database"
require_relative "../core/tab_ui"
require_relative "../core/metric_selector"

class WrDominance < Statistic
  include TabUi
  include MetricSelector

  HEADER = {
    "Count" => :right, "Improvement" => :right, "Days" => :right,
    "Person" => :left, "Date" => :left, "Competition" => :left
  }.freeze

  def initialize
    @title = "Dominance (top N on leaderboard by one person)"
    @note = "A competitor completely dominates top N on the leaderboard of results. Tied results are excluded."
  end

  def query
    ""
  end

  def data
    @data ||= compute_all
  end

  def markdown
    md = top
    md += metric_selector_styles
    md += dominance_metric_buttons

    # NOTE: Single 面板
    md += "<div class=\"metric-panel active\" id=\"metric-single\">\n"
    data[:single].each do |event_name, rows|
      next if rows.empty?
      md += render_event_table(event_name, rows)
    end
    md += "</div>\n"

    # NOTE: Average 面板
    md += "<div class=\"metric-panel\" id=\"metric-average\">\n"
    data[:average].each do |event_name, rows|
      next if rows.empty?
      md += render_event_table(event_name, rows)
    end
    md += "</div>\n"

    md += metric_selector_script
    md
  end

  private

  # NOTE: 指标按钮（Single / Average）
  def dominance_metric_buttons
    html = "<div class=\"metric-selector\">\n"
    [{"Single" => "single"}, {"Average" => "average"}].each_with_index do |m, i|
      label, id = m.first
      active = i == 0 ? " active" : ""
      html += "  <button class=\"metric-btn#{active}\" onclick=\"switchMetric('#{id}')\" "
      html += "data-i18n-en=\"#{label}\">#{label}</button>\n"
    end
    html += "</div>\n"
    html
  end

  # NOTE: 渲染单个项目的表格
  def render_event_table(event_name, rows)
    md = "<h3 data-i18n-en=\"#{event_name}\" data-i18n-zh=\"#{Events.zh(event_name)}\">#{event_name}</h3>\n"
    md += "<table>\n"
    md += html_table_header(HEADER)
    rows.each do |row|
      md += "<tr>"
      md += "<td style=\"text-align:right\">#{row[:count]}</td>"
      md += "<td style=\"text-align:right\">#{row[:improvement]}</td>"
      md += "<td style=\"text-align:right\">#{row[:days]}</td>"
      md += "<td>#{md_link_to_html(row[:person_link])}</td>"
      md += "<td>#{row[:date]}</td>"
      md += "<td>#{md_link_to_html(row[:comp_link])}</td>"
      md += "</tr>\n"
    end
    md += "</table>\n"
    md
  end

  def compute_all
    result = { single: [], average: [] }

    puts "  Dominance: querying all results..."
    all_rows = fetch_all_results

    # Single: 所有项目
    Events::ALL.each do |event_id, event_name|
      rows = all_rows.select { |r| r["event_id"] == event_id && r["best"] > 0 }
      next if rows.empty?
      hist = compute_wr_history(rows, "best")
      result[:single] << [event_name, hist] unless hist.empty?
    end

    # Average: 所有项目
    Events::ALL.each do |event_id, event_name|
      rows = all_rows.select { |r| r["event_id"] == event_id && r["average"] > 0 }
      next if rows.empty?
      hist = compute_wr_history(rows, "average")
      result[:average] << [event_name, hist] unless hist.empty?
    end

    result
  end

  # NOTE: 一次查询同时取 best 和 average，由调用方按需使用对应列
  def fetch_all_results
    sql = <<-SQL
      SELECT
        result.event_id,
        result.person_id,
        result.best,
        result.average,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') comp_link,
        competition.start_date
      FROM results result
      JOIN persons person ON person.wca_id = result.person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = result.competition_id
      WHERE result.best > 0 OR result.average > 0
      ORDER BY result.event_id, competition.start_date
    SQL
    Database.client.query(sql).to_a
  end

  # NOTE: 按时间线追踪 dominance 最高纪录的变化
  # 优化：维护 per-person 排序数组 + best_by_person hash，避免每步全量排序
  # value_col: "best" 或 "average"，指定从哪个列读取成绩值
  def compute_wr_history(rows, value_col)
    # per-person 排序值列表（用于 binary search 计数）
    pv = Hash.new { |h, k| h[k] = [] }  # person_id => sorted [values]
    # 每人最佳（最小）值
    pb = {}  # person_id => best value
    # 每人最新的 link 信息
    pl = {}  # person_id => person_link
    cl = {}  # person_id => comp_link

    max_dom = 0
    wr_records = []

    rows.group_by { |r| r["start_date"] }.each do |date, comp_rows|
      comp_rows.each do |r|
        pid = r["person_id"]
        val = r[value_col]

        # 二分插入，保持有序
        idx = pv[pid].bsearch_index { |v| v >= val } || pv[pid].size
        pv[pid].insert(idx, val)

        # 更新 best
        pb[pid] = val if !pb[pid] || val < pb[pid]

        pl[pid] = r["person_link"]
        cl[pid] = r["comp_link"]
      end

      # 找 top person（best 最小的人）和 second_best（非 top 的最小 best）
      top_pid = nil
      top_best = Float::INFINITY
      second_best = Float::INFINITY

      pb.each do |pid, best|
        if best < top_best
          second_best = top_best
          top_pid = pid
          top_best = best
        elsif best < second_best
          second_best = best
        end
      end

      # 如果只有一个人，跳过
      next if second_best == Float::INFINITY

      # 用 binary search 统计 top_person 有多少值 < second_best
      arr = pv[top_pid]
      cnt = arr.bsearch_index { |v| v >= second_best } || arr.size

      if cnt > max_dom && cnt > 0
        max_dom = cnt
        wr_records << {
          count: cnt,
          person_id: top_pid,
          person_link: pl[top_pid],
          comp_link: cl[top_pid],
          date: date
        }
      end
    end

    # 计算 improvement 和 days，然后倒序
    # NOTE: days = 该纪录保持的天数（到被下一条打破为止），最新纪录的 days 为空
    result = wr_records.each_with_index.map do |r, i|
      if i > 0
        prev = wr_records[i - 1]
        improvement = "+#{r[:count] - prev[:count]}"
      else
        improvement = ""
      end

      if i < wr_records.size - 1
        next_r = wr_records[i + 1]
        days = (next_r[:date] - r[:date]).to_i.to_s
      else
        days = ""
      end
      {
        count: r[:count],
        improvement: improvement,
        days: days,
        person_link: r[:person_link],
        comp_link: r[:comp_link],
        date: r[:date].strftime("%Y-%m-%d")
      }
    end

    result.reverse
  end
end
