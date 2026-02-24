# NOTE: 多指标页面布局模块——为聚合页面（wr_metric / wr_dominance / wr_aoxr 等）提供
# metric-panel 包装容器和下拉菜单的 HTML 生成
# 仅供指标数量 >= 2 的页面使用（单指标页面无需此 mixin）

module MetricLayout

  # NOTE: 通用 flex 包装容器——让 metric 选择器、tab 选择器在桌面端同行显示
  # 通过 display:contents 将 metric-panel 的子元素暴露到 flex 布局中
  # 手机端自动换行（flex-wrap: wrap）
  # CSS 已迁至 assets/css/stats_ui.css，只输出容器 div
  def metric_tab_wrap_start
    "<div class=\"metric-tab-wrap\">\n"
  end

  def metric_tab_wrap_end
    "</div><!-- metric-tab-wrap -->\n"
  end


  # ═══════════════════════════════════════════════
  # NOTE: 下拉菜单方案（适用于指标数量 > 5 的页面，如 wr_metric）
  # 与药丸按钮方案并列，消费方按需选择
  # ═══════════════════════════════════════════════

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
        html += "onclick=\"selectFromDropdown('#{m[:id]}')\">#{m[:label]}</button>\n"
        is_first = false
      end
      html += "    </div>\n"
    end

    html += "  </div>\n"
    html += "</div>\n"
    html
  end
end
