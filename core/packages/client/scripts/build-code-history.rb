# Offline adapter for the official Ruby-only GitHub Linguist API.
# Install: gem install github-linguist -v 9.7.0
# Run from core/: ruby packages/client/scripts/build-code-history.rb
# Does not check out commits or modify the working tree. No network access.
gem 'github-linguist', '9.7.0'
require 'rugged'
require 'linguist'
require 'json'
require 'date'
ENV['TZ'] = 'America/Los_Angeles'
$stdout.sync = true
root = File.expand_path('../../../..', __dir__)
repo = Rugged::Repository.new(root)
commits = IO.popen(['git', '-C', root, 'log', '--first-parent', '--format=%ct %H', 'main'], &:read)
raise 'Could not read main history' unless $?.success?
daily = {}
commits.each_line do |line|
  timestamp, sha = line.split
  daily[Time.at(timestamp.to_i).getlocal.strftime('%Y-%m-%d')] ||= sha
end
checkpoint = File.join(repo.path, 'code-language-history.json')
state = File.exist?(checkpoint) ? JSON.parse(File.read(checkpoint)) : {'rows' => [], 'sha' => nil, 'cache' => nil}
# A rewritten history must not silently reuse unrelated daily snapshots.
expected = daily.sort
saved = state['rows'].map { |row| [row['date'], row['sha']] }
raise "History changed; preserve then remove #{checkpoint} before rebuilding" unless expected.take(saved.size) == saved
expected.each_with_index do |(date, sha), index|
  next if index < saved.size
  analysis = state['sha'] ? Linguist::Repository.incremental(repo, sha, state['sha'], state['cache']) : Linguist::Repository.new(repo, sha)
  languages = analysis.languages
  raise "Empty analysis for #{date}" if languages.empty?
  state['rows'] << {'date' => date, 'sha' => sha, 'languages' => languages}
  state['sha'], state['cache'] = sha, analysis.cache
  File.write(checkpoint + '.tmp', JSON.generate(state))
  File.rename(checkpoint + '.tmp', checkpoint)
  puts "#{index + 1}/#{daily.size} #{date} pid=#{Process.pid}"
  GC.start
end
rows = state['rows']
by_date = rows.to_h { |row| [row['date'], row] }
previous = nil
filled = (Date.parse(rows.first['date'])..Date.parse(rows.last['date'])).map do |date|
  previous = by_date[date.to_s] || previous
  previous.merge('date' => date.to_s)
end
output = File.expand_path('../app/[lang]/dev/code-history/history.json', __dir__)
File.write(output, JSON.generate({'engine' => "github-linguist #{Linguist::VERSION}", 'timezone' => ENV['TZ'], 'branch' => 'main', 'rows' => filled}))
puts "Saved #{filled.size} calendar days"
