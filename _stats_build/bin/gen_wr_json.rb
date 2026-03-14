# NOTE: 从 RoundMetric 的 ranking_data 提取每个项目的 WR 值，输出 calc/data/wr.json
# 集成到 compute_all.rb 构建流程，CI 每周自动刷新
#
# 用法：cd _stats_build && ruby bin/gen_wr_json.rb

require_relative "../statistics/index"
require_relative "../core/events"
require "json"

# NOTE: calc 页面需要的 4 个关键指标
METRICS = {
  "single"  => "WrSingleHistory",
  "average" => "WrAverageHistory",
  "bpa"     => "WrBpa",
  "wpa"     => "WrWpa",
}.freeze

OUTPUT_PATH = File.expand_path("../../calc/data/wr.json", __dir__)

result = {}

METRICS.each do |metric_id, class_name|
  klass = Object.const_get(class_name)
  instance = klass.new
  rankings = instance.ranking_data

  rankings.each do |event_name, top10|
    next if top10.empty?
    # top10 第一行 = WR，格式 [rank, person_link, metric_str, country, date, comp_link]
    wr_str = top10.first[2]

    # NOTE: 解析时间字符串为 centiseconds
    # 格式可能是 "3.57"（秒）或 "1:05.04"（分:秒）或纯整数 "16"（FMC moves）
    cs = nil
    if wr_str =~ /\A(\d+):(\d+\.\d+)\z/
      cs = ($1.to_i * 6000 + ($2.to_f * 100).round)
    elsif wr_str =~ /\A\d+\.\d+\z/
      cs = (wr_str.to_f * 100).round
    elsif wr_str =~ /\A\d+\z/
      cs = wr_str.to_i * 100  # FMC: moves → centiseconds 代理
    end
    next unless cs && cs > 0

    # NOTE: 反向查找 event_id（从 event_name 映射回 event_id）
    event_id = Events::ALL.find { |id, name| name == event_name }&.first
    next unless event_id

    result[event_id] ||= {}
    result[event_id][metric_id] = cs
  end
end

File.write(OUTPUT_PATH, JSON.pretty_generate(result) + "\n")
puts "Generated #{OUTPUT_PATH} (#{result.size} events)"
