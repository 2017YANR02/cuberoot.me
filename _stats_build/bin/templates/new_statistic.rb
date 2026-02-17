require_relative "../core/statistic"

class <<<CLASS_NAME>>> < Statistic
  def initialize
    @title = "Title"
    @note = "Optional note"
    @table_header = {  }
  end

  def query
    <<-SQL
      -- SQL query
    SQL
  end

  def transform(query_results)
    # Optional data transformation in ruby
  end
end
