# 1LLL 迁移 —— 执行台账

设计和结论在 [`1lll-migration.md`](./1lll-migration.md);**这里只记「做到哪了」**。
每个单元做完就在这里打勾 + 一句话结论,断线换人接着往下推。

> **GT(case 数)在 migration.md §5。每一期跑完拿它对账,对不上就是这一期错了。**
> **push = 上线。默认只 commit。** 灌生产 DB 前必 `pg_dump`,且先本地 pg13 dry run。

---

## 进度总览

| 期 | 内容 | 状态 |
|---|---|---|
| 0 | 状态轨道 join(表 3915 ↔ 站 3893) | ✅ 零残留(Phase 2 修完地基后**重跑,结论不变**) |
| 1 | 共享记号 / 计步 lib + 收 9 个计步器 + MIRROR | ✅ |
| 2 | 全量校验报告(含备选公式)→ 交站长 | ✅ `docs/1lll-sheet-issues.md` |
| 3 | Schema:`alg_cases.meta` + `AlgEntry` 扩字段 | ✅ migration 0069 |
| 4 | 导入(pg13 dry run → 生产) | ✅ **已上生产**,3915 case 逐条复验 |
| 5 | UI:OLLCP 主名 + 元数据弹窗 + 标签筛选 | ✅ |
| 6 | Trainer 打乱类型选择器 | ✅ |
| 7 | 学习进度(后置,本轮不做) | ⏸ |

## 顺手挖出的**线上** bug(与 1LLL 无关,但都已根治)

| bug | 后果 | 修在哪 |
|---|---|---|
| `mirrorAlg` 的 `new Move(f, amount)` **丢层号** | `2R` → `L'`、`3Rw` → `Lw'`;/sim 镜像按钮在 4x4/5x5 上能点到 | `lib/cube3.ts` 改用 `.modified()` |
| `mirrorAlg` 的 `amount % 4 === 0` **删掉 `R4`** | 在乱改公式。cubing.js 自己就把 `Move('L',-4)` 序列化成 `L4'`,那条丢弃纯属自伤 | 只拦 `amount === 0` |
| `recon-norm-cross.normalize` **静默丢 M/E/S** | `rotateSolutionY("M2 U M U2 M' U M2", 1)` = `"y U U2 U"` | slice 身份由参照面定(M 跟 L、E 跟 D、S 跟 F),走同一套 `orig2slot` |
| `recon-stats.htm` 把 `Rw` 数成 2 步 | recon 的步数 / TPS 全错 | 换成 shared 的 tokenizer |
| `timer/export_csv.qtmOf` 把 M/E/S 记 0 步 | CSV 导出的 QTM 偏低 | 同上 |
| `math/god` 的 `MetricExplainer` 自己算错度量 | 一个**讲度量**的页面把 STM 写死 = HTM | 三个数都走 shared |
| `AlgPlayer` 把库里的原文**直接**喂 cubing.js | 人写的公式带连写 `MR` / 换握 `↑` / 分组 `(…)2`。cubing.js 对 `MR` **不报错**(收下一个叫 `MR` 的 family),到 applyAlg 才炸,而 catch 只 warn 一行 → 用户看到**空播放器**。1LLL 一进来立刻踩 554 条 | `normalizeAlgForTwisty` 走 shared 的 `toMoveString`;megaminx/sq1 记号不同,白名单 gate |
| `sheet_notation` 自己造了第二份 MOVE_RE | 不认 `w`:`Lw2` 被切成 `L` + junk `w2`,站上 3 条公式静默作废 | 改 import shared 的 `MOVE_RE` / `MOVE_CHARS` —— **没有第二份文法可漂移了** |

### ⚠ 判据雷区(记下来,别再踩)

- **`lib/roux/CubeLib` 的 `CubieCube` 不能当 3x3 判据**:它不认 `Rw`/`Lw`/`Uw`/`Dw`/`Fw`/`Bw`
  (小写 `d`、`b` 直接是 **no-op**),而且它的 **`E` 方向与 cubing.js 相反**
  (`r == R M'`、`x == R M' L'` 都成立,唯独含 `E` 的恒等式全不成立)。
  我拿它当 oracle,含宽块的用例假红了 1095/1200。**判据一律用 cubing.js**(站上播放器就是它)。
  Roux 公式不用 `E`,所以线上没暴露 —— 但别把它借去当通用判据。
- **测试的随机生成器只喂面转,就永远测不出 slice 被吞。** `rotate_solution.test.ts` 的池子
  原本只有 `U D L R F B` —— M/E/S 被静默丢弃这个 bug 就是这么活到今天的。

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
- [x] **2b** 修 `ll_ident.identOfAlg` 的净转体 bug(见下,**这是 Phase 0 的地基**)
- [x] **2c** 汇总 → `docs/1lll-sheet-issues.md`

### 结论(2026-07-13)

5059 条公式全扫,**5034 条正确**。

| | |
|---|---|
| 不保 F2L | **4** |
| 解错 case | **21** |
| 括号不配对 | 2 |
| 单元格开头多空格(把表自己的 `DELETE_AUF` 挡住了) | 1 |
| `Speedcubedb no.` 脏数据 | 7 |

**首条公式坏 19 条 —— 与 Phase 0 逐条吻合**(独立重跑的交叉验证);备选公式另有 **6** 条。

### ★ 揪出 `ll_ident.identOfAlg` 的净转体 bug —— **Phase 0 的地基**

```
公式 A 把打乱态 S 送到「还原 · ρ」(ρ = A 的净转体;S 是纯 LL 置换,不动中心块,
所以做完 A 之后中心块的位置完全由 A 自己决定)

    S · A = ρ    ⟹    S = ρ · A⁻¹        净转体必须【前置】
```

旧实现只写了 `ident(A⁻¹)`,漏了 ρ。于是**带净转体的公式**(`[oh]` 里一大把,`x'` / `z` 起手不收尾)
被算成一个根本不是 LL 的态 → **误判成「不保 F2L」**。实测**假阳性 4 条**
(`12/PLL-A-` 的 `[oh] x' R' U'D' …`、`22/PLL-T` 的 `[fmc] …`、`8/PLL-E`、`199/LF3`)。

`normalize` 里那个**后**接的旋转治不了 —— 右乘 ≠ 左乘。它对**纯 y** 净转体碰巧有效
(y 保住 U 面),所以带 `x`/`z` 分量的才崩 —— 而首条公式的 8 个净转体恰好全是 y 系。

⟹ **修完重跑 Phase 0:3891 对上 / 24 新 case / 0 定不了 / 19 条坏公式,逐格重现,结论不变。**

---

## Phase 3 —— Schema

- [x] **3a** migration `0069_alg_cases_meta.sql`:`ALTER TABLE alg_cases ADD COLUMN meta JSONB`
- [x] **3b** `AlgEntry` 加 `tags` / `source` / `stm` / `sqtm`;`AlgCaseMeta`;server route 吐 `meta`
- [x] **3c** typecheck + 全量测试绿

### 顺手堵掉的 `AlgEditor` 静默毁数据

`getValue()` 原本把每行**重建**成 `{ alg }` —— 管理员在后台编任意一个 case,该 case 所有公式的
`altId` / `ytId` / `tags` / `source` / `stm` / `sqtm` 全部**静默蒸发**。改成 rest-spread 保留未知字段。
(这个 bug 在 1LLL 之前就有,只是当时 `AlgEntry` 上没什么值钱的东西。)

## Phase 4 —— 导入

- [x] **4a** `import_1lll.mjs` 生成 `BEGIN…COMMIT` SQL。**直连 PG,禁走 REST**
- [x] **4b** 生产 `pg_dump` → 本机 pg13 `alg_dry` → migration 0069 → import SQL → **读回来验**
- [x] **4c** 生产:`pg_dump` 备份 → migration 0069 → 灌 → 复验(4.1s;`make_rollback.mjs` 的回滚脚本实测可用)
- [x] **4d** 线上复验:`phase4_verify.mjs prod` 直连生产库读回,10123 条公式逐条过 cubing.js,全绿

### ⚠ 灌完之后才发现的:**打乱列也有错的**

Phase 2 只验了公式列。做 Phase 6 时把六个**打乱列**也过了一遍轨道判据 —— **113 条打的是别的 case**
(`Scramble` 17、`SH*` 13、`SQ*` 25、`H*` 28、`Q*` 28、`COEP` 2)。它们当时已经进了生产的 meta,
弹窗正在展示错的打乱,trainer 一旦用它出题就是**静默教错**(屏幕上写着这个 case 的名字,
手上打出来的是另一个)。

根因:导入时**没给打乱列立判据**,只给公式立了。修法 = `import_1lll.mjs` 的 `keepScramble()`,
每条打乱都要打出**本行的** case(16 折轨道)才收,验不过只留步数。
生产走「回滚 → 重灌」(回滚脚本此前已实测),复验后六套打乱 3898/3902/3890/3887/3887/470 条**零错误**。

## Phase 5 —— UI

- [x] **5a** OLLCP 主名(`O-U8`),站上原名(`1LLL 6 7`)降为副名;PLL 的 ollcp 剥掉 `PLL-` 前缀后
      与站上原名重合 → 不显示副名
- [x] **5b** 组名也换字母制:1lll 的组号是纯数字(`1LLL 06`),组内每个 case 的 `meta.oll` 都一样
      (实测 50 组全 1:1)→ 组名 `O-`,数字降为副名
- [x] **5c** 公式行显示标签(单手 / 脚拧 / 最少步 / 高阶 / 键盘)+ STM
- [x] **5d** 标签筛选下拉(`?tag=oh`,nuqs replace);筛完没公式的 case 一并隐藏
- [x] **5e** `AlgCaseMetaModal`:编号 / 子集 / OLL / 角换 / 叠加类型 / 生成元 / 对称性 / 打乱 /
      四套最优解 / COEP + 镜像·逆·镜像逆的互跳
- [x] **5f** `useCopy` hook(5 处手写的 clipboard 都漏了卸载时清 timer)

### ★ STM 徽章要数**屏幕上那一条**

入库的公式带着**载荷收尾 AUF**(`setup + alg` 必须精确还原),而 `displayAlg` 显示时会剥掉它。
直接把 `entry.stm`(入库值)当徽章 ⟹ **显示 10 步、徽章写 11**。徽章改成 `stm(displayAlg(alg))`。

## Phase 6 —— Trainer 打乱类型选择器

- [x] **6a** `ScrambleKind` = `inv` / `stm`(SH\*)/ `sqtm`(SQ\*)/ `htm`(H\*)/ `qtm`(Q\*)/ `coep`
- [x] **6b** `availableKinds(c)` 按 case 算 —— 不是每个 case 都有全套(验不过判据的没入库),
      选中的这批 case 取并集;只有一种就不渲染选择器,缺的那种自动退回 `inv`
- [x] **6c** 换类型立刻重出当前题(不然要等下一次「换一个」才生效,用户以为没反应);计时中禁换
- [x] **6d** 收尾随机 AUF 对**所有**类型一视同仁 —— 少了它,同一个 case 永远长同一个样,
      练的就成了背图。多一步 U 不影响「它是最短打乱」(长度在元数据弹窗里看)
- [x] **6e** 实测:六种类型对同一个 case 出的六条打乱,cubing.js 判定全落在同一个 16 折轨道

### Dry run 验收(2026-07-13)—— `phase4_verify.mjs`

判据不看生成器的内存对象(同一份 buggy 逻辑既造 SQL 又造断言 = 永远绿),而是
**生产 dump → pg13 → 跑 SQL → psql 读回 → cubing.js 判**:

```
从 pg13/alg_dry 读回 3915 个 case、10123 条公式
  ✓ 每条公式都满足 setup + alg == 还原(10123 条)   ← 不抽样
  ✓ pll 21 / zbll 472 / ell 25 / 1lll 3397 = 3915(全部命中 GT)
  ✓ 3915 个互不相同的态(没有重复 case)
  ✓ 1lll position 连续 0..3396
  ✓ meta.no 3915 个不重号 / stm / sqtm 与公式一致
```

动作:**3898 UPDATE / 17 INSERT / 20 DELETE** + 1lll 的 position 全量重排。

| 公式 | |
|---|---|
| 站长的,原样就还原 | 4173 |
| 站长的,补收尾 AUF | 805 |
| 站长的,补起手 AUF | 44 |
| 站长的,跳过 | 28(25 条坏 + 3 条净 x/z 转体) |
| 站上原有(speedcubedb)留用 | 5101 |
| 与站长的重复 | 871 |
| 丢弃(新 setup 下装不进) | 12(全是净 x/z 转体) |

### ★ 定理:带 x/z 净转体的公式,**收尾 AUF 用不了**

设公式 `A` 的净转体为 ρ、它解的态 `S_A = ρ·A⁻¹`。

- **起手** AUF `U^a` 把它能服务的态**右乘**成 `S_A·U^-a` —— 永远可用。
- **收尾** AUF `U^b` 要**左乘**成 `U^-b·S_A`,前提是 `ρ·U^b·ρ⁻¹` 仍是 U 层的转 ——
  **只有 ρ 是纯 y(或恒等)时才成立**。ρ 带 x/z 时那个 `U` 落到别的面上去了。

⟹ 带 x/z 净转体的公式只能覆盖 16 元轨道里的 **4** 个态。setup 不在那 4 个里就装不进,**改不了**。

实测(全部 5034 条正确的站长公式),推导与数据逐格吻合:

| ρ | 装得进 | 装不进 | 靠**非零收尾 AUF** 装进的 |
|---|---|---|---|
| 纯 y / 无转体 | 5030 | **0** | 常见 |
| 含 x/z | 1 | **3** | **0 —— 一条都没有** |

---

## 日志

- **2026-07-13** — 台账建立。Phase 0 已闭环(见 migration.md §6'')。
- **2026-07-13(续)** — **Phase 1 + Phase 2 完成。**
  - `@cuberoot/shared/alg-notation` 落地(零依赖 tokenizer + 5 个度量 + 镜像/旋转规则表)。
    验收:表的 `SH` 3914/3915、`SQ` 3914/3915、`Self gen` **3915/3915**;唯一分歧是表格 typo。
  - 度量语义订正为「照写照执行,不折 mod 4」—— **`R4` 是站长故意写的,保留**(站长当场纠正了我)。
  - 站上 9 个计步器收成 1 个(3 个域内正确的保留);顺手根治 6 个线上 bug(见上表)。
  - 揪出 `identOfAlg` 的净转体 bug(Phase 0 的地基),修完**重跑 Phase 0,结论逐格不变**。
  - 全量校验 5059 条公式 → `docs/1lll-sheet-issues.md`(25 条坏公式 + 表格 typo 清单)。
  - **未写入任何生产数据。**
- **2026-07-13(再续)** — **Phase 3 + Phase 4 dry run 完成。**
  - `alg_cases.meta` (JSONB) 上线到 schema;`AlgEntry` 扩 `tags`/`source`/`stm`/`sqtm`。
  - `import_1lll.mjs` → 7343 行 SQL。生产两张表已 `pg_dump` 备份到 `.tmp/phase4/`(2.1 MB)。
  - dry run:pg13 里跑通,**读回来 10123 条公式逐条过 cubing.js,全绿**,计数命中 GT。
  - 又根治 2 个线上 bug:`AlgPlayer` 裸喂 cubing.js(1LLL 一进来就有 554 条炸成空播放器)、
    `sheet_notation` 的第二份 MOVE_RE 不认 `Lw2`。
  - **仍未写入任何生产数据** —— 3915 个 case 的破坏性替换,等站长点头。
- **2026-07-13(收尾)** — 站长拍板「备份好 然后全做了」。**Phase 4 / 5 / 6 全部完成。**
  - 生产:`pg_dump` 备份 → migration 0069 → 灌 3915 个 case(4.1s)→ 直连生产库读回,
    10123 条公式逐条过 cubing.js,全绿。push 上线(CI 三绿:Test / Deploy Next / Deploy Core)。
  - 灌完才发现**打乱列也有 113 条打错 case** —— 导入时只给公式立了判据,没给打乱立。
    补上 `keepScramble()`(每条打乱都要打出本行的 case)后走「回滚 → 重灌」,六套打乱现在零错误。
  - Phase 5:OLLCP 主名 + 组名字母制 + 标签徽章/筛选 + `AlgCaseMetaModal` + `useCopy`。
  - Phase 6:trainer 六选一打乱类型,实测六种打乱同轨道。
  - 又根治 2 个线上 bug:`AlgPlayer` 裸喂 cubing.js、`sheet_notation` 不认 `Lw2`。
  - 剩:Phase 7(学习进度)后置;`docs/1lll-sheet-issues.md` 的 138 条表侧问题交站长改表。
