# NOTE: 聚合页面——将 13 个 RoundMetric 子类合并为一个入口
# 用户通过指标选择器切换 Single/Average/BAo5/Mo5 等
# 每个指标有独立的 Tab 双视图（Current Ranking + WR History）
require_relative "abstract/round_metric"
require_relative "../core/metric_layout"

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
  include StatPanel
  include MetricLayout

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

  # NOTE: 指标分组定义（下拉菜单用）
  METRIC_GROUPS = [
    { label: "Basic", label_zh: "基本",
      items: [WrSingleHistory, WrAverageHistory] },
    { label: "Composite", label_zh: "复合",
      items: [WrBao5, WrWao5, WrMo5, WrBpa, WrWpa] },
    { label: "Distribution", label_zh: "分布",
      items: [WrMedian, WrBestCounting, WrWorstCounting,
              WrWorst, WrVariance, WrBestAverageRatio] },
  ].freeze

  def initialize
    @title = "Metric"
    @note = "World record history and current rankings for various derived metrics computed from a round's 5 solves."
  end

  def markdown
    md = top

    # --- 顶栏（下拉菜单 + 全局 Tab） ---
    # NOTE: data-tab-mode="global" 让 JS 生成 switchGlobalTab 而非 switchTab
    md += "<div class=\"metric-tab-wrap\" data-tab-mode=\"global\">\n"
    md += metric_dropdown_html(METRIC_GROUPS, METRIC_META)

    md += aggregate_panels(METRIC_CLASSES, METRIC_META) do |inst, prefix|
      panel = grouped_panel("#{prefix}-ranking", true, inst.ranking_data, RANKING_HEADER.merge("Details" => :left),
                            label_en: "Ranking", label_zh: "排名")
      panel += grouped_panel("#{prefix}-history", false, inst.data, inst.table_header,
                             label_en: "History", label_zh: "历史")
      panel
    end

    md += "</div><!-- metric-tab-wrap -->\n"
    md
  end
end
