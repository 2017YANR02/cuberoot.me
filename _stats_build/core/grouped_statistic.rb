require_relative "statistic"

class GroupedStatistic < Statistic
  def markdown
    markdown = top
    data.each do |header, subdata|
      unless subdata.empty?
        markdown += "\n### #{header}\n\n"
        markdown += markdown_table(@table_header, subdata)
      end
    end
    markdown
  end
end
