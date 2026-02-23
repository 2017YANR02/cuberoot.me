# NOTE: 指标选择器 UI 模块——为聚合页面（WrMetric / WrAoxr）提供
# 选择器按钮、样式和切换脚本的共享实现
# 消费方只需定义 META 常量（class => { label:, id: }）
module MetricSelector
  # NOTE: 选择器按钮的 CSS 样式（药丸按钮 + metric-panel 显隐）
  def metric_selector_styles
    <<~HTML
      <style>
      .metric-selector{display:flex;flex-wrap:wrap;gap:6px;margin:16px 0}
      .metric-btn{padding:8px 16px;border:1px solid #4a6785;border-radius:20px;background:transparent;color:#8ab4f8;cursor:pointer;font-size:14px;font-weight:500;transition:all .2s}
      .metric-btn.active{background:#2c4a6e;border-color:#8ab4f8;color:#fff}
      .metric-btn:hover:not(.active){background:rgba(138,180,248,0.1)}
      .metric-panel{display:none}
      .metric-panel.active{display:block}
      </style>
    HTML
  end

  # NOTE: 生成指标选择器按钮行
  # @param instances [Array] 子类实例列表
  # @param meta [Hash] class => { label:, id: } 映射
  def metric_selector_buttons(instances, meta)
    html = "<div class=\"metric-selector\">\n"
    instances.each_with_index do |inst, i|
      m = meta[inst.class]
      active = i == 0 ? " active" : ""
      html += "  <button class=\"metric-btn#{active}\" onclick=\"switchMetric('#{m[:id]}')\" "
      html += "data-i18n-en=\"#{m[:label]}\">#{m[:label]}</button>\n"
    end
    html += "</div>\n"
    html
  end

  # NOTE: 指标切换 JS——显示选中的 .metric-panel，高亮按钮
  def metric_selector_script
    <<~HTML
      <script>
      function switchMetric(id){
        document.querySelectorAll('.metric-panel').forEach(p=>p.classList.remove('active'));
        document.querySelectorAll('.metric-btn').forEach(b=>b.classList.remove('active'));
        document.getElementById('metric-'+id).classList.add('active');
        event.target.classList.add('active');
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
      .metric-dropdown{position:relative;display:inline-block;margin:16px 0}
      .metric-dropdown-trigger{
        display:flex;align-items:center;gap:8px;
        padding:10px 18px;
        border:1px solid #4a6785;border-radius:8px;
        background:rgba(255,255,255,0.03);
        color:#e0e0e0;cursor:pointer;
        font-size:15px;font-weight:500;
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
