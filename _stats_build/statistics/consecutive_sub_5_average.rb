require_relative "../core/statistic"
require_relative "../core/solve_time"

class ConsecutiveSub5Average < Statistic
  def initialize
    @title = "Most consecutive sub-5 averages in 3x3x3"
    @note = "Only official 3x3x3 averages are considered. Computed across all rounds in chronological order."
    @table_header = {} # NOTE: 不使用基类的 markdown_table，自定义 HTML 输出
  end

  # NOTE: sub-5 的阈值，500 = 5.00 秒（WCA 用厘秒存储）
  SUB_X_THRESHOLD = 500

  def query
    <<-SQL
      SELECT
        result.person_id,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        person.name person_name,
        result.average,
        competition.cell_name competition_name,
        competition.id competition_id,
        competition.start_date
      FROM results result
      JOIN persons person ON person.wca_id = result.person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = result.competition_id
      JOIN round_types round_type ON round_type.id = result.round_type_id
      WHERE result.event_id = '333'
      ORDER BY result.person_id, competition.start_date, round_type.rank
    SQL
  end

  def transform(query_results)
    # NOTE: 收集所有选手的连续 sub-5 段
    all_streaks = []
    query_results
      .group_by { |r| r["person_id"] }
      .each do |_person_id, rows|
        collect_streaks(rows, all_streaks)
      end
    all_streaks
  end

  def markdown
    streaks = data

    # 视图 1: 当前排名（每人只取最长 streak，按 streak 降序）
    ranking = streaks
      .group_by { |s| s[:person_id] }
      .map { |_pid, ss| ss.max_by { |s| s[:count] } }
      .sort_by { |s| -s[:count] }
      .first(100)

    # 视图 2: WR 历史（按结束日期排序，只保留打破/追平纪录的行，最终倒序显示）
    wr_history = build_wr_history(streaks)

    build_tabbed_page(ranking, wr_history)
  end

  private

  # NOTE: 找出一个选手的所有连续 sub-5 average 段（count > 1）
  def collect_streaks(rows, result)
    person_id = rows.first["person_id"]
    person_link = rows.first["person_link"]
    current = new_streak

    rows.each do |r|
      avg = r["average"]
      if avg > 0 && avg < SUB_X_THRESHOLD
        if current[:count] == 0
          current[:start_comp] = r["competition_name"]
          current[:start_comp_id] = r["competition_id"]
          current[:start_date] = r["start_date"]
        end
        current[:count] += 1
        current[:end_comp] = r["competition_name"]
        current[:end_comp_id] = r["competition_id"]
        current[:end_date] = r["start_date"]
      else
        if current[:count] > 1
          result << current.merge(person_id: person_id, person_link: person_link)
        end
        current = new_streak
      end
    end

    # 最后一段（仍在进行中的 streak）
    if current[:count] > 1
      result << current.merge(person_id: person_id, person_link: person_link)
    end
  end

  def new_streak
    { count: 0, start_comp: nil, start_comp_id: nil, start_date: nil,
      end_comp: nil, end_comp_id: nil, end_date: nil }
  end

  # NOTE: 构建 WR 历史——按结束日期排序，只保留 >= 当前最大值的行，最终倒序
  def build_wr_history(streaks)
    sorted = streaks.sort_by { |s| s[:end_date] }
    max_count = 0
    history = sorted.filter_map do |s|
      if s[:count] >= max_count && s[:count] > 1
        max_count = s[:count]
        s
      end
    end
    history.reverse
  end

  def comp_link(name, id)
    "<a href=\"https://www.worldcubeassociation.org/competitions/#{id}\">#{name}</a>"
  end

  def person_link_html(link_md)
    # NOTE: 把 markdown link [text](url) 转为 <a> 标签
    if link_md =~ /\[(.+?)\]\((.+?)\)/
      "<a href=\"#{$2}\">#{$1}</a>"
    else
      link_md
    end
  end

  def build_tabbed_page(ranking, wr_history)
    timestamp = Time.parse(Database.metadata["export_timestamp"])
    updated = timestamp.strftime("%e %B %Y").strip

    <<~HTML
      ## #{@title}

      *Note: #{@note}*
      *Updated on #{updated}*

      <style>
      .stat-tabs{display:flex;gap:0;margin:16px 0 0}
      .stat-tab{flex:1;padding:10px 20px;border:none;cursor:pointer;font-size:15px;font-weight:600;color:#fff;background:#4a6785;transition:background .2s}
      .stat-tab:first-child{border-radius:6px 0 0 6px}
      .stat-tab:last-child{border-radius:0 6px 6px 0}
      .stat-tab.active{background:#2c4a6e}
      .stat-tab:hover:not(.active){background:#3b5975}
      .stat-panel{display:none;margin-top:12px}
      .stat-panel.active{display:block}
      .stat-panel table{border-collapse:collapse;width:100%}
      .stat-panel th,.stat-panel td{padding:6px 12px;border-bottom:1px solid #ddd;text-align:left}
      .stat-panel th{background:#f6f8fa;font-weight:600}
      .stat-panel td:first-child{text-align:right}
      </style>

      <div class="stat-tabs">
        <button class="stat-tab active" onclick="switchTab(event,'ranking')">当前排名</button>
        <button class="stat-tab" onclick="switchTab(event,'history')">WR 历史</button>
      </div>

      <div id="ranking" class="stat-panel active">
      #{ranking_table(ranking)}
      </div>

      <div id="history" class="stat-panel">
      #{history_table(wr_history)}
      </div>

      <script>
      function switchTab(e,id){
        document.querySelectorAll('.stat-tab').forEach(t=>t.classList.remove('active'));
        document.querySelectorAll('.stat-panel').forEach(p=>p.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(id).classList.add('active');
      }
      </script>
    HTML
  end

  def ranking_table(data)
    rows = data.map do |s|
      "<tr><td>#{s[:count]}</td><td>#{person_link_html(s[:person_link])}</td>" \
      "<td>#{comp_link(s[:start_comp], s[:start_comp_id])}</td>" \
      "<td>#{comp_link(s[:end_comp], s[:end_comp_id])}</td></tr>"
    end.join("\n")

    <<~TABLE
      <table>
      <tr><th style="text-align:right">Streak</th><th>Person</th><th>Started at</th><th>Ended at</th></tr>
      #{rows}
      </table>
    TABLE
  end

  def history_table(data)
    rows = data.map do |s|
      period = "#{comp_link(s[:start_comp], s[:start_comp_id])} → #{comp_link(s[:end_comp], s[:end_comp_id])}"
      "<tr><td>#{s[:count]}</td><td>#{person_link_html(s[:person_link])}</td><td>#{period}</td></tr>"
    end.join("\n")

    <<~TABLE
      <table>
      <tr><th style="text-align:right">Streak</th><th>Person</th><th>Period</th></tr>
      #{rows}
      </table>
    TABLE
  end
end
