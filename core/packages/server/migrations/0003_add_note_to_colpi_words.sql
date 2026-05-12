-- 0003_add_note_to_colpi_words.sql
-- 为 colpi_words 加 note 列(用户解释为什么 word 能和 pair 对应,e.g. word=苹果 note=APPLE)。
ALTER TABLE colpi_words ADD COLUMN note TEXT;
