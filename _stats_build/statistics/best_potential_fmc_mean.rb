require_relative "../core/statistic"

class BestPotentialFmcMean < Statistic
  def initialize
    @title = "Best potential FMC mean"
    @note = "The means are computed by taking the best result for each attempt in the given round."
    @table_header = { "Mean" => :center, "Attempt 1" => :center, "Attempt 2" => :center, "Attempt 3" => :center, "Competition" => :left }
  end

  def query
    <<-SQL
      SELECT
        (best1 + best2 + best3) / 3 mean,
        best1, best2, best3,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, '/results/all#e333fm', '_', round_type_id, ')') round_link
      FROM (
        SELECT
          MIN(IF(value1 > 0, value1, NULL)) best1,
          MIN(IF(value2 > 0, value2, NULL)) best2,
          MIN(IF(value3 > 0, value3, NULL)) best3,
          competition_id,
          round_type_id
        FROM results
        WHERE event_id = '333fm'
        GROUP BY competition_id, round_type_id
      ) AS best_attempts_by_competition_and_round
      JOIN competitions competition ON competition.id = competition_id
      WHERE LEAST(best1, best2, best3) IS NOT NULL
      ORDER BY mean
      LIMIT 100
    SQL
  end

  def transform(query_results)
    query_results.map do |result|
      ["%0.2f" % result["mean"], result["best1"], result["best2"], result["best3"], result["round_link"]]
    end
  end
end
