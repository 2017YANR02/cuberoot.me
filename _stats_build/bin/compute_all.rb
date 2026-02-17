#!/usr/bin/env ruby

require_relative "helpers"
require_relative "../statistics/index"

$stdout.sync = true # Make sure the output is printed immediately, so that Travis doesn't timeout.

build_path = File.expand_path("../../stats", __dir__)
Helpers.timed_task("Computing all statistics") do
  STATISTICS.each do |statistic_id, statistic_object|
    destination_path = File.join(build_path, "#{statistic_id}.md")
    Helpers.timed_task("Generating file at #{destination_path}") do
      markdown_result = statistic_object.markdown
      File.write(destination_path, markdown_result)
    end
  end
end
