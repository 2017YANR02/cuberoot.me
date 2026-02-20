# NOTE: 通用 Tab UI mixin，提供双视图（当前排名 + WR 历史）的 HTML 生成能力
# 任何需要 Tab 双视图的统计类都可以 include 此 module
module TabUi

  # NOTE: 标准排名表头——所有带 Tab 双视图的统计共用
  # 子类可用此常量或在此基础上追加列（如 ao_rounds 追加 Details）
  RANKING_HEADER = {
    "#" => :right, "Person" => :left, "Result" => :right,
    "Country" => :left, "Competition" => :left, "Date" => :left
  }.freeze

  # NOTE: 简化版排名表头——round_metric 等不关联具体比赛的统计使用
  RANKING_HEADER_SIMPLE = {
    "Person" => :left, "Result" => :right, "Country" => :left
  }.freeze

  def tab_styles
    <<~HTML
      <style>
      .stat-tabs{display:flex;gap:0;margin:16px 0 0}
      .stat-tab{flex:1;padding:10px 20px;border:none;cursor:pointer;font-size:15px;font-weight:600;color:#fff;background:#4a6785;transition:background .2s}
      .stat-tab:first-child{border-radius:6px 0 0 6px}
      .stat-tab:last-child{border-radius:0 6px 6px 0}
      .stat-tab.active{background:#2c4a6e}
      .stat-tab:hover:not(.active){background:#3b5975}
      .stat-panel{display:none;margin-top:12px}
      .stat-panel.active{display:block}
      .stat-panel table{border-collapse:collapse}
      .stat-panel th,.stat-panel td{padding:6px 12px;border-bottom:1px solid #ddd;text-align:left}
      .stat-panel th{background:#f6f8fa;font-weight:600}
      </style>
    HTML
  end

  # NOTE: 支持双语标签，en/zh 分别为英文/中文文本
  def tab_buttons(en1, zh1, id1, en2, zh2, id2)
    <<~HTML
      <div class="stat-tabs">
        <button class="stat-tab active" onclick="switchTab(event,'#{id1}')" data-i18n-en="#{en1}" data-i18n-zh="#{zh1}">#{en1}</button>
        <button class="stat-tab" onclick="switchTab(event,'#{id2}')" data-i18n-en="#{en2}" data-i18n-zh="#{zh2}">#{en2}</button>
      </div>
    HTML
  end

  def tab_script
    <<~HTML
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

  # NOTE: 把 markdown link [text](url) 转为 <a> 标签
  def md_link_to_html(text)
    text.to_s.gsub(/\[(.+?)\]\((.+?)\)/) { "<a href=\"#{$2}\">#{$1}</a>" }
  end

  # NOTE: 通用的表格头部 HTML 生成
  def html_table_header(header_hash)
    cells = header_hash.map do |k, v|
      align = v == :right ? ' style="text-align:right"' : ''
      "<th#{align}>#{k}</th>"
    end
    "<tr>#{cells.join}</tr>\n"
  end

  # NOTE: 通用的表格行 HTML 生成
  def html_table_row(row, header_hash)
    cells = row.each_with_index.map do |cell, i|
      align = header_hash.values[i] == :right ? ' style="text-align:right"' : ''
      "<td#{align}>#{md_link_to_html(cell.to_s)}</td>"
    end
    "<tr>#{cells.join}</tr>\n"
  end

  # NOTE: 通用双视图 Tab Markdown 生成器，消除子类手动拼 HTML 的风险
  # ranking_data / history_data 格式：{ event_name => [[col1, col2, ...], ...] }
  # ranking_header / history_header 格式：{ "ColName" => :left/:right }
  def tabbed_grouped_markdown(ranking_data:, ranking_header:, history_data:, history_header:)
    md = tab_styles
    md += tab_buttons("Current Ranking", "当前排名", "ranking", "WR History", "WR 历史", "history")
    md += grouped_panel("ranking", true,  ranking_data, ranking_header)
    md += grouped_panel("history", false, history_data, history_header)
    md += tab_script
    md
  end

  # NOTE: 通用排名查询——逐事件查询 top 10（避免全表 550 万行 JOIN）
  # 合并了 wr_single_history 和 wr_average_history 的 build_ranking_from_all
  # field: "best" 或 "average"（SQL 列名）
  # type: :single 或 :average（SolveTime 格式化用）
  # cache_name: 缓存标识，避免 single/average 冲突
  def build_ranking_from_results(event_id, field:, type:, cache_name:)
    require_relative "database"
    # NOTE: 用类变量 hash 做内存缓存，同一进程重复调用时直接返回
    cache_key = :"@@ranking_cache_#{cache_name}"
    self.class.class_variable_set(cache_key, {}) unless self.class.class_variable_defined?(cache_key)
    cache = self.class.class_variable_get(cache_key)
    return cache[event_id] if cache[event_id]

    # NOTE: 逐事件查询，每次只加载一个项目的数据（几千~几万行），避免全表 JOIN
    rows = Database.client.query(
      "SELECT r.person_id, r.#{field},
       CONCAT('[', p.name, '](https://www.worldcubeassociation.org/persons/', p.wca_id, ')') person_link,
       p.country_id,
       CONCAT('[', c.cell_name, '](https://www.worldcubeassociation.org/competitions/', c.id, ')') competition_link,
       c.start_date
       FROM results r
       JOIN persons p ON p.wca_id = r.person_id AND p.sub_id = 1
       JOIN competitions c ON c.id = r.competition_id
       WHERE r.#{field} > 0 AND r.event_id = '#{event_id}'
       ORDER BY r.#{field}"
    ).to_a

    # NOTE: 每人每项目最佳成绩，保留对应的比赛/日期/国家信息
    best_by_person = {}
    rows.each do |r|
      pid = r["person_id"]
      if !best_by_person[pid] || r[field] < best_by_person[pid][field]
        best_by_person[pid] = r
      end
    end

    result = best_by_person.values
      .sort_by { |r| r[field] }
      .first(10)
      .each_with_index.map do |r, i|
        result_str = SolveTime.new(event_id, type, r[field]).clock_format
        date_str = r["start_date"].respond_to?(:strftime) ? r["start_date"].strftime("%Y-%m-%d") : r["start_date"].to_s
        {
          rank: i + 1,
          person_link: r["person_link"],
          result_str: result_str,
          country: r["country_id"],
          competition_link: r["competition_link"],
          date: date_str
        }
      end

    cache[event_id] = result
    result
  end

  # NOTE: 将排名 hash 数组转为 tabbed_grouped_markdown 需要的二维数组
  # keys: 要提取的字段列表，顺序与 ranking_header 对应
  def ranking_to_arrays(ranking_rows, keys: [:rank, :person_link, :result_str, :country, :competition_link, :date])
    ranking_rows.map { |r| keys.map { |k| r[k] } }
  end

  private

  # NOTE: 渲染单个面板（一个 <div> 包含若干 <h3> + <table>）
  def grouped_panel(panel_id, active, grouped_data, header)
    active_class = active ? " active" : ""
    md = "<div id=\"#{panel_id}\" class=\"stat-panel#{active_class}\">\n"
    grouped_data.each do |event_name, rows|
      next if rows.empty?
      ezh = Events.zh(event_name)
      md += "<h3 data-i18n-en=\"#{event_name}\" data-i18n-zh=\"#{ezh}\">#{event_name}</h3>\n"
      md += "<table>\n"
      md += html_table_header(header)
      rows.each { |row| md += html_table_row(row, header) }
      md += "</table>\n"
    end
    md += "</div>\n"
    md
  end
end
