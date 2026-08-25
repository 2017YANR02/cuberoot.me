-- 星标和「不熟」表达重复，退役星标维度；纯星标旧记录无需保留。
DELETE FROM alg_case_marks WHERE status IS NULL;

ALTER TABLE alg_case_marks
  ALTER COLUMN status SET NOT NULL,
  DROP COLUMN starred;
