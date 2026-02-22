# NOTE: 聚合页面——将 13 个 RoundMetric 子类合并为一个入口
# 用户通过指标选择器切换 Single/Average/BAo5/Mo5 等
# 每个指标有独立的 Tab 双视图（Current Ranking + WR History）
require_relative "abstract/round_metric"
require_relative "../core/metric_selector"

# NOTE: 加载所有 RoundMetric 子类
require_relative "wr_single_history"
require_relative "wr_average_history"
require_relative "wr_bao5"
require_relative "wr_wao5"
require_relative "wr_mo5"
require_relative "wr_bpa"
require_relative "wr_wpa"
require_relative "wr_median"
require_relative "wr_best_counting"
require_relative "wr_worst_counting"
require_relative "wr_worst"
require_relative "wr_variance"
require_relative "wr_best_average_ratio"

class WrMetric < Statistic
  include TabUi
  include MetricSelector

  # NOTE: 指标展示顺序——Single/Average 在前，衍生指标按逻辑相近分组
  METRIC_CLASSES = [
    WrSingleHistory, WrAverageHistory,
    WrBao5, WrWao5, WrMo5,
    WrBpa, WrWpa,
    WrMedian, WrBestCounting, WrWorstCounting, WrWorst,
    WrVariance, WrBestAverageRatio
  ].freeze

  # NOTE: 按钮标签和 HTML ID 前缀。中文翻译统一在 i18n.js 中维护
  METRIC_META = {
    WrSingleHistory     => { label: "Single",         id: "single" },
    WrAverageHistory    => { label: "Average",         id: "average" },
    WrBao5              => { label: "BAo5",            id: "bao5" },
    WrWao5              => { label: "WAo5",            id: "wao5" },
    WrMo5               => { label: "Mo5",             id: "mo5" },
    WrBpa               => { label: "BPA",             id: "bpa" },
    WrWpa               => { label: "WPA",             id: "wpa" },
    WrMedian            => { label: "Median",          id: "median" },
    WrBestCounting      => { label: "Best Counting",   id: "bestc" },
    WrWorstCounting     => { label: "Worst Counting",  id: "worstc" },
    WrWorst             => { label: "Worst",           id: "worst" },
    WrVariance          => { label: "Variance",        id: "variance" },
    WrBestAverageRatio  => { label: "Best/Avg",        id: "ratio" },
  }.freeze

  def initialize
    @title = "Metric"
    @note = "World record history and current rankings for various derived metrics computed from a round's 5 solves."
  end

  def markdown
    instances = METRIC_CLASSES.map(&:new)

    md = top

    # --- 指标选择器按钮 ---
    md += metric_selector_styles
    md += metric_selector_buttons(instances, METRIC_META)

    # --- Tab 样式（全局只输出一次）---
    md += tab_styles

    # --- 每个指标的内容面板 ---
    instances.each_with_index do |inst, i|
      meta = METRIC_META[inst.class]
      prefix = meta[:id]
      active = i == 0
      t_sub = Time.now

      md += "<div class=\"metric-panel#{active ? ' active' : ''}\" id=\"metric-#{prefix}\">\n"

      # NOTE: 获取排名数据和 WR 历史数据
      ranking = inst.ranking_data
      history = inst.data  # 调用 query → transform

      # NOTE: Tab ID 加前缀避免 13 个面板的 ID 冲突
      md += tab_buttons(
        "Current Ranking", "当前排名", "#{prefix}-ranking",
        "WR History", "WR 历史", "#{prefix}-history"
      )
      md += grouped_panel("#{prefix}-ranking", true, ranking, RANKING_HEADER)
      md += grouped_panel("#{prefix}-history", false, history, inst.instance_variable_get(:@table_header))

      md += "</div>\n"
      printf("    [%2d/%d] %-20s %5.1fs\n", i + 1, instances.size, meta[:label], Time.now - t_sub)
    end

    # --- JS ---
    md += metric_selector_script
    md += tab_script  # NOTE: 作用域版，用 closest('.metric-panel') 限定
    md
  end
end
