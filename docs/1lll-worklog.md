# 1LLL 迁移 —— 执行台账

设计和结论在 [`1lll-migration.md`](./1lll-migration.md);**这里只记「做到哪了」**。
每个单元做完就在这里打勾 + 一句话结论,断线换人接着往下推。

> **GT(case 数)在 migration.md §5。每一期跑完拿它对账,对不上就是这一期错了。**
> **push = 上线。默认只 commit。** 灌生产 DB 前必 `pg_dump`,且先本地 pg13 dry run。

---

## 进度总览

| 期 | 内容 | 状态 |
|---|---|---|
| 0 | 状态轨道 join(表 3915 ↔ 站 3893) | ✅ 零残留 |
| 1 | 共享记号 / 计步 lib + 修 4 个计步器 + MIRROR | 🔨 进行中 |
| 2 | 全量校验报告(含备选公式)→ 交站长 | ⬜ |
| 3 | Schema:`alg_cases.meta` + `AlgEntry` 扩字段 | ⬜ |
| 4 | 导入(pg13 dry run → 生产) | ⬜ |
| 5 | UI:OLLCP 主名 + 元数据弹窗 + 标签筛选 | ⬜ |
| 6 | Trainer 打乱类型选择器 | ⬜ |
| 7 | 学习进度(后置,本轮不做) | ⏸ |

---

## Phase 1 —— 共享记号 / 计步 lib

### 为什么要做

站上**四个各自为政的计步器**,其中一个是错的:

| 位置 | 实际语义 | 病 |
|---|---|---|
| `lib/cube3.ts` `countMoves` | cubing.js leaf 数 = **ETM** | 名字骗人(不是「步数」是「token 数」) |
| `lib/recon-alg-utils.ts` `countMovesExpanded` | 空格分词 = ETM | 连写 `M'R'` 数成 1 步 |
| `lib/recon-stats.ts` `htm` | 字符法 = **STM** | **`Rw` 数成 2 步** —— 表里宽块写小写才碰巧对,recon 用 `Rw` 就错 |
| `math/god` `MetricExplainer` | 写死示例上的内联 | `/2$/` 抓不到 `R2'`;STM 直接写死 = HTM |

根因一句话:**字符法只在「宽块写小写」时正确**。修法 = 换成真 tokenizer。

### 单元

- [x] **1a** `@cuberoot/shared/alg-notation` —— 零依赖 tokenizer + 5 个度量 + `gen` / `deleteAuf` /
      `expandGroups` / strip 系列 + MIRROR/ROTATE 的**规则表**
- [x] **1b** 度量学名订正:表里叫 `SH`/`SQ`,其实是 **STM** / **SQTM**(不是 HTM/QTM)
- [x] **1c** `lib/cube3.ts` `mirrorAlg` 改用 shared 的规则表(解析仍走 cubing.js,保住交换子 `[R,U]`)
- [x] **1d** `recon-stats.ts` / `recon-alg-utils.ts` / `MetricExplainer.tsx` 全部接 shared
- [x] **1e** 验收:shared 的度量逐行复现表里 3915 个 `SH`/`SQ`;分歧全部落在已知脏数据上
- [x] **1f** 用修好的 MIRROR 重算 §6'' 那批「经镜像传染」的坏公式

### 验收结论(2026-07-13)

**STM 3915/3915、SQTM 3887/3915** —— 28 个 SQTM 分歧**全部**落在 §6'' 之外的一类**新脏数据**上:
表里 28 行把 `R'` 写成 `R3`、把恒等写成 `R4`/`L4'`。

- `R3` == `R'`(1 个 90°),表的 SQ 公式按字面数成 **3** 个 → 每行虚高 2 步。
- `R4` / `L4'` == **恒等**,压根不该出现;表的 SH 还把它数成 **1 步**(所以 SH 也虚高 1)。
  这 18 行的 SH 之所以还能「3915/3915 吻合」,是因为**我在复现表自己的公式**,连它的 bug 一起复现了。
  换成正确度量后它们必然分歧 —— **这正是把 bug 照出来的地方**。

⟹ **入库存正确度量,不存表里的缓存值。** 28 行清单进 Phase 2 报告交站长。

---

## Phase 2 —— 全量校验报告

- [x] **2a** 扫**备选**公式(§6'' 只扫了首条)
- [x] **2b** 汇总:坏公式 / 括号不配对 / `R3`·`R4` 脏量 / `Speedcubedb no.` 脏数据
- [x] **2c** 产出 `docs/1lll-sheet-issues.md` 交站长

### 结论(2026-07-13)

5080 条公式全扫。**首条 19 条坏(Phase 0 已定案),备选另有 47 条坏**,合计 66 条。
另有 28 行 `R3`/`R4` 脏量、2 行括号不配对。清单 → `docs/1lll-sheet-issues.md`。

---

## Phase 3 —— Schema

- [ ] **3a** migration:`ALTER TABLE alg_cases ADD COLUMN meta JSONB`
- [ ] **3b** `AlgEntry` 加 `tags` / `source`(JSONB 内,免 migration)
- [ ] **3c** typecheck + 全量测试绿

## Phase 4 —— 导入

- [ ] **4a** 生成 `BEGIN…COMMIT` SQL(范本 `gen_zbls_sql.mjs`)。**直连 PG,禁走 REST**
- [ ] **4b** 本地 pg13(docker 5433)dry run;计数对 GT
- [ ] **4c** `pg_dump` 备份 → 生产
- [ ] **4d** 线上复验

## Phase 5 —— UI
## Phase 6 —— Trainer 打乱类型选择器

---

## 日志

- **2026-07-13** — 台账建立。Phase 0 已闭环(见 migration.md §6'')。开 Phase 1。
