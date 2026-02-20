# NOTE: 1stWR = 首场比赛第一轮第一次还原 (value1) 的排名
# 逻辑来源: WCA-Statistics/1stWR.sql
# 与 wr_newcomer.rb 的区别:
#   - wr_newcomer: 取首场比赛所有轮次的 MIN(best)（最佳单次）
#   - wr_1st_wr:   取首场比赛第一轮的 value1（字面意义上的第一次还原）
#   - 当首场比赛无第一轮数据时，回退到决赛轮
require_relative "../core/statistic"
require_relative "../core/events"
require_relative "../core/solve_time"

class Wr1stWr < Statistic
  def initialize
    @title = "First solve in first competition"
    @note = "The very first official 3x3 solve (value1 of round 1) in a person's first competition."
    @table_header = { "#" => :right, "Single" => :right, "Person" => :left, "Competition" => :left, "Date" => :left }
  end

  def query
    <<-SQL
      SELECT
        fr.value1 AS first_single,
        CONCAT('[', p.name, '](https://www.worldcubeassociation.org/persons/', p.wca_id, ')') person_link,
        CONCAT('[', c.cell_name, '](https://www.worldcubeassociation.org/competitions/', c.id, ')') competition_link,
        c.start_date
      FROM (
        -- NOTE: 优先取第一轮 (round_type_id IN ('1','0','d'))，无则回退到决赛轮
        SELECT r1.person_id, r1.value1, r1.competition_id,
               ROW_NUMBER() OVER (PARTITION BY r1.person_id ORDER BY
                 CASE WHEN r1.round_type_id IN ('1','0','d') THEN 0 ELSE 1 END
               ) AS rn
        FROM results r1
        JOIN competitions c1 ON c1.id = r1.competition_id
        JOIN (
          -- 子查询: 每个选手的首场 333 比赛日期
          SELECT r2.person_id, MIN(c2.start_date) AS earliest_date
          FROM results r2
          JOIN competitions c2 ON c2.id = r2.competition_id
          WHERE r2.event_id = '333'
          GROUP BY r2.person_id
        ) fc ON fc.person_id = r1.person_id AND c1.start_date = fc.earliest_date
        WHERE r1.event_id = '333'
          AND r1.value1 > 0
      ) fr
      JOIN persons p ON p.wca_id = fr.person_id AND p.sub_id = 1
      JOIN competitions c ON c.id = fr.competition_id
      WHERE fr.rn = 1
      ORDER BY fr.value1
      LIMIT 100
    SQL
  end

  def transform(query_results)
    query_results.each_with_index.map do |r, i|
      single_str = SolveTime.new("333", :single, r["first_single"]).clock_format
      date_str = r["start_date"].strftime("%Y-%m-%d")
      [i + 1, single_str, r["person_link"], r["competition_link"], date_str]
    end
  end
end
