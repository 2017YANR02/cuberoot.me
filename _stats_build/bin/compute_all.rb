#!/usr/bin/env ruby

require_relative "helpers"
require_relative "../statistics/index"
require "parallel"
require "tempfile"

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
    # NOTE: 默认 4 worker。CI runner 7GB RAM 足够（峰值 ~3GB）
    # 可通过 STATS_WORKERS 环境变量覆盖
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

    # NOTE: fork 前强制 GC，确保 Phase 1 遗留的 Mysql2::Client 被 finalizer 关闭
    # 否则子进程继承父进程的 stale socket 文件描述符，GC 时 double-close 可能导致 segfault
    GC.start(full_mark: true, immediate_sweep: true) unless Gem.win_platform?

    # NOTE: 临时文件用于跨进程传递失败信息（fork 模式下子进程无法共享 Ruby 对象）
    fail_dir = Dir.mktmpdir("stats_fail")
    log_mutex = Mutex.new
    # NOTE: 抑制统计内部的 puts（wr_newcomer 有 13 处、wr_dominance 有 1 处）
    # 这些内部日志不受 Mutex 保护，会交错。重定向到 NULL 后只输出汇总行
    # 进程模式下子进程继承 NULL stdout，内部日志同样被抑制
    saved_stdout = $stdout
    $stdout = File.open(File::NULL, "w")

    Parallel.each(independent_ids, **parallel_opts) do |statistic_id|
      destination_path = File.join(build_path, "#{statistic_id}.md")
      t_start = Time.now
      success = false

      # NOTE: 最多尝试 2 次（首次 + 1 次重试），防止瞬态故障终止整个构建
      2.times do |attempt|
        begin
          statistic_object = Module.const_get(camelize(statistic_id)).new
          File.write(destination_path, statistic_object.markdown)
          # NOTE: 及时释放内存，防止多 worker 同时持有大量数据导致 OOM
          statistic_object.instance_variables.each { |iv| statistic_object.instance_variable_set(iv, nil) }
          success = true
          break
        rescue => e
          if attempt == 0
            GC.start
            # 重试前不输出日志，静默重试
          else
            # NOTE: 写入临时文件，主进程最后读取（fork 模式下不能直接共享数组）
            File.write(File.join(fail_dir, statistic_id), "#{e.class}: #{e.message}")
          end
        end
      end

      duration = Time.now - t_start
      # NOTE: RSS 内存监控（仅 Linux），帮助定位内存热点
      rss_str = ""
      if File.exist?("/proc/self/status")
        rss_kb = File.read("/proc/self/status")[/VmRSS:\s+(\d+)/, 1]
        rss_str = "  [#{rss_kb.to_i / 1024}MB]" if rss_kb
      end
      status = success ? "" : " FAILED"

      # NOTE: 原子化输出——单行 printf，Mutex 保护（线程模式）
      # 进程模式下 Mutex 不跨进程，但单行 write ≤4KB，POSIX 保证原子性
      log_mutex.synchronize do
        saved_stdout.printf("  %-50s %5.1fs%s%s\n", statistic_id, duration, rss_str, status)
      end
    end

    $stdout = saved_stdout

    # NOTE: 汇总失败报告（读取子进程写入的临时文件）
    fail_files = Dir.glob(File.join(fail_dir, "*"))
    unless fail_files.empty?
      $stderr.puts "WARNING: #{fail_files.size} stat(s) failed after retry:"
      fail_files.each do |f|
        $stderr.puts "  #{File.basename(f)}: #{File.read(f)}"
      end
    end
    FileUtils.rm_rf(fail_dir)
  end
end
