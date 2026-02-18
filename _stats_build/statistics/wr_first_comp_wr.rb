# NOTE: 1stWR = 选手在首场比赛第一轮就创造的 WR single
# 只看 round_type_id 为 '1', '0', 'd' 的第一轮结果
require_relative "../core/statistic"
require_relative "../core/events"
require_relative "../core/solve_time"

class WrFirstCompWr < Statistic
  def initialize
    @title = "World records set in a person's first competition"
    @note = "People who set a 3x3 World Record in their very first WCA competition."
    @table_header = { "#" => :right, "Single" => :right, "Person" => :left, "Competition" => :left, "Date" => :left }
  end

  def query
    <<-SQL
      SELECT
        r.best AS first_single,
        r.regional_single_record,
        CONCAT('[', p.name, '](https://www.worldcubeassociation.org/persons/', p.wca_id, ')') person_link,
        CONCAT('[', c.cell_name, '](https://www.worldcubeassociation.org/competitions/', c.id, ')') competition_link,
        c.start_date,
        p.wca_id
      FROM results r
      JOIN persons p ON p.wca_id = r.person_id AND p.sub_id = 1
      JOIN competitions c ON c.id = r.competition_id
      JOIN (
        SELECT r2.person_id, MIN(c2.start_date) AS earliest_date
        FROM results r2
        JOIN competitions c2 ON c2.id = r2.competition_id
        WHERE r2.event_id = '333'
        GROUP BY r2.person_id
      ) fc ON fc.person_id = r.person_id AND c.start_date = fc.earliest_date
      WHERE r.event_id = '333'
        AND r.best > 0
        AND r.regional_single_record = 'WR'
      ORDER BY r.best
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
