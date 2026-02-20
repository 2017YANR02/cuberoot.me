# NOTE: 抽象基类，用于计算跨轮次 average of averages 的 WR 历史
# AoXR = 一场比赛中某人恰好参加了 X 轮时，各轮 average 的均值
# 子类只需指定 round_count 即可
# 支持双视图 Tab：当前排名 + WR 历史
#
# HACK: 不走 Statistic 的统一 query → transform 流程。
# results 全表 550 万行，一次加载 ~8.7GB 导致 CI OOM。
# 改为按 event_id 逐个查询 MySQL，每次只加载 ~1-5 万行，
# 处理完后 GC 可回收，内存峰值 ~100MB。
#
# NOTE: 一次性计算模式——第一个子类运行时，为 4 种 round_count 同时计算结果。
# 后续子类直接取预计算数据，80 次 MySQL 查询减到 20 次。
require_relative "../../core/grouped_statistic"
require_relative "../../core/events"
require_relative "../../core/solve_time"
require_relative "../../core/tab_ui"
require_relative "../../core/database"

class AoRounds < GroupedStatistic
  include TabUi

  # NOTE: 预计算结果缓存
  # 结构：{ round_count => { history_data: [[event_name, wr_results], ...],
  #                          ranking_by_event: { event_name => [...] } } }
  @@precomputed = {}

  # NOTE: 所有子类的 round_count 枚举，用于一次性批量计算
  ROUND_COUNTS = [1, 2, 3, 4].freeze

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

  # NOTE: 按 event_id 单独查询，避免全表加载
  def query_for_event(event_id)
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
      WHERE result.average > 0 AND result.event_id = '#{event_id}'
      ORDER BY competition.start_date
    SQL
  end

  # NOTE: 重写 data，使用一次性计算模式
  # 第一个子类触发 compute_all_round_counts，后续子类直接取缓存
  def data
    return @data if @data

    compute_all_round_counts if @@precomputed.empty?

    result = @@precomputed[round_count]
    @ranking_by_event = result[:ranking_by_event]
    @data = result[:history_data]
  end

  # NOTE: 用 top + tabbed_grouped_markdown 替换原手写 HTML
  # 将 @ranking_by_event 中的 hash rows 归一化为数组供基类渲染
  def markdown
    ranking_header = { "Person" => :left, "Result" => :right, "Details" => :left }
    # NOTE: 必须先调 data 触发查询，才能填充 @ranking_by_event
    history_data = data
    # NOTE: build_ranking 返回 [{person_link:, metric_str:, details:}]，需转为数组格式
    ranking_data = @ranking_by_event.transform_values do |rows|
      rows.map { |r| [r[:person_link], r[:metric_str], r[:details]] }
    end
    top + tabbed_grouped_markdown(
      ranking_data: ranking_data,
      ranking_header: ranking_header,
      history_data: history_data,
      history_header: @table_header
    )
  end

  private

  # NOTE: 一次性为所有 round_count 计算结果
  # 每个 event 只查一次 MySQL，然后为 rc=1,2,3,4 分别计算
  # 处理完一个 event 后 raw rows 即可被 GC 回收
  def compute_all_round_counts
    events = Events::WITH_AVERAGE

    # 初始化结果容器
    ROUND_COUNTS.each do |rc|
      @@precomputed[rc] = { history_data: [], ranking_by_event: {} }
    end

    events.each do |event_id, event_name|
      # NOTE: 每个项目只查询 MySQL 一次，4 种 round_count 共享同一份数据
      event_rows = Database.client.query(query_for_event(event_id)).to_a

      # NOTE: 先做一次分组（最耗时的操作），4 种 rc 共用分组结果
      grouped = group_by_competition_person(event_rows, event_id)

      ROUND_COUNTS.each do |rc|
        computed = filter_and_compute(grouped, rc)
        @@precomputed[rc][:ranking_by_event][event_name] = build_ranking(computed, event_id)
        wr_results = build_wr_history(computed, event_id)
        @@precomputed[rc][:history_data] << [event_name, wr_results]
      end
      # event_rows 和 grouped 在 block 结束后可被 GC 回收
    end
  end

  # NOTE: 按 (competition_id, person_id) 分组，收集该人在该比赛的所有轮次记录
  def group_by_competition_person(event_rows, event_id)
    grouped = {}
    event_rows.each do |r|
      key = [r["competition_id"], r["person_id"]]
      grouped[key] ||= { "rows" => [], "person_link" => r["person_link"],
                         "person_id" => r["person_id"],
                         "competition_link" => r["competition_link"],
                         "start_date" => r["start_date"], "event_id" => event_id }
      grouped[key]["rows"] << r
    end
    grouped
  end

  # NOTE: 从已分组数据中筛选恰好有 rc 条记录的组，计算 AoXR
  # rc: round_count，由 compute_all_round_counts 传入
  def filter_and_compute(grouped, rc)
    grouped.filter_map do |_key, info|
      rows = info["rows"]
      next unless rows.size == rc

      # 按轮次排序（R1 < R2 < R3 < Final），提取 average 值
      sorted_rows = rows.sort_by { |r| ROUND_SORT_ORDER[r["round_type_id"]] || 50 }
      values = sorted_rows.map { |r| r["average"] }
      avg = values.sum.to_f / rc
      info.merge("_metric" => avg, "_round_values" => values)
    end
  end

  # NOTE: 每人最佳 metric，按项目 top 10
  def build_ranking(computed, event_id)
    best_by_person = {}
    computed.each do |r|
      pid = r["person_id"]
      if !best_by_person[pid] || r["_metric"] < best_by_person[pid]["_metric"]
        best_by_person[pid] = r
      end
    end

    best_by_person.values
      .sort_by { |r| r["_metric"] }
      .first(10)
      .map do |r|
        metric_str = SolveTime.new(event_id, :average, r["_metric"].round).clock_format
        details = r["_round_values"].map { |v| SolveTime.new(event_id, :average, v).clock_format }.join(', ')
        { person_link: r["person_link"], metric_str: metric_str, details: details }
      end
  end

  # NOTE: WR 历史——按日期正序扫描，只保留刷新最小值的记录，最终倒序
  def build_wr_history(computed, event_id)
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

      gain_str, days_str = wr_progress(wr_records, i) { |r| r["_metric"] }

      # Details: 显示各轮 average（已按轮次排序）
      details = r["_round_values"].map do |v|
        SolveTime.new(event_id, :average, v).clock_format
      end.join(', ')

      date_str = r["start_date"].strftime("%Y-%m-%d")
      [metric_str, gain_str, days_str, r["person_link"], r["competition_link"], date_str, details]
    end

    results.reverse
  end
end


