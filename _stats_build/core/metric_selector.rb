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
end
