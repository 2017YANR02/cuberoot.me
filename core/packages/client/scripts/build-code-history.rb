# Offline adapter for the official Ruby-only GitHub Linguist API.
# Install: gem install github-linguist -v 9.7.0
# Run from core/: ruby packages/client/scripts/build-code-history.rb [--plan]
# Does not check out commits or modify source files. No network access.
require 'json'
require 'date'
require 'fileutils'

module CodeLanguageHistory
  ENGINE = 'github-linguist 9.7.0'.freeze
  TIMEZONE = 'America/Los_Angeles'.freeze
  METADATA = { 'engine' => ENGINE, 'timezone' => TIMEZONE, 'branch' => 'main' }.freeze
  OUTPUT = 'core/packages/client/app/[lang]/dev/architecture/_components/code-history/history.json'.freeze

  # Publishing the snapshot must not cause another snapshot-only commit tomorrow.
  # Inspect paths, not author/subject: real edits by a bot still count.
  def self.source_changed?(root, previous, head)
    return true unless previous
    commits = IO.popen(['git', '-C', root, 'log', '--first-parent', '--format=%H',
      '-1', "#{previous}..#{head}", '--', '.', ":(top,exclude)#{OUTPUT}"], &:read)
    raise 'Cannot check language-history source changes' unless $?.success?
    !commits.strip.empty?
  end

  # Calendar carry-forward rows are display data, not additional Git snapshots.
  def self.commit_rows(rows)
    rows.each_with_index.each_with_object([]) do |(row, index), result|
      result << row if index.zero? || rows[index - 1]['sha'] != row['sha']
    end
  end

  def self.reusable_rows(expected, rows)
    matched = rows.take_while.with_index do |row, index|
      expected[index] == [row['date'], row['sha']]
    end
    return matched if matched.size == rows.size

    # Today's final commit changes throughout the day. Only an append to that
    # final saved day is safe; older changes still indicate rewritten history.
    last = rows.last
    replacement = expected[matched.size]
    if matched.size == rows.size - 1 && replacement && last['date'] == replacement[0] && yield(last['sha'], replacement[1])
      return matched
    end
    raise 'Saved history changed before its final day; preserve the checkpoint and snapshot before rebuilding'
  end

  def self.calendar_rows(rows)
    by_date = rows.to_h { |row| [row['date'], row] }
    previous = nil
    (Date.parse(rows.first['date'])..Date.parse(rows.last['date'])).map do |date|
      previous = by_date[date.to_s] || previous
      previous.merge('date' => date.to_s)
    end
  end

  def self.prepare_state(expected, state, &ancestor)
    saved = commit_rows(state.fetch('rows'))
    rows = reusable_rows(expected, saved, &ancestor)
    cached = !!(state['cache'] && state['sha'] == saved.last&.fetch('sha'))
    pending = expected.drop(rows.size)
    { rows: rows, cached: cached, pending: pending,
      bootstrap: !cached && !rows.empty? && !pending.empty? }
  end

  def self.atomic_json(path, value)
    json = JSON.generate(value)
    return if File.file?(path) && File.read(path) == json
    FileUtils.mkdir_p(File.dirname(path))
    File.write(path + '.next', json)
    File.rename(path + '.next', path)
  end

  def self.run(plan_only: false)
    ENV['TZ'] = TIMEZONE
    $stdout.sync = true
    root = File.expand_path('../../../..', __dir__)
    output = File.join(root, OUTPUT)
    checkpoint = File.join(root, '.local-data/code-language-history/checkpoint.json')
    git = lambda do |*args|
      result = IO.popen(['git', '-C', root, *args], &:read)
      raise "git #{args.first} failed" unless $?.success?
      result.strip
    end
    head = git.call('rev-parse', 'main^{commit}')
    daily = {}
    git.call('log', '--first-parent', '--format=%ct %H', head).each_line do |line|
      timestamp, sha = line.split
      daily[Time.at(timestamp.to_i).getlocal.strftime('%Y-%m-%d')] ||= sha
    end
    expected = daily.sort
    raise 'main has no commits' if expected.empty?
    # Leave the old cache intact when migrating; never discard recovery data.
    legacy = File.expand_path(git.call('rev-parse', '--git-path', 'code-language-history.json'), root)
    source = [checkpoint, legacy, output].find { |path| File.file?(path) }
    saved_json = source && File.read(source)
    state = saved_json ? JSON.parse(saved_json) : { 'rows' => [] }
    if source && source != legacy && METADATA.any? { |key, value| state[key] != value }
      raise "Incompatible language history metadata: #{source}"
    end
    prepared = prepare_state(expected, state) do |old, current|
      system('git', '-C', root, 'merge-base', '--is-ancestor', old, current)
    end
    rows, cached, pending = prepared.values_at(:rows, :cached, :pending)
    plan = METADATA.merge('head' => head, 'source' => source, 'checkpoint' => checkpoint,
      'reusedDays' => rows.size, 'analyzedDays' => pending.size,
      'cacheBootstrap' => prepared[:bootstrap],
      'sourceChanged' => source_changed?(root, File.file?(output) ? JSON.parse(File.read(output))['rows'].last&.fetch('sha') : nil, head),
      'lastDate' => expected.last.first)
    if plan_only
      puts JSON.pretty_generate(plan)
      return
    end

    FileUtils.mkdir_p(File.dirname(checkpoint))
    File.open(checkpoint + '.lock', File::RDWR | File::CREAT, 0o644) do |lock|
      raise 'Another language-history update is running' unless lock.flock(File::LOCK_EX | File::LOCK_NB)
      if [checkpoint, legacy, output].find { |path| File.file?(path) } != source || (source && File.read(source) != saved_json)
        raise 'Language history changed while planning; run again using the new checkpoint'
      end
      # Load the engine only when analysis is needed; a repeated run is a no-op.
      unless pending.empty?
        gem 'github-linguist', '9.7.0'
        require 'rugged'
        require 'linguist'
        repo = Rugged::Repository.new(root)
        state = METADATA.merge('rows' => rows, 'sha' => cached ? state['sha'] : nil, 'cache' => cached ? state['cache'] : nil)
        if prepared[:bootstrap]
          started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
          analysis = Linguist::Repository.new(repo, rows.last['sha'])
          raise 'Linguist baseline differs from the saved snapshot' unless analysis.languages == rows.last['languages']
          state['sha'], state['cache'] = rows.last['sha'], analysis.cache
          atomic_json(checkpoint, state)
          puts "Restored cache at #{rows.last['date']} in #{(Process.clock_gettime(Process::CLOCK_MONOTONIC) - started).round(2)}s"
        end
        pending.each do |date, sha|
          started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
          analysis = state['sha'] ? Linguist::Repository.incremental(repo, sha, state['sha'], state['cache']) : Linguist::Repository.new(repo, sha)
          languages = analysis.languages
          raise "Empty analysis for #{date}" if languages.empty?
          rows << { 'date' => date, 'sha' => sha, 'languages' => languages }
          state['sha'], state['cache'] = sha, analysis.cache
          atomic_json(checkpoint, state)
          puts "#{rows.size}/#{expected.size} #{date} #{(Process.clock_gettime(Process::CLOCK_MONOTONIC) - started).round(2)}s pid=#{Process.pid}"
          GC.start
        end
      end
      filled = calendar_rows(rows)
      atomic_json(output, METADATA.merge('rows' => filled))
      puts "Saved #{filled.size} calendar days through #{filled.last['date']} (#{head}); reused #{plan['reusedDays']}, analyzed #{pending.size}"
    end
  end
end

if $PROGRAM_NAME == __FILE__
  abort 'Usage: build-code-history.rb [--plan]' unless (ARGV - ['--plan']).empty?
  CodeLanguageHistory.run(plan_only: ARGV.include?('--plan'))
end
