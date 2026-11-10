-- Refresh retired runbook commands without changing their categories, ordering or other entries.
-- Content only: no schema or account behavior changes. Apply through the normal migration runner.
-- Match the reviewed old value so a later administrator edit is not overwritten.

UPDATE ops_commands
SET cwd = $value0$core/$value0$,
    chips = $value1$[
  {
    "zh": "本地计算",
    "en": "Local computation"
  },
  {
    "zh": "默认发布线上",
    "en": "Publishes to production by default"
  }
]$value1$::jsonb,
    desc_zh = $value2$使用仓库指定的 pnpm，先进入 core/。默认增量运行 stages（三阶阶段）、333opt（三阶最优）与 puzzles（其他项目），随后更新线上 PostgreSQL、WCA 数据 Release 和静态分片。需要已有的本地数据、对应求解表及发布凭据；新 checkout 先用 pnpm stats:hydrate 恢复数据。启动计算前遵守 docs/contributing/compute.md 的资源保护要求，耗时取决于增量规模。仅查看计划或只做本地计算时使用下方独立入口。$value2$,
    desc_en = $value3$Use the repository-pinned pnpm from core/. The default incrementally runs stages, 333opt and puzzles, then updates production PostgreSQL, the WCA data Release and static shards. Existing local data, solver tables and publishing credentials are required; hydrate a new checkout with pnpm stats:hydrate. Follow docs/contributing/compute.md resource protections before computing. Duration depends on the incremental workload. Use the separate entries below for planning or local-only computation.$value3$,
    cmd = $value4$pnpm stats:scramble$value4$,
    variants = $value5$[
  {
    "zh": {
      "label": "只看计划",
      "note": "只读列出计划，不求解、不发布。"
    },
    "en": {
      "label": "Inspect the plan",
      "note": "Read-only plan; no solving or publishing."
    },
    "cmd": "pnpm stats:scramble:local --plan"
  },
  {
    "zh": {
      "label": "只在本地计算",
      "note": "运行全部作业并更新本地产物，不发布线上。"
    },
    "en": {
      "label": "Local computation only",
      "note": "Run all jobs and update local artifacts without publishing."
    },
    "cmd": "pnpm stats:scramble:local"
  },
  {
    "zh": {
      "label": "只跑三阶最优并发布",
      "note": "只运行 333opt；完成后发布本轮统计。"
    },
    "en": {
      "label": "Compute and publish 3×3 optimal",
      "note": "Run only 333opt, then publish this update."
    },
    "cmd": "pnpm stats:scramble --jobs 333opt"
  },
  {
    "zh": {
      "label": "多个作业并发布",
      "note": "逗号分隔作业；完成计算后统一发布。"
    },
    "en": {
      "label": "Compute and publish several jobs",
      "note": "Separate jobs with commas; publish after computation."
    },
    "cmd": "pnpm stats:scramble --jobs stages,puzzles"
  },
  {
    "zh": {
      "label": "只在本地更新 SQ1",
      "note": "只运行 puzzles 中的 SQ1，仍须遵守计算保护；不发布。"
    },
    "en": {
      "label": "Update SQ1 locally",
      "note": "Run only SQ1 in puzzles under the compute protections, without publishing."
    },
    "cmd": "pnpm stats:scramble:local --jobs puzzles --puzzles sq1"
  },
  {
    "zh": {
      "label": "指定阶段变体，本地计算",
      "note": "显式选择 eo、pseudo、pseudo_pair；不发布，不能用此命令绕过内存保护。"
    },
    "en": {
      "label": "Select stage variants locally",
      "note": "Select eo, pseudo and pseudo_pair without publishing; resource protections still apply."
    },
    "cmd": "pnpm stats:scramble:local --jobs stages --variants eo,pseudo,pseudo_pair"
  }
]$value5$::jsonb
WHERE id = 'update-scramble-stats'
  AND cmd = $reviewed$pwsh core/packages/scramble-stats-build/update_cross_stats.ps1$reviewed$
;

UPDATE ops_commands
SET variants = $value0$[
  {
    "zh": {
      "label": "使用已解压的 SQL（macOS / Linux）",
      "note": "把路径替换为本机已解压的 SQL 文件。仍会重建目标 WCA 数据库，不适用于仅查看数据。"
    },
    "en": {
      "label": "Use an extracted SQL file (macOS / Linux)",
      "note": "Replace the path with your extracted SQL file. This still rebuilds the target WCA database; it is not a read-only command."
    },
    "cmd": "env WCA_DUMP_SQL_PATH='/absolute/path/to/wca-developer-database-dump.sql' pnpm --filter @cuberoot/stats-build exec tsx src/bin/update_database.ts"
  }
]$value0$::jsonb
WHERE id = 'wca-dump-refresh'
  AND variants = $reviewed$[
  {
    "en": {
      "note": "Point to an existing .sql to jump straight to import, saving the 2GB download + unzip",
      "label": "Skip download if .sql already extracted"
    },
    "zh": {
      "note": "指向已解压的 .sql 直接进 import 步,省 2GB 下载 + 解压时间",
      "label": "已手动下好 .sql,跳下载"
    },
    "cmd": "$env:WCA_DUMP_SQL_PATH = 'E:\\path\\to\\wca-developer-database-dump.sql'\npnpm --filter @cuberoot/stats-build exec tsx src/bin/update_database.ts"
  }
]$reviewed$::jsonb
;

