STATISTICS = {}

def camelize(str)
  str.split('_').map(&:capitalize).join
end

# NOTE: 被合并到聚合页面的统计 ID，不在索引页单独列出，也不单独生成 .md
# DRY: 统一维护于此，compute_index.rb 和 compute_all.rb 直接引用
MERGED_INTO_METRIC = %w[
  wr_single_history wr_average_history
  wr_bao5 wr_wao5 wr_mo5 wr_bpa wr_wpa
  wr_median wr_best_counting wr_worst_counting wr_worst
  wr_variance wr_best_average_ratio
].freeze

MERGED_INTO_AOXR = %w[wr_ao1r wr_ao2r wr_ao3r wr_ao4r].freeze

MERGED_INTO_AVERAGE_OF = %w[
  average_of_5 average_of_12 average_of_25 average_of_50 average_of_100
].freeze

ALL_MERGED = (MERGED_INTO_METRIC + MERGED_INTO_AOXR + MERGED_INTO_AVERAGE_OF).freeze

# Require all statistic files.
Dir["#{__dir__}/*.rb"].reject { |path| path.end_with?(__FILE__) }.each do |file|
  require file
  basename = File.basename(file, ".rb")
  STATISTICS[basename] = Module.const_get(camelize(basename)).new
end

