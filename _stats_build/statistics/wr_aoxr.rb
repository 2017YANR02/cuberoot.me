# NOTE: 聚合页面——将 4 个 AoRounds 子类合并为一个 AoXR 入口
# 用户通过选择器在 Ao1R / Ao2R / Ao3R / Ao4R 之间切换
require_relative "abstract/ao_rounds"
require_relative "wr_ao1r"
require_relative "wr_ao2r"
require_relative "wr_ao3r"
require_relative "wr_ao4r"

class WrAoxr < Statistic
  include TabUi

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
    @title_zh = "跨轮次均值"
    @note = "World record history and current rankings for Average of X Rounds (AoXR) — the mean of averages across multiple rounds in one competition."
    @note_zh = "跨轮次均值（AoXR）的世界纪录历史与当前排名——一场比赛中多轮 average 的均值。"
  end

  def markdown
    instances = AOXR_CLASSES.map(&:new)

    md = top

    # --- 选择器按钮 ---
    md += metric_selector_styles
    md += metric_selector_buttons(instances)

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
      ao_keys = [:rank, :person_link, :result_str, :country, :competition_link, :date, :details]
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

  private

  # NOTE: 复用 WrMetric 相同的选择器样式和 JS
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

  def metric_selector_buttons(instances)
    html = "<div class=\"metric-selector\">\n"
    instances.each_with_index do |inst, i|
      meta = AOXR_META[inst.class]
      active = i == 0 ? " active" : ""
      html += "  <button class=\"metric-btn#{active}\" onclick=\"switchMetric('#{meta[:id]}')\" "
      html += "data-i18n-en=\"#{meta[:label]}\">#{meta[:label]}</button>\n"
    end
    html += "</div>\n"
    html
  end

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
