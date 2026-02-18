# NOTE: Dominance = 选手在某项目全历史成绩排行榜上完全霸占前 N 席
# 例如某人有 12 个 result 比任何其他人的最佳 result 都好，则 dominance = 12
# 并列成绩排除（只算严格优于 others_best 的）
# 仅 WR 历史（屠榜是历史现象，当前排名无意义）
require_relative "../core/statistic"
require_relative "../core/events"
require_relative "../core/solve_time"
require_relative "../core/database"
require_relative "../core/tab_ui"

class WrDominance < Statistic
  include TabUi

  def initialize
    @title = "Dominance (top N on leaderboard by one person)"
    @title_zh = "排行榜霸榜（单人霸占前 N 席）"
    @note = "A competitor completely dominates top N on the leaderboard of results. Tied results are excluded."
    @note_zh = "选手在全历史成绩排行榜上完全霸占前 N 席。并列成绩不计入。"
  end

  def query
    ""
  end

  def data
    @data ||= compute_all
  end

  def markdown
    timestamp = Time.parse(Database.metadata["export_timestamp"])
    updated = timestamp.strftime("%e %B %Y").strip

    zh = @title_zh || @title
    md = "<h2 data-i18n-en=\"#{@title}\" data-i18n-zh=\"#{zh}\">#{@title}</h2>\n\n"
    nzh = @note_zh || @note
    md += "<p><em data-i18n-en=\"#{@note}\" data-i18n-zh=\"#{nzh}\">#{@note}</em></p>\n"
    date_zh = timestamp.strftime("更新于 %Y 年 %-m 月 %-d 日")
    md += "<p><em data-i18n-en=\"Updated on #{updated}\" data-i18n-zh=\"#{date_zh}\">Updated on #{updated}</em></p>\n\n"

    data.each do |group_name, rows|
      next if rows.empty?
      md += "<h3>#{group_name}</h3>\n"
      md += "<table>\n"
      md += "<tr>"
      md += "<th style=\"text-align:right\">Count</th>"
      md += "<th style=\"text-align:right\">Improvement</th>"
      md += "<th style=\"text-align:right\">Days</th>"
      md += "<th>Person</th><th>Competition</th><th>Date</th>"
      md += "</tr>\n"
      rows.each do |row|
        md += "<tr>"
        md += "<td style=\"text-align:right\">#{row[:count]}</td>"
        md += "<td style=\"text-align:right\">#{row[:improvement]}</td>"
        md += "<td style=\"text-align:right\">#{row[:days]}</td>"
        md += "<td>#{md_link_to_html(row[:person_link])}</td>"
        md += "<td>#{md_link_to_html(row[:comp_link])}</td>"
        md += "<td>#{row[:date]}</td>"
        md += "</tr>\n"
      end
      md += "</table>\n"
    end

    md
  end

  private

  def compute_all
    results = []

    # Single: 所有官方项目
    puts "  Dominance: querying singles..."
    single_rows = fetch_results(:single)
    Events::OFFICIAL.each do |event_id, event_name|
      group = "#{event_name} Single"
      rows = single_rows.select { |r| r["event_id"] == event_id }
      next if rows.empty?
      hist = compute_wr_history(rows)
      results << [group, hist] unless hist.empty?
    end

    # Average: 排除 BLD 类（它们用 mean，数据太少且意义不大）
    puts "  Dominance: querying averages..."
    avg_rows = fetch_results(:average)
    avg_events = Events::OFFICIAL.reject { |id, _| Events::BLD.key?(id) }
    avg_events.each do |event_id, event_name|
      group = "#{event_name} Average"
      rows = avg_rows.select { |r| r["event_id"] == event_id }
      next if rows.empty?
      hist = compute_wr_history(rows)
      results << [group, hist] unless hist.empty?
    end

    results
  end

  def fetch_results(type)
    col = type == :single ? "best" : "average"
    sql = <<-SQL
      SELECT
        result.event_id,
        result.person_id,
        result.#{col} AS value,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') comp_link,
        competition.start_date
      FROM results result
      JOIN persons person ON person.wca_id = result.person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = result.competition_id
      WHERE result.#{col} > 0
      ORDER BY result.event_id, competition.start_date
    SQL
    Database.client.query(sql).to_a
  end

  # NOTE: 按时间线追踪 dominance 最高纪录的变化
  # 优化：维护 per-person 排序数组 + best_by_person hash，避免每步全量排序
  def compute_wr_history(rows)
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
        val = r["value"]

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
    result = wr_records.each_with_index.map do |r, i|
      if i > 0
        prev = wr_records[i - 1]
        improvement = "+#{r[:count] - prev[:count]}"
        days = (r[:date] - prev[:date]).to_i.to_s
      else
        improvement = ""
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
