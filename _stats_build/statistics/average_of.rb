# NOTE: 聚合页面——将 5 个 AverageOfX 子类合并为一个入口
# 用户通过选择器在 Ao5 / Ao12 / Ao25 / Ao50 / Ao100 之间切换
require_relative "abstract/average_of_x"
require_relative "../core/stat_panel"
require_relative "average_of_3"
require_relative "../core/metric_layout"
require_relative "average_of_5"
require_relative "average_of_12"
require_relative "average_of_25"
require_relative "average_of_50"
require_relative "average_of_100"

class AverageOf < Statistic
  include StatPanel
  include MetricLayout

  AOX_CLASSES = [AverageOf3, AverageOf5, AverageOf12, AverageOf25, AverageOf50, AverageOf100].freeze

  # NOTE: 按钮标签和 HTML ID 前缀
  AOX_META = {
    AverageOf3   => { label: "Mo3",   id: "mo3" },
    AverageOf5   => { label: "Ao5",   id: "ao5" },
    AverageOf12  => { label: "Ao12",  id: "ao12" },
    AverageOf25  => { label: "Ao25",  id: "ao25" },
    AverageOf50  => { label: "Ao50",  id: "ao50" },
    AverageOf100 => { label: "Ao100", id: "ao100" },
  }.freeze

  def initialize
    @title = "Rolling Average"
    @note = "X consecutive official attempts are considered. " \
            "Top N varies by event: 333 top 15, most events top 30, " \
            "333fm/pyram/clock/444bf/555bf/magic/mmagic top 300, " \
            "333bf top 2000."
  end

  def markdown
    md = top
    md += metric_tab_wrap_start

    md += aggregate_panels(AOX_CLASSES, AOX_META) do |inst, prefix|
      # NOTE: 双 Tab 视图——复用 wr_aoxr.rb 的 grouped_panel 模式
      ranking = inst.ranking_data
      history = inst.wr_history

      panel = grouped_panel("#{prefix}-ranking", true, ranking, AverageOfX::RANKING_HEADER_AOX,
                            label_en: "Current Ranking", label_zh: "排名")
      panel += grouped_panel("#{prefix}-history", false, history, inst.history_header,
                             label_en: "WR History", label_zh: "历史")
      panel
    end

    md += metric_tab_wrap_end
    md
  end
end
