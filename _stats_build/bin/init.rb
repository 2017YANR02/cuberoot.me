#!/usr/bin/env ruby

require 'fileutils'

# Create the build directory.
Dir.mkdir("build") unless Dir.exist?("build")
# Copy the default database config file to the root directory.
template_path = File.join(__dir__, "templates", "database.yml")
root_path = File.expand_path("..", __dir__)
FileUtils.copy(template_path, root_path)
