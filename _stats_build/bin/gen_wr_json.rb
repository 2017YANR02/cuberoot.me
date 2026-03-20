# NOTE: 从 RoundMetric 的 ranking_data 提取每个项目的 WR 值，输出 calc/data/wr.json
# 集成到 compute_all.rb 构建流程，CI 每周自动刷新
#
# 用法：cd _stats_build && ruby bin/gen_wr_json.rb

# NOTE: 复用 compute_all.rb 已写入的 .data_cache/ marshal 缓存，跳过 MySQL 重复查询
# 前提：compute_all.rb 必须在本脚本之前运行（CI workflow 已保证顺序）
# 无缓存时自动 fall through 到 MySQL 查询，行为不变
ENV["STATS_USE_CACHE"] = "1"

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

# NOTE: 解析时间字符串为 centiseconds
# 格式："3.57"（秒）、"1:05.04"（分:秒）、"16"（FMC moves）
def parse_cs(str)
  case str
  when /\A(\d+):(\d+\.\d+)\z/
    $1.to_i * 6000 + ($2.to_f * 100).round
  when /\A\d+\.\d+\z/
    (str.to_f * 100).round
  when /\A\d+\z/
    str.to_i * 100  # FMC: moves → centiseconds 代理
  end
end

METRICS.each do |metric_id, class_name|
  klass = Object.const_get(class_name)
  instance = klass.new
  rankings = instance.ranking_data

  rankings.each do |event_name, top10|
    next if top10.empty?

    # NOTE: 反向查找 event_id（从 event_name 映射回 event_id）
    event_id = Events::ALL.find { |id, name| name == event_name }&.first
    next unless event_id

    # top10 第一行 = WR，格式 [rank, person_link, metric_str, country, date, comp_link]
    cs = parse_cs(top10.first[2])
    next unless cs && cs > 0

    result[event_id] ||= {}
    result[event_id][metric_id] = cs

    # NOTE: average 指标额外存储第 2 名（供 calc 页面 Target 格默认值）
    if metric_id == "average" && top10.size >= 2
      cs2 = parse_cs(top10[1][2])
      result[event_id]["average_2"] = cs2 if cs2 && cs2 > 0
    end
  end
end

# NOTE: 额外提取 Ao100 世界前 2（供 calc 页面进步幅度缩放 + KDE 采样）
# ao100_1/ao100_2 = trimmed average 数值
# times_1/times_2 = 100 个原始成绩数组（KDE 采样数据源）
begin
  ao100 = AverageOf100.new
  # NOTE: AverageOfX < GroupedStatistic < Statistic，正确的数据方法是 data（非 ranking_data）
  ao100_rankings = ao100.data

  ao100_rankings.each do |event_name, top10|
    next if top10.empty?

    event_id = Events::ALL.find { |id, name| name == event_name }&.first
    next unless event_id

    result[event_id] ||= {}

    # NOTE: top10 格式 [ao100_clock, person_link, times_str]
    top10.first(2).each_with_index do |row, idx|
      suffix = idx == 0 ? "1" : "2"

      # Ao100 trimmed average 数值
      cs = parse_cs(row[0])
      next unless cs && cs > 0
      result[event_id]["ao100_#{suffix}"] = cs

      # NOTE: 100 个原始成绩 — 从 times_str 解析为 centiseconds 数组
      # DNF 不参与 KDE 采样，过滤掉
      times = row[2].split(", ").map do |t|
        t = t.strip
        if t == "DNF"
          -1
        elsif t =~ /\A(\d+):(\d+\.\d+)\z/
          ($1.to_i * 6000 + ($2.to_f * 100).round)
        elsif t =~ /\A\d+\.\d+\z/
          (t.to_f * 100).round
        elsif t =~ /\A\d+\z/
          t.to_i * 100  # FMC
        else
          -1
        end
      end.select { |v| v > 0 }

      result[event_id]["times_#{suffix}"] = times unless times.empty?
    end
  end
end

# NOTE: 校验 KDE 数据完整性 — 防止 CI 生成残缺 wr.json 覆盖旧数据
has_kde = result.any? { |_, v| v.key?("times_1") }
unless has_kde
  abort "FATAL: wr.json has no KDE data (times_1 missing). Refusing to overwrite.\n" \
        "Check AverageOf100 and database connectivity."
end

File.write(OUTPUT_PATH, JSON.pretty_generate(result) + "\n")
puts "Generated #{OUTPUT_PATH} (#{result.size} events, KDE data present)"
