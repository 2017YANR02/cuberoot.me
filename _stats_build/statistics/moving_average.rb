require_relative "../core/grouped_statistic"
require_relative "../core/events"
require_relative "../core/solve_time"

class MovingAverage < GroupedStatistic
  def initialize
    @title = "Moving average"
    @note = <<-NOTE
      You may think of it as "how well the given person has been doing recently".
      This computes exponentially moving average (EMA) of competitor averages.
      EMA is a weighted average, with weights decreasing exponentially,
      meaning that more recent values contribute more to the computed average.
      Here we use α = 0.8, meaning that the average emphasizes last ~5 results
      (weight of results older than 5 is around 1/3 in total and decreases quickly for particular results).
      People with less than 5 averages are ignored (as there's not much data to base on).
    NOTE
    .strip
    @table_header = { "Moving average" => :right, "Person" => :left }
  end

  def query
    <<-SQL
      SELECT
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        event_id,
        average
      FROM results result
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      JOIN round_types round_type ON round_type.id = round_type_id
      WHERE average > 0 AND event_id NOT IN ('333bf', '333mbf', '333mbo', '444bf', '555bf')
      ORDER BY competition.start_date, round_type.rank
    SQL
  end

  def transform(query_results)
    Events::ALL.map do |event_id, event_name|
      results = query_results
        .select { |result| result["event_id"] == event_id }
        .group_by { |result| result["person_link"] }
        .select { |person_link, results| results.length >= 5 } # Arbitrarily remove people with less than 5 averages, as there is not enough data to base on.
        .map do |person_link, results|
          average = moving_average(results.map { |result| result["average"] })
          [average, person_link]
        end
        .sort_by! { |average, person_link| average }
        .first(50)
        .map do |average, person_link|
          solve_time = SolveTime.new(event_id, :average, average)
          [solve_time.clock_format, person_link]
        end
      [event_name, results]
    end
  end

  # Exponentially weighted average with bias correction.
  def moving_average(numbers)
    alpha = 0.8
    average = numbers.reduce(0) do |average, number|
      average * alpha + (1 - alpha) * number
    end
    corrected = average / (1 - alpha ** numbers.length) # Apply bias correction.
    corrected.round
  end
end
