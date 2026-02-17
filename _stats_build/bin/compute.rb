#!/usr/bin/env ruby

require_relative "helpers"
require_relative "../statistics/index"

$stdout.sync = true

statistic_path = ARGV[0] || abort("Please provide the statistic file path.")
statistic_id = File.basename(statistic_path, ".rb")
statistic_object = STATISTICS[statistic_id]
Helpers.timed_task("Computing: #{statistic_object.title}") do
  markdown_result = statistic_object.markdown
  destination_path = File.expand_path("../../stats/#{statistic_id}.md", __dir__)
  File.write(destination_path, markdown_result)
  puts "File generated at #{destination_path}"
end
