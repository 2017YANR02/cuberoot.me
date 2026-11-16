# Pure planning and checkpoint checks; no Linguist gem, network or Git writes.
# Run from core/: ruby packages/client/scripts/check-code-history.rb
require 'tmpdir'
require_relative 'build-code-history'

checks = 0
assert = lambda do |message, condition|
  raise message unless condition
  checks += 1
end
rows = [
  { 'date' => '2026-11-14', 'sha' => 'a', 'languages' => { 'Ruby' => 4 } },
  { 'date' => '2026-11-16', 'sha' => 'b', 'languages' => { 'Ruby' => 5 } }
]
expected = [['2026-11-14', 'a'], ['2026-11-16', 'b']]
future = expected + [['2026-11-17', 'c']]
prepare = lambda do |dates, state, &ancestor|
  CodeLanguageHistory.prepare_state(dates, state, &(ancestor || ->(*) { false }))
end

unchanged = prepare.call(expected, { 'rows' => rows })
assert.call('An unchanged snapshot must need neither analysis nor cache bootstrap',
  unchanged[:rows] == rows && unchanged[:pending].empty? && !unchanged[:bootstrap])

missing_cache = prepare.call(future, { 'rows' => rows })
assert.call('A missing cache must preserve historical rows and bootstrap only their final commit',
  missing_cache[:rows] == rows && missing_cache[:pending] == [future.last] && missing_cache[:bootstrap])

cache = { 'rows' => rows, 'sha' => 'b', 'cache' => { 'example.rb' => ['Ruby', 5] } }
cached = prepare.call(future, cache)
assert.call('A matching per-file cache must be reused', cached[:cached] && !cached[:bootstrap])
stale = prepare.call(future, cache.merge('sha' => 'wrong'))
assert.call('A cache for a different commit must be rebuilt', !stale[:cached] && stale[:bootstrap])

replacement = [expected.first, ['2026-11-16', 'b2']]
same_day = prepare.call(replacement, cache) { |old, current| old == 'b' && current == 'b2' }
assert.call('Same-day appended commits must refresh just that day with the old cache',
  same_day[:rows] == rows.take(1) && same_day[:pending] == [replacement.last] && same_day[:cached])

[
  [['2026-11-14', 'rewritten'], expected.last],
  [expected.first, ['2026-11-16', 'unrelated']],
  expected.take(1)
].each do |changed|
  rejected = false
  begin
    prepare.call(changed, cache)
  rescue RuntimeError => error
    rejected = error.message.include?('Saved history changed')
  end
  assert.call('Rewritten or truncated saved history must be rejected', rejected)
end

filled = CodeLanguageHistory.calendar_rows(rows)
assert.call('Days without commits must carry the prior byte counts',
  filled[1] == rows.first.merge('date' => '2026-11-15'))
assert.call('Carry-forward days must not count as analyzed commits',
  CodeLanguageHistory.commit_rows(filled) == rows)
empty = prepare.call(expected, { 'rows' => [] })
assert.call('A first run has no prior cache to bootstrap',
  empty[:rows].empty? && empty[:pending] == expected && !empty[:bootstrap])

scratch = File.expand_path('../../../../.tmp/scratch', __dir__)
FileUtils.mkdir_p(scratch)
Dir.mktmpdir('code-history-check-', scratch) do |directory|
  path = File.join(directory, 'snapshot.json')
  CodeLanguageHistory.atomic_json(path, { 'rows' => rows })
  File.utime(Time.at(0), Time.at(0), path)
  bytes, mtime = File.read(path), File.mtime(path)
  CodeLanguageHistory.atomic_json(path, { 'rows' => rows })
  assert.call('An unchanged run must preserve bytes and mtime',
    File.read(path) == bytes && File.mtime(path) == mtime)
  CodeLanguageHistory.atomic_json(path, { 'rows' => filled })
  assert.call('Changed data must be replaced completely without a leftover partial file',
    JSON.parse(File.read(path)) == { 'rows' => filled } && !File.exist?(path + '.next'))
end

puts "#{checks} code-language-history checks passed (Ruby standard library only)"
