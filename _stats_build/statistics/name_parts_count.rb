require_relative "../core/statistic"

class NamePartsCount < Statistic
  def initialize
    @title = "Name parts count"
    @note = "Local names within parentheses are ignored."
    @table_header = { "Parts" => :center, "People" => :right, "Countries of origin" => :left }
  end

  def query
    <<-SQL
      SELECT
        person.name name,
        country.name country_name
      FROM persons person
      JOIN countries country ON country.id = country_id
      WHERE sub_id = 1
    SQL
  end

  def transform(query_results)
    query_results
      .group_by { |person| person["name"].gsub(/ \(.*\)/, '').split(' ').count }
      .map do |parts_count, people|
        countries = people
          .map { |person| person["country_name"] }
          .group_by(&:itself)
          .map { |country, array| [country, array.length] }
          .sort_by! { |country, people_from_this_country_count| -people_from_this_country_count }
          .first(5)
          .map! do |country, people_from_this_country_count|
            percent = "%0.2f" % (people_from_this_country_count.to_f / people.count * 100)
            "#{country} *(#{percent} %)*"
          end
          .join(', ')
        [parts_count, people.count, countries]
      end
      .sort_by!(&:first)
  end
end
