# 1LLL 公式库迁移

把作者自编的 Google Sheet(3915 个 1LLL case、5080 条公式、外加镜像/逆/最优/对称性等元数据)
迁进站上的 `alg_sets` / `alg_cases`,替换现有的 speedcubedb 抓取数据。

Status: **分析完成,尚未写入任何生产数据**。
Owner: 站长(Ruimin Yan)。文档随进度更新,§9 是进度日志。

---

## 1. 数据源

| | |
|---|---|
| 表格 | `https://docs.google.com/spreadsheets/d/1I2McWXVQZxGRVmrVEJDub9r_NPTNdPs6C7jriodyG1E` |
| 导出 | `https://docs.google.com/spreadsheets/d/<id>/export?format=xlsx`(公开可读,免鉴权) |
| 主表 | sheet `1LLL`,3915 行 × 80 列 |
| 自定义函数 | Apps Script named lambdas(`DELETE_AUF` / `HTM` / `QTM` / `GEN` / `MIRRORLR` / `ROTATEY` / `SIMPLIFY` …),源码不进 xlsx,但**调用式和计算结果都进** |

**xlsx 同时含公式层和值层**:`openpyxl(data_only=False)` 读公式,`data_only=True` 读 Google 烘进去的缓存结果。
自定义函数被导出成 `=IFERROR(__xludf.DUMMYFUNCTION("HTM(EXPANDALG(...))"), 16.0)` —— 调用文本和结果都在。

唯一丢值的是 `BK`–`BQ` 七个开发辅助列(`ROTATE(Z2,"y")` 之类),不参与迁移。

### 关键列

| 列 | 含义 |
|---|---|
| `Self` | case 编号 1–3916(缺 0005 = LL 连跳)。**主键** |
| `Name` | OLLCP 名,如 `AB3` = OLL `A` + 角换 `B` + 识别特征 `3`(十六进制 1–9,A,B,C) |
| `Subset` | `PLL` / `ZBLL-{U,T,L,H,Pi,S+,S-}` / `1LLL` / `ELL-{A,B,X}` |
| `OLL` / `CP` | 字母制 OLL 名 + 角换类型 |
| `Scramble (alg of inv case)` | 打乱 = **逆 case 的公式**,且已被 `DELETE_AUF` 剥掉起手 AUF。⚠ 见 §6 |
| `Self alg` | 公式,多条按 `\n` 分行 |
| `SH` / `SQ` | 本条公式的 STM(=HTM) / QTM 步数 |
| `Type` | 叠加公式类型(`OO`=OLL+OLL、`OP`=OLL+PLL、`CC`=conjugate commutator …)。**取决于首条公式**,仅部分 case 有 |
| `Mirror` / `Inv` / `IM` | 镜像 / 逆 / 镜像逆 case 的**编号**(+ 各自公式列) |
| `SH*`/`SQ*`/`H*`/`Q*` + 各自 scramble | 四套最优解及步数 |
| `COEP alg` / `COEP scramble` | 仅 474 行(ZBLL+PLL)有 |
| `C_n` / `Self-Mirror` / `Self-Inv` / `Any sym` / `Full sym` / `Anti-sym` / `No sym` | 对称性 |
| `Self gen` | 生成元集合,如 `FlLMU` |
| `doc No.` / `Old No.` | 旧编号(存 meta 备查) |

**不迁移**:`Yiheng Progress`(他人学习进度)、`Train`(本人学习进度,见 §8 后置)、`V3.PDF`/`V4.PDF`(旧版公式)。

---

## 2. 公式记号规范

站上 `/sim` **已经有这套记号**(`app/[lang]/sim/engine/hands/FINGERTRICKS.md`),表和站说的是同一种语言。

| 记号 | 含义 | 出现次数 |
|---|---|---|
| `↑` / `↓` / `·` | **换握记号**:上手(拇指起手 U 面)/ 下手(D 面)/ 回 home 握。占一个播放步驱动手部动画,**对魔方状态零作用** | 1192 / 558 / 395 |
| `[oh]` | 单手公式 | 333 |
| `[ft]` | 脚拧公式 | 15 |
| `[key]` | 虚拟键盘公式(模拟魔方用) | 10 |
| `[big]` | 高阶魔方公式 | 6 |
| `[fmc]` | 最少步公式 | 19 |
| `=` 行首 | 上一条公式的**等价写法** | 36 |
| `(...)` | 分组,无语义 | — |

手别由**空白**定(FINGERTRICKS §2):记号紧贴后续字符(`↑U`)= 右手;后随空白(`↑ U`)= 左手;`↑↑ U` = 双手。
→ **转写工具不得增删记号周边空格。**

**无空格连写**:表里写 `UD'`、`M'R'`、`R'L'`、`R2'`。cubing.js 解析不了,必须先 tokenize:

```js
const TOKEN = /([RLUDFBrludfbMSExyz]w?)(\d*)('?)/g;
```

`EXPANDALG` 只处理 `(...)2` / `(...)3` 重复。**没有**交换子 / 共轭的方括号写法(`[R U R', F]`)。

---

## 3. Case 身份:Z4 × Z4 轨道 ★

**这是整个迁移的理论地基,搞错了就全盘贴错位。**

LL 状态数 = `4!·3³·4!·2³ / 2`(奇偶约束) = **62208**。
ZBLL(棱已定向)= `62208 / 8` = 7776 个状态。

而 ZBLL 公认是 **493** 个 case。验算:`7776 / 16 = 486`,加上对称不动点(Burnside)→ **正好 493**。

⟹ **case = 状态在 (前 AUF × 后 AUF) = Z4 × Z4 下的轨道。**

同理 1LLL:`62208 / 16 = 3888` + 对称不动点 → **3916**(含连跳)。✓ 与表一致。

**推论**:
- 公式 `A` 和 `U^a · A · U^b` 解**同一个 case**。
- 一条公式的 `y2` 共轭 = `(前 U2, 后 U2)`,**仍是同一个 case**(已实测:表里 `PLL-U+` 的公式正是 `PLL-U-` 的 y2 共轭)。
- 站上的 `alg_cases.setup` 是该轨道的某个**代表元**;每条存库公式都是"无末尾 AUF"的规范形式
  (`lib/alg_validation.ts:88-93` 明令禁止末尾 U-family move)。

---

## 4. 已实证的变换规则

⚠ 下面每条都是**跑 cubing.js 实测**得出的,不是推导。别改成"看起来更对"的版本。

### 4.1 镜像(MIRROR):交换轴上两面,**每一步的 amount 全部取反**

```
LR 镜像:R↔L, r↔l, Rw↔Lw;所有 move 的 amount 取反(M 和 x 也取反)
```

验证:T-perm 是合法 LL 公式 → 镜像后必须仍是合法 LL 公式。

```
in : R U R' U' R' F R2 U' R' U' R U R' F'
 negate-all → L' U' L U L F' L2' U L U L' U' L F     LL-valid ✓
```

> **🐛 站上 `lib/cube3.ts:69` 的 `mirrorAlg` 是坏的。** 它只对 `{R,L,r,l,Rw,Lw,M,x}` 取反,
> `U/D/F/B/E/S/y/z` 全漏了。含 U/F 的公式镜像出来是垃圾(T-perm 镜像后 D 层和中层被破坏)。
> 无任何测试;唯一调用点是 `PlayerControls.tsx:2052` 的 /sim 镜像按钮 —— **线上一直静默错着**。
> 迁移前必须修 + 补测试。

### 4.2 整体旋转(ROTATE):family 重映射表

`y` 一步(转写自表里的 `ROTATEY`,已实测正确):

```
R→F  U→U  F→L  D→D  B→R  L→B
r→f  u→u  f→l  d→d  b→r  l→b        (Rw/Uw/… 同理)
x→z  y→y  z→x'  E→E  M→S'  S→M      (' = amount 取反)
```

### 4.3 消去起手转体:`y^k` 起手 ⟹ **body 按 `y^-k` 重映射**

| 起手 | body 重映射 |
|---|---|
| `y` (y¹) | y³ |
| `y2` (y²) | y² |
| `y'` (y³) | y¹ |

实测:站上 **3348 条**起手带 y 且精确解开 setup 的公式,重映射后 **3348/3348 全部仍然成立**。

> **🐛 "起手 y2 换成 U2、y 换成 U" 是错的 —— 别再试。**
> 跨 9 个顶层集合、5099 条起手带 y 的公式实测:
>
> | 做法 | 在「本来就能解」的公式里成立的次数 |
> |---|---|
> | 删掉起手 y(保留 body) | **0** |
> | `y`→`U` 字面替换 | **0** |
> | 按 `y^-k` 重映射 body | **3348 / 3348** |
>
> `y` 转的是整个坐标系(中心块跟着转),后面的招式写在转过之后的框里;`U` 只转顶层。
> 数学上:`y^k · A` ≡ `rotate(A, y^-k)` + 一个纯视角的末尾转体。
>
> **结论:LL 公式里的起手转体无法在不改动 body 的前提下消除。** 要消除就得换面
> (`y R U R'` → `B U B'`),人没法按原指法执行。

### 4.4 剥离起手 AUF(表里的 `DELETE_AUF`)

```
=TRIM(REGEXREPLACE(alg, "^U2'?|^U'|^U", ""))
```

### 4.5 计步(表里的 `HTM` / `QTM`)

```
HTM = 删掉 [ ()'xyz234·↑↓./] 后剩余字符数    → 转体 0 步、slice 1 步、宽块 1 步
QTM = HTM + ("2" 的个数) + 2×("3" 的个数) + 3×("4" 的个数)
GEN = alg 里 [A-Wa-w] 的去重排序(用 W 截断把 x/y/z 排除)
```

⚠ 站上**没有**正确的 3x3 计步器(`recon-stats.ts:30` 的字符法把宽块 `Rw` 数成 2 步)。要新写。
表里 3915 行的缓存 `SH`/`SQ` 值 = 现成的测试基准,重写的计步器必须逐行复现。

---

## 5. 目标结构

站上现状 vs 迁移目标:

| set | 现在 | 目标 | 动作 |
|---|---|---|---|
| `pll` | 21 | 21 | 只换公式 |
| `zbll` | 472 | 472 | 只换公式 |
| `ell` | — | **25** | **新建 set**,从 1lll 里拆出(角已全还原、只剩棱) |
| `1lll` | **3400** | **3397** | +22(缺失的 OLL 20 组) −25(移入 ell) |
| 合计 | 3893 | **3915** | |

站上 `1lll` 的 subgroup 是 `01`–`19` + `28`–`57`,**整组缺 20**(21–27 在 `zbll` set 里,OLL 跳过在 `pll` 里)。
`3422 - 3400 = 22` 正是 OLL 20 组(四重对称,case 被大幅约简)。

### 命名

- `alg_cases.name` **保持现状不动**(`1LLL 1 1` / `ZBLL U 1` / `Aa`)。
  它是 `alg_submissions.case_name` 的 join key,**改名会孤儿化用户投稿**。
- OLLCP 名(`AB3`)+ 数字号(`0703`)存进 `meta`,UI 用 `displayAlgCaseName()` 改成
  **OLLCP 主标题 + 现有名副标题**。字母制优先,数字制保留。
- 分组:字母制为主,数字制保留(切换器)。

### Schema 改动

```sql
ALTER TABLE alg_cases ADD COLUMN meta JSONB;   -- 一条 migration
```

`meta` 装:OLLCP 名 / 数字号 / 6 套打乱 / STM·QTM / 四套最优 / 镜像·逆·镜像逆 case 号 /
叠加类型 / 对称性 / 生成元 / doc No. / Old No.

`algs`(已是 JSONB,`AlgEntry[][]`)加字段 **无需 migration**,只改 shared 类型 + UI:

```ts
type AlgEntry = {
  alg: string; algHtml?: string; altId?: string; ytId?: string;
  tags?: ('oh'|'ft'|'fmc'|'big'|'key')[];      // 新增
  source?: 'cuberoot' | 'speedcubedb';          // 新增
}
```

### 公式合并顺序

**站长的公式排最前,speedcubedb 的在后**。去重时命中就删 speedcubedb 那条。
规范化键:剥括号 + 剥换握记号 `↑↓·` + 剥标签 + 剥 `=` + 归一化写法(`R2'`→`R2`、`Rw`↔`r`)+ 压空格。

⚠ **禁止用"魔方状态等价"去重** —— H-perm 的 2-gen 版和 M 层版状态完全等价,但是两条值得各自保留的公式。

---

## 6. ⚠ 已知数据问题(表侧)

对 5080 条公式跑了「打乱 + 公式 = 还原」的全量校验(允许前 AUF、后 AUF、末尾整体转体):

| | 首条公式 (3915) | 备选公式 (1165) |
|---|---|---|
| 只需前 AUF | 2857 | 349 |
| 还需后 AUF | 969 | 715 |
| **任何 AUF 组合都解不开** | **89** | **101** |

- **"还需后 AUF"不是错误** —— 按 §3,它们只是写在不同 U 朝向下,仍是同一 case 的合法解。
- **190 条"解不开"要逐条查。** 已定位一类:**自逆 case**(`Inv` = `Self`)的打乱被 `DELETE_AUF`
  推导坏了。例:`LUB`(#177)的打乱 = 它自己的公式;`PLL-U+` 的公式其实是 `PLL-U-` 的 y2 共轭
  (两者解同一个 case)。

> **结论:不要拿表里的 `Scramble` 列当 case 身份的依据。**
> case 身份 ← 站上已有的 `setup`(按状态轨道 join);缺失的 22 个 ← `setup = inverse(已验证的首条公式)`。

---

## 6'. ⚠ 已知数据问题(站侧)—— 先导任务

对 5 个**整解**集合(`pll` / `zbll` / `1lll` / `ell` / `anti-pll`)的全部公式跑校验:

| | 数量 |
|---|---|
| 起手带 y 的公式 | 4146 |
| ├ 精确解开自己的 `setup` | 3348 |
| ├ 解不开,但**加个 AUF 就能解**(同一 case、不同 AUF 代表元) | **1279** |
| └ **完全解不开(真错)** | **0** |

**站上的公式没有坏的。** `y` 起手是公式的有机组成部分,不是脏数据。

但那 **1279 条需要额外 AUF**,意味着在 `/alg` 页面点播放时**动画跑完魔方没还原**(顶层差一个 U)。
其中 **256 条**恰好等价于「起手 y 换成 U」(抓取时把 AUF 写成了 `y`,例:PLL Z 的
`y M' U M2 U M2 U M' U2 M2` → `U …` 才精确)。但对另外 3348 条本来就对的公式,同样的替换会全部搞坏。

### 先导任务(迁移前必须做,全部机器可验证)

1. **把每条公式所需的 (前 AUF, 后 AUF) 折进公式本身**,让它精确解开 `setup`。1279 条受影响。
2. **修 `lib/cube3.ts:69` 的 `mirrorAlg`**(见 §4.1)+ 补测试。
3. **修 `lib/alg_validation.ts:88-93` 的"禁末尾 AUF"规则**:它无条件拒绝末尾的 U-family move,
   但有些公式的末尾 U 是**必需**的(去掉就解不开)。正确规则:末尾 U 只有在**去掉后仍能解**时才算冗余。
4. `OLL` / `COLL` / `CMLL` / `OLLCP` 不是整解集合(公式不还原魔方),要各自的判据才能校验 —— 单独一轮。

---

## 7. 已决事项

| # | 决定 |
|---|---|
| A1 | 起手转体见 §4.3。**y→U 已被实证推翻(0/5099)**。起手 y 予以保留;去重语义待定(§9.1) |
| A2 | `Type` 取决于首条公式,仅部分 case 有 |
| A3 | 学习进度功能(`Train` 列)**后置**,这轮不做;`Yiheng Progress` 丢弃 |
| A4 | `COEP` 只有 ZBLL/PLL 有 → 训练器里对其余 case 回退到 `Inv case` |
| A5 | `V3/V4 PDF` 旧公式不上站;`doc No.`/`Old No.` 只进 meta |
| A6 | 无交换子 / 共轭方括号写法 |
| B7 | 保持三分 + 新增 ell,总数 3915(见 §5) |
| B8 | 字母制命名优先,数字制保留 |
| B9 | ELL 单独成 set,25 个(不含 4 个 EPLL) |
| B10 | 富元数据要展示,但**不能让前端拥挤** → 走弹窗 |
| C11 | 先从生产 dump `alg_sets`/`alg_cases` 灌进本地 pg13(docker 5433)跑通全流程,验收后再上生产 |
| C12 | 上生产前 `pg_dump` 备份这两张表 |

---

## 8. 分期

| 期 | 内容 | 验收 |
|---|---|---|
| **0** | 状态轨道 join:表 3915 ↔ 站 3893 | `mapping.json` + 冲突报告;22 个新 case 被独立证实;用 `Speedcubedb no.` 列(474 行)交叉验证 |
| **1** | 记号 lib(从 `PlayerControls.tsx` 提出 `stripGripMarks`/`stripPushMarks`/`stripHandMarks` → 共享 lib)+ ROTATE / MIRROR / HTM / QTM / GEN / DELETE_AUF + **修 `mirrorAlg` bug 并补测试** | 计步器逐行复现表里 3915 个 `SH`/`SQ`;镜像通过 LL-valid 校验 |
| **2** | 全量校验 + 190 条问题公式的逐条报告 | 交站长过目 |
| **3** | Schema:`alg_cases.meta` migration + `AlgEntry` 扩字段 | typecheck + 现有测试全绿 |
| **4** | 导入:直连 PG 生成 `BEGIN…COMMIT` SQL(范本 `core/packages/alg-build/gen_zbls_sql.mjs`) | 本地 pg13 先跑;计数 3915 |
| **5** | UI:OLLCP 主名 + 富元数据弹窗 + 标签筛选 | |
| **6** | Trainer:打乱类型选择器(`Inv case`/`SH*`/`SQ*`/`H*`/`Q*`/`COEP`) | |
| **7**(后置) | 学习进度追踪(按用户存,绑账号) | |

> **导入必须直连 PG,不能走 REST。** 写接口每 IP 每分钟限流 30 次
> (`server/src/utils/recon_helpers.ts:415`),3900 个 case 要 2 小时且会被 429 打断。
> `POST` 还只能 append(`position = MAX+1`),新组会落到队尾、组序错乱。

---

## 9. 待定 / 阻塞

1. **去重语义**(A1 的后续):`y` ≠ `U` 已证。那么 speedcubedb 的 `y2 R U R' …` 和站长的
   `U2 R U R' …` 是**不同的公式**(不同的物理执行)。去重时:
   - (a) 按 §4.3 消去起手转体后再比 —— 数学正确,但比出来大概率不重复;
   - (b) 直接剥掉起手转体、**不**重映射 body,只拿 body 当去重键 —— 匹配得上,但前提是
     speedcubedb 的 body 写在规范朝向下。

   **需要站长定夺。**

2. **`setup` 用谁的**。站长指定用表的 `Scramble (alg of inv case)` 列。但该列被 `DELETE_AUF`
   剥过起手 AUF,直接当 `setup` 会让站长自己的 **969 条首条公式需要末尾 AUF**。
   → 建议 `setup = inverse(站长首条公式)`(数学上保证精确,也是站上现有约定),
   `Scramble` 列存 meta 供训练器「Inv case」模式用。两者只差一个 AUF,魔方图看起来一样。**待站长确认。**

3. **是否强行清掉所有起手 y**。唯一正确做法是重映射 body(§4.3),代价是公式换面
   (`y R U R'` → `B U B'`),人没法按原指法执行。**默认:不清,保留起手 y。**

4. **OLL 字母 ↔ 数字映射**:从表的 `OLL` sheet 提取(该表有 `OLL` 字母列 + `No.` 数字列)。

---

## 9'. 进度日志

- **2026-07-13** — 分析完成。表已导出、公式层+值层齐全;case 轨道理论坐实(ZBLL 7776/16+对称 = 493 ✓);
  镜像/旋转/消转体三条规则实测通过;发现 `mirrorAlg` 线上 bug;全量校验:表侧 190 条问题公式,
  站侧 1279 条播放时不还原(缺 AUF)、0 条真错。"起手 y→U" 规则被 5099 条样本实证推翻。
  **未写入任何生产数据。**
  发现 `mirrorAlg` 线上 bug;全量校验跑出 190 条问题公式。**未写入任何生产数据。**
