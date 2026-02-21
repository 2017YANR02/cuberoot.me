# NOTE: AverageOfX -- "Ao100" / "Ao1000" etc.
# Computes: a person's best trimmed-mean of @solve_count consecutive official solves.
#
# Algorithm: sliding window.
# 1. For each person, line up ALL their value1-5 in chronological order.
# 2. Slide a window of length @solve_count across this sequence.
# 3. At every position compute the trimmed mean (5% trimmed each side).
# 4. Keep the best (lowest) one as the person's result.
#
# Data scope: per-event top-N average globally (SQL CASE WHEN filter).
require_relative "../../core/grouped_statistic"
require_relative "../../core/events"
require_relative "../../core/solve_time"

class AverageOfX < GroupedStatistic
  # NOTE: 各项目的候选选手筛选范围（世界平均排名前 N）
  # 333 top-15，主流项目 top-30，特殊项目 top-300，333bf top-2000
  TOP_N_BY_EVENT = {
    "333" => 15,
    "222" => 30, "444" => 30, "555" => 30,
    "666" => 30, "777" => 30, "333ft" => 30, "skewb" => 30,
    "sq1" => 30, "333oh" => 30, "minx" => 30,
    "333fm" => 300, "pyram" => 300, "clock" => 300,
    "444bf" => 300, "555bf" => 300, "magic" => 300, "mmagic" => 300,
    "333bf" => 2000,
  }.freeze

  DEFAULT_TOP_N = 30

  def initialize(solve_count:)
    @solve_count = solve_count

    @title = "Average of #{@solve_count}"

    @note = "#{@solve_count} consecutive official attempts are considered. " \
            "Top N varies by event: 333 top 15, most events top 30, " \
            "333fm/pyram/clock/444bf/555bf/magic/mmagic top 300, " \
            "333bf top 2000."
    @table_header = { "Ao#{@solve_count}" => :right, "Person" => :left, "Times" => :left }
  end

  # NOTE: class-level cache -- all subclasses (Ao100, Ao1000 ...) share one query result
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
            RANK() OVER (PARTITION BY r.event_id ORDER BY MIN(r.average)) AS global_rank
          FROM results r
          WHERE r.average > 0
          GROUP BY r.event_id, r.person_id
        ) ranked
        WHERE global_rank <= CASE ranked.event_id
          WHEN '333' THEN 15
          WHEN '333fm' THEN 300
          WHEN 'pyram' THEN 300
          WHEN 'clock' THEN 300
          WHEN '444bf' THEN 300
          WHEN '555bf' THEN 300
          WHEN 'magic' THEN 300
          WHEN 'mmagic' THEN 300
          WHEN '333bf' THEN 2000
          ELSE 30
        END
      ) top_avg ON top_avg.event_id = result.event_id AND top_avg.person_id = result.person_id
      WHERE result.event_id NOT IN ('333mbf', '333mbo')
      ORDER BY competition.start_date, round_type.rank
    SQL
  end

  # NOTE: sliding window -- find each person's best AoX across their career
  #
  # For each person:
  #   flatten all value1..5 into a 1-D timeline
  #   slide a window of @solve_count across it
  #   at each full window: compute trimmed mean, keep best
  #   result: one best_aox per person, then take top 10
  def transform(query_results)
    Events::ALL.map do |event_id, event_name|
      results = query_results
        .select { |result| result["event_id"] == event_id }
        .group_by { |result| result["person_link"] }
        .map do |person_link, results|
          # last_x_solves: sliding window buffer
          # best_aox: best average found so far for this person
          data = { last_x_solves: [], best_aox: SolveTime::DNF, best_aox_solves: [] }
          results
            .flat_map { |result| (1..5).map { |n| result["value#{n}"] } }
            .each do |value|
              next if value == SolveTime::SKIPPED_VALUE
              # NOTE: raw integers instead of SolveTime objects for performance
              # DNF/DNS (<= 0) mapped to Infinity so they sort last
              data[:last_x_solves] << (value > 0 ? value : Float::INFINITY)
              if data[:last_x_solves].length == @solve_count
                # NOTE: window is full -- compute average and check if it's a new best
                current_aox = average(data[:last_x_solves], event_id)
                if current_aox < data[:best_aox]
                  data[:best_aox] = current_aox
                  data[:best_aox_solves] = data[:last_x_solves].dup
                end
                # slide: pop left end, next iteration pushes right end
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

  # NOTE: Trimmed Mean (generalized WCA average)
  # WCA Ao5:   trim 1 per side (ceil(5*0.05) = 1)
  # Ao100:     trim 5 per side (ceil(100*0.05) = 5)
  # If any remaining solve is DNF (Infinity), the whole average is DNF.
  def average(solves, event_id)
    trimmed_per_side = (solves.length * 0.05).ceil
    untrimmed_solves = solves.sort.slice!(trimmed_per_side...-trimmed_per_side)
    return SolveTime::DNF if untrimmed_solves.last == Float::INFINITY
    values = untrimmed_solves
    mean_value = values.reduce(:+) / values.count.to_f
    # NOTE: FMC scores are in "moves" (integer); multiply by 100 to unify with centiseconds
    mean_value *= 100 if event_id == "333fm"
    SolveTime.new(event_id, :average, mean_value.round)
  end
end
