require "time"
require "fileutils"
require_relative "database"
require_relative "events"

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
  def top
    timestamp = Time.parse(Database.metadata["export_timestamp"])
    zh = @title_zh || @title
    markdown = "<h2 data-i18n-en=\"#{@title}\" data-i18n-zh=\"#{zh}\">#{@title}</h2>\n\n"
    if @note
      nzh = @note_zh || @note
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
end
