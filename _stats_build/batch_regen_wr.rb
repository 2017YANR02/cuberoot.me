#!/usr/bin/env ruby
# NOTE: 批量生成所有 WR 统计（每个 stat 独立子进程，内存完全隔离，避免 OOM）
# 配合 STATS_USE_CACHE=1 使用磁盘缓存，速度极快（大多数统计 < 1 秒）
# 对于第一次跑（无缓存）的 stat，会自动从 MySQL 查询并写入缓存

$stdout.sync = true

# 除 wr_bao5 外所有 World Record Analysis 统计
STATS_TO_BUILD = %w[
  wr_average_history wr_bpa wr_best_counting wr_best_average_ratio
  wr_current wr_dominance wr_median wr_mo5 wr_single_history wr_variance
  wr_wao5 wr_wpa wr_ao1r wr_ao2r wr_ao3r wr_ao4r
  wr_worst_counting wr_worst wr_newcomer first_r_is_wr wr_1st_wr
]

total_start = Time.now
failed = []

STATS_TO_BUILD.each_with_index do |id, i|
  print "[#{i + 1}/#{STATS_TO_BUILD.size}] #{id}... "
  t = Time.now
  # NOTE: 每个 stat 独立子进程，进程退出后内存完全释放，避免单进程 OOM
  # STATS_USE_CACHE=1 跳过 MySQL 大查询，使用磁盘缓存
  ok = system({ "STATS_USE_CACHE" => "1" }, "ruby", "bin/compute.rb", id)
  elapsed = (Time.now - t).round(1)
  if ok
    puts "#{elapsed}s"
  else
    puts "FAILED (exit #{$?.exitstatus}), #{elapsed}s"
    failed << id
  end
end

puts "\n✅ 全部完成，总耗时 #{(Time.now - total_start).round(0)}s"
unless failed.empty?
  puts "⚠️  以下统计失败（可重新单独跑）：#{failed.join(', ')}"
end
