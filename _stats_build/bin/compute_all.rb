#!/usr/bin/env ruby

require_relative "helpers"
require_relative "../statistics/index"
require "parallel"

$stdout.sync = true

build_path = File.expand_path("../../stats", __dir__)

# NOTE: 聚合页面 → 其内部使用的基类缓存变量
# 聚合页面的 .markdown 方法会创建子类实例并触发类级缓存填充，
# 生成完毕后即可安全清除对应基类的缓存 + GC。
AGGREGATE_CACHE_CLEANUP = {
  "wr_metric"  => { RoundMetric => :@@precomputed_rankings },
  "wr_aoxr"    => { AoRounds    => :@@precomputed },
  "average_of" => { AverageOfX  => :@@query_results },
}.freeze

# NOTE: 优先计算列表——聚合页面排在最前面，确保缓存及时释放
PRIORITY_STATS = %w[
  wr_newcomer wr_metric wr_aoxr average_of
  wr_current first_r_is_wr wr_1st_wr wr_dominance
].freeze

# NOTE: 被合并到聚合页面的统计 ID 已在 index.rb 中统一定义为 ALL_MERGED
ordered_ids = PRIORITY_STATS.select { |id| STATISTICS.key?(id) } +
              (STATISTICS.keys - PRIORITY_STATS - ALL_MERGED)

# NOTE: STATS_FILTER 环境变量——逗号分隔的统计 ID，只计算指定项
# 为空时计算全部。用于 CI 手动触发时快速验证特定统计
if ENV["STATS_FILTER"] && !ENV["STATS_FILTER"].empty?
  filter = ENV["STATS_FILTER"].split(",").map(&:strip)
  ordered_ids = ordered_ids.select { |id| filter.include?(id) }
  puts "STATS_FILTER active: #{filter.join(', ')} (#{ordered_ids.size} matched)"
end

# NOTE: 分离聚合统计（有类级缓存依赖，必须串行）和独立统计（可并行）
# 新增独立统计时无需修改此处——不在 AGGREGATE_CACHE_CLEANUP 中的自动归入并行组
aggregate_ids = ordered_ids & AGGREGATE_CACHE_CLEANUP.keys
independent_ids = ordered_ids - aggregate_ids

Helpers.timed_task("Computing all statistics") do
  # ======= 阶段 1：聚合统计串行执行（有 @@ 类级缓存依赖） =======
  unless aggregate_ids.empty?
    puts "Phase 1: #{aggregate_ids.size} aggregate stats (serial)"
    aggregate_ids.each do |statistic_id|
      statistic_object = STATISTICS[statistic_id]
      destination_path = File.join(build_path, "#{statistic_id}.md")
      Helpers.timed_task("  #{statistic_id}") do
        File.write(destination_path, statistic_object.markdown)
      end

      # NOTE: 释放实例级缓存
      statistic_object.instance_variables.each do |ivar|
        statistic_object.instance_variable_set(ivar, nil)
      end

      # NOTE: 聚合页面生成完毕后，清除子类共享的类级缓存
      if AGGREGATE_CACHE_CLEANUP.key?(statistic_id)
        AGGREGATE_CACHE_CLEANUP[statistic_id].each do |cls, var|
          if cls.class_variable_defined?(var)
            reset_val = cls.class_variable_get(var).is_a?(Hash) ? {} : nil
            cls.class_variable_set(var, reset_val)
            puts "  [Memory] Cleared #{cls}.#{var} after #{statistic_id}, GC started"
          end
        end
        GC.start
      end
    end
  end

  # ======= 阶段 2：独立统计并行执行 =======
  unless independent_ids.empty?
    # NOTE: 默认 4 worker，防止多个重量级统计同时跑导致 OOM
    # CI runner 只有 7GB RAM，4 worker 是安全上限。本地 16GB 可通过 STATS_WORKERS=8 增加
    worker_count = (ENV["STATS_WORKERS"] || 4).to_i
    # NOTE: Windows 不支持 fork，用 in_threads 替代
    # 多线程下 I/O 等待（MySQL 查询）时 GIL 释放，仍有显著加速
    parallel_opts = if Gem.win_platform?
      { in_threads: worker_count }
    else
      { in_processes: worker_count }
    end
    mode_label = Gem.win_platform? ? "threads" : "processes"
    puts "Phase 2: #{independent_ids.size} independent stats, #{worker_count} #{mode_label}"

    log_mutex = Mutex.new
    # NOTE: 抑制统计内部的 puts（wr_newcomer 有 13 处、wr_dominance 有 1 处）
    # 这些内部日志不受 Mutex 保护，会交错。重定向到 NULL 后只输出汇总行
    # 进程模式下子进程继承 NULL stdout，内部日志同样被抑制
    saved_stdout = $stdout
    $stdout = File.open(File::NULL, "w")

    Parallel.each(independent_ids, **parallel_opts) do |statistic_id|
      # NOTE: 重新实例化统计对象，不复用 STATISTICS[id]
      # 阶段 1 已将其 instance variables 清 nil；且进程模式下无法共享对象
      statistic_object = Module.const_get(camelize(statistic_id)).new
      destination_path = File.join(build_path, "#{statistic_id}.md")
      t_start = Time.now
      File.write(destination_path, statistic_object.markdown)
      duration = Time.now - t_start

      # NOTE: 原子化输出——单行 printf，Mutex 保护（线程模式）
      # 进程模式下 Mutex 不跨进程，但单行 write ≤4KB，POSIX 保证原子性
      log_mutex.synchronize do
        saved_stdout.printf("  %-50s %5.1fs\n", statistic_id, duration)
      end

      # NOTE: 及时释放内存，防止多 worker 同时持有大量数据导致 OOM
      statistic_object.instance_variables.each do |ivar|
        statistic_object.instance_variable_set(ivar, nil)
      end
    end

    $stdout = saved_stdout
  end
end

