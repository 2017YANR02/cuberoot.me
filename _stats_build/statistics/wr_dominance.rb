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
#   - 提供双视图：当前排名 + WR 历史
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

  # NOTE: WR 历史表头
  HISTORY_HEADER = {
    "Count" => :right, "Improvement" => :right, "Days" => :right,
    "Person" => :left, "Start Date" => :left, "Start Comp" => :left,
    "Date" => :left, "Competition" => :left
  }.freeze

  # NOTE: 当前排名表头
  RANKING_HEADER = {
    "#" => :right, "Person" => :left, "Count" => :right,
    "Date" => :left, "Competition" => :left
  }.freeze

  def initialize
    @title = "Dominance"
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

    # NOTE: Tab 样式（全局只输出一次）
    md += tab_styles

    # NOTE: Single 面板——内含 Tab 双视图（当前排名 + WR 历史）
    md += "<div class=\"metric-panel active\" id=\"metric-single\">\n"
    md += tab_buttons(
      "Current Ranking", "当前排名", "single-ranking",
      "WR History", "WR 历史", "single-history"
    )
    md += grouped_panel("single-ranking", true, data[:single][:ranking].to_h, RANKING_HEADER)
    md += grouped_panel("single-history", false, data[:single][:history].to_h, HISTORY_HEADER)
    md += "</div>\n"

    # NOTE: Average 面板
    md += "<div class=\"metric-panel\" id=\"metric-average\">\n"
    md += tab_buttons(
      "Current Ranking", "当前排名", "average-ranking",
      "WR History", "WR 历史", "average-history"
    )
    md += grouped_panel("average-ranking", true, data[:average][:ranking].to_h, RANKING_HEADER)
    md += grouped_panel("average-history", false, data[:average][:history].to_h, HISTORY_HEADER)
    md += "</div>\n"

    md += metric_selector_script
    md += tab_script
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



  def compute_all
    result = {
      single:  { ranking: [], history: [] },
      average: { ranking: [], history: [] }
    }

    puts "  Dominance: querying all results..."
    all_rows = fetch_all_results

    # Single: 所有项目
    Events::ALL.each do |event_id, event_name|
      rows = all_rows.select { |r| r["event_id"] == event_id && r["best"] > 0 }
      next if rows.empty?

      dom = compute_dominance(rows, "best")
      result[:single][:history] << [event_name, dom[:history]] unless dom[:history].empty?
      result[:single][:ranking] << [event_name, dom[:ranking]] unless dom[:ranking].empty?
    end

    # Average: 所有项目
    Events::ALL.each do |event_id, event_name|
      rows = all_rows.select { |r| r["event_id"] == event_id && r["average"] > 0 }
      next if rows.empty?

      dom = compute_dominance(rows, "average")
      result[:average][:history] << [event_name, dom[:history]] unless dom[:history].empty?
      result[:average][:ranking] << [event_name, dom[:ranking]] unless dom[:ranking].empty?
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

  # NOTE: 统一计算 dominance 的 WR 历史和当前排名（共享 pv/pb 数据结构，单次遍历）
  # value_col: "best" 或 "average"，指定从哪个列读取成绩值
  # 返回 { history: [[cols...], ...], ranking: [[cols...], ...] }
  def compute_dominance(rows, value_col)
    # per-person 排序值列表（用于 binary search 计数）
    pv = Hash.new { |h, k| h[k] = [] }  # person_id => sorted [values]
    # 每人最佳（最小）值
    pb = {}  # person_id => best value
    # 每人最新的 link/date 信息（WR 历史和当前排名共用）
    pi = {}  # person_id => { person_link, comp_link, date }

    max_dom = 0
    wr_records = []
    # NOTE: 追踪每位选手首次 dominance 的比赛信息
    first_dom = {}  # person_id => { comp_link:, date: }

    # --- WR 历史追踪：按日期分组逐步构建 pv/pb ---
    rows.group_by { |r| r["start_date"] }.each do |date, comp_rows|
      comp_rows.each do |r|
        pid = r["person_id"]
        val = r[value_col]

        # 二分插入，保持有序
        idx = pv[pid].bsearch_index { |v| v >= val } || pv[pid].size
        pv[pid].insert(idx, val)

        # 更新 best
        pb[pid] = val if !pb[pid] || val < pb[pid]

        pi[pid] = {
          person_link: r["person_link"],
          comp_link: r["comp_link"],
          date: r["start_date"]
        }
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
        first_dom[top_pid] ||= { comp_link: pi[top_pid][:comp_link], date: date }
        wr_records << {
          count: cnt,
          person_id: top_pid,
          person_link: pi[top_pid][:person_link],
          comp_link: pi[top_pid][:comp_link],
          date: date
        }
      end
    end

    # --- WR 历史：计算 improvement 和 days，然后倒序 ---
    history = wr_records.each_with_index.map do |r, i|
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
        days = (Date.today - r[:date]).to_i.to_s
      end
      first = first_dom[r[:person_id]]
      [r[:count], improvement, days,
       r[:person_link],
       first[:date].strftime("%Y-%m-%d"), first[:comp_link],
       r[:date].strftime("%Y-%m-%d"), r[:comp_link]]
    end.reverse

    # --- 当前排名：复用遍历结束后的 pv/pb 最终状态 ---
    ranking = compute_ranking_from_state(pv, pb, pi)

    { history: history, ranking: ranking }
  end

  # NOTE: 从 pv/pb/pi 最终状态计算当前 dominance Top 10
  def compute_ranking_from_state(pv, pb, pi)
    # 预计算全局 top1 和 second_best
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

    return [] if second_best == Float::INFINITY

    # 对每个 person 计算 dominance
    # others_best: 如果 P 是全局最佳选手则为 second_best，否则为 top_best
    ranking = []
    pv.each do |pid, values|
      others_best = (pid == top_pid) ? second_best : top_best

      cnt = values.bsearch_index { |v| v >= others_best } || values.size
      next if cnt <= 0

      info = pi[pid]
      date_str = info[:date].respond_to?(:strftime) ? info[:date].strftime("%Y-%m-%d") : info[:date].to_s
      ranking << [cnt, pid, info[:person_link], date_str, info[:comp_link]]
    end

    # 按 dominance 降序排序，取 Top 10
    ranking.sort_by! { |r| -r[0] }
    ranking.first(10).each_with_index.map do |r, i|
      [i + 1, r[2], r[0], r[3], r[4]]
    end
  end
end
