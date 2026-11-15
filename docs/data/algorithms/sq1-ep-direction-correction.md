# SQ1 EP 方向与分类修正（2026-09-11）

已通过生产管理 API 修正 23 条记录；完整回读确认 100 个案例、183 条公式。

判据：用共享 SQ1 状态引擎执行 setup，以角块消除整层转动，再计算棱块的还原置换。上下层都从各自面正视；三棱顺时针还原为 U+，逆时针为 U-。数据库保留 Ua/Ub 分类键（对应 U+/U-），展示名称使用已有公共映射。

原有 181 条候选公式全部保留，包含来源、note、altId 和各自的 setup。21 条归入正确案例；五个错误代表 setup 随正确首条公式更新。未改 case ID、原始 name/subgroup 标识及历史 migration，避免改变学习进度和投稿使用的键。前端 EP 可见分组本来就按案例名重建。

## 重新归类的原公式

序号从 1 开始，指修正前所在案例中的候选顺序。

| 原 ID | 原分类 | 原序号 | 新 ID | 实际分类 |
| --- | --- | --- | --- | --- |
| 5987 | Ua / Solved | 2 | 5992 | Ub / Solved |
| 7802 | Ua & Opp | 2 | 9492 | Opp & Ua |
| 7801 | Ua & Adj | 3 | 7804 | Ub & Adj |
| 5988 | Ua / Ua | 3 | 5994 | Ub / Ub |
| 5989 | Ua / Ub | 2 | 5993 | Ub / Ua |
| 5986 | Ua / H | 3 | 5991 | Ub / H |
| 5990 | Ua / Z | 1 | 5995 | Ub / Z |
| 5990 | Ua / Z | 2 | 5995 | Ub / Z |
| 5992 | Ub / Solved | 2 | 5987 | Ua / Solved |
| 7803 | Ub & Opp | 2 | 7802 | Ua & Opp |
| 7804 | Ub & Adj | 3 | 7801 | Ua & Adj |
| 5994 | Ub / Ub | 1 | 5988 | Ua / Ua |
| 5994 | Ub / Ub | 2 | 5993 | Ub / Ua |
| 5994 | Ub / Ub | 3 | 5988 | Ua / Ua |
| 9497 | Ub & O- | 1 | 9515 | Z & O- |
| 5991 | Ub / H | 3 | 5986 | Ua / H |
| 5995 | Ub / Z | 1 | 5990 | Ua / Z |
| 9500 | O+ & Ub | 1 | 9499 | O+ & Ua |
| 5976 | O- / W | 2 | 5971 | O+ / W |
| 6003 | Z / Ua | 2 | 6004 | Z / Ub |
| 6004 | Z / Ub | 2 | 6003 | Z / Ua |

## 两条补充公式

- ID 9497，Ub & O-：由 ID 9493 的 Ua & O+ 公式取逆。
- ID 9500，O+ & Ub：由 ID 9503 的 O- & Ua 公式取逆。

新增两条均标注推导来源，并验证 setup、每一步可切性和最终完整还原。

## 维护与验证

`scripts/sq1-ep-correct.ts` 只生成修正计划，不写线上。输入必须是 API 完整 SQ1 EP JSON；遇到不可切、不还原或不能判定的状态会停止。再次输入修正后的线上数据，必须得到零改动。

在 `core/` 执行（输入输出路径使用绝对路径）：

```sh
pnpm --filter @cuberoot/client exec tsx scripts/sq1-ep-correct.ts INPUT.json PLAN.json
pnpm --filter @cuberoot/client exec vitest run tests/sq1_ep_direction_correction.test.ts tests/sq1_ep_parity.test.ts
```

回归 fixture 保存的是修正前完整公开 API 数据，覆盖全部 181 条原公式。测试还覆盖上下层所有 24 种棱排列、每种排列的全部 12 个转层位置，检查状态判别、原数据保留、100 种分类完整性和再次运行零改动。
