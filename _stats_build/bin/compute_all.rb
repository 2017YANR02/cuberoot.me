#!/usr/bin/env ruby

require_relative "helpers"
require_relative "../statistics/index"

$stdout.sync = true # Make sure the output is printed immediately, so that Travis doesn't timeout.

build_path = File.expand_path("../../stats", __dir__)

# NOTE: 聚合页面 → 其内部使用的基类缓存变量
# 聚合页面的 .markdown 方法会创建子类实例并触发类级缓存填充，
# 生成完毕后即可安全清除对应基类的缓存 + GC。
# 旧的 CACHE_GROUPS 计数系统有 BUG：被 MERGED 排除的子类永远不会被遍历，
# 导致计数器永远达不到目标值，缓存永远不被清除。
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

Helpers.timed_task("Computing all statistics") do
  ordered_ids.each do |statistic_id|
    statistic_object = STATISTICS[statistic_id]
    destination_path = File.join(build_path, "#{statistic_id}.md")
    Helpers.timed_task("Generating file at #{destination_path}") do
      markdown_result = statistic_object.markdown
      File.write(destination_path, markdown_result)
    end

    # NOTE: 释放实例级缓存（@query_results、@data 等），防止 84 个统计的数据在内存中累积
    # 写完文件后该对象不再使用，所有实例变量均可安全释放
    statistic_object.instance_variables.each do |ivar|
      statistic_object.instance_variable_set(ivar, nil)
    end

    # NOTE: 聚合页面生成完毕后，定点清除其内部子类共享的类级缓存
    # 此时所有子类的数据已经写入聚合 .md 文件，缓存可安全释放
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

