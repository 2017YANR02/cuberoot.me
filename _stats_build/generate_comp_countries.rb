#!/usr/bin/env ruby
# NOTE: 生成前端国旗功能需要的两个 JSON 映射文件:
# 1. comp_countries.json: competition_id → country_id
# 2. person_countries.json: wca_id → iso2（仅含 stats 页面出现的选手）

require_relative 'core/database'
require 'json'

STATS_DIR = File.expand_path("../stats", __dir__)

# ── 1. 比赛 → 国家 ──
puts "Querying competition countries..."
comp_path = File.join(STATS_DIR, "comp_countries.json")
rows = Database.client.query("SELECT id, country_id FROM Competitions")
# NOTE: 直接用 country_id（如 "USA"、"China"）作为值
# 前端 _countryIso2 映射已覆盖 country.name 和 country_id 两种格式
comp_map = {}
rows.each { |r| comp_map[r["id"]] = r["country_id"] }
File.write(comp_path, JSON.generate(comp_map))
puts "  #{comp_path} (#{comp_map.size} competitions, #{File.size(comp_path)} bytes)"

# ── 2. 选手 → 国家（ISO2） ──
# NOTE: 只导出 stats 页面实际出现的选手，避免全量 28 万条导致文件过大
puts "Scanning stats markdown for person IDs..."
person_ids = Set.new
Dir.glob(File.join(STATS_DIR, "**", "*.md")).each do |md|
  File.read(md).scan(%r{/persons/([A-Z0-9]+)\)}) { |m| person_ids.add(m[0]) }
end
puts "  Found #{person_ids.size} unique person IDs"

# 构建 country_id → iso2 查找表
iso_map = {}
Database.client.query("SELECT id, iso2 FROM countries").each { |r| iso_map[r["id"]] = r["iso2"].downcase }

# 分批查询（MySQL IN 子句有长度限制）
person_path = File.join(STATS_DIR, "person_countries.json")
person_map = {}
person_ids.each_slice(500) do |batch|
  placeholders = batch.map { |id| "'#{id}'" }.join(",")
  Database.client.query("SELECT wca_id, country_id FROM persons WHERE sub_id=1 AND wca_id IN (#{placeholders})").each do |r|
    person_map[r["wca_id"]] = iso_map[r["country_id"]] || r["country_id"]
  end
end
File.write(person_path, JSON.generate(person_map))
puts "  #{person_path} (#{person_map.size} persons, #{File.size(person_path)} bytes)"
