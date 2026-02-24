# NOTE: RoundMetric -- 抽象基类，从一轮的 5 次成绩 (value1-5) 中计算衍生指标
# 子类只需实现 compute_metric(values, r) 方法即可
# 产出双视图 Tab：排名 (ranking_data) + 历史 (transform)
#
# NOTE: 一次性计算模式——第一个子类运行时，动态发现并实例化所有子类，
# 按 (value_column, target_events) 分组，逐 event 查询一次 MySQL
# 后为同组每个子类的 compute_metric 计算 ranking。
# 分组避免跨组 target_events 冲突和子进程查询翻倍。
require_relative "../../core/grouped_statistic"
require_relative "../../core/events"
require_relative "../../core/solve_time"
require_relative "../../core/stat_panel"
require_relative "../../core/database"

class RoundMetric < GroupedStatistic
  include StatPanel

  # NOTE: 预计算结果缓存
  # 结构：{ "ClassName" => [[event_name, top10], ...] }
  @@precomputed_rankings = {}

  # --- 子类可覆盖的钩子方法 ---

  # WR 记录过滤列（query 中的 WHERE 条件）
  def wr_record_column = "regional_average_record"

  # 数值字段名：排名查询的 WHERE 和 ORDER BY 使用
  def value_column = "average"

  # SolveTime 格式化类型
  def value_type = :average

  # NOTE: 是否参与 compute_all_rankings 批量计算
  # metric = 原始字段值的子类（Single/Average）设为 false，用高效两步 SQL
  # metric = 自定义计算的子类（BAo5/Mo5 等）保持 true，加载全量数据在 Ruby 中计算
  def self.batch_ranking? = true

  # --- 核心方法 ---

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
      WHERE #{wr_record_column} = 'WR'
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
        .select { |r| r["event_id"] == event_id && r[value_column] > 0 }
        .sort_by { |r| r["start_date"] }

      # 对每条记录计算指标值
      computed = records.filter_map do |r|
        values = (1..5).map { |n| r["value#{n}"] }
        metric = compute_metric(values, r)
        next unless metric
        r.merge("_metric" => metric)
      end

      # 构建 历史：按日期正序扫描，保留刷新或等于最小值的记录（含 tie WR）
      # NOTE: <= 包含平 WR，与 WCA 官方行为一致；同值行 Improvement 显示 0.0%
      min_so_far = Float::INFINITY
      wr_records = computed.select do |r|
        if r["_metric"] <= min_so_far
          min_so_far = r["_metric"]
          true
        else
          false
        end
      end

      results = wr_records.each_with_index.map do |r, i|
        metric_str = format_metric(r["_metric"], event_id)
        [metric_str] + wr_history_row(wr_records, i, event_id) { |r| r["_metric"] }
      end

      [event_name, results.reverse]
    end
  end

  # NOTE: 排名数据
  # batch_ranking? = true 的子类走 compute_all_rankings（批量加载 + Ruby 计算 metric）
  # batch_ranking? = false 的子类走 compute_own_ranking（两步 SQL，秒级完成）
  def ranking_data
    return @_ranking_cache if @_ranking_cache

    # 磁盘缓存检查（本地开发用）
    cache_file = File.join(Statistic::CACHE_DIR, "#{self.class.name}_ranking.marshal")
    if ENV["STATS_USE_CACHE"] == "1" && File.exist?(cache_file)
      return @_ranking_cache = Marshal.load(File.binread(cache_file))
    end

    if self.class.batch_ranking?
      compute_all_rankings if @@precomputed_rankings.empty?
      @_ranking_cache = @@precomputed_rankings[self.class.name]
    else
      @_ranking_cache = compute_own_ranking
    end
  end

  # NOTE: 统一使用完整 6 列 RANKING_HEADER
  def markdown
    top + tabbed_grouped_markdown(
      ranking_data: ranking_data,
      ranking_header: RANKING_HEADER,
      history_data: data,
      history_header: @table_header
    )
  end

  private

  # NOTE: 一次性为所有子类计算 ranking 数据
  # 按 (value_column, target_events) 分组，避免跨组 target_events 冲突
  # 每组独立查 MySQL，同组子类共享数据，子进程模式下查询量与原来相同
  def compute_all_rankings
    # NOTE: 只处理 batch_ranking? = true 的子类（metric 需要从 value1-5 计算的）
    # Single/Average 等 batch_ranking? = false 的子类用 compute_own_ranking
    all_instances = RoundMetric.subclasses
      .select(&:batch_ranking?)
      .map { |c| [c.name, c.new] }.to_h

    # 初始化结果容器
    all_instances.each_key { |name| @@precomputed_rankings[name] = [] }

    # NOTE: 按 (value_column, target_events) 分组
    # 例如：("average", Events::WITH_AVERAGE) 一组，("best", Events::OFFICIAL) 一组
    # 避免 Single 的 OFFICIAL 事件列表污染 BAo5 等子类
    groups = all_instances.group_by { |_, inst| [inst.value_column, inst.target_events] }

    groups.each do |(vc, events), group_instances|
      events.each do |event_id, event_name|
        # NOTE: 每组每项目只查询 MySQL 一次，同组所有子类共享数据
        event_rows = Database.client.query(
          "SELECT person_id, value1, value2, value3, value4, value5, average, best,
           CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
           person.country_id,
           CONCAT('[', c.cell_name, '](https://www.worldcubeassociation.org/competitions/', c.id, ')') competition_link,
           c.start_date
           FROM results
           JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
           JOIN competitions c ON c.id = competition_id
           WHERE #{vc} > 0 AND event_id = '#{event_id}'"
        ).to_a

        group_instances.each do |class_name, instance|
          # 计算每人最佳 metric
          best_by_person = {}
          event_rows.each do |r|
            values = (1..5).map { |n| r["value#{n}"] }
            metric = instance.compute_metric(values, r)
            next unless metric
            pid = r["person_id"]
            if !best_by_person[pid] || metric < best_by_person[pid][:metric]
              best_by_person[pid] = {
                metric: metric, person_link: r["person_link"],
                country: r["country_id"],
                competition_link: r["competition_link"],
                start_date: r["start_date"]
              }
            end
          end

          top = best_by_person.values
            .sort_by { |v| v[:metric] }
            .first(10)
            .each_with_index.map do |v, i|
              metric_str = instance.format_metric(v[:metric], event_id)
              date_str = v[:start_date].respond_to?(:strftime) ? v[:start_date].strftime("%Y-%m-%d") : v[:start_date].to_s
              [i + 1, v[:person_link], metric_str, v[:country], date_str, v[:competition_link]]
            end

          @@precomputed_rankings[class_name] << [event_name, top]
        end
        # event_rows 在 block 结束后可被 GC 回收
      end
    end

    # NOTE: 写入磁盘缓存，下次 STATS_USE_CACHE=1 时可直接读取
    FileUtils.mkdir_p(Statistic::CACHE_DIR)
    all_instances.each_key do |class_name|
      cache_file = File.join(Statistic::CACHE_DIR, "#{class_name}_ranking.marshal")
      File.binwrite(cache_file, Marshal.dump(@@precomputed_rankings[class_name]))
    end
  end

  # NOTE: 高效排名计算——用于 batch_ranking? = false 的子类（metric = 原始字段值）
  # 两步 SQL 避免加载百万行：
  # Step 1: MIN(value_column) GROUP BY person_id LIMIT 10 → MySQL 聚合，只返回 10 行
  # Step 2: 仅对 top 10 的 person_id JOIN 取详情（几百行）
  def compute_own_ranking
    result = target_events.map do |event_id, event_name|
      vc = value_column

      # Step 1: SQL 聚合，让 MySQL 找每人最佳 + 排序 + 截取 top 10
      top_persons = Database.client.query(
        "SELECT person_id, MIN(#{vc}) as min_val
         FROM results
         WHERE #{vc} > 0 AND event_id = '#{event_id}'
         GROUP BY person_id
         ORDER BY min_val
         LIMIT 10"
      ).to_a

      if top_persons.empty?
        next [event_name, []]
      end

      person_ids = top_persons.map { |r| "'#{r["person_id"]}'" }.join(",")

      # Step 2: 仅对 top 10 取详细信息（person name, country, competition, date）
      details = Database.client.query(
        "SELECT r.person_id, r.#{vc},
         CONCAT('[', p.name, '](https://www.worldcubeassociation.org/persons/', p.wca_id, ')') person_link,
         p.country_id,
         CONCAT('[', c.cell_name, '](https://www.worldcubeassociation.org/competitions/', c.id, ')') competition_link,
         c.start_date
         FROM results r
         JOIN persons p ON p.wca_id = r.person_id AND p.sub_id = 1
         JOIN competitions c ON c.id = r.competition_id
         WHERE r.#{vc} > 0 AND r.event_id = '#{event_id}'
         AND r.person_id IN (#{person_ids})"
      ).to_a

      # 每人最佳成绩，保留对应的比赛/日期/国家信息
      best_by_person = {}
      details.each do |r|
        pid = r["person_id"]
        val = r[vc]
        if !best_by_person[pid] || val < best_by_person[pid][vc]
          best_by_person[pid] = r
        end
      end

      top = best_by_person.values
        .sort_by { |r| r[vc] }
        .each_with_index.map do |r, i|
          val_str = format_metric(r[vc], event_id)
          date_str = r["start_date"].respond_to?(:strftime) ? r["start_date"].strftime("%Y-%m-%d") : r["start_date"].to_s
          [i + 1, r["person_link"], val_str, r["country_id"], date_str, r["competition_link"]]
        end

      [event_name, top]
    end

    # 写入磁盘缓存
    FileUtils.mkdir_p(Statistic::CACHE_DIR)
    cache_file = File.join(Statistic::CACHE_DIR, "#{self.class.name}_ranking.marshal")
    File.binwrite(cache_file, Marshal.dump(result))

    result
  end
end
