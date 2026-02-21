# patch_md_translations.rb
# 直接将 stats/*.md 中错误的 data-i18n-zh 属性替换为翻译表中的正确中文
# 无需数据库，直接修补已生成的 .md 文件

require_relative "i18n_translations"

STATS_DIR = File.expand_path("../stats", __dir__)

patched = 0
skipped = 0

Dir.glob(File.join(STATS_DIR, "*.md")).each do |path|
  basename = File.basename(path, ".md")
  trans = STAT_TRANSLATIONS[basename]

  # 没有翻译条目的跳过
  unless trans
    skipped += 1
    next
  end

  bytes   = File.binread(path)
  content = bytes.force_encoding("UTF-8")
  changed = false

  # 1. 修补 <h2> 标题的 data-i18n-zh
  if trans[:title_zh]
    # 匹配 data-i18n-zh="..." 中的内容（h2 标签内）
    new_content = content.gsub(
      /(<h2[^>]*data-i18n-zh=)"([^"]*)"([^>]*>)/
    ) do
      prefix, current_zh, suffix = $1, $2, $3
      correct_zh = trans[:title_zh]
      if current_zh != correct_zh
        changed = true
        "#{prefix}\"#{correct_zh}\"#{suffix}"
      else
        $&  # 不变
      end
    end
    content = new_content
  end

  # 2. 修补 <em> 说明文字的 data-i18n-zh（仅第一个 em）
  if trans[:note_zh]
    first = true
    new_content = content.gsub(
      /(<em[^>]*data-i18n-zh=)"([^"]*)"([^>]*>)/
    ) do
      if first
        first = false
        prefix, current_zh, suffix = $1, $2, $3
        correct_zh = trans[:note_zh]
        if current_zh != correct_zh
          changed = true
          "#{prefix}\"#{correct_zh}\"#{suffix}"
        else
          $&
        end
      else
        $&
      end
    end
    content = new_content
  end

  if changed
    File.binwrite(path, content.encode("UTF-8").b)
    puts "[PATCHED] #{basename}"
    patched += 1
  end
end

puts "\nDone: #{patched} patched, #{skipped} skipped (no translation entry)."
