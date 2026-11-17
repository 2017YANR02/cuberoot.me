# JSON-lines adapter to the official Ruby-only engine; orchestration lives in TS.
# One process/repository serves the whole run. Cache bytes are opaque to TS.
require 'json'
gem 'github-linguist', ARGV.fetch(0)
require 'rugged'
require 'linguist'

$stdout.sync = true
repo = Rugged::Repository.new(ARGV.fetch(1))
STDIN.each_line do |line|
  request = JSON.parse(line)
  analysis = if request['previousSha']
    Linguist::Repository.incremental(repo, request.fetch('sha'), request['previousSha'], request.fetch('cache'))
  else
    Linguist::Repository.new(repo, request.fetch('sha'))
  end
  puts JSON.generate('languages' => analysis.languages, 'cache' => analysis.cache)
  GC.start
end
