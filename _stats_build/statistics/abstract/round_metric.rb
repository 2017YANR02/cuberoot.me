# NOTE: RoundMetric -- 抽象基类，从一轮的 5 次成绩 (value1-5) 中计算衍生指标
# 子类只需实现 compute_metric(values, r) 方法即可
# 产出双视图 Tab：当前排名 (ranking_data) + WR 历史 (transform)
#
# NOTE: 一次性计算模式——第一个子类运行时，动态发现并实例化所有子类，
# 逐 event 查询一次 MySQL 后为每个子类的 compute_metric 计算 ranking。
# 11 个子类 × 20 events = 220 次查询减到 20 次。
require_relative "../../core/grouped_statistic"
require_relative "../../core/events"
require_relative "../../core/solve_time"
require_relative "../../core/tab_ui"
require_relative "../../core/database"

class RoundMetric < GroupedStatistic
  include TabUi

  # NOTE: 预计算结果缓存
  # 结构：{ "ClassName" => [[event_name, top10], ...] }
  @@precomputed_rankings = {}
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

        gain_str, days_str = wr_progress(wr_records, i) { |r| r["_metric"] }

        details = (1..5).map { |n| SolveTime.new(event_id, :single, r["value#{n}"]).clock_format }
          .reject(&:empty?)
          .join(', ')

        date_str = r["start_date"].strftime("%Y-%m-%d")

        [metric_str, gain_str, days_str, r["person_link"], r["competition_link"], date_str, details]
      end

      [event_name, results.reverse]
    end
  end

  # NOTE: 当前排名数据——使用一次性计算模式
  # 第一个子类触发 compute_all_rankings，后续子类直接取 @@precomputed_rankings
  # 支持磁盘缓存，STATS_USE_CACHE=1 时直接读取
  def ranking_data
    return @_ranking_cache if @_ranking_cache

    # 磁盘缓存检查（本地开发用）
    cache_file = File.join(Statistic::CACHE_DIR, "#{self.class.name}_ranking.marshal")
    if ENV["STATS_USE_CACHE"] == "1" && File.exist?(cache_file)
      return @_ranking_cache = Marshal.load(File.binread(cache_file))
    end

    # 一次性计算：第一个子类触发，后续直接取缓存
    compute_all_rankings if @@precomputed_rankings.empty?

    @_ranking_cache = @@precomputed_rankings[self.class.name]
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

  # NOTE: 一次性为所有子类计算 ranking 数据
  # 动态发现所有 RoundMetric 子类，逐 event 查一次 MySQL，
  # 对每个子类实例调用 compute_metric 计算 best_by_person → top 10
  def compute_all_rankings
    # NOTE: 动态发现所有子类并实例化（用于调用各自的 compute_metric / format_metric）
    subclass_instances = RoundMetric.subclasses.map { |c| [c.name, c.new] }.to_h

    # 初始化结果容器
    subclass_instances.each_key { |name| @@precomputed_rankings[name] = [] }

    target_events.each do |event_id, event_name|
      # NOTE: 每个项目只查询 MySQL 一次，所有子类共享同一份数据
      event_rows = Database.client.query(
        "SELECT person_id, value1, value2, value3, value4, value5, average, best,
         CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link
         FROM results
         JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
         WHERE average > 0 AND event_id = '#{event_id}'"
      ).to_a

      subclass_instances.each do |class_name, instance|
        # 计算每人最佳 metric
        best_by_person = {}
        event_rows.each do |r|
          values = (1..5).map { |n| r["value#{n}"] }
          metric = instance.compute_metric(values, r)
          next unless metric
          pid = r["person_id"]
          if !best_by_person[pid] || metric < best_by_person[pid][:metric]
            best_by_person[pid] = { metric: metric, person_link: r["person_link"] }
          end
        end

        top = best_by_person.values
          .sort_by { |v| v[:metric] }
          .first(10)
          .map do |v|
            metric_str = instance.format_metric(v[:metric], event_id)
            [v[:person_link], metric_str]
          end

        @@precomputed_rankings[class_name] << [event_name, top]
      end
      # event_rows 在 block 结束后可被 GC 回收
    end

    # NOTE: 写入磁盘缓存，下次 STATS_USE_CACHE=1 时可直接读取
    FileUtils.mkdir_p(Statistic::CACHE_DIR)
    subclass_instances.each_key do |class_name|
      cache_file = File.join(Statistic::CACHE_DIR, "#{class_name}_ranking.marshal")
      File.binwrite(cache_file, Marshal.dump(@@precomputed_rankings[class_name]))
    end
  end
end
