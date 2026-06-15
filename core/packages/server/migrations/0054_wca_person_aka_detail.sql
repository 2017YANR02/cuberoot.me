-- 选手详情页 hero「曾经是 X - 国家」展示用:每个历史身份(sub_id>1)的 名字 + 当时国家 iso2。
-- 与 former_names 口径不同,故另存一列:
--   former_names(0053):只「名字」去重(剔与现名相同),给名录聚合 / 长度排序;
--   former_detail(本迁移):[{name, iso2}],含纯改国籍(名同国不同),忠实对齐 WCA 官网展示。
-- 由 stats-build/gen_person_aka.ts 一并生成、psql 灌(near-static)。
ALTER TABLE wca_person_aka ADD COLUMN IF NOT EXISTS former_detail JSONB;
