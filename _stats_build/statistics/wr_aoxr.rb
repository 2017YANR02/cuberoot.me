# NOTE: 聚合页面——将 4 个 AoRounds 子类合并为一个 AoXR 入口
# 用户通过选择器在 Ao1R / Ao2R / Ao3R / Ao4R 之间切换
require_relative "abstract/ao_rounds"
require_relative "../core/metric_layout"
require_relative "wr_ao1r"
require_relative "wr_ao2r"
require_relative "wr_ao3r"
require_relative "wr_ao4r"

class WrAoxr < Statistic
  include StatPanel
  include MetricLayout

  AOXR_CLASSES = [WrAo1r, WrAo2r, WrAo3r, WrAo4r].freeze

  # NOTE: 按钮标签和 HTML ID 前缀。中文翻译统一在 i18n.js 中维护
  AOXR_META = {
    WrAo1r => { label: "Ao1R", id: "ao1r" },
    WrAo2r => { label: "Ao2R", id: "ao2r" },
    WrAo3r => { label: "Ao3R", id: "ao3r" },
    WrAo4r => { label: "Ao4R", id: "ao4r" },
  }.freeze

  def initialize
    @title = "AoXR"
    @note = "World record history and current rankings for Average of X Rounds (AoXR) — the mean of averages across multiple rounds in one competition."
  end

  def markdown
    md = top
    md += metric_tab_wrap_start

    ranking_header = RANKING_HEADER.merge("Details" => :left)
    ao_keys = [:rank, :person_link, :result_str, :country, :date, :competition_link, :details]

    md += aggregate_panels(AOXR_CLASSES, AOXR_META) do |inst, prefix|
      # NOTE: 必须先调 data 触发 compute_all_round_counts，才能填充 ranking_by_event
      history = inst.data
      ranking = inst.ranking_by_event
        .transform_values { |rows| ranking_to_arrays(rows, keys: ao_keys) }

      panel = grouped_panel("#{prefix}-ranking", true, ranking, ranking_header,
                            label_en: "Current Ranking", label_zh: "排名")
      panel += grouped_panel("#{prefix}-history", false, history, inst.table_header,
                             label_en: "WR History", label_zh: "历史")
      panel
    end

    md += metric_tab_wrap_end
    md
  end
end
