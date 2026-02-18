require "time"
require_relative "database"
require_relative "events"

class Statistic
  attr_reader :title, :title_zh, :note, :note_zh

  def query
    raise "Must implement #query"
  end

  def query_results
    Database.client.query(query)
  end

  def transform(query_results)
    query_results.each(as: :array)
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
    # NOTE: 注入 i18n 脚本和语言切换按钮，stats 页面在 /stats/ 子目录
    markdown += <<~HTML
      <div style="position:fixed;bottom:16px;right:16px;z-index:9999;display:flex;gap:0;border-radius:6px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.15)">
        <button data-i18n-toggle="en" onclick="I18n.setLocale('en')" style="padding:6px 14px;border:none;cursor:pointer;font-size:14px;font-weight:600;background:#e0e0e0;color:#333">EN</button>
        <button data-i18n-toggle="zh" onclick="I18n.setLocale('zh')" style="padding:6px 14px;border:none;cursor:pointer;font-size:14px;font-weight:600;background:#e0e0e0;color:#333">中文</button>
      </div>
      <script src="../src/i18n/i18n.js" defer></script>
    HTML
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
