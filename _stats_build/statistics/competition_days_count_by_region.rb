require_relative "../core/grouped_statistic"

class CompetitionDaysCountByRegion < GroupedStatistic
  def initialize
    @title = "Competition days count by region"
    @table_header = { "Days" => :right, "Region" => :left, "Competitions" => :right }
  end

  def query
    <<-SQL
      SELECT
        (DATEDIFF(end_date, start_date) + 1) days,
        country.name country,
        continent.name continent
      FROM competitions
      JOIN countries country ON country.id = country_id
      JOIN continents continent ON continent.id = continent_id
      WHERE country_id -- Ignore Multiple Countries used for continental FMC competitions.
        NOT IN ('XA', 'XE', 'XF', 'XM', 'XN', 'XO', 'XS', 'XW')
        AND continent_id != "_Multiple Continents"
    SQL
  end

  def transform(query_results)
    {
      "World" => ->(result) { "World" },
      "Continents" => ->(result) { result["continent"] },
      "Countries" => ->(result) { result["country"] }
    }.map do |header, grouping_function|
      results = query_results
        .group_by(&grouping_function)
        .map do |region, competitions|
          days = competitions.map { |competition| competition["days"] }
          days_mean = days.reduce(:+).to_f / competitions.count
          [days_mean, region, competitions.count]
        end
        .sort_by! { |days_mean, region, competitions_count| [-days_mean, region] }
        .map { |days_mean, region, competitions_count| ["%0.2f" % days_mean, region, competitions_count] }
      [header, results]
    end
  end
end
