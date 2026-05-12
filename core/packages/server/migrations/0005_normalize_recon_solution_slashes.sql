-- 0005_normalize_recon_solution_slashes.sql
-- 规范化 recons.solution 里的 `//` 注释标记:每行第一个 `//` 前后各恰好一个空格。
-- 规则(对应 client 端 normalizeSolutionSlashes()):
--   `R//x`        → `R // x`     -- 无空格 → 加
--   `R  //  x`    → `R // x`     -- 多空格 → 收缩
--   `R // x`     → `R // x`     -- 已规范 → 不变
--   `// comment` → `// comment` -- 行首注释保持无前导空格,trailing 收单空格
-- 实现:两步 regexp_replace,先行首再行中。
--   行首:m 模式下 `^[ \t]*//[ \t]*` → `// `
--   行中:`(\S)[ \t]*//[ \t]*`      → `\1 // ` (捕获前一字符确保非空白,放回)
-- 注:PG regexp 'g' 全局替换;'m' multi-line 让 ^ 匹配每行行首。
UPDATE recons
SET solution = regexp_replace(
  regexp_replace(solution, '^[ \t]*//[ \t]*', '// ', 'gm'),
  '(\S)[ \t]*//[ \t]*', '\1 // ', 'g'
)
WHERE solution LIKE '%//%';
