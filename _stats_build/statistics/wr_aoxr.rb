# NOTE: 聚合页面——将 4 个 AoRounds 子类合并为一个 AoXR 入口
# 用户通过选择器在 Ao1R / Ao2R / Ao3R / Ao4R 之间切换
require_relative "abstract/ao_rounds"
require_relative "../core/metric_selector"
require_relative "wr_ao1r"
require_relative "wr_ao2r"
require_relative "wr_ao3r"
require_relative "wr_ao4r"

class WrAoxr < Statistic
  include TabUi
  include MetricSelector

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
    instances = AOXR_CLASSES.map(&:new)

    md = top

    # --- 选择器按钮 ---
    md += metric_selector_styles
    md += metric_selector_buttons(instances, AOXR_META)

    # --- Tab 样式 ---
    md += tab_styles

    # --- 每个 AoXR 的内容面板 ---
    # NOTE: AoRounds.markdown 调 data 触发一次性计算，4 个子类共享一次查询
    ranking_header = RANKING_HEADER.merge("Details" => :left)

    instances.each_with_index do |inst, i|
      meta = AOXR_META[inst.class]
      prefix = meta[:id]
      active = i == 0

      md += "<div class=\"metric-panel#{active ? ' active' : ''}\" id=\"metric-#{prefix}\">\n"

      # NOTE: 获取数据——第一个子类触发 compute_all_round_counts，后续直接取缓存
      history = inst.data
      ao_keys = [:rank, :person_link, :result_str, :country, :date, :competition_link, :details]
      ranking = inst.instance_variable_get(:@ranking_by_event)
        .transform_values { |rows| ranking_to_arrays(rows, keys: ao_keys) }

      md += tab_buttons(
        "Current Ranking", "当前排名", "#{prefix}-ranking",
        "WR History", "WR 历史", "#{prefix}-history"
      )
      md += grouped_panel("#{prefix}-ranking", true, ranking, ranking_header)
      md += grouped_panel("#{prefix}-history", false, history, inst.instance_variable_get(:@table_header))

      md += "</div>\n"
    end

    md += metric_selector_script
    md += tab_script
    md
  end
end
