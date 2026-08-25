-- 非 WCA 复盘的比赛城市(自由文本)。WCA 比赛城市仍由 comp_wca_id 解析,不入库。
ALTER TABLE recons ADD COLUMN IF NOT EXISTS city VARCHAR(100);
