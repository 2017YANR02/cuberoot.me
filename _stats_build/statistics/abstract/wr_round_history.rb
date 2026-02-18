# NOTE: 抽象基类，用于基于 WR average 轮次 value1-5 计算衍生指标的 WR 历史
# 子类只需实现 compute_metric(values, event_id) 方法即可
require_relative "../../core/grouped_statistic"
require_relative "../../core/events"
require_relative "../../core/solve_time"

class WrRoundHistory < GroupedStatistic
  def query
    <<-SQL
      SELECT
        result.event_id,
        average,
        best,
        value1, value2, value3, value4, value5,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        competition.start_date
      FROM results result
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      WHERE regional_average_record = 'WR'
      ORDER BY competition.start_date
    SQL
  end

  # 子类必须实现：从5次成绩的数组中计算指标值
  # values: [v1, v2, v3, v4, v5] 原始 WCA 编码值
  # r: 完整的行数据（包含 average, best 等）
  # 返回: 数值（用于排序和 WR 判断），或 nil 表示无效
  def compute_metric(values, r)
    raise "子类必须实现 compute_metric"
  end

  # 子类可覆盖：格式化指标值为显示字符串
  def format_metric(metric_value, event_id)
    SolveTime.new(event_id, :single, metric_value.round).clock_format
  end

  # 子类可覆盖：决定哪些项目参与（默认为官方项目中有 average 的）
  def target_events
    Events::OFFICIAL.reject { |id, _| Events::BLD.key?(id) }
  end

  def transform(query_results)
    target_events.map do |event_id, event_name|
      records = query_results
        .select { |r| r["event_id"] == event_id && r["average"] > 0 }
        .sort_by { |r| r["start_date"] }

      # 对每条记录计算指标值
      computed = records.filter_map do |r|
        values = (1..5).map { |n| r["value#{n}"] }
        metric = compute_metric(values, r)
        next unless metric
        r.merge("_metric" => metric)
      end

      # 构建 WR 历史：按日期正序扫描，只保留刷新最小值的记录
      min_so_far = Float::INFINITY
      wr_records = computed.select do |r|
        if r["_metric"] < min_so_far
          min_so_far = r["_metric"]
          true
        else
          false
        end
      end

      results = wr_records.each_with_index.map do |r, i|
        metric_str = format_metric(r["_metric"], event_id)

        if i > 0
          prev = wr_records[i - 1]
          # NOTE: .to_f 防止 compute_metric 返回整数时的整数除法问题
          gain = ((prev["_metric"] - r["_metric"]).to_f / prev["_metric"] * 100).round(1)
          gain_str = "-#{gain}%"
          duration = (r["start_date"] - prev["start_date"]).to_i
          days_str = duration.to_s
        else
          gain_str = ""
          days_str = ""
        end

        details = (1..5).map { |n| SolveTime.new(event_id, :single, r["value#{n}"]).clock_format }
          .reject(&:empty?)
          .join(', ')

        date_str = r["start_date"].strftime("%Y-%m-%d")

        [metric_str, gain_str, days_str, r["person_link"], r["competition_link"], date_str, details]
      end

      [event_name, results.reverse]
    end
  end
end
