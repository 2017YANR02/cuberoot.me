# CubingApp 公式与 WCA 工具整合跟踪

## 范围与来源

- 上游工作区: `D:\cube\cubingapp`
- 固定上游版本: `613a49885dc618023368e5f0c2a25024b8c7e9a5`
- 目标工作区: `core/`
- 目标入口: `/alg/4x4`、`/alg/3x3`、`/alg/pyraminx`、`/wca`
- 数据原则: PG `alg_sets` / `alg_cases` 是公式库唯一真源，网页、PDF、训练器和缩略图共用现有消费链路。
- 去重原则: 先按功能和数据语义检查整个本站，不按页面标题判断；已有功能只补数据或补入口，不复制页面。

## 公式库

| 上游集合 | 本站基线 | 处理 | 状态 |
|---|---|---|---|
| 4x4 PLL Parity | 已有 `4x4/pll-parity` 22/40 | 5 条上游式已存在，保留 case ID/进度并补 17 条 | 完成:22/57 |
| 2 Look OLL | 无独立 set | 新增并复用通用详情/PDF/训练器 | 完成:9/9 |
| 2 Look PLL | 无独立 set | 新增并复用通用详情/PDF/训练器 | 完成:6/10 |
| 2 Look CMLL | 无独立 set | 新增到 3x3 Roux 分区 | 完成:9/9 |
| CMLL | 已有 `3x3/cmll` 42/168 | 141 条上游式命中，19 条候选经状态及 canonical 去重后新增 11 条 | 完成:42/179 |
| OH CMLL | 无独立 set | 上游 100 条中 99 条状态有效，1 条明确拒收 | 完成:42/99 |
| LSE EO | 已有 `3x3/eo4a` 9/36 | 合并缺失公式和 2 个缺失状态，不新建重复 set | 完成:11/43 |
| LSE EOLR | 无独立 set | 新增到 3x3 Roux 分区，与现有 Pruner 共用 17 个目标态 | 完成:46/48 |
| Pyraminx Last Layer | 本站已有 `pyraminx/l3e` | 上游 5 条全部 canonical 命中，不新建重复 set | 完成:保持 5/16 |
| Pyraminx L4E | 已有 `pyraminx/l4e` 37/187 | 补 12 个缺失状态和 15 条有效公式 | 完成:49/202 |

说明: 本站已有 `/alg/roux` 桥式训练器、`3x3/cmll`、`3x3/sbls` 和 `3x3/eo4a`。本次“Roux 分区”是 `/alg/3x3` 公式目录内的分类展示，不复制已有训练器。

## WCA 工具去重矩阵

| CubingApp 工具 | 本站初步发现 | 决策 | 状态 |
|---|---|---|---|
| Competition Distance | `/wca/comp` 已有定位、haversine 距离、未来比赛排序和日期 | 复用现有地球视图，不新建页 | 完成 |
| Kinch Ranks | 全站缺失 | 新增 `/wca/kinch`，共享计算公式、日更预计算表与逐项明细 | 完成 |
| Name Ranks | `/wca/results` 只有模糊搜索 | 在同页增 `any/first/last/exact`，不新建页 | 完成 |
| Ranks | `/wca/results` 已覆盖项目、口径、范围、选手/成绩与分页 | 保留现有实现，不重复 | 完成 |
| Record Streak | 只有全站历史最长静态统计 | 将指定选手的 current/longest 整合进现有选手详情 Misc | 完成 |
| Sum of Ranks | `/wca/results?events=all` 与 `/v1/wca/sum-of-ranks` 已更完整 | 保留现有实现，不重复 | 完成 |

## 复用与约束

- 公式集合只登记到共享 `ALG_CATALOG`；不为每个集合新写页面。
- NxN 缩略图只走 `@cuberoot/visualcube`，非 NxN 走现有 puzzle-image 引擎。
- PDF、网页和训练器继续消费同一 `AlgFile` / `caseThumbPlan`。
- 所有新 UI 文案走 `tr` / `useT`，内部链接走 `AppLink`。
- 新数据库内容使用幂等 migration，并在本地 PG 连续应用两次验证。
- CubingApp 致谢只更新 `credits_data.json` 单一来源。

## 验证清单

- [x] 上游每个集合的 case 数与公式数固定测试
- [x] 与本站现有 case 按状态/名称/canonical 公式三层去重
- [x] migration 首次应用计数正确
- [x] migration 连续应用无重复、数据 hash 与既有 case ID 稳定
- [x] 网页缩略图、详情页、PDF、训练器使用同一 `caseThumbPlan`
- [x] EOLR 48 条公式全部命中与 Roux Pruner 共用的 17 个目标态，46 个 setup 零步均未达标
- [x] OH CMLL 上游坏公式经 42 case × 16 AUF/y 锚定穷举后拒收
- [x] 中英文目录、标题、metadata、站内搜索与代码目录守卫通过
- [x] Kinch 计算、并列名次、MBLD 方向、Name Ranks 边界与 PR streak 语义固定测试
- [x] 本地 PG 验证 0109/0110 幂等迁移与 0111 表/索引/并列名次
- [x] 所有工作区全量 typecheck/test 通过（常规 5261 项，分析器慢测 15 项）
- [x] 汇总全部协作者改动，提交并 push

## 审查轮次

1. 数据审查: 上游清单、本站基线、去重映射、公式合法性。
2. 架构审查: 单一数据源、共用渲染/PDF/训练器、路由和 metadata。
3. UI 审查: 桌面与窄屏、双语、空态、错误态、URL 状态。
4. 回归审查: migration 幂等、定向测试、类型检查、改动边界。

独立交叉审查已复核 Roux/Pyraminx 迁移计数、canonical 重复、EOLR 真目标、OH CMLL 坏公式、L3E 全命中与 Web/PDF 共享渲染链，结论为 PASS。
