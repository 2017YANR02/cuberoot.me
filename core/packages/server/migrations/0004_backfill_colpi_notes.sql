-- 0004_backfill_colpi_notes.sql
-- 含 CJK 的词里把括号(全/半角)内容搬到 note 列,word 去掉括号 + 折叠空白。
-- 例: word='苹果（APPLE）' → word='苹果', note='APPLE'
-- 仅按 CJK 字符过滤(语言标签不可靠;ja/en 也可能含 CJK)。
UPDATE colpi_words
SET
  note = (regexp_match(word, '[（(]([^（()）]+)[）)]'))[1],
  word = trim(regexp_replace(regexp_replace(word, '\s*[（(][^（()）]+[）)]\s*', ' ', 'g'), '\s+', ' ', 'g'))
WHERE word ~ '[一-鿿]' AND word ~ '[（(][^（()）]+[）)]';
