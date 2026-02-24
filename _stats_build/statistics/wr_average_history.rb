require_relative "abstract/round_metric"
require_relative "mbf_average"

# NOTE: WR Average 历史——RoundMetric 的退化情况
# compute_metric 直接返回 average 字段，无需从 value1-5 计算
# 333mbf/333mbo 无官方 average，通过委托 MbfAverage 获取 Mo3 数据
class WrAverageHistory < RoundMetric
  # NOTE: metric = average 字段本身，用高效两步 SQL 排名（不参与 compute_all_rankings）
  def self.batch_ranking? = false

  def initialize
    @title = "Average"
    @note = "Shows how world record averages have progressed over time for each event. " \
            "For 333mbf and 333mbo, Mo3 (mean of 3) is used as an unofficial substitute."
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right,
                      "Person" => :left, "Date" => :left, "Competition" => :left, "Details" => :left }
  end

  # NOTE: Average 的 metric 就是 average 字段本身
  def compute_metric(_values, r) = r["average"]
  def format_metric(v, eid) = SolveTime.new(eid, :average, v.round).clock_format

  # NOTE: 覆盖 target_events：加入 333mbf/333mbo（通过 Mo3 展示）
  def target_events
    Events::WITH_MO3
  end

  # NOTE: MbfAverage 单例——延迟初始化，避免重复实例化
  def mbf_instance
    @mbf_instance ||= MbfAverage.new
  end

  # NOTE: 覆盖 transform：正常项目走 super，333mbf/333mbo 委托 MbfAverage
  def transform(query_results)
    mbf_ids = %w[333mbf 333mbo]

    # 基类用 WITH_AVERAGE（不含 333mbf/333mbo），这里先用 WITH_AVERAGE 的 results 跑基类逻辑
    normal_results = super(query_results)

    # 替换 333mbf/333mbo 条目（基类返回的是 nil 或空）
    normal_results.map do |event_name, rows|
      event_id = Events::WITH_MO3.key(event_name)
      if event_id && mbf_ids.include?(event_id)
        [event_name, mbf_instance.history_for(event_name)]
      else
        [event_name, rows]
      end
    end
  end

  # NOTE: 完全覆盖 ranking_data，处理磁盘缓存绕过问题（Bug 2）
  # 先让基类计算正常项目排名，再替换 333mbf/333mbo 条目，最后重写缓存
  def ranking_data
    return @_ranking_cache if @_ranking_cache

    cache_file = File.join(Statistic::CACHE_DIR, "#{self.class.name}_ranking.marshal")
    if ENV["STATS_USE_CACHE"] == "1" && File.exist?(cache_file)
      return @_ranking_cache = Marshal.load(File.binread(cache_file))
    end

    # 基类 compute_own_ranking 会对 333mbf/333mbo 发空 SQL（average=0），返回各自 []
    raw = compute_own_ranking  # 返回 [[event_name, rows], ...]

    mbf_ids = %w[333mbf 333mbo]
    result = raw.map do |event_name, rows|
      event_id = Events::WITH_MO3.key(event_name)
      if event_id && mbf_ids.include?(event_id)
        [event_name, mbf_instance.ranking_for(event_name)]
      else
        [event_name, rows]
      end
    end

    # 重写磁盘缓存（含 333mbf/333mbo 真实数据）
    FileUtils.mkdir_p(Statistic::CACHE_DIR)
    File.binwrite(cache_file, Marshal.dump(result))

    @_ranking_cache = result
  end
end
