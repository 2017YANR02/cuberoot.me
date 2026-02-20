require_relative "../core/statistic"

class LongestCompetitionsPath < Statistic
  def initialize
    @title = "Longest competitions path"
    @note = "Calculated as the sum of direct distance between subsequent competitions."
    @table_header = { "Person" => :left, "Distance" => :right }
  end

  def query
    <<-SQL
      SELECT
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        RADIANS(latitude / 1000000) latitude_radians,
        RADIANS(longitude / 1000000) longitude_radians
      FROM (
        SELECT DISTINCT person_id, competition_id
        FROM results
      ) AS people_with_competitions
      JOIN persons person ON person.wca_id = person_id AND sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      WHERE competition.country_id -- Ignore Multiple Countries used for continental FMC competitions.
        NOT IN ('XA', 'XE', 'XF', 'XM', 'XN', 'XO', 'XS', 'XW')
      ORDER BY competition.start_date, competition.end_date
    SQL
  end

  def transform(query_results)
    query_results
      .group_by { |result| result["person_link"] }
      .map do |person_link, results|
        distance_km = results
          .map { |result| [result["latitude_radians"], result["longitude_radians"]] }
          .each_cons(2).map { |previous_coords, next_coords| distance_km(*previous_coords, *next_coords) }
          .sum
        [person_link, distance_km.round]
      end
      .sort_by! { |person_link, distance_km| -distance_km }
      .map! do |person_link, distance_km|
        [person_link, distance_km.to_s.gsub(/(\d)(?=\d{3}+$)/, '\1 ') + " km"]
      end
      .first(1000)
  end
end

# See http://www.movable-type.co.uk/scripts/latlong.html
def distance_km(lat1, lon1, lat2, lon2) # All in radians
  r = 6371 # km
  d_lat = lat2 - lat1
  d_lon = lon2 - lon1

  a = Math.sin(d_lat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(d_lon / 2) ** 2
  c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  d = r * c
end
