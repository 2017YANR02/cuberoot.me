#!/usr/bin/env ruby
# 临时测试脚本：只跑 minx 的 Ao1R，生成 HTML 预览
# 用途：验证 ao_rounds.rb 修复后的 UI 渲染效果，同时测量 minx 的查询速度

$stdout.sync = true
require 'kramdown'
require 'kramdown-parser-gfm'
$LOADED_FEATURES << "bundler/setup"
require_relative "statistics/index"

stat = STATISTICS["wr_ao1r"]

# Monkey-patch query 方法：只拉 minx 数据
def stat.query
  <<-SQL
    SELECT result.event_id, result.average, result.round_type_id, result.competition_id,
      CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
      person.wca_id AS person_id,
      CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
      competition.start_date
    FROM results result
    JOIN persons person ON person.wca_id = result.person_id AND person.sub_id = 1
    JOIN competitions competition ON competition.id = result.competition_id
    WHERE result.event_id = 'minx' AND result.average > 0
    ORDER BY result.event_id, competition.start_date
  SQL
end

puts "Computing wr_ao1r (minx only)..."
t = Time.now
md = stat.markdown
puts "Done in #{(Time.now - t).round(2)}s"

# 读取 CSS（和 verify_render_kramdown.rb 相同）
css_path = File.expand_path("../_layouts/default.html", __dir__)
css = ""
if File.exist?(css_path)
  css_match = File.read(css_path).match(/<style>(.*?)<\/style>/m)
  css = css_match[1] if css_match
end

# 生成 HTML
body = Kramdown::Document.new(md, input: "GFM", syntax_highlighter: nil).to_html
html = <<~HTML
  <!DOCTYPE html>
  <html><head><meta charset="UTF-8">
  <title>wr_ao1r (minx test)</title>
  <style>body { background: #1a1a2e; color: #e0e0e0; font-family: sans-serif; padding: 2em; }
  #{css}
  </style></head><body>#{body}</body></html>
HTML

out = File.expand_path("test_ao1r_minx.html", __dir__)
File.write(out, html)
puts "HTML preview: #{out}"
