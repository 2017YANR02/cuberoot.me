#!/usr/bin/env ruby

file_name = ARGV[0] || abort("Please provide the statistic file name.")
class_name = file_name.split('_').map!(&:capitalize).join
grouped_statistic = (ARGV[1] == "--grouped")
# Read the template and make the necessary replacements.
template_path = File.join(__dir__, "templates", "new_statistic.rb")
template = File.read(template_path)
template.gsub!("<<<CLASS_NAME>>>", class_name)
if grouped_statistic
  template.gsub!("statistic", "grouped_statistic")
  template.gsub!("Statistic", "GroupedStatistic")
end
# Create a new statistic file.
file_path = File.expand_path("../statistics/#{file_name}.rb", __dir__)
File.write(file_path, template)
puts "New statistic file created at #{file_path}"
