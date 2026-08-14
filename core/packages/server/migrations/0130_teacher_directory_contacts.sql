-- 将单一联系方式扩展为按平台存储的多种公开联系方式，并保留旧数据。
ALTER TABLE teacher_directory_entries
  ADD COLUMN contacts JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE teacher_directory_entries
SET contacts = jsonb_build_object('other', contact)
WHERE contact <> '';

ALTER TABLE teacher_directory_entries
  ADD CHECK (jsonb_typeof(contacts) = 'object');
