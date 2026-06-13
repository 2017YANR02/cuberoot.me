-- cn_comp_zh 增加 cubing.com 中文比赛名(原始全名,如 2026WCA湛江魔方公开赛)。
-- 比赛详情页中文标题原走 comp_names_zh.json(日更),当天刚公示的 CN 比赛要等近 24h 才有中文名。
-- 复用已在抓的 cubing.com 详情页(地点同源),顺手取 h1 标题,详情页即时拿到中文名。
ALTER TABLE cn_comp_zh ADD COLUMN name_zh TEXT;
