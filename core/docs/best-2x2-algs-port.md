# Two-Tools / Best 2x2 Algs 移植跟踪

最后更新：2026-08-05

## 目标与边界

- 上游功能：[`WACWCA/two-tool`](https://github.com/WACWCA/two-tool)，已获授权。
- 公式来源：[`Best 2x2 Algs`](https://docs.google.com/spreadsheets/d/1OFXakCV85Mp2zsQBXMxiMX9a506JeAcLnUXZr8FgXAY/edit)。
- 页面：`/[lang]/2x2x2`，不再 iframe `/tools/2x2x2/`。
- 公式库：`/[lang]/alg/2x2`。
- 不移植上游 AWS RUM、MUI、贴纸映射器、react-three-fiber 或 cubing.js `twisty-player`。
- 二阶状态、转体、记号与还原验证复用 `lib/pocket-facelet.ts`；3D 预览复用 `/sim` 的 `AlgSimPlayer` / `mountSimWorld({ puzzle: 2 })`。

## 已完成

- [x] 抓取公开表格的 21 个工作表（17 个公式页、4 个说明页）。
- [x] 解析 784 个格位、2,874 个来源单元格；分支记号展开后为 2,900 条公式分支。
- [x] 支持 `(U/U')`、`F2/D`、`B/F`、`R/R3'`、`R3`、`U2'` 等表内真实写法。
- [x] 用站内二阶状态模型反推每格题面，并以 24 朝向、起手/收尾 AUF 做交叉校验。
- [x] 隔离 17 条不属于所在格位的分支；每个格位仍至少有一条有效公式。
- [x] 合并站内 CLL、EG-1、EG-2、Ortega PBL，保留原有 case 名称、ID、贴纸和训练进度键。
- [x] 新增 LEG-1、TCLL+、TCLL-、LS-1…LS-9、TEG2+，并把 PBL 补到表格的 9 个角度格位。
- [x] 生成 0104 数据迁移；本地 PostgreSQL 实际执行并通过每个 set 的数量断言。
- [x] 最终清单共 17 个表格 set、784 个格位、3,270 条合并公式；逐条执行 `setup + alg` 全部还原。
- [x] 原生移植 Two-Tools 双向 BFS、方法/深度/底色筛选、每 case 公式数和三连转手感排序。
- [x] 查找计算放入 Web Worker；完整 732-case 目标库的样例搜索约 0.4 秒，返回解逐条实测可还原。
- [x] 增加每周 Google Sheet 漂移检测；变化时创建或更新 GitHub issue 并附表页/行差异。
- [x] About 页单一数据源加入上游致谢。

## 数据结果

| 指标 | 数量 |
|---|---:|
| 表格公式集 | 17 |
| 表格格位 | 784 |
| 来源单元格 | 2,874 |
| 展开后的来源分支 | 2,900 |
| 可导入来源分支 | 2,883 |
| 隔离分支 | 17 |
| 合并后公式 | 3,270 |
| 更新既有 DB case | 126 |
| 新增 DB case | 658 |
| 迁移后二阶公式集总数（含 Ortega OLL） | 18 |
| 迁移后二阶 case 总数 | 791 |

表格里的 EG-1 与 LEG-1 是同一批物理题面的不同公式体系，因此 80 个格位在公式库中仍保留为两个独立 set，不能按状态去重成 40 行。

## 隔离清单

以下分支不能还原所在格位，未写入 `alg_cases`。其中斜杠单元格两边都会独立验证，所以 PBL 与 TEG2+ 各产生两条隔离记录。

- PBL / Diag #1，row 33：`R U' R U R' F2 R' U' R' U F2/D R2` → `… F2 R2`
- PBL / Diag #1，row 33：同单元格 → `… D R2`
- CLL / T #1，row 57：`(U) R' F' R' U F U F'`
- EG-1 / U #3，row 31：`(U) R U R' U F R U R' U R U' R2 F2 R`
- EG-1 / U #5，row 35：`z' y (U) R U' R' U2 R U' R2 U'`
- LEG-1 / T #2，row 45：`(U) y' F R U' R F R2 U' R' U R' F'`
- TCLL- / Gun #1，row 50：`y (U) R2 U' R2 U R U' R'`
- LS-5 / Hammer-B #6，row 13：`y R' U' F R F' R U' R U2 R'`
- LS-5 / Spaceship-A #1，row 21：`(U') R U2 R U' R' U R' U' F R' F`
- LS-6 / Spaceship #5，row 14：`R2 U' R' F R' F U2 F`
- LS-6 / Two-Face #1，row 19：`(U2) R U' R' F R F' R U R2`
- LS-7 / Pi-B #2，row 28：`y2 z' (U2) F R' U' R2 U R' U R U2 R'`
- LS-7 / U #6，row 35：`x (U') R U' R2' U R2 U R'`
- LS-7 / T #2，row 42：`(U') F R' F' R2 U' R' y U R' U' R`
- LS-8 / Spaceship #2，row 16：`y2 R F' R U R2 F' R2 U' R'`
- TEG2+ / Pinwheel-Poser #6，row 44：`R2 F2 R/R3' U' R2 F R F'` → `R2 F2 R …`
- TEG2+ / Pinwheel-Poser #6，row 44：同单元格 → `R2 F2 R3' …`

反向扫描还发现少量公式能解另一格（例如 TCLL- Gun、LS-5 Hammer-B、LS-6 Two-Face、LS-7 U 的个别条目），但不能擅自搬格；来源作者修正前统一隔离。

## 同步与提醒方案

可以自动收到提醒。`.github/workflows/best2x2_drift.yml` 每周一读取 Google Sheets 的公开 gviz CSV，按规范化后的 21 个表页分别计算 SHA-256。任一页变化时：

1. 创建或更新带 `best2x2-drift` 标签的 issue，并指派仓库所有者，因此 GitHub 会发送通知。
2. 报告变化的表页、行数及前 12 个行差异。
3. 不自动写数据库。当前来源真实存在错位和多分支记号，必须先经过模拟器验证，再生成新的迁移。

部署过 0104 后，后续同步必须新增迁移编号，不能重写 0104。审核后的更新流程是：抓取 → report → build-import → 新 SQL → verify-import / verify-finder → 本地迁移 → 更新快照。

## 复现命令

在 `core/` 下执行：

```pwsh
$env:NODE_USE_ENV_PROXY='1'
pnpm -F @cuberoot/client exec tsx scripts/best2x2/fetch.mts
pnpm -F @cuberoot/client exec tsx scripts/best2x2/report.mts --site-dir .tmp/best2x2 --json .tmp/best2x2/derived-site.json
pnpm -F @cuberoot/client exec tsx scripts/best2x2/build-import.mts .tmp/best2x2/derived-site.json .tmp/best2x2 .tmp/best2x2/import.json
node packages/alg-build/gen_best2x2_sql.mjs .tmp/best2x2/import.json core/packages/server/migrations/0104_best_2x2_algs.sql
pnpm -F @cuberoot/client exec tsx scripts/best2x2/verify-import.mts .tmp/best2x2/import.json
pnpm -F @cuberoot/client exec tsx scripts/best2x2/verify-finder.mts .tmp/best2x2/import.json
node packages/client/scripts/best2x2-check.mjs
```

本地数据库验证：

```pwsh
pnpm --filter @cuberoot/server seed:local-alg
Get-Content packages/server/migrations/0104_best_2x2_algs.sql | docker exec -i pg13 psql -U postgres -d cuberoot_db -v ON_ERROR_STOP=1
```

## 上线状态

- 代码与迁移已在本地完成和验证。
- 尚未 push，因此线上 API 仍会对新增 set 返回 404；push 后部署流程会自动执行迁移。
- 本次没有触碰工作区中并行进行的 timer / reconstruct / meet 改动。
