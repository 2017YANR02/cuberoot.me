# NOTE: 333mbf/333mbo Mo3 平均值
# 333mbf：从 DB 计算 Mo3，WCA 编码 0DDTTTTTMM，DD/TTTTT/MM 分别取均值（ROUND）后拼接
# 333mbo：历史上仅 1 人完成过 3 轮，硬编码数据
# 此类同时作为独立统计页面（ranking + history）和数据提供者（供 WrAverageHistory 委托）
require_relative "../core/statistic"
require_relative "../core/stat_panel"
require_relative "../core/events"
require_relative "../core/solve_time"

class MbfAverage < Statistic
  include StatPanel

  # NOTE: 历史表头（7 列，含 Details）——独立页面使用
  HISTORY_HEADER = {
    "Mo3" => :right, "Improvement" => :right, "Days" => :right,
    "Person" => :left, "Date" => :left, "Competition" => :left, "Details" => :left
  }.freeze

  # NOTE: 333mbo 历史上仅 Constantin Ceausu 在 ECC 2006 完成过 Mo3
  # 三次成绩均无时间记录（旧格式不记录时间），硬编码显示字符串
  MBO_EVENT_NAME = Events::ALL["333mbo"].freeze
  MBO_PERSON_LINK = "[Constantin Ceausu](https://www.worldcubeassociation.org/persons/2003CEAU01)".freeze
  MBO_COMPETITION_LINK = "[European Championship 2006](https://www.worldcubeassociation.org/competitions/Euro2006)".freeze
  MBO_DATE = "2006-09-23".freeze
  MBO_DETAILS = "3/3 ?:??:??, 4/5 ?:??:??, 2/4 ?:??:??".freeze
  # NOTE: Mo3 显示：3 次 (solved/attempted) 各自平均 → 约 3/4 ?:??:??
  MBO_MO3 = "3/4 ?:??:??".freeze

  # NOTE: 333mbo Mo3 的排名数据（6 列，对齐 RANKING_HEADER）
  MBO_RANKING = [[1, MBO_PERSON_LINK, MBO_MO3, "Romania", MBO_DATE, MBO_COMPETITION_LINK]].freeze
  # NOTE: 历史只有 1 条纪录，进步为空，保持天数算到今天（硬编码为固定值，不影响内容）
  MBO_HISTORY = [["3/4 ?:??:??", "", "7000+", MBO_PERSON_LINK, MBO_DATE, MBO_COMPETITION_LINK, MBO_DETAILS]].freeze

  def initialize
    @title = "3x3x3 Multi-Blind Mo3"
    @note = "Unofficial Mo3 for 333mbf (not tracked by WCA). " \
            "The WCA value 0DDTTTTTMM is split into DD (99 minus difference), " \
            "TTTTT (time in seconds), and MM (missed). " \
            "Each part is averaged across 3 attempts and rounded to the nearest integer, " \
            "then reassembled into a single value for ranking. " \
            "333mbo data is hardcoded (only one person has ever completed a Mo3)."
    @table_header = HISTORY_HEADER
  end

  def query
    <<-SQL
      SELECT
        value1, value2, value3,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        person.name person_name,
        result.person_id,
        person.country_id,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        competition.start_date
      FROM results result
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      WHERE result.event_id = '333mbf'
        AND value1 > 0
        AND value2 > 0
        AND value3 > 0
      ORDER BY competition.start_date
    SQL
  end

  # NOTE: 按 average.sql 方案——DD/TTTTT/MM 分别取均值再拼接
  # WCA 编码新格式 0DDTTTTTMM（9 位）；此方法仅用于新格式 333mbf，不适用于旧格式 333mbo
  # DD = value / 10_000_000, TTTTT = (value / 100) % 100_000, MM = value % 100
  def mbf_mo3(v1, v2, v3)
    vals = [v1, v2, v3]
    # NOTE: 各部分独立求均值后四舍五入，与 average.sql 的 ROUND() 保持一致
    dd    = (vals.map { |v| v / 10_000_000 }.sum / 3.0).round
    ttttt = (vals.map { |v| (v / 100) % 100_000 }.sum / 3.0).round
    mm    = (vals.map { |v| v % 100 }.sum / 3.0).round
    dd * 10_000_000 + ttttt * 100 + mm
  end

  def format_mo3(mo3_value)
    SolveTime.new("333mbf", :single, mo3_value).clock_format
  end

  def transform(query_results)
    # --- 333mbf ---
    computed = query_results.filter_map do |r|
      v1, v2, v3 = r["value1"], r["value2"], r["value3"]
      mo3 = mbf_mo3(v1, v2, v3)
      r.merge("_metric" => mo3)
    end.sort_by { |r| r["start_date"] }

    # WR history：按日期正序扫描，值越小越好，保留刷新最小值的记录
    min_so_far = Float::INFINITY
    wr_records = computed.select do |r|
      if r["_metric"] <= min_so_far
        min_so_far = r["_metric"]
        true
      else
        false
      end
    end

    mbf_history = wr_records.each_with_index.map do |r, i|
      mo3_str = format_mo3(r["_metric"])
      # NOTE: 进步列用 points 差值（solved - missed），百分比对复合编码无意义
      curr_pts = SolveTime.new("333mbf", :single, r["_metric"]).points
      gain_str = if i > 0
        prev_pts = SolveTime.new("333mbf", :single, wr_records[i - 1]["_metric"]).points
        "+#{curr_pts - prev_pts} pts"
      else
        ""
      end
      days_str = if i < wr_records.size - 1
        (wr_records[i + 1]["start_date"] - r["start_date"]).to_i.to_s
      else
        (Date.today - r["start_date"].to_date).to_i.to_s
      end
      date_str = r["start_date"].strftime("%Y-%m-%d")
      details = (1..3).map { |n| SolveTime.new("333mbf", :single, r["value#{n}"]).clock_format }.join(", ")
      [mo3_str, gain_str, days_str, r["person_link"], date_str, r["competition_link"], details]
    end

    # Ranking（包含 Details，7 列——独立页面专用）
    best_by_person = {}
    computed.each do |r|
      pid = r["person_id"]
      if !best_by_person[pid] || r["_metric"] < best_by_person[pid][:metric]
        best_by_person[pid] = {
          metric: r["_metric"], person_link: r["person_link"],
          country: r["country_id"],
          competition_link: r["competition_link"],
          start_date: r["start_date"],
          value1: r["value1"], value2: r["value2"], value3: r["value3"]
        }
      end
    end

    mbf_ranking_7col = best_by_person.values
      .sort_by { |v| v[:metric] }
      .first(10)
      .each_with_index.map do |v, i|
        mo3_str = format_mo3(v[:metric])
        date_str = v[:start_date].respond_to?(:strftime) ? v[:start_date].strftime("%Y-%m-%d") : v[:start_date].to_s
        details = [v[:value1], v[:value2], v[:value3]].map { |val| SolveTime.new("333mbf", :single, val).clock_format }.join(", ")
        [i + 1, v[:person_link], mo3_str, v[:country], date_str, v[:competition_link], details]
      end

    # NOTE: 缓存数据供接口方法使用
    # history 以 event_name 为 key，方便 WrAverageHistory 委托时按名称取用
    mbf_name = Events::ALL["333mbf"]
    @_mbf_history  = mbf_history.reverse
    @_mbf_ranking_6col = mbf_ranking_7col.map { |row| row[0..5] }  # 去掉 Details 列

    @_ranking = {
      mbf_name => mbf_ranking_7col,
      MBO_EVENT_NAME => [MBO_RANKING.first]  # 独立页面也显示 333mbo
    }
    {
      mbf_name => @_mbf_history,
      MBO_EVENT_NAME => MBO_HISTORY
    }
  end

  # NOTE: 供 WrAverageHistory 委托调用——history 数据（7 列）
  def history_for(event_name)
    data  # 触发 transform（若未执行）
    case event_name
    when Events::ALL["333mbf"] then @_mbf_history
    when MBO_EVENT_NAME         then MBO_HISTORY
    else []
    end
  end

  # NOTE: 供 WrAverageHistory 委托调用——ranking 数据（6 列，对齐 RANKING_HEADER）
  def ranking_for(event_name)
    data  # 触发 transform
    case event_name
    when Events::ALL["333mbf"] then @_mbf_ranking_6col
    when MBO_EVENT_NAME         then MBO_RANKING
    else []
    end
  end

  def markdown
    md = top

    # NOTE: 使用 StatPanel 的双 tab 视图
    # ranking 用 7 列（含 Details），history 用 HISTORY_HEADER（7 列）
    md += tabbed_grouped_markdown(
      ranking_data: ranking_data,
      ranking_header: RANKING_HEADER.merge("Details" => :left),
      history_data: data,
      history_header: HISTORY_HEADER
    )
    md
  end

  def ranking_data
    data  # 触发 transform
    @_ranking
  end
end
