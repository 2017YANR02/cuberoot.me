# NOTE: NWR (Newcomer World Record) = 选手首场比赛的最佳 single/average
# 与 WR history 系列不同，这里按选手分组而非按项目
require_relative "../core/statistic"
require_relative "../core/events"
require_relative "../core/solve_time"

class WrNewcomer < Statistic
  def initialize
    @title = "Best first competition results (Newcomer World Records)"
    @title_zh = "最佳首次参赛成绩（新人世界纪录）"
    @note = "Shows the best single achieved by a person in their very first 3x3 competition."
    @note_zh = "展示选手在首次三阶比赛中取得的最佳单次成绩。"
    @table_header = { "#" => :right, "Single" => :right, "Person" => :left, "Competition" => :left, "Date" => :left }
  end

  def query
    <<-SQL
      SELECT
        MIN(r.best) AS first_comp_single,
        CONCAT('[', p.name, '](https://www.worldcubeassociation.org/persons/', p.wca_id, ')') person_link,
        CONCAT('[', c.cell_name, '](https://www.worldcubeassociation.org/competitions/', c.id, ')') competition_link,
        c.start_date,
        p.wca_id
      FROM results r
      JOIN persons p ON p.wca_id = r.person_id AND p.sub_id = 1
      JOIN competitions c ON c.id = r.competition_id
      JOIN (
        -- 子查询：找到每个选手的首场比赛日期
        SELECT r2.person_id, MIN(c2.start_date) AS earliest_date
        FROM results r2
        JOIN competitions c2 ON c2.id = r2.competition_id
        WHERE r2.event_id = '333'
        GROUP BY r2.person_id
      ) fc ON fc.person_id = r.person_id AND c.start_date = fc.earliest_date
      WHERE r.event_id = '333' AND r.best > 0
      GROUP BY p.wca_id, p.name, c.cell_name, c.id, c.start_date
      ORDER BY first_comp_single
      LIMIT 100
    SQL
  end

  def transform(query_results)
    query_results.each_with_index.map do |r, i|
      single_str = SolveTime.new("333", :single, r["first_comp_single"]).clock_format
      date_str = r["start_date"].strftime("%Y-%m-%d")
      [i + 1, single_str, r["person_link"], r["competition_link"], date_str]
    end
  end
end
