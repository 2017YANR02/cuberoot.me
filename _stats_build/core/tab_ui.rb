# NOTE: 通用 Tab UI mixin，提供双视图（当前排名 + WR 历史）的 HTML 生成能力
# 任何需要 Tab 双视图的统计类都可以 include 此 module
module TabUi
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
      .stat-panel table{border-collapse:collapse;width:100%}
      .stat-panel th,.stat-panel td{padding:6px 12px;border-bottom:1px solid #ddd;text-align:left}
      .stat-panel th{background:#f6f8fa;font-weight:600}
      </style>
    HTML
  end

  def tab_buttons(label1, id1, label2, id2)
    <<~HTML
      <div class="stat-tabs">
        <button class="stat-tab active" onclick="switchTab(event,'#{id1}')">#{label1}</button>
        <button class="stat-tab" onclick="switchTab(event,'#{id2}')">#{label2}</button>
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
end
