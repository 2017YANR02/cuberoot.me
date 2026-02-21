require "date"
require "time"
require "fileutils"
require_relative "database"
require_relative "events"
require_relative "solve_time"
require_relative "../i18n_translations"

class Statistic
  attr_reader :title, :title_zh, :note, :note_zh

  # NOTE: 缓存目录，存放 marshal 格式的查询结果。不提交到 git
  CACHE_DIR = File.expand_path("../../.data_cache", __dir__)

  def query
    raise "Must implement #query"
  end

  # NOTE: 支持磁盘缓存。STATS_USE_CACHE=1 时跳过 MySQL，直接从文件读取
  # 每次正常运行（无环境变量）时都会更新缓存，确保数据始终最新
  def query_results
    return @query_results if @query_results
    cache_file = File.join(CACHE_DIR, "#{self.class.name.gsub('::', '_')}.marshal")
    if ENV["STATS_USE_CACHE"] == "1" && File.exist?(cache_file)
      @query_results = Marshal.load(File.binread(cache_file))
    else
      # NOTE: .to_a 将 Mysql2::Result 转为 Array of Hashes，才能 marshal 序列化
      @query_results = Database.client.query(query).to_a
      FileUtils.mkdir_p(CACHE_DIR)
      File.binwrite(cache_file, Marshal.dump(@query_results))
    end
    @query_results
  end

  # NOTE: 默认 transform — 从 Array of Hashes 取值列（顺序与 SQL SELECT 一致）
  def transform(query_results)
    query_results.map(&:values)
  end

  def data
    @data ||= transform(query_results)
  end

  # NOTE: 用 HTML data-i18n 属性实现双语切换，前端 i18n.js 据此替换文本
  # 翻译来源优先级: @title_zh (硬编码) > STAT_TRANSLATIONS (集中管理) > @title (英文原文)
  def top
    timestamp = Time.parse(Database.metadata["export_timestamp"])
    # NOTE: 通过类名反推文件 basename（CamelCase → snake_case），查找集中翻译表
    # NOTE: CamelCase -> snake_case 需分两步：
    #   1. 小写/数字 + 大写 -> 插入 _（如 MostPodiums -> most_podiums）
    #   2. 小写字母 + 数字 -> 插入 _（如 Most4thPlaces -> most_4th_places）
    basename = self.class.name
                    .gsub(/([a-z\d])([A-Z])/, '\1_\2')
                    .gsub(/([a-z])(\d)/, '\1_\2')
                    .downcase
    trans = defined?(STAT_TRANSLATIONS) ? (STAT_TRANSLATIONS[basename] || {}) : {}
    zh = @title_zh || trans[:title_zh] || @title
    markdown = "<h2 data-i18n-en=\"#{@title}\" data-i18n-zh=\"#{zh}\">#{@title}</h2>\n\n"
    if @note
      nzh = @note_zh || trans[:note_zh] || @note
      markdown += "<p><em data-i18n-en=\"#{@note}\" data-i18n-zh=\"#{nzh}\">#{@note}</em></p>\n"
    end
    # NOTE: 日期也用双语输出
    date_en = timestamp.strftime("Updated on %e %B %Y").strip
    date_zh = timestamp.strftime("更新于 %Y 年 %-m 月 %-d 日")
    markdown += "<p><em data-i18n-en=\"#{date_en}\" data-i18n-zh=\"#{date_zh}\">#{date_en}</em></p>\n\n"
    markdown
  end

  def markdown
    top + markdown_table(@table_header, data)
  end

  def markdown_table(header, data)
    table = "| #{header.keys.join(' | ')} |\n"
    alignments = { left: ":---", center: ":--:", right: "---:" }
    table += "| #{header.values.map { |alignment| alignments[alignment] }.join(' | ')} |\n"
    data.each do |row|
      table += "| #{row.join(' | ')} |\n"
    end
    table
  end

  # NOTE: WR 历史行的公共字段——进步、天数、选手、比赛、日期、详情
  # records: 按时间正序排列的纪录数组
  # i: 当前索引
  # event_id: 项目 ID（用于格式化 details 中的 value1-5）
  # details: 可选，自定义详情字符串（ao_rounds 用各轮 average 而非 value1-5）
  # block: 从记录中提取指标值（用于计算进步百分比）
  # 返回: [gain_str, days_str, person_link, date_str, competition_link, details]
  def wr_history_row(records, i, event_id, details: nil)
    r = records[i]

    # 进步：与前一条纪录相比的百分比提升
    if i > 0
      prev_val = yield(records[i - 1]).to_f
      curr_val = yield(r).to_f
      gain_str = "#{((prev_val - curr_val) / prev_val * 100).round(1)}%"
    else
      gain_str = ""
    end

    # 天数：该纪录保持了多久
    # 已被打破 → 到下一条纪录的天数；仍保持 → 到今天的天数
    if i < records.size - 1
      days_str = (records[i + 1]["start_date"] - r["start_date"]).to_i.to_s
    else
      days_str = (Date.today - r["start_date"].to_date).to_i.to_s
    end

    date_str = r["start_date"].strftime("%Y-%m-%d")
    details ||= (1..5).map { |n| SolveTime.new(event_id, :single, r["value#{n}"]).clock_format }
      .reject(&:empty?).join(', ')

    [gain_str, days_str, r["person_link"], date_str, r["competition_link"], details]
  end
end
