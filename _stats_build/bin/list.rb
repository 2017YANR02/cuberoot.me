#!/usr/bin/env ruby

require_relative "../statistics/index"

STATISTICS.sort.each do |statistic_id, statistic_object|
  printf "%-50s %s\n", statistic_id, statistic_object.title
end
