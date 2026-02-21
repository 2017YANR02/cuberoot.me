# NOTE: 聚合页面——将 5 个 AverageOfX 子类合并为一个入口
# 用户通过选择器在 Ao5 / Ao12 / Ao25 / Ao50 / Ao100 之间切换
require_relative "abstract/average_of_x"
require_relative "../core/tab_ui"
require_relative "../core/metric_selector"
require_relative "average_of_5"
require_relative "average_of_12"
require_relative "average_of_25"
require_relative "average_of_50"
require_relative "average_of_100"

class AverageOf < Statistic
  include TabUi
  include MetricSelector

  AOX_CLASSES = [AverageOf5, AverageOf12, AverageOf25, AverageOf50, AverageOf100].freeze

  # NOTE: 按钮标签和 HTML ID 前缀
  AOX_META = {
    AverageOf5   => { label: "Ao5",   id: "ao5" },
    AverageOf12  => { label: "Ao12",  id: "ao12" },
    AverageOf25  => { label: "Ao25",  id: "ao25" },
    AverageOf50  => { label: "Ao50",  id: "ao50" },
    AverageOf100 => { label: "Ao100", id: "ao100" },
  }.freeze

  def initialize
    @title = "Average of X"
    @note = "X consecutive official attempts are considered. Only people from top 25 average are taken into account."
  end

  def markdown
    instances = AOX_CLASSES.map(&:new)

    md = top

    # --- 选择器按钮 ---
    md += metric_selector_styles
    md += metric_selector_buttons(instances, AOX_META)

    # --- 每个 AoX 的内容面板 ---
    # NOTE: AverageOfX 没有 Ranking/History 双视图，
    # 直接渲染分组 HTML 表格（不能用 Markdown 表格，因为在 <div> 内 Kramdown 不解析）
    instances.each_with_index do |inst, i|
      meta = AOX_META[inst.class]
      prefix = meta[:id]
      active = i == 0

      md += "<div class=\"metric-panel#{active ? ' active' : ''}\" id=\"metric-#{prefix}\">\n"

      header = inst.instance_variable_get(:@table_header)
      inst.data.each do |event_name, rows|
        next if rows.empty?
        ezh = Events.zh(event_name)
        md += "<h3 data-i18n-en=\"#{event_name}\" data-i18n-zh=\"#{ezh}\">#{event_name}</h3>\n"
        md += "<table>\n"
        md += html_table_header(header)
        rows.each { |row| md += html_table_row(row, header) }
        md += "</table>\n"
      end

      md += "</div>\n"
    end

    # --- JS ---
    md += metric_selector_script
    md
  end
end
