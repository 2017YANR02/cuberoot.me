STATISTICS = {}

def camelize(str)
  str.split('_').map(&:capitalize).join
end

# Require all statistic files.
Dir["#{__dir__}/*.rb"].reject { |path| path.end_with?(__FILE__) }.each do |file|
  require file
  basename = File.basename(file, ".rb")
  STATISTICS[basename] = Module.const_get(camelize(basename)).new
end
