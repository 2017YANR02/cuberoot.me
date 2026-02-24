# NOTE: 数据面板渲染模块——把 DB 查询结果渲染成 stat-panel + table HTML
# 所有统计页面的表格生成共用此 mixin
# UI 层（按钮、Tab 切换）已完全迁至 assets/js/stats_ui.js

module StatPanel

  # NOTE: 标准排名表头——所有带 Tab 双视图的统计共用
  # 子类可用此常量或在此基础上追加列（如 ao_rounds 追加 Details）
  RANKING_HEADER = {
    "#" => :right, "Person" => :left, "Result" => :right,
    "Country" => :left, "Date" => :left, "Competition" => :left
  }.freeze


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
    # NOTE: tab 按钮由 JS 根据 data-label-* 自动生成
    md = grouped_panel("ranking", true,  ranking_data, ranking_header,
                       label_en: "Current Ranking", label_zh: "排名")
    md += grouped_panel("history", false, history_data, history_header,
                        label_en: "WR History", label_zh: "历史")
    md
  end


  # NOTE: 将排名 hash 数组转为 tabbed_grouped_markdown 需要的二维数组
  # keys: 要提取的字段列表，顺序与 ranking_header 对应
  def ranking_to_arrays(ranking_rows, keys: [:rank, :person_link, :result_str, :country, :date, :competition_link])
    ranking_rows.map { |r| keys.map { |k| r[k] } }
  end

  private

  # NOTE: 渲染单个面板（一个 <div> 包含若干 <h3> + <table>）
  # label_en / label_zh：供 JS initStatsUI() 自动生成 tab 按钮
  def grouped_panel(panel_id, active, grouped_data, header, label_en: nil, label_zh: nil)
    active_class = active ? " active" : ""
    data_attrs = ""
    data_attrs += " data-label-en=\"#{label_en}\"" if label_en
    data_attrs += " data-label-zh=\"#{label_zh}\"" if label_zh
    md = "<div id=\"#{panel_id}\" class=\"stat-panel#{active_class}\"#{data_attrs}>\n"
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
