---
name: maintain-sq1-pbl
description: 检查并同步 Daniel's Public PBL Doc 到 CubeRoot 的 SQ1 PBL 公式库。用户说“维护表格”（默认指 SQ1 PBL）、“维护 SQ1 PBL 表格”、“同步 PBL 表格”、“维护 PBL 公式”或“sq1-pbl-drift”，或处理对应 GitHub Issue 时使用。
---

# 维护 SQ1 PBL 公式源

在仓库 `core/` 运行唯一检查入口：

```powershell
node packages/client/scripts/sq1-pbl-check.mjs
```

- `0`：同步或仅 editorial 变化；报告后停止。
- `3`：内容、结构或格式发生实质漂移；继续人工复核。
- `2`：缺少基线；先确认路径，禁止创建未知基线。
- `1`：下载或解析失败；修复后重跑。

本地复核用：

```powershell
node packages/client/scripts/sq1-pbl-check.mjs --source "..\.tmp\xlsx\Daniel's Public PBL Doc.xlsx"
```

实质漂移时先核对：968 个 Raw Algs、1 个 `-/-` 还原参考、967 个非还原可执行公式、963 个 recommended、4 个 unused、总频次 10368。只允许 `M/Db` 从 `Standard Algs Data!T208` 恢复；其他非还原空公式必须失败。同步审查 `Help!B18:N43` 的 103 个助记定义、4 条 Alt 注释、`Help!K37` 变体注释，以及推荐助记中未定义形式的集合。

确认来源变化正确后运行：

```powershell
node packages/client/scripts/sq1-pbl-check.mjs --write
```

该命令只同步 `data/sq1-pbl/cases.json`、`public/data/sq1-pbl/finder-defaults.json` 和 `scripts/sq1-pbl/source.snapshot.json`。禁止生成或维护 workbook 网页查看器的 `manifest.json`、`sheets/`、`media/`、`formula-media/`；`--public-write` 与 `--public-dir` 已退役。

若公式数据变化：

1. 保持 `recommendation.algorithm` 仅作 note，执行公式只取规范化 `solution`；助记定义同步到 `lib/sq1-pbl-mnemonics.ts`，未定义形式原样保留且禁止猜解。
2. 保留四个 unused case；不得导入 `-/-`。
3. 禁止修改已应用的 `0140_sq1_pbl.sql`；新增下一号 PG 迁移，按 case name 原位更新/新增，禁止丢失收藏、熟练度或社区公式关联。
4. 同步迁移台账，先在本地 PostgreSQL 应用，再核对 API 恰有 967 个唯一、非空 case 和 44 个叶分组。
5. 运行：

```powershell
uv run python packages/client/scripts/sq1-pbl/test_normalize.py
pnpm --filter @cuberoot/client exec vitest run tests/sq1_pbl_drift.test.ts tests/sq1_pbl_alg_library.test.ts tests/sq1_pbl_finder.test.ts tests/sq1_pbl_notation.test.ts
pnpm --filter @cuberoot/client typecheck
```

最后实测 `/zh/alg/sq1` 的 PBL 卡片、`/zh/alg/sq1/pbl` 的分类/情况/播放器、`/zh/alg/sq1/pbl-notation` 的助记说明，以及 390px 窄屏；漂移 Issue 关闭前记录新摘要与验证证据。不要自动上线未经人工审核的上游变化。
