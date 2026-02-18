require_relative "abstract/wr_round_history"

class WrBestAverageRatio < WrRoundHistory
  def initialize
    @title = "World record best/average ratio history"
    @note = "Best/Average Ratio: ratio of the best single to the average in a round (lower = more dominant best solve)."
    @table_header = { "Result" => :right, "Improvement" => :right, "Days" => :right, "Person" => :left, "Competition" => :left, "Date" => :left, "Details" => :left }
  end

  # NOTE: Best/Average Ratio = best / average
  # 需要全部5次有效且 average > 0
  def compute_metric(values, r)
    return nil unless values.all? { |v| v > 0 }
    return nil unless r["average"] > 0
    r["best"].to_f / r["average"]
  end

  def format_metric(metric_value, event_id)
    "%.2f" % metric_value
  end
end
