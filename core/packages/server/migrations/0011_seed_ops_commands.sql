-- 0011_seed_ops_commands.sql — 初始 6 条 (从 OpsPage.tsx COMMANDS 数组迁过来)
-- 用 dollar-quote 避开单引号 / 反斜杠转义地狱.JSON 字段内的 \\ 是 JSON escape, 不是 SQL.

-- ── db: WCA dump refresh ──────────────────────────────────────────
INSERT INTO ops_commands (id, category, cwd, position, chips, title_zh, title_en, desc_zh, desc_en, cmd, variants) VALUES (
  'wca-dump-refresh',
  'db',
  'core/',
  0,
  $chips$[
    {"zh":"~25 min","en":"~25 min"},
    {"zh":"~10 GB 空闲","en":"~10 GB free"},
    {"zh":"mysql CLI","en":"mysql CLI"}
  ]$chips$::jsonb,
  $tzh$刷新本地 WCA 数据库$tzh$,
  $ten$Refresh local WCA database$ten$,
  $dzh$从 WCA 官方 dump (~2GB) 下载 + 解压 + drop wca_developer_database + 选择性导入 REQUIRED_TABLES + 建覆盖索引。脚本带行数 assertion,空表 (ranks_*) 自动跳过。$dzh$,
  $den$Download WCA official dump (~2GB) + extract + drop wca_developer_database + selectively import REQUIRED_TABLES + build covering indexes. Script has row-count assertion; legitimately-empty tables (ranks_*) skip the check.$den$,
  $cmd$pnpm --filter @cuberoot/stats-build exec tsx src/bin/update_database.ts$cmd$,
  $var$[
    {
      "zh": {"label":"已手动下好 .sql,跳下载","note":"指向已解压的 .sql 直接进 import 步,省 2GB 下载 + 解压时间"},
      "en": {"label":"Skip download if .sql already extracted","note":"Point to an existing .sql to jump straight to import, saving the 2GB download + unzip"},
      "cmd": "$env:WCA_DUMP_SQL_PATH = 'E:\\path\\to\\wca-developer-database-dump.sql'\npnpm --filter @cuberoot/stats-build exec tsx src/bin/update_database.ts"
    }
  ]$var$::jsonb
);

-- ── prompt: AFK 短任务 ────────────────────────────────────────────
INSERT INTO ops_commands (id, category, position, chips, title_zh, title_en, desc_zh, desc_en, cmd) VALUES (
  'prompt-afk-light',
  'prompt',
  0,
  $chips$[
    {"zh":"短任务","en":"short"},
    {"zh":"AFK","en":"AFK"},
    {"zh":"安全提交","en":"safe commit"}
  ]$chips$::jsonb,
  $tzh$暂离 · 已交底的短任务$tzh$,
  $ten$AFK · pre-briefed short task$ten$,
  $dzh$任务已说清,放手让 AI 跑;约束 commit 范围避免污染其他 agent 工作树。$dzh$,
  $den$Task fully specified — fire and forget. Constrains commit scope so other agents are not clobbered.$den$,
  $cmd$暂离,不待确认。完成后用 git add 指定路径只提交你改的文件 (不要 git add -A,避免误带其他 agent 改动);不 push。$cmd$
);

-- ── prompt: 实现 + 求专业表达 ─────────────────────────────────────
INSERT INTO ops_commands (id, category, position, chips, title_zh, title_en, desc_zh, desc_en, cmd) VALUES (
  'prompt-implement-and-meta',
  'prompt',
  1,
  $chips$[
    {"zh":"实现","en":"implement"},
    {"zh":"求专业表达","en":"request phrasing"}
  ]$chips$::jsonb,
  $tzh$实现 + 求一段更专业的描述$tzh$,
  $ten$Implement + request a professional restatement$ten$,
  $dzh$让 AI 边实现边产出一段适合贴进 issue / PR 的专业描述,顺带提升你自己的表达。$dzh$,
  $den$Have AI implement while also producing an issue/PR-grade restatement of the request, to upgrade your own phrasing.$den$,
  $cmd$实现以下需求 / 修以下 bug;同时产出一段更专业的描述 (适合 issue / PR)。$cmd$
);

-- ── prompt: AFK 完全自主长任务 ────────────────────────────────────
INSERT INTO ops_commands (id, category, position, chips, title_zh, title_en, desc_zh, desc_en, cmd) VALUES (
  'prompt-autonomous-long',
  'prompt',
  2,
  $chips$[
    {"zh":"长任务","en":"long"},
    {"zh":"多 agent","en":"multi-agent"},
    {"zh":"AFK","en":"AFK"},
    {"zh":"含占位","en":"has [fill]"}
  ]$chips$::jsonb,
  $tzh$暂离 · 完全自主长任务 (模板)$tzh$,
  $ten$AFK · fully autonomous long task (template)$ten$,
  $dzh$大型多步交付。把方括号占位换成本次具体目标 + 必须严格对齐的参考来源。$dzh$,
  $den$Large multi-step delivery. Fill the bracketed placeholder with the actual goal + reference source to match exactly.$den$,
  $cmd$[目标] <填:期望结果 + 必须严格对齐的参考来源 (如 speedcubedb 的公式库 / 自动填充 / 界面)>

全自主执行,不询问、不等待。可用工具:playwright、网络搜索、subagent、git clone。
鼓励并行多 agent 协作 (调查 / 实现 / review 分工)。
遇阻不硬攻;记录已完成范围 + 阻塞点。

完成后用 git add 指定路径只提交你改的文件 (不要 -A);不 push。$cmd$
);

-- ── prompt: 收尾审查 ──────────────────────────────────────────────
INSERT INTO ops_commands (id, category, position, chips, title_zh, title_en, desc_zh, desc_en, cmd) VALUES (
  'prompt-wrap-up',
  'prompt',
  3,
  $chips$[
    {"zh":"收尾","en":"wrap-up"},
    {"zh":"移交检查","en":"handoff check"}
  ]$chips$::jsonb,
  $tzh$收尾审查 + AI 移交自检$tzh$,
  $ten$Wrap-up review + AI handoff self-check$ten$,
  $dzh$任务结束跑这套清单,确保未来 AI 凭现有 skill / memory 能接手同类任务。$dzh$,
  $den$Run this at end of task to ensure a future AI can pick up similar work from current skill / memory alone.$den$,
  $cmd$收尾审查:
1. skill / memory / CLAUDE.md 是否需要更新?要更新必须极简
2. 用 git add 指定路径只提交你改的文件 (不要 -A)
3. 一句话总结本次工作 + 1-2 条未来注意事项
4. 自检:仅凭现有 skill / memory,未来 AI 能独立接手同类任务吗?$cmd$
);

-- ── prompt: 性能优化判定 ──────────────────────────────────────────
INSERT INTO ops_commands (id, category, position, chips, title_zh, title_en, desc_zh, desc_en, cmd) VALUES (
  'prompt-perf-decision',
  'prompt',
  4,
  $chips$[
    {"zh":"性能优化","en":"perf opt"},
    {"zh":"判定规则","en":"verdict rule"}
  ]$chips$::jsonb,
  $tzh$性能优化 commit / 回滚判定$tzh$,
  $ten$Perf optimization commit / rollback verdict$ten$,
  $dzh$改完性能后甩这条,AI 自决,跳过对 tiny 优化的人工 review。$dzh$,
  $den$After a perf change, drop this in — AI decides, skipping manual review of tiny tweaks.$den$,
  $cmd$性能优化判定:
- 实测显著提升 → commit
- 提升微弱 / 倒退 / 持平但代码变复杂 → 回滚$cmd$
);
