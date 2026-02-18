require_relative "../core/grouped_statistic"
require_relative "../core/events"
require_relative "../core/solve_time"

class BestRound < GroupedStatistic
  def initialize
    @title = "Best round"
    @title_zh = "最佳轮次"
    @note = "For each event, shows the rounds with the best sum of the top 3 results. For blind events the single is used, for other events the average is used."
    @note_zh = "对每个项目，展示前 3 名成绩之和最低的轮次。盲拧项目使用单次成绩，其他项目使用平均成绩。"
    @table_header = { "Competition" => :left, "Round" => :left, "Sum" => :right,
                      "1st" => :left, "Result" => :right, "2nd" => :left, "Result " => :right, "3rd" => :left, "Result  " => :right }
  end

  def query
    <<-SQL
      SELECT
        pivoted.event_id,
        competition.id comp_id,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, '/results/all#e', pivoted.event_id, '_', pivoted.round_type_id, ')') comp_link,
        round_type.cell_name round_name,
        first_id, first_name, first_result,
        second_id, second_name, second_result,
        third_id, third_name, third_result,
        first_result + second_result + third_result result_sum
      FROM (
        SELECT
          competition_id,
          round_type_id,
          event_id,
          MAX(CASE WHEN row_num = 1 THEN person_id END) first_id,
          MAX(CASE WHEN row_num = 1 THEN person_name END) first_name,
          MAX(CASE WHEN row_num = 1 THEN best_result END) first_result,
          MAX(CASE WHEN row_num = 2 THEN person_id END) second_id,
          MAX(CASE WHEN row_num = 2 THEN person_name END) second_name,
          MAX(CASE WHEN row_num = 2 THEN best_result END) second_result,
          MAX(CASE WHEN row_num = 3 THEN person_id END) third_id,
          MAX(CASE WHEN row_num = 3 THEN person_name END) third_name,
          MAX(CASE WHEN row_num = 3 THEN best_result END) third_result
        FROM (
          SELECT
            competition_id, round_type_id, person_id, person_name, event_id,
            CASE WHEN event_id IN ('333bf', '444bf', '555bf', '333mbf') THEN best ELSE average END best_result,
            ROW_NUMBER() OVER (
              PARTITION BY competition_id, round_type_id
              ORDER BY CASE WHEN event_id IN ('333bf', '444bf', '555bf', '333mbf') THEN best ELSE average END
            ) row_num
          FROM results
          WHERE event_id = '%s'
            AND (CASE WHEN event_id IN ('333bf', '444bf', '555bf', '333mbf') THEN best ELSE average END) > 0
        ) ranked
        GROUP BY competition_id, round_type_id
      ) pivoted
      JOIN competitions competition ON competition.id = pivoted.competition_id
      JOIN round_types round_type ON round_type.id = pivoted.round_type_id
      WHERE third_result IS NOT NULL
      ORDER BY result_sum
      LIMIT 10
    SQL
  end

  def transform(query_results)
    # NOTE: 333mbf 排序需要特殊处理——点数越高越好，需要降序
    # 其他项目按 result_sum 升序（SQL 中已处理）
    Events::ALL.map do |event_id, event_name|
      rows = query_results.select { |r| r["event_id"] == event_id }
      next [event_name, []] if rows.empty?

      # NOTE: 333mbf 需要单独查询并降序排序，因为 SQL 中统一用了 ASC
      if event_id == "333mbf"
        rows = run_mbf_query
      end

      results = rows.first(10).map do |row|
        # NOTE: 成绩格式化 — 盲拧用 :single，其他用 :average
        field = Events::BLD.key?(event_id) ? :single : :average
        first_st  = SolveTime.new(event_id, field, row["first_result"])
        second_st = SolveTime.new(event_id, field, row["second_result"])
        third_st  = SolveTime.new(event_id, field, row["third_result"])

        sum_display = if event_id == "333mbf"
          # NOTE: 多盲 sum = 三人各自的 points 之和
          p1 = SolveTime.new(event_id, :single, row["first_result"]).points
          p2 = SolveTime.new(event_id, :single, row["second_result"]).points
          p3 = SolveTime.new(event_id, :single, row["third_result"]).points
          (p1 + p2 + p3).to_s
        else
          SolveTime.centiseconds_to_clock_format(row["result_sum"])
        end

        first_link  = "[#{row['first_name']}](https://www.worldcubeassociation.org/persons/#{row['first_id']})"
        second_link = "[#{row['second_name']}](https://www.worldcubeassociation.org/persons/#{row['second_id']})"
        third_link  = "[#{row['third_name']}](https://www.worldcubeassociation.org/persons/#{row['third_id']})"

        [row["comp_link"], row["round_name"], sum_display,
         first_link, first_st.clock_format,
         second_link, second_st.clock_format,
         third_link, third_st.clock_format]
      end

      [event_name, results]
    end
  end

  private

  # NOTE: 333mbf 的 wca_value 编码特殊——值越小成绩越好（含解题数和时间），
  # 但"最佳轮次"要按 points 之和降序排列，所以需要单独查询
  def run_mbf_query
    mbf_sql = query % "333mbf"
    # HACK: 用子查询替换 ORDER BY，按 points 降序
    # 原 SQL 用 result_sum ASC，但 333mbf 的 wca_value 编码是反直觉的
    mbf_results = Database.client.query(mbf_sql)
    mbf_results.sort_by do |row|
      p1 = SolveTime.new("333mbf", :single, row["first_result"]).points
      p2 = SolveTime.new("333mbf", :single, row["second_result"]).points
      p3 = SolveTime.new("333mbf", :single, row["third_result"]).points
      -(p1 + p2 + p3)
    end
  end

  # NOTE: 覆盖父类的 query_results，逐项目执行查询
  def query_results
    all_results = []
    Events::ALL.each do |event_id, _|
      next if event_id == "333mbf"  # NOTE: 333mbf 在 transform 中单独处理
      sql = query % event_id
      Database.client.query(sql).each { |row| all_results << row }
    end
    all_results
  end
end
