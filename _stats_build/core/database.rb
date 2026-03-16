require 'bundler/setup'
require 'yaml'
require 'mysql2'

module Database
  DATABASE_CONFIG_PATH = File.expand_path("../database.yml", __dir__)
  DATABASE_CONFIG = YAML.load_file(DATABASE_CONFIG_PATH)
  DATABASE_CONFIG["init_command"] = "SET SESSION group_concat_max_len=4096;"
  REQUIRED_TABLES = %w(
    championships
    competitions
    competition_delegates
    continents
    countries
    events
    formats
    persons
    preferred_formats
    ranks_single
    ranks_average
    result_attempts
    results
    round_types
    users
  )
  INDICES = [
    "CREATE INDEX index_results_on_competition_id_person_id ON results (competition_id, person_id);",
  ]
  # NOTE: 统一的 GROUP_CONCAT 子查询，获取一个 result 的所有 attempt 值（逗号分隔）
  # 支持任意 attempt 数量（H2H 赛制可能有 21+ attempts）
  # 覆盖索引 (result_id, attempt_number, value) 保证 index-only scan
  # 调用方 SQL 中 results 表须用别名 result（项目惯例：FROM results result）
  ATTEMPTS_SUBQUERY = "(SELECT GROUP_CONCAT(ra.value ORDER BY ra.attempt_number) FROM result_attempts ra WHERE ra.result_id = result.id)"

  def self.client
    Mysql2::Client.new(DATABASE_CONFIG)
  end

  def self.metadata
    self.client
      .query("SELECT * FROM wca_statistics_metadata")
      .map { |row| [row["field"], row["value"]] }
      .to_h
  end
end
