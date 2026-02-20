# NOTE: 聚合页面——将 13 个 RoundMetric 子类合并为一个入口
# 用户通过指标选择器切换 Single/Average/BAo5/Mo5 等
# 每个指标有独立的 Tab 双视图（Current Ranking + WR History）
require_relative "abstract/round_metric"

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
    WrBestAverageRatio  => { label: "Best/Avg Ratio",  id: "ratio" },
  }.freeze

  def initialize
    @title = "Metric"
    @title_zh = "衍生指标"
    @note = "World record history and current rankings for various derived metrics computed from a round's 5 solves."
    @note_zh = "从一轮 5 次成绩中计算的各类衍生指标的世界纪录历史与当前排名。"
  end

  def markdown
    instances = METRIC_CLASSES.map(&:new)

    md = top

    # --- 指标选择器按钮 ---
    md += metric_selector_styles
    md += metric_selector_buttons(instances)

    # --- Tab 样式（全局只输出一次）---
    md += tab_styles

    # --- 每个指标的内容面板 ---
    instances.each_with_index do |inst, i|
      meta = METRIC_META[inst.class]
      prefix = meta[:id]
      active = i == 0

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
    end

    # --- JS ---
    md += metric_selector_script
    md += tab_script  # NOTE: 作用域版，用 closest('.metric-panel') 限定
    md
  end

  private

  # NOTE: 指标选择器专用样式
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
  def metric_selector_buttons(instances)
    html = "<div class=\"metric-selector\">\n"
    instances.each_with_index do |inst, i|
      meta = METRIC_META[inst.class]
      active = i == 0 ? " active" : ""
      html += "  <button class=\"metric-btn#{active}\" onclick=\"switchMetric('#{meta[:id]}')\" "
      html += "data-i18n-en=\"#{meta[:label]}\">#{meta[:label]}</button>\n"
    end
    html += "</div>\n"
    html
  end

  # NOTE: 指标选择器切换 JS
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
