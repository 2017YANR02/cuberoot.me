# NOTE: 批量注入脚本，为每个统计文件添加 @title_zh 和 @note_zh
# 在 @title = ... 行后插入 @title_zh = ...
# 在 @note = ... 行后插入 @note_zh = ...
require_relative "i18n_translations"

stats_dir = File.join(__dir__, "statistics")

Dir[File.join(stats_dir, "*.rb")].each do |file|
  basename = File.basename(file, ".rb")
  next if basename == "index"
  next unless STAT_TRANSLATIONS.key?(basename)

  trans = STAT_TRANSLATIONS[basename]
  next unless trans[:title_zh] || trans[:note_zh]

  content = File.read(file, encoding: "utf-8")
  modified = false

  # 跳过已有 @title_zh 的文件
  next if content.include?("@title_zh")

  # 在 @title = ... 行后插入 @title_zh
  if trans[:title_zh]
    content = content.gsub(/^(\s*@title\s*=\s*.+)$/) do |match|
      indent = match.match(/^(\s*)/)[1]
      "#{match}\n#{indent}@title_zh = \"#{trans[:title_zh]}\""
    end
    modified = true
  end

  # 在 @note = ... 行后插入 @note_zh
  if trans[:note_zh]
    content = content.gsub(/^(\s*@note\s*=\s*.+)$/) do |match|
      indent = match.match(/^(\s*)/)[1]
      "#{match}\n#{indent}@note_zh = \"#{trans[:note_zh]}\""
    end
    modified = true
  end

  if modified
    File.write(file, content, encoding: "utf-8")
    puts "Updated: #{basename}.rb"
  end
end

# 也处理 abstract 目录
abstract_dir = File.join(stats_dir, "abstract")
Dir[File.join(abstract_dir, "*.rb")].each do |file|
  basename = File.basename(file, ".rb")
  content = File.read(file, encoding: "utf-8")

  # AverageOfX 的标题是动态的，需要特殊处理
  if basename == "average_of_x" && !content.include?("@title_zh")
    content = content.gsub(/^(\s*@title\s*=\s*"Average of #\{@solve_count\}")$/) do |match|
      indent = match.match(/^(\s*)/)[1]
      "#{match}\n#{indent}@title_zh = \"#{'{'}@solve_count} 次平均\""
    end
    content = content.gsub(/^(\s*@note\s*=\s*.+)$/) do |match|
      indent = match.match(/^(\s*)/)[1]
      "#{match}\n#{indent}@note_zh = \"取连续 \#\{@solve_count\} 次官方成绩计算。仅考虑单次前 200 名的选手。\""
    end
    File.write(file, content, encoding: "utf-8")
    puts "Updated: abstract/#{basename}.rb"
  end
end

puts "Done!"
