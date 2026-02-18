# NOTE: 将统计输出包装成可直接在浏览器中打开的 HTML 页面
# 用于本地开发时快速预览统计效果（表格、Tab 切换等）
#
# 用法:
#   ruby test_html.rb <statistic_name>
#
# 示例:
#   ruby test_html.rb wr_dominance
#   ruby test_html.rb wr_bpa
#   ruby test_html.rb consecutive_sub_5_average
#
# 输出:
#   _stats_build/test_output.html（直接双击打开即可）
#
# 前提:
#   - 本地安装了 Ruby 3.x
#   - MySQL 中已导入 WCA 数据库（参见 TESTING.md）
#
# HACK: 绕过 bundler/setup，本地测试不需要 Gemfile
$LOADED_FEATURES << "bundler/setup"

require_relative "statistics/index"

stat_name = ARGV[0]
unless stat_name
  puts "用法: ruby test_html.rb <statistic_name>"
  puts "可用统计: #{STATISTICS.keys.sort.join(', ')}"
  exit 1
end

stat = STATISTICS[stat_name]
unless stat
  puts "未找到统计: #{stat_name}"
  puts "可用统计: #{STATISTICS.keys.sort.join(', ')}"
  exit 1
end

puts "=== 生成 #{stat_name} HTML ==="

begin
  output = stat.markdown
  lines = output.lines
  puts "Markdown 输出: #{lines.count} 行"

  html = <<~HTML
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>#{stat.title} - Test Preview</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; color: #333; }
        table { border-collapse: collapse; width: 100%; margin: 8px 0; }
        th, td { padding: 6px 12px; border-bottom: 1px solid #ddd; text-align: left; }
        th { background: #f6f8fa; font-weight: 600; }
        a { color: #0366d6; text-decoration: none; }
        a:hover { text-decoration: underline; }
        h2 { border-bottom: 2px solid #e1e4e8; padding-bottom: 8px; }
        h3 { margin-top: 24px; color: #24292e; }
      </style>
    </head>
    <body>
    #{output}
    </body>
    </html>
  HTML

  output_path = File.expand_path("test_output.html", __dir__)
  File.write(output_path, html)
  puts "HTML 已生成: #{output_path}"
  puts "=== 成功 ==="
rescue => e
  puts "=== 错误 ==="
  puts "#{e.class}: #{e.message}"
  puts e.backtrace.first(10).join("\n")
end
