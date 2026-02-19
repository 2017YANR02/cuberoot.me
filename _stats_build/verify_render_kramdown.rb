require 'kramdown'
require 'kramdown-parser-gfm'

$LOADED_FEATURES << "bundler/setup"

require_relative "statistics/index"

# get stat name from ARGV or default to wr_bao5
stat_name = ARGV[0] || 'wr_bao5'

if ARGV[0].nil?
  puts "Usage: ruby verify_render_kramdown.rb <statistic_name>"
  puts "Defaulting to: #{stat_name}"
end

stat = STATISTICS[stat_name]
unless stat
  puts "Error: Statistic '#{stat_name}' not found."
  puts "Available: #{STATISTICS.keys.sort.join(', ')}"
  exit 1
end

puts "Generating markdown for #{stat_name}..."
markdown = stat.markdown

puts "Rendering HTML using Kramdown (GFM)..."
html_content = Kramdown::Document.new(markdown, input: 'GFM').to_html

full_html = <<~HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>#{stat.title} - Kramdown Preview</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',Arial,sans-serif;background-color:#0a0a0f;color:#e0e0e0;line-height:1.6;padding:2rem;background-image:radial-gradient(ellipse at 20% 50%,rgba(90,90,200,.08) 0%,transparent 50%),radial-gradient(ellipse at 80% 50%,rgba(200,90,90,.06) 0%,transparent 50%);min-height:100vh}
    .container{max-width:960px;margin:0 auto}
    h1,h2,h3,h4{color:#fff;margin:1.2em 0 .5em}
    h2{font-size:1.5rem;border-bottom:1px solid rgba(255,255,255,.1);padding-bottom:.3em}
    h3{font-size:1.2rem}
    p{margin:.5em 0}
    em{color:#aaa}
    a{color:#8888cc;text-decoration:none}
    a:hover{text-decoration:underline;color:#aaaaee}
    table{border-collapse:collapse;margin:1em 0;font-size:.9rem}
    th{background:#1a1a2e;color:#ccc;font-weight:600;padding:8px 12px;border:1px solid #2a2a3e;text-align:left}
    td{padding:6px 12px;border:1px solid #1e1e30}
    tr:nth-child(even){background:#12121f}
    tr:nth-child(odd){background:#0e0e18}
    tr:hover{background:#1e1e35}
    /* Tab 面板（来自 TabUi mixin） */
    .stat-tabs{display:flex;gap:0;margin:16px 0 0}
    .stat-tab{flex:1;padding:10px 20px;border:none;cursor:pointer;font-size:15px;font-weight:600;color:#fff;background:#4a6785;transition:background .2s}
    .stat-tab:first-child{border-radius:6px 0 0 6px}
    .stat-tab:last-child{border-radius:0 6px 6px 0}
    .stat-tab.active{background:#2c4a6e}
    .stat-tab:hover:not(.active){background:#3b5975}
    .stat-panel{display:none;margin-top:12px}
    .stat-panel.active{display:block}
  </style>
</head>
<body>
<div class="container">
#{html_content}
</div>
</body>
</html>
HTML

output_file = 'preview_kramdown.html'
File.write(output_file, full_html)
puts "HTML Generated: #{File.expand_path(output_file)}"
puts "Content check:"
line_match = html_content.lines.find { |l| l.include?("Rubik's Cube") && l.include?('h3') }
if line_match
  puts "Found h3 line: #{line_match.strip}"
else
  puts "WARNING: Could not find target h3 line for verification"
end
