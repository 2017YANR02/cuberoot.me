# NOTE: 抽象基类，用于计算跨轮次 average of averages 的 WR 历史
# AoXR = 一场比赛中某人恰好参加了 X 轮时，各轮 average 的均值
# 子类只需指定 round_count 即可
require_relative "../../core/grouped_statistic"
require_relative "../../core/events"
require_relative "../../core/solve_time"

class AoRounds < GroupedStatistic
  # NOTE: round_type_id 分类：用于确定各轮在 Details 中的排列顺序
  # 排序权重越小越靠前（R1 < R2 < R3 < Final）
  ROUND_SORT_ORDER = {
    '1' => 1, 'd' => 1,   # First round / Combined first
    '2' => 2, 'e' => 2,   # Second round / Combined second
    '3' => 3, 'g' => 3,   # Semi-final / Combined third
    'c' => 99, 'f' => 99  # Combined final / Final（总是最后）
  }.freeze

  def round_count
    raise "子类必须实现 round_count"
  end

  def query
    <<-SQL
      SELECT
        result.event_id,
        result.average,
        result.round_type_id,
        result.competition_id,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        person.wca_id AS person_id,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        competition.start_date
      FROM results result
      JOIN persons person ON person.wca_id = result.person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = result.competition_id
      ORDER BY result.event_id, competition.start_date
    SQL
  end

  def transform(query_results)
    Events::OFFICIAL.map do |event_id, event_name|
      event_rows = query_results.select { |r| r["event_id"] == event_id }

      # NOTE: 按 (competition_id, person_id) 分组，收集该人在该比赛的所有轮次记录
      # 与 WCADB SQL 一致：COUNT(r.average) = round_count（计入所有行，含 average <= 0）
      grouped = {}
      event_rows.each do |r|
        key = [r["competition_id"], r["person_id"]]
        grouped[key] ||= { "rows" => [], "person_link" => r["person_link"],
                           "competition_link" => r["competition_link"],
                           "start_date" => r["start_date"], "event_id" => event_id }
        grouped[key]["rows"] << r
      end

      # 筛选：该人在该比赛恰好有 round_count 条记录，且所有 average > 0
      computed = grouped.filter_map do |_key, info|
        rows = info["rows"]
        next unless rows.size == round_count
        next if rows.any? { |r| r["average"].nil? || r["average"] <= 0 }

        # 按轮次排序（R1 < R2 < R3 < Final），提取 average 值
        sorted_rows = rows.sort_by { |r| ROUND_SORT_ORDER[r["round_type_id"]] || 50 }
        values = sorted_rows.map { |r| r["average"] }
        avg = values.sum.to_f / round_count
        info.merge("_metric" => avg, "_round_values" => values)
      end

      # 按日期正序排序，构建 WR 历史（只保留刷新最小值的记录）
      sorted = computed.sort_by { |r| r["start_date"] }
      min_so_far = Float::INFINITY
      wr_records = sorted.select do |r|
        if r["_metric"] < min_so_far
          min_so_far = r["_metric"]
          true
        else
          false
        end
      end

      results = wr_records.each_with_index.map do |r, i|
        metric_str = SolveTime.new(event_id, :average, r["_metric"].round).clock_format

        if i > 0
          prev = wr_records[i - 1]
          gain = ((prev["_metric"] - r["_metric"]) / prev["_metric"] * 100).round(1)
          gain_str = "-#{gain}%"
          duration = (r["start_date"] - prev["start_date"]).to_i
          days_str = duration.to_s
        else
          gain_str = ""
          days_str = ""
        end

        # Details: 显示各轮 average（已按轮次排序）
        details = r["_round_values"].map do |v|
          SolveTime.new(event_id, :average, v).clock_format
        end.join(', ')

        date_str = r["start_date"].strftime("%Y-%m-%d")
        [metric_str, gain_str, days_str, r["person_link"], r["competition_link"], date_str, details]
      end

      [event_name, results.reverse]
    end
  end
end
