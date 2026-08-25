-- 0084_contributor_contributions.sql — 给 /support 贡献者加「每次贡献的内容」明细。
-- contributions = JSONB 数组,每项 { zh, en, date? }(zh/en 至少填一个,date 可选)。
-- score 仍是总贡献次数(与明细条数解耦,admin 点数字 +1 不必带明细)。公开页展示明细。
ALTER TABLE contributors ADD COLUMN contributions JSONB NOT NULL DEFAULT '[]'::jsonb;
