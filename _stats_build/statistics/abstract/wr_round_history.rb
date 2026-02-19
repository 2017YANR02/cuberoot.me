# NOTE: 抽象基类，用于基于 WR average 轮次 value1-5 计算衍生指标的 WR 历史
# 子类只需实现 compute_metric(values, event_id) 方法即可
# 支持双视图 Tab：WR 历史 + 当前排名
require_relative "../../core/grouped_statistic"
require_relative "../../core/events"
require_relative "../../core/solve_time"
require_relative "../../core/tab_ui"

class WrRoundHistory < GroupedStatistic
  include TabUi
  def query
    <<-SQL
      SELECT
        result.event_id,
        average,
        best,
        value1, value2, value3, value4, value5,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        person.name person_name,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        competition.cell_name competition_name,
        competition.id competition_id,
        competition.start_date
      FROM results result
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      WHERE regional_average_record = 'WR'
      ORDER BY competition.start_date
    SQL
  end

  # NOTE: 全量查询，用于当前排名。类级别内存缓存，所有子类共享一次查询
  def self.all_results_cache
    @@all_results_cache ||= begin
      require_relative "../../core/database"
      Database.client.query(
        "SELECT event_id, person_id, value1, value2, value3, value4, value5, average, best,
         CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link
         FROM results
         JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
         WHERE average > 0"
      ).to_a
    end
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
    Events::WITH_AVERAGE
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
          gain_str = "#{gain}%"
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

  # NOTE: 当前排名数据——从全量 results 中计算每人每项目最佳 metric
  # 支持磁盘缓存，STATS_USE_CACHE=1 时直接读取最终排名结果，完全跳过 882MB 全量查询
  def ranking_data
    return @_ranking_cache if @_ranking_cache
    cache_file = File.join(Statistic::CACHE_DIR, "#{self.class.name}_ranking.marshal")
    if ENV["STATS_USE_CACHE"] == "1" && File.exist?(cache_file)
      return @_ranking_cache = Marshal.load(File.binread(cache_file))
    end

    all = self.class.all_results_cache
    target_ids = target_events.map(&:first).to_set

    # 按项目分组计算每人最佳 metric
    best_by_person = {}
    all.each do |r|
      next unless target_ids.include?(r["event_id"])
      values = (1..5).map { |n| r["value#{n}"] }
      metric = compute_metric(values, r)
      next unless metric
      key = [r["event_id"], r["person_id"]]
      if !best_by_person[key] || metric < best_by_person[key][:metric]
        best_by_person[key] = { metric: metric, person_link: r["person_link"] }
      end
    end

    # 按项目分组，每项目 top 10
    result = target_events.map do |event_id, event_name|
      top = best_by_person
        .select { |k, _| k[0] == event_id }
        .sort_by { |_, v| v[:metric] }
        .first(10)
        .map do |(_eid, _pid), v|
          metric_str = format_metric(v[:metric], event_id)
          [v[:person_link], metric_str]
        end
      [event_name, top]
    end

    FileUtils.mkdir_p(Statistic::CACHE_DIR)
    File.binwrite(cache_file, Marshal.dump(result))
    @_ranking_cache = result
  end

  # NOTE: 用 top + tabbed_grouped_markdown 替换原手写 HTML，所有引号转义由基类统一处理
  def markdown
    ranking_header = { "Person" => :left, "Result" => :right }
    top + tabbed_grouped_markdown(
      ranking_data: ranking_data,
      ranking_header: ranking_header,
      history_data: data,
      history_header: @table_header
    )
  end

  private
end
