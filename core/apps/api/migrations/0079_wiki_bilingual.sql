-- 0079_wiki_bilingual.sql
-- wiki 词条从「中英混排单字段」升级为结构化双语:head/body 各拆出 en/zh 两列。
-- 原 head/body 保留(combined,继续供搜索/slug/兜底);新列 nullable:
--   - seed 词条由 0080 从原 head/body 自动拆分回填
--   - 新建/编辑词条前端直接写这四列(head/body 由后端拼 combined 兜底)
-- 显示为「中英对照」:两列都在时并排显示,缺一语用另一语兜底。

ALTER TABLE wiki_terms ADD COLUMN head_en TEXT;
ALTER TABLE wiki_terms ADD COLUMN head_zh TEXT;
ALTER TABLE wiki_terms ADD COLUMN body_en TEXT;
ALTER TABLE wiki_terms ADD COLUMN body_zh TEXT;
