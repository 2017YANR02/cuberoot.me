-- 作者可隐藏自己的老师或机构资料；公开接口不再返回隐藏条目。
ALTER TABLE teacher_directory_entries
  ADD COLUMN is_visible BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE teacher_directory_entries
SET is_visible = FALSE
WHERE id = 1
  AND owner_key = '2017YANR02'
  AND wca_id = '2017YANR02'
  AND name_zh = '颜瑞民';
