#!/usr/bin/env ruby

require_relative "helpers"
require_relative "../statistics/index"

$stdout.sync = true # Make sure the output is printed immediately, so that Travis doesn't timeout.

build_path = File.expand_path("../../stats", __dir__)

# NOTE: 类级缓存映射表
# 这些抽象基类使用 @@类变量 让多个子类共享查询结果，减少 DB 查询次数。
# 但在 compute_all.rb（单进程跑 84 个统计）中，这些缓存永不释放会导致内存累积。
# 解法：统计每组子类数量，当组内最后一个子类完成后清除类缓存 + GC。
CACHE_GROUPS = {
  AverageOfX  => :@@query_results,
  AoRounds    => :@@precomputed,
  RoundMetric => :@@precomputed_rankings,
}.freeze

group_total = Hash.new(0)
group_done  = Hash.new(0)
STATISTICS.each_value do |obj|
  CACHE_GROUPS.each_key { |cls| group_total[cls] += 1 if obj.is_a?(cls) }
end

Helpers.timed_task("Computing all statistics") do
  STATISTICS.each do |statistic_id, statistic_object|
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

    # NOTE: 检测类缓存组是否已全部完成
    # 组内最后一个子类完成后：清除类级缓存 → 强制 GC → 释放该组占用的所有内存
    CACHE_GROUPS.each do |cls, var|
      next unless statistic_object.is_a?(cls)
      group_done[cls] += 1
      if group_done[cls] == group_total[cls]
        reset_val = cls.class_variable_get(var).is_a?(Hash) ? {} : nil
        cls.class_variable_set(var, reset_val)
        puts "  [Memory] Cleared #{cls}.#{var} (#{group_total[cls]} subclasses done), GC started"
        GC.start
      end
    end
  end
end

