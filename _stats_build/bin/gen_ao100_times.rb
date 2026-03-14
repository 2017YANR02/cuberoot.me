# NOTE: 提取每个项目 Ao100 top 2 选手的 100 个原始成绩
# 输出到 calc/data/ao100_times.json，供 calc Rand 按钮 KDE 采样使用
# 集成到 compute_all.rb 构建流程，CI 每周自动刷新
#
# 用法：cd _stats_build && ruby bin/gen_ao100_times.rb

require_relative "../statistics/index"
require_relative "../core/events"
require_relative "../core/solve_time"
require "json"

OUTPUT_PATH = File.expand_path("../../calc/data/ao100_times.json", __dir__)

# NOTE: 使用 AverageOf100 类获取 Ao100 排名和成绩
ao100 = AverageOf100.new
ranking_data = ao100.ranking_data

result = {}

ranking_data.each do |event_name, top10|
  next if top10.empty?

  # NOTE: 反向查找 event_id
  event_id = Events::ALL.find { |id, name| name == event_name }&.first
  next unless event_id

  # NOTE: ranking_data 格式: [ao100_str, person_link, times_str]
  # times_str 是逗号分隔的 100 个成绩字符串
  top2 = top10.first(2)

  times_arrays = top2.map do |row|
    times_str = row[2]  # 第 3 列：逗号分隔的成绩
    times_str.split(", ").map do |t|
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
    end
  end

  # NOTE: 只存非 DNF 成绩（DNF 不参与 KDE 采样）
  entry = {}
  if times_arrays[0]
    entry["times_1"] = times_arrays[0].select { |t| t > 0 }
  end
  if times_arrays[1]
    entry["times_2"] = times_arrays[1].select { |t| t > 0 }
  end

  result[event_id] = entry unless entry.empty?
end

File.write(OUTPUT_PATH, JSON.generate(result) + "\n")
puts "Generated #{OUTPUT_PATH} (#{result.size} events)"
