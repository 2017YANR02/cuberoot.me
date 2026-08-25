-- sor_player_best: 支持「所有并列最优组合」.
-- best_events 改为 ';' 分隔的多组合列表(每组合内部仍逗号分隔 event id,服务端封顶 KEEP 个,项目数最少优先);
-- combo_count = 在 best_rank 上并列的全部子集数(可能远大于列出的组合数). 历史行默认 1(单组合,无 ';').
-- 表由 load_sor.sql 手动管道创建/灌库(不在 schema.pg.sql),这里只补列,IF NOT EXISTS 幂等.
ALTER TABLE sor_player_best ADD COLUMN IF NOT EXISTS combo_count INTEGER NOT NULL DEFAULT 1;
