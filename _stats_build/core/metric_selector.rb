# NOTE: 指标选择器 UI 模块——为聚合页面（WrMetric / WrAoxr）提供
# 选择器按钮、样式和切换脚本的共享实现
# 消费方只需定义 META 常量（class => { label:, id: }）
module MetricSelector
  # NOTE: 通用分段控件 CSS 生成器
  # @param css_prefix [String] CSS 类名前缀 ("metric" 或 "source")
  #   生成 .{prefix}-selector, .{prefix}-btn, .{prefix}-panel 等样式
  def segmented_selector_styles(css_prefix = "metric")
    p = css_prefix # 简写
    <<~HTML
      <style>
      .#{p}-selector{display:flex;align-items:center;gap:0;margin:16px 0}
      .#{p}-selector-group{display:flex;gap:0}
      .#{p}-btn{padding:8px 20px;border:1px solid #4a6785;background:transparent;color:#8ab4f8;cursor:pointer;font-size:14px;font-weight:600;line-height:1.2;transition:all .2s;border-radius:0}
      .#{p}-btn:first-child{border-radius:6px 0 0 6px}
      .#{p}-btn:last-child{border-radius:0 6px 6px 0}
      .#{p}-btn + .#{p}-btn{border-left:none}
      .#{p}-btn.active{background:#2c4a6e;border-color:#8ab4f8;color:#fff}
      .#{p}-btn:hover:not(.active){background:rgba(138,180,248,0.08)}
      .#{p}-panel{display:none}
      .#{p}-panel.active{display:block}
      </style>
    HTML
  end

  # NOTE: 通用分段控件按钮生成器
  # @param items [Array<Hash>] [{ label:, id:, label_zh: nil }]
  # @param css_prefix [String] CSS 类名前缀 ("metric" / "source")
  # @param js_fn [String] 点击回调函数名
  # @param label [String/nil] 左侧标签文字（如 "Type"）
  # @param id_prefix [String/nil] ID 前缀（source 需要拼接 metric 的 id）
  # @param pass_self [Boolean] onclick 是否传 this（switchSource 需要 btn 引用定位 scope）
  def segmented_selector_buttons(items, css_prefix: "metric",
                                  js_fn: "switchMetric",
                                  label: nil, id_prefix: nil,
                                  pass_self: false)
    p = css_prefix
    html = "<div class=\"#{p}-selector\">\n"
    html += "  <div class=\"#{p}-selector-group\">\n"
    items.each_with_index do |item, i|
      active = i == 0 ? " active" : ""
      full_id = id_prefix ? "#{id_prefix}-#{item[:id]}" : item[:id]
      onclick = pass_self ? "#{js_fn}(this,'#{full_id}')" : "#{js_fn}('#{full_id}')"
      html += "    <button class=\"#{p}-btn#{active}\" onclick=\"#{onclick}\" "
      html += "data-i18n-en=\"#{item[:label]}\" "
      html += "data-i18n-zh=\"#{item[:label_zh]}\" " if item[:label_zh]
      html += ">#{item[:label]}</button>\n"
    end
    html += "  </div>\n"
    html += "</div>\n"
    html
  end

  # NOTE: 通用 flex 包装容器——让 metric 选择器、tab 选择器在桌面端同行显示
  # 通过 display:contents 将 metric-panel 的子元素暴露到 flex 布局中
  # 手机端自动换行（flex-wrap: wrap）
  def metric_tab_wrap_start
    <<~HTML
      <style>
      .metric-tab-wrap { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin: 16px 0; }
      .metric-tab-wrap .metric-selector { margin: 0; }
      .metric-tab-wrap .metric-panel { display: none; }
      .metric-tab-wrap .metric-panel.active { display: contents; }
      .metric-tab-wrap .stat-panel { width: 100%; }
      </style>
      <div class="metric-tab-wrap">
    HTML
  end

  def metric_tab_wrap_end
    "</div><!-- metric-tab-wrap -->\n"
  end


  # NOTE: 指标切换 JS——显示选中的 .metric-panel，高亮按钮
  def metric_selector_script
    <<~HTML
      <script>
      function switchMetric(id){
        // NOTE: metric 和 source 是独立选择器，切换 metric 时保持 source 选择不变
        var oldPanel=document.querySelector('.metric-panel.active');
        var srcIdx=0;
        if(oldPanel){
          oldPanel.querySelectorAll('.source-btn').forEach(function(b,i){if(b.classList.contains('active'))srcIdx=i;});
        }
        document.querySelectorAll('.metric-panel').forEach(p=>p.classList.remove('active'));
        document.querySelectorAll('.metric-btn').forEach(b=>b.classList.remove('active'));
        var panel=document.getElementById('metric-'+id);
        panel.classList.add('active');
        event.target.classList.add('active');
        // NOTE: 同步 source 索引到新 panel
        var newBtns=panel.querySelectorAll('.source-btn');
        if(newBtns[srcIdx]) newBtns[srcIdx].click();
      }
      </script>
    HTML
  end

  # ═══════════════════════════════════════════════
  # NOTE: 下拉菜单方案（适用于指标数量 > 5 的页面）
  # 与药丸按钮方案并列，消费方按需选择
  # ═══════════════════════════════════════════════

  # NOTE: 下拉菜单 CSS 样式
  def metric_dropdown_styles
    <<~HTML
      <style>
      .metric-toolbar{display:flex;align-items:center;gap:16px;margin:16px 0;flex-wrap:wrap}
      .metric-dropdown{position:relative;display:inline-block;margin:0}
      .metric-dropdown-trigger{
        display:flex;align-items:center;gap:8px;
        padding:8px 18px;
        border:1px solid #4a6785;border-radius:8px;
        background:rgba(255,255,255,0.03);
        color:#e0e0e0;cursor:pointer;
        font-size:14px;font-weight:500;
        transition:all .2s
      }
      .metric-dropdown-trigger:hover{border-color:#8ab4f8;background:rgba(138,180,248,0.08)}
      .metric-dropdown-trigger .arrow{
        font-size:10px;color:#8ab4f8;
        transition:transform .2s
      }
      .metric-dropdown.open .arrow{transform:rotate(180deg)}
      .metric-dropdown-panel{
        display:none;position:absolute;top:calc(100% + 6px);left:0;
        min-width:320px;
        padding:12px 0;
        background:rgba(20,25,40,0.95);
        backdrop-filter:blur(12px);
        border:1px solid rgba(138,180,248,0.2);
        border-radius:10px;
        box-shadow:0 8px 32px rgba(0,0,0,0.4);
        z-index:50
      }
      .metric-dropdown.open .metric-dropdown-panel{display:block}
      .metric-dropdown-group-label{
        padding:4px 16px;margin-top:8px;
        font-size:12px;font-weight:600;
        color:rgba(138,180,248,0.7);
        text-transform:uppercase;letter-spacing:0.5px
      }
      .metric-dropdown-group-label:first-child{margin-top:0}
      .metric-dropdown-items{
        display:flex;flex-wrap:wrap;gap:4px;
        padding:4px 12px
      }
      .metric-dropdown-item{
        padding:6px 14px;
        border:1px solid transparent;border-radius:6px;
        background:transparent;
        color:#c0c8d8;cursor:pointer;
        font-size:14px;font-weight:500;
        transition:all .15s
      }
      .metric-dropdown-item:hover{background:rgba(138,180,248,0.12);color:#fff}
      .metric-dropdown-item.active{
        background:rgba(138,180,248,0.18);
        border-color:rgba(138,180,248,0.3);
        color:#8ab4f8
      }
      .metric-panel{display:none}
      .metric-panel.active{display:block}
      </style>
    HTML
  end

  # NOTE: 生成分组下拉菜单 HTML
  # @param groups [Array<Hash>] 分组定义 [{ label:, label_zh:, items: [Class, ...] }, ...]
  # @param meta [Hash] class => { label:, id: } 映射
  def metric_dropdown_html(groups, meta)
    # 默认选中第一组的第一个
    first = meta[groups[0][:items][0]]
    html = "<div class=\"metric-dropdown\">\n"
    html += "  <button class=\"metric-dropdown-trigger\" onclick=\"toggleMetricDropdown()\">\n"
    html += "    <span data-i18n-en=\"#{first[:label]}\" data-role=\"trigger-text\">#{first[:label]}</span>\n"
    html += "    <span class=\"arrow\">▼</span>\n"
    html += "  </button>\n"
    html += "  <div class=\"metric-dropdown-panel\">\n"

    is_first = true
    groups.each do |group|
      html += "    <div class=\"metric-dropdown-group-label\" "
      html += "data-i18n-en=\"#{group[:label]}\" data-i18n-zh=\"#{group[:label_zh]}\">"
      html += "#{group[:label]}</div>\n"
      html += "    <div class=\"metric-dropdown-items\">\n"
      group[:items].each do |klass|
        m = meta[klass]
        active = is_first ? " active" : ""
        html += "      <button class=\"metric-dropdown-item#{active}\" "
        html += "data-id=\"#{m[:id]}\" data-i18n-en=\"#{m[:label]}\" "
        html += "onclick=\"selectFromDropdown('#{m[:id]}')\">"
        html += "#{m[:label]}</button>\n"
        is_first = false
      end
      html += "    </div>\n"
    end

    html += "  </div>\n"
    html += "</div>\n"
    html
  end

  # NOTE: 下拉菜单交互 JS
  # 依赖 switchMetric()（由 metric_selector_script 定义）
  def metric_dropdown_script
    <<~HTML
      <script>
      function toggleMetricDropdown(){
        document.querySelector('.metric-dropdown').classList.toggle('open');
      }
      function selectFromDropdown(id){
        // NOTE: 调用共享的面板切换逻辑
        switchMetric(id);
        // 更新触发器文本
        var item=document.querySelector('.metric-dropdown-item[data-id="'+id+'"]');
        if(item){
          var trigger=document.querySelector('[data-role="trigger-text"]');
          trigger.textContent=item.textContent;
          trigger.setAttribute('data-i18n-en',item.getAttribute('data-i18n-en'));
        }
        // 高亮当前项
        document.querySelectorAll('.metric-dropdown-item').forEach(function(i){i.classList.remove('active')});
        if(item) item.classList.add('active');
        // 关闭面板
        document.querySelector('.metric-dropdown').classList.remove('open');
      }
      // NOTE: 点击面板外部关闭
      document.addEventListener('click',function(e){
        var dd=document.querySelector('.metric-dropdown');
        if(dd && !dd.contains(e.target)) dd.classList.remove('open');
      });
      </script>
    HTML
  end
end
