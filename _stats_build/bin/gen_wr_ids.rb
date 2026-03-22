# NOTE: 从 RoundMetric 的 ranking_data 提取每个项目的 WR 值和前 2 名 WCA ID
# 输出极简 JSON，前端通过 WCA ID 调 API 获取详细数据（times / ao100）
# 不依赖 AverageOfX，不需要 Ao100 查询
#
# 用法：cd _stats_build && ruby bin/gen_wr_ids.rb

ENV["STATS_USE_CACHE"] = "1"

require_relative "../statistics/index"
require_relative "../core/events"
require "json"

OUTPUT_PATH = File.expand_path("../../stats/wr_ids.json", __dir__)

result = {}

# NOTE: 从 person_link markdown 提取 WCA ID
# 格式: [Name](https://www.worldcubeassociation.org/persons/2023GENG02)
def extract_wca_id(person_link)
  person_link[%r{/persons/([^)\]]+)}, 1]
end

# NOTE: 从 metric_str 解析为 centiseconds
def parse_cs(str)
  case str
  when /\A(\d+):(\d+\.\d+)\z/
    $1.to_i * 6000 + ($2.to_f * 100).round
  when /\A\d+\.\d+\z/
    (str.to_f * 100).round
  when /\A\d+\z/
    str.to_i * 100
  end
end

# NOTE: 提取 average WR top 2 的 WCA ID + 成绩
avg_klass = WrAverageHistory.new
avg_klass.ranking_data.each do |event_name, top10|
  next if top10.empty?

  event_id = Events::ALL.find { |id, name| name == event_name }&.first
  next unless event_id

  result[event_id] ||= {}

  top10.first(2).each_with_index do |row, idx|
    # row 格式: [rank, person_link, metric_str, country, date, comp_link]
    wca_id = extract_wca_id(row[1])
    cs = parse_cs(row[2])
    next unless wca_id && cs && cs > 0

    suffix = idx == 0 ? "1" : "2"
    result[event_id]["avg_id_#{suffix}"] = wca_id
    result[event_id]["avg_#{suffix}"] = cs
  end
end

# NOTE: 提取 single WR
single_klass = WrSingleHistory.new
single_klass.ranking_data.each do |event_name, top10|
  next if top10.empty?

  event_id = Events::ALL.find { |id, name| name == event_name }&.first
  next unless event_id

  result[event_id] ||= {}
  cs = parse_cs(top10.first[2])
  result[event_id]["single"] = cs if cs && cs > 0
end

# NOTE: 校验
has_ids = result.any? { |_, v| v.key?("avg_id_1") }
unless has_ids
  abort "FATAL: wr_ids.json has no player IDs. Check WrAverageHistory."
end

File.write(OUTPUT_PATH, JSON.pretty_generate(result) + "\n")
puts "Generated #{OUTPUT_PATH} (#{result.size} events)"
