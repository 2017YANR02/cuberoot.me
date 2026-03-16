#!/usr/bin/env ruby

require 'tmpdir'
require 'fileutils'
require 'time'
require_relative "helpers"
require_relative "../core/database"

Dir.mktmpdir do |tmp_direcory|
  FileUtils.cd tmp_direcory do
    database_export_url = "https://www.worldcubeassociation.org/wst/wca-developer-database-dump.zip"
    zip_filename = "wca-developer-database-dump.zip"
    filename = "wca-developer-database-dump.sql"
    config = Database::DATABASE_CONFIG
    mysql_with_credentials = "mysql --user=#{config["username"]} --password=#{config["password"]}"
    filter_out_mysql_warning = '2>&1 | grep -v "[Warning] Using a password on the command line interface can be insecure."'

    Helpers.timed_task("Downloading #{database_export_url}") { `wget --quiet #{database_export_url}` }
    Helpers.timed_task("Unzipping #{zip_filename}") { `unzip #{zip_filename}` }
    # NOTE: CI 是一次性 MySQL 实例，导入前设置 InnoDB 高性能参数即可，无需恢复。
    # 与本地 import_wca_database.ps1 相同的优化策略（DRY 原则）。
    # 这些参数同时加速后续的导入、索引创建等所有写入操作。
    Helpers.timed_task("Setting MySQL performance parameters") do
      [
        "SET GLOBAL innodb_flush_log_at_trx_commit = 0",
        "SET GLOBAL innodb_buffer_pool_size = 2147483648",  # 2GB（CI runner 7GB RAM）
        "SET GLOBAL innodb_log_buffer_size = 268435456",    # 256MB
        "SET GLOBAL innodb_io_capacity = 10000",
        "SET GLOBAL innodb_io_capacity_max = 20000",
      ].each do |sql|
        `#{mysql_with_credentials} -e "#{sql}" #{filter_out_mysql_warning}`
      end
      # NOTE: DISABLE REDO_LOG 大幅加速批量写入（崩溃时需重新导入，CI 可接受）
      `#{mysql_with_credentials} -e "ALTER INSTANCE DISABLE INNODB REDO_LOG" #{filter_out_mysql_warning}`
    end

    Helpers.timed_task("Importing #{filename} into #{config["database"]}") do
      `#{mysql_with_credentials} -e "DROP DATABASE IF EXISTS #{config["database"]}" #{filter_out_mysql_warning}`
      `#{mysql_with_credentials} -e "CREATE DATABASE #{config["database"]}" #{filter_out_mysql_warning}`

      table_sqls = {}

      # The export file is gigabytes in size, so we don't want to operate
      # on the whole contents in the memory. Instead, we read it line by
      # line and effectively build exports for individual tables, only
      # the ones we care about.
      File.open(filename, "r") do |file|
        lines = []
        header = nil
        current_table_name = nil

        # The export comes from MariaDB and the first line is
        #
        #   /*!999999\- enable the sandbox mode */
        #
        # MySQL does not recognise this command, so we always skip this
        # line. See https://mariadb.org/mariadb-dump-file-compatibility-change
        file.readline

        until file.eof? do
          line = file.readline

          table_begin_match = line.match(/-- Table structure for table `(.*?)`/)

          if table_begin_match
            table_name = table_begin_match[1]

            if header.nil?
              header = lines.join("\n")
            elsif current_table_name
              table_sqls[current_table_name] = header + "\n" + lines.join("\n")
              current_table_name = nil
            end

            if Database::REQUIRED_TABLES.include?(table_name)
              current_table_name = table_name
            end

            lines = []
          end

          lines.push(line)
        end
      end

      Database::REQUIRED_TABLES.each do |table_name|
        puts "  - Importing table #{table_name}"
        table_sql = table_sqls[table_name]
        # Get rid of indexes within the table definition in favour of index creations after all the INSERT statements.
        index_creations = ""
        table_sql.gsub!(/,\s*KEY (.\w+.) (\([^)]*\))/m) do
          index_creations += "CREATE INDEX #{$1} ON #{table_name} #{$2};\n"
          ""
        end
        table_sql += index_creations
        # Custom indices.
        table_sql += Database::INDICES.join("\n")
        table_filename = "#{table_name}.sql"
        File.write(table_filename, table_sql)
        `#{mysql_with_credentials} #{config["database"]} < #{table_filename} #{filter_out_mysql_warning}`
      end
    end

    # NOTE: WCA 在 2026 年初将 value1-5 从 results 表拆分到 result_attempts 表。
    #       添加覆盖索引 (result_id, attempt_number, value)，
    #       让所有 GROUP_CONCAT / JOIN 走 index-only scan，无需回表。
    #       临时关闭 InnoDB 刷盘同步加速建索引。
    Helpers.timed_task("Creating covering index on result_attempts") do
      `#{mysql_with_credentials} #{config["database"]} -e "CREATE INDEX idx_ra_covering ON result_attempts(result_id, attempt_number, value)" #{filter_out_mysql_warning}`
    end

    # Store the export timestamp
    export_timestamp = File.mtime(filename)
    store_metadata_sql = "CREATE TABLE wca_statistics_metadata (field varchar(255), value varchar(255)); INSERT INTO wca_statistics_metadata (field, value) VALUES ('export_timestamp', '#{export_timestamp.iso8601}')"
    `#{mysql_with_credentials} #{config["database"]} -e "#{store_metadata_sql}" #{filter_out_mysql_warning}`
  end
end
