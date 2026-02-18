require_relative "../../core/grouped_statistic"
require_relative "../../core/events"
require_relative "../../core/solve_time"

class AverageOfX < GroupedStatistic
  def initialize(solve_count:)
    @solve_count = solve_count

    @title = "Average of #{@solve_count}"
    @note = "#{@solve_count} consecutive official attempts are considered. Only people from top 200 single are taken into account."
    @table_header = { "Ao#{@solve_count}" => :right, "Person" => :left, "Times" => :left }
  end

  # Cache result of the query as it's the same for each subclass
  def query_results
    @@query_results ||= super
  end

  def query
    # NOTE: WCA Developer Dump 不含 ranks_single 数据行，
    # 改用子查询从 results 表直接计算每个国家的 top-200 single 排名
    <<-SQL
      SELECT
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        result.event_id,
        value1, value2, value3, value4, value5
      FROM results result
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      JOIN round_types round_type ON round_type.id = round_type_id
      JOIN (
        SELECT event_id, person_id
        FROM (
          SELECT r.event_id, r.person_id,
            RANK() OVER (PARTITION BY r.event_id, p.country_id ORDER BY MIN(r.best)) AS country_rank
          FROM results r
          JOIN persons p ON p.wca_id = r.person_id AND p.sub_id = 1
          WHERE r.best > 0
          GROUP BY r.event_id, r.person_id, p.country_id
        ) ranked
        WHERE country_rank <= 200
      ) top_single ON top_single.event_id = result.event_id AND top_single.person_id = result.person_id
      WHERE result.event_id NOT IN ('333mbf', '333mbo')
      ORDER BY competition.start_date, round_type.rank
    SQL
  end

  def transform(query_results)
    Events::ALL.map do |event_id, event_name|
      results = query_results
        .select { |result| result["event_id"] == event_id }
        .group_by { |result| result["person_link"] }
        .map do |person_link, results|
          data = { last_x_solves: [], best_aox: SolveTime::DNF, best_aox_solves: [] }
          results
            .flat_map { |result| (1..5).map { |n| result["value#{n}"] } }
            .each do |value|
              next if value == SolveTime::SKIPPED_VALUE
              # Here we use raw values instead of SolveTime to improve the performance.
              data[:last_x_solves] << (value > 0 ? value : Float::INFINITY)
              if data[:last_x_solves].length == @solve_count
                current_aox = average(data[:last_x_solves], event_id)
                if current_aox < data[:best_aox]
                  data[:best_aox] = current_aox
                  data[:best_aox_solves] = data[:last_x_solves].dup
                end
                data[:last_x_solves].shift
              end
            end
          [person_link, data[:best_aox], data[:best_aox_solves]]
        end
        .reject { |person_link, best_aox, best_aox_solves| best_aox == SolveTime::DNF }
        .sort_by! { |person_link, best_aox, best_aox_solves| best_aox }
        .first(10)
        .map do |person_link, best_aox, best_aox_solves|
          solve_times = best_aox_solves.map do |solve|
            solve == Float::INFINITY ? SolveTime::DNF : SolveTime.new(event_id, :single, solve)
          end
          [best_aox.clock_format, person_link, solve_times.map(&:clock_format).join(', ')]
        end
      [event_name, results]
    end
  end

  def average(solves, event_id)
    trimmed_per_side = (solves.length * 0.05).ceil
    untrimmed_solves = solves.sort.slice!(trimmed_per_side...-trimmed_per_side)
    return SolveTime::DNF if untrimmed_solves.last == Float::INFINITY
    values = untrimmed_solves
    mean_value = values.reduce(:+) / values.count.to_f
    mean_value *= 100 if event_id == "333fm" # Unify values for FMC to fit others
    SolveTime.new(event_id, :average, mean_value.round)
  end
end
