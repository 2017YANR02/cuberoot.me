#!/usr/bin/env ruby
#
# === 执行架构 ===
# Phase 1: 聚合统计串行（wr_metric, wr_aoxr, average_of），有类级缓存依赖
# Phase 2: 重量级独立统计串行（HEAVY_STATS，RSS > 3GB 的 12 个）
#   - Linux(CI): fork 隔离，子进程退出后 OS 回收内存
#   - Windows:   主进程执行 + GC
# Phase 3: 轻量级独立统计并行（~48 个，RSS < 2GB）
#   - Linux(CI): 4 processes + isolation 模式
#   - Windows:   4 threads
#
# CI 实测: ~48 min（7GB RAM）| 本地 Windows 预估: ~43 min
#
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

# NOTE: CI RSS 数据显示这些统计单进程 RSS > 3GB（全表查询加载百万行到 Ruby）
# 必须串行执行，防止两个重量级同时运行导致 OOM（CI 7GB 上限）
# 新增全表查询类统计时，应检查 CI RSS 日志，超过 3GB 则加入此列表
HEAVY_STATS = %w[
  best_single_counting_into_average
  longest_streak_of_podiums
  longest_streak_of_personal_records
  wr_dominance
  best_result_off_podium
  consecutive_sub_5_average
  wr_newcomer
  most_completed_solves
  most_competitions_before_winning
  smallest_diff_between_single_and_average
  most_frequent_results
  moving_average
].freeze

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

# NOTE: 三段分离：聚合统计 → 重量级独立统计 → 轻量级独立统计
aggregate_ids = ordered_ids & AGGREGATE_CACHE_CLEANUP.keys
independent_ids = ordered_ids - aggregate_ids
heavy_ids = independent_ids & HEAVY_STATS
light_ids = independent_ids - heavy_ids

# NOTE: RSS 内存监控（仅 Linux），帮助定位内存热点
def rss_mb_str
  return "" unless File.exist?("/proc/self/status")
  rss_kb = File.read("/proc/self/status")[/VmRSS:\s+(\d+)/, 1]
  rss_kb ? "  [#{rss_kb.to_i / 1024}MB]" : ""
end

# NOTE: fork 隔离执行——在独立子进程中运行统计，任务完成后进程退出，OS 回收全部内存
# Windows 无 fork，直接在主进程执行（线程模式下共享内存，GC 可回收）
def run_isolated(statistic_id, build_path)
  destination_path = File.join(build_path, "#{statistic_id}.md")
  t_start = Time.now

  if !Gem.win_platform? && Process.respond_to?(:fork)
    pid = Process.fork do
      # NOTE: 抑制统计内部日志（wr_newcomer 有 13 处 puts、wr_dominance 有 1 处）
      $stdout = File.open(File::NULL, "w")
      statistic_object = Module.const_get(camelize(statistic_id)).new
      File.write(destination_path, statistic_object.markdown)
    end
    Process.wait(pid)
    success = $?.success?
  else
    # Windows 回退：直接在主进程执行
    begin
      statistic_object = Module.const_get(camelize(statistic_id)).new
      File.write(destination_path, statistic_object.markdown)
      # NOTE: 释放内存
      statistic_object.instance_variables.each { |iv| statistic_object.instance_variable_set(iv, nil) }
      GC.start
      success = true
    rescue => e
      $stderr.puts "  ERROR #{statistic_id}: #{e.class}: #{e.message}"
      success = false
    end
  end

  duration = Time.now - t_start
  status = success ? "" : " FAILED"
  printf("  %-50s %5.1fs%s%s\n", statistic_id, duration, rss_mb_str, status)
  success
end

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
      puts "  #{rss_mb_str.strip}" unless rss_mb_str.empty?

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

  # ======= 阶段 2：重量级独立统计串行执行（fork 隔离内存） =======
  # NOTE: 这些统计单进程 RSS 3-6GB，不能并行。每个用 fork 隔离，
  # 子进程退出后 OS 回收全部内存，避免内存累积
  unless heavy_ids.empty?
    puts "Phase 2: #{heavy_ids.size} heavy stats (serial, isolated)"
    # NOTE: fork 前强制 GC，确保 Phase 1 遗留的 Mysql2::Client 被 finalizer 关闭
    GC.start(full_mark: true, immediate_sweep: true) unless Gem.win_platform?

    heavy_ids.each { |id| run_isolated(id, build_path) }
  end

  # ======= 阶段 3：轻量级独立统计并行执行 =======
  # NOTE: 这些统计 RSS < 2GB，可安全并行。isolation 模式防止内存跨任务累积
  unless light_ids.empty?
    worker_count = (ENV["STATS_WORKERS"] || 4).to_i
    parallel_opts = if Gem.win_platform?
      { in_threads: worker_count }
    else
      # NOTE: isolation 确保每个任务在独立子进程执行，任务完成后进程退出
      # 防止内存碎片在子进程中累积
      { in_processes: worker_count, isolation: true }
    end
    mode_label = Gem.win_platform? ? "threads" : "processes"
    puts "Phase 3: #{light_ids.size} light stats, #{worker_count} #{mode_label}"

    # NOTE: fork 前强制 GC（如果 Phase 2 没执行过的话）
    GC.start(full_mark: true, immediate_sweep: true) if heavy_ids.empty? && !Gem.win_platform?

    fail_dir = Dir.mktmpdir("stats_fail")
    log_mutex = Mutex.new
    saved_stdout = $stdout
    $stdout = File.open(File::NULL, "w")

    Parallel.each(light_ids, **parallel_opts) do |statistic_id|
      destination_path = File.join(build_path, "#{statistic_id}.md")
      t_start = Time.now
      success = false

      2.times do |attempt|
        begin
          statistic_object = Module.const_get(camelize(statistic_id)).new
          File.write(destination_path, statistic_object.markdown)
          statistic_object.instance_variables.each { |iv| statistic_object.instance_variable_set(iv, nil) }
          success = true
          break
        rescue => e
          if attempt == 0
            GC.start
          else
            File.write(File.join(fail_dir, statistic_id), "#{e.class}: #{e.message}")
          end
        end
      end

      duration = Time.now - t_start
      rss_str = ""
      if File.exist?("/proc/self/status")
        rss_kb = File.read("/proc/self/status")[/VmRSS:\s+(\d+)/, 1]
        rss_str = "  [#{rss_kb.to_i / 1024}MB]" if rss_kb
      end
      status = success ? "" : " FAILED"

      log_mutex.synchronize do
        saved_stdout.printf("  %-50s %5.1fs%s%s\n", statistic_id, duration, rss_str, status)
      end
    end

    $stdout = saved_stdout

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

