require_relative "statistic"
require_relative "events"

class GroupedStatistic < Statistic
  def markdown
    markdown = top
    data.each do |header, subdata|
      unless subdata.empty?
        # NOTE: header 是项目英文名，用 Events.zh 查找中文名
        zh = Events.zh(header)
        markdown += "\n<h3 data-i18n-en=\"#{header}\" data-i18n-zh=\"#{zh}\">#{header}</h3>\n\n"
        markdown += markdown_table(@table_header, subdata)
      end
    end
    markdown
  end
end
