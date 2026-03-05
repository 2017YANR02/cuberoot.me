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
  # NOTE: 同时匹配 Markdown 格式 /persons/ID) 和 HTML 格式 /persons/ID"
  File.read(md).scan(%r{/persons/([A-Z0-9]+)[)"]}) { |m| person_ids.add(m[0]) }
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

# ── 3. 比赛展示名 → ISO2（recon 页面用） ──
# NOTE: recon 页面的比赛数据来自 CSV，可能使用 name（完整名）或 cell_name（短名）。
# 例如 name="Rubik's x TheCubicle CubingUSA All-Stars 2025" 但 cell_name="CubingUSA All-Stars 2025"。
# 同时写入两种 key 确保都能匹配。
puts "Generating comp name → iso2 mapping..."
comp_name_path = File.join(STATS_DIR, "comp_name_countries.json")
comp_name_map = {}
Database.client.query(<<-SQL).each do |r|
  SELECT c.name, c.cell_name, co.iso2
  FROM competitions c
  JOIN countries co ON co.id = c.country_id
SQL
  iso2 = r["iso2"].downcase
  comp_name_map[r["cell_name"]] = iso2
  # NOTE: name 与 cell_name 不同时，额外写入 name 作为 key
  comp_name_map[r["name"]] = iso2 if r["name"] != r["cell_name"]
end
File.write(comp_name_path, JSON.generate(comp_name_map))
puts "  #{comp_name_path} (#{comp_name_map.size} entries, #{File.size(comp_name_path)} bytes)"

# ── 4. 选手展示名 → ISO2（recon 页面用） ──
# NOTE: recon 页面的选手数据来自 CSV（只有展示名），需要通过 persons.name 查国家
# 同名选手可能来自不同国家，取 sub_id=1（当前有效记录）
puts "Generating person name → iso2 mapping..."
person_name_path = File.join(STATS_DIR, "person_name_countries.json")
person_name_map = {}
Database.client.query(<<-SQL).each do |r|
  SELECT p.name, co.iso2
  FROM persons p
  JOIN countries co ON co.id = p.country_id
  WHERE p.sub_id = 1
SQL
  # NOTE: 同名选手保留第一个匹配（绝大多数情况名字唯一）
  person_name_map[r["name"]] ||= r["iso2"].downcase
end
File.write(person_name_path, JSON.generate(person_name_map))
puts "  #{person_name_path} (#{person_name_map.size} persons, #{File.size(person_name_path)} bytes)"

# ── 5. 比赛展示名 → 日期（recon 页面用） ──
# NOTE: recon 页面的日期优先使用 WCA 数据库中的 start_date，而非 CSV 手动输入
puts "Generating comp name → date mapping..."
comp_dates_path = File.join(STATS_DIR, "comp_dates.json")
comp_dates_map = {}
Database.client.query("SELECT cell_name, start_date FROM Competitions").each do |r|
  comp_dates_map[r["cell_name"]] = r["start_date"].strftime("%Y-%m-%d")
end
File.write(comp_dates_path, JSON.generate(comp_dates_map))
puts "  #{comp_dates_path} (#{comp_dates_map.size} competitions, #{File.size(comp_dates_path)} bytes)"

# ── 6. 比赛展示名 → WCA 比赛 ID（recon 页面用，点击比赛名跳转 WCA 页面） ──
# NOTE: 比赛名含特殊字符（变音符号等）时不能简单去空格推导 ID，必须查映射表
puts "Generating comp name → WCA ID mapping..."
comp_wca_ids_path = File.join(STATS_DIR, "comp_name_to_wca_id.json")
comp_wca_ids_map = {}
Database.client.query("SELECT id, name, cell_name FROM Competitions").each do |r|
  comp_wca_ids_map[r["cell_name"]] = r["id"]
  # NOTE: name 与 cell_name 不同时，额外写入 name 作为 key
  comp_wca_ids_map[r["name"]] = r["id"] if r["name"] != r["cell_name"]
end
File.write(comp_wca_ids_path, JSON.generate(comp_wca_ids_map))
puts "  #{comp_wca_ids_path} (#{comp_wca_ids_map.size} entries, #{File.size(comp_wca_ids_path)} bytes)"

# ── 7. Recon 专用精简映射（4 合 1，从 ~9.6MB 降到 ~30KB） ──
# NOTE: 从备份文件提取 recon 实际涉及的选手/比赛名，过滤出子集
# 合并 personCountries + compCountries + compWcaIds + compNamesZh 为一个文件
# 前端只需 1 次 fetch，替代原来的 4 次（共 ~9.6MB）
puts "Generating recon auxiliary data (subset)..."
recon_dir = File.expand_path("../recon", __dir__)
backup_path = File.join(recon_dir, "backup", "recons_backup.json")
comp_zh_path = File.join(recon_dir, "comp_names_zh.json")
aux_out_path = File.join(recon_dir, "recon_aux_data.json")

if File.exist?(backup_path)
  backup = JSON.parse(File.read(backup_path))
  # 提取所有 unique person 和 comp
  persons = backup.map { |s| s["person"] }.compact.uniq
  comps = backup.map { |s| s["comp"] }.compact.uniq
  puts "  Recon uses #{persons.size} unique persons, #{comps.size} unique comps"

  # 从步骤 3/4/6 的内存映射中过滤子集
  sub_person_countries = {}
  persons.each { |p| sub_person_countries[p] = person_name_map[p] if person_name_map[p] }

  sub_comp_countries = {}
  comps.each { |c| sub_comp_countries[c] = comp_name_map[c] if comp_name_map[c] }

  sub_comp_wca_ids = {}
  comps.each { |c| sub_comp_wca_ids[c] = comp_wca_ids_map[c] if comp_wca_ids_map[c] }

  # comp_names_zh 由 Python 脚本独立生成，从磁盘读取并过滤
  sub_comp_names_zh = {}
  if File.exist?(comp_zh_path)
    all_zh = JSON.parse(File.read(comp_zh_path))
    comps.each { |c| sub_comp_names_zh[c] = all_zh[c] if all_zh[c] }
  end

  aux_data = {
    "personCountries" => sub_person_countries,
    "compCountries" => sub_comp_countries,
    "compWcaIds" => sub_comp_wca_ids,
    "compNamesZh" => sub_comp_names_zh
  }
  File.write(aux_out_path, JSON.generate(aux_data))
  puts "  #{aux_out_path} (#{File.size(aux_out_path)} bytes)"
  puts "  Subset sizes: #{sub_person_countries.size} persons, #{sub_comp_countries.size} comp countries, " \
       "#{sub_comp_wca_ids.size} comp WCA IDs, #{sub_comp_names_zh.size} comp zh names"
else
  puts "  SKIP: #{backup_path} not found (run backup CI first)"
end
