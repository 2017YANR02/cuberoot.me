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

> ⚠ **裸的 `y`→`U` 字面替换是错的**:5099 条样本里成立 0 次。删掉 y 也是 0 次。
> `y` 除了转顶层,还把 D 层 / 中层 / 中心块一起转了。
>
> 但这不代表做不到 —— 见 §4.3'。body 保持原样是**可以**的,只要补上末尾 AUF。

### 4.3' 消去起手 `y`,**body 一个字节不改** ★

这是先导任务的理论地基。它不是经验规律,是一条恒等式。

**引理.** `y = U · Dw'`(`Dw` = 底下两层)。两个因子作用在不相交的层上,所以可交换,且 `y^k = U^k · Dw^-k`。
实测:`y == U Dw'`、`y2 == U2 Dw2`、`y' == U' Dw`,三条全 true。

**定理.** 若公式体 `A` 的**净群元素与 `Dw` 可交换**,则对任意状态 `S`

```
S · U^k · A · U^-k   ==   ( S · y^k · A ) · y^-k
```

即**改写后的公式与原公式到达完全相同的状态,只差一个整体旋转 `y^-k`**。

*证明.* `S·y^k = S·U^k·Dw^-k`,故 `S·U^k = S·y^k·Dw^k`。于是
`S·U^k·A·U^-k = S·y^k·(Dw^k·A)·U^-k = S·y^k·A·(Dw^k·U^-k) = (S·y^k·A)·y^-k`,
中间一步用了 `A` 与 `Dw^k` 可交换,末一步用了 `y^-k = U^-k·Dw^k`。∎

**这条定理不依赖任何「本集合算不算还原」的判据** —— 判据只要是旋转不变的(站上一律容忍 24 个整体旋转),
改写就对 OLL / PLL / COLL / CMLL / Anti PLL / OLLCP / ZBLL / 1LLL **一视同仁地成立**。
所以先导任务**不需要**给每个集合写"还原判据",只要一个纯群论测试。

#### 判据(唯一的合法性条件)

```
可改写  ⟺  A 与 Dw 可交换
        ⟺  A = (只动顶层块的置换) ∘ (y 轴旋转)
        ⟺  body 没有净 x/z 旋转
```

正规的 LL 公式天然满足(保 F2L 就等于"支撑集 ⊆ 顶层",与 `Dw` 支撑集不交 ⟹ 可交换),
**唯一的例外是 body 带净 x/z 转体的那批**。注意两个容易踩的坑:

- **净 `y` 无所谓**。`R U R' U' R' F R F' y` 动了中心块,但 `y` 与 `Dw` 同轴、照样交换 ⟹ 可改写。
  所以「body 只动顶层块」是**充分不必要**条件,别拿它当判据。
- 判据必须直接测 `Dw^k·A == A·Dw^k`。在 12 条 body × 3 个 k 上,它对 oracle 的预测是 **36/36**。

实测 9 个 LL 集合共 **5099** 条起手带 y 的公式(oll 119 / pll 29 / coll 86 / cmll 1 / anti-pll 29 /
ollcp 747 / zbll 1120 / 1lll 2915 / ell 53):

| | |
|---|---|
| **可改写** | **5081** |
| 必须跳过(body 含净 x/z) | **18** |

改写式一律 `y^k A → U^k A U^-k`,body 一个字节不改。跳过的 18 条例:
`pll Aa: y' x L2 D2 L' U' L D2 L' U L'`、`zbll ZBLL L 6: y2 z U' R2 U' L' U R2 U' L U2`、
`ollcp OLLCP10 2: y' z U R U' R U R' U F' U' F R' U`。它们的 `x`/`z` 是必需的握持方式,保留原样。

判据经独立复核:在 5567 条可解析公式上与实测 oracle **一致 5567/5567,零分歧**。

#### 收尾 AUF:**存进库,前端显示时剥掉** ★(站长 2026-07-13 拍板)

| 层面 | 内容 |
|---|---|
| DB / API | `U R U R' U' R' F R F' U'` —— **完整公式**,`setup + alg` 精确还原 |
| 前端显示 / 复制 | `U R U R' U' R' F R F'` —— `displayAlg()` 剥掉末尾那个 U |
| 播放器 / 缩略图 / recon 查表 | **完整公式**,动画停在还原态 |
| 校验器 | 判据 = 「setup + alg 精确还原」,不放宽 |

**为什么不存"剥好的规范形、播放时现算 AUF"**(这是我最初的方案,被审计推翻):

- **推不出来。** OLL / COLL / CMLL / OLLCP **没有**"整体还原"这个判据可用 —— 实测 **1173 条**公式
  对本阶段正确却不还原整个魔方(它们的 setup 只是**首条**公式的逆,替代公式落在别的顶层排列上)。
  播放器无法统一推导收尾 AUF,得给每个集合单写目标判据。
- **失败模式更糟。** 存完整公式时,某处漏接 `displayAlg` 只是多显示一个 U(难看);
  存剥好的形式时,某个播放器漏补 AUF 就是**魔方没还原**(算错)。
- 站长原话是「**在前端显示** 最后的 U 不要有」—— 本来就是显示层规则。

⟹ 不变式:**`setup + alg` == 目标态**。任何消费方直接用库里那串都天然正确。
`displayAlg()`(`lib/alg_display.ts`)是纯字符串操作,不过 cubing.js —— 括号 / `=` 标记 /
`·↑↓` 指法记号全部原样保留。接了三处:`AlgCategoryView`(公式表 + 复制)、`AlgsPanel`(/sim 列表)、
`PllPerformerOverlay`。**管理端(AlgEditor / ValidationReportModal)故意不接** —— 那里要看库里的真值。

#### ⚠ `sticker.kind` **不是**"能不能改写"的判据

实测 API:12 个 3x3 集合是 `kind: "face"`,但**只有 `pll` / `zbll` / `1lll` / `ell` / `anti-pll`
真的以整体还原为目标**。

- `oll` / `coll` / `cmll` / `ollcp` 是 `face`,但只完成本阶段(1173 条不还原整方)。
- **`vls` / `wv` / `sv` 也是 `face`,可它们是最后一槽(F2L)集合** —— 公式净元素动 D 层和 E 层。
  按 `kind==='face'` 筛选做改写会**毁掉 77 条 VLS/WV/SV 公式**。
- 非 LL 集合(f2l / adv-f2l / zbls / cls / vls / wv / sv / fruf / eo4a)共 474 条起手 y 公式,
  **改写成功率 0/474 —— 全毁**。它们绝不能进改写脚本。

改写脚本的过滤条件 = **显式的 9 个 LL 集合名单 ∩ §4.3' 的群论判据**,两道都要。

#### 校验器的两条规则(`lib/alg_validation.ts`)

1. `face`:`setup + alg` 必须精确还原(容忍 24 个整体旋转)。
   **不再单独拦末尾 U** —— U 转不是整体旋转,`setup+A` 与 `setup+A+U` 不可能同时还原,
   所以过了还原判据的末尾 U **必然是载荷性的收尾 AUF**。旧规则对 face 是死代码,而且它和
   "必须还原"**互斥**:需要收尾 AUF 的公式两种写法都存不进来(旧 bug,已修)。
2. `f2l`:判据不看顶层,U 转对它毫无影响 ⟹ 末尾的 U **永远**是多余的,继续拦。

#### 先导任务的实际盘子

| 集合 | cases | 公式 | 起手 y | 末尾多余 U |
|---|---|---|---|---|
| oll | 57 | 228 | 119 | 0 |
| pll | 21 | 84 | 29 | 0 |
| coll | 40 | 160 | 86 | 0 |
| cmll | 42 | 168 | 1 | 0 |
| anti-pll | 22 | 83 | 29 | 4 |
| ollcp | 342 | 1115 | 747 | 4 |
| zbll | 472 | 1789 | 1120 | 54 |
| 1lll | 3400 | 4084 | 2915 | 34 |
| ell | 25 | 99 | 53 | 0 |
| **合计** | **4421** | **7810** | **5099** | **96** |

**17 个例外**:body 里含 `x`/`z` 转体(`y' x L2 D2 …` 这类 A-perm / E-perm,必须侧握执行)。
body 里有转体 ⟹ "顶层"不再是 U 面,U 转补不回来。**这些保留原样**,它们的 `x` 是必需的握持方式。

```
pll   Aa         y' x L2 D2 L' U' L D2 L' U L'
pll   Ab         y' x L U' L D2 L' U L D2 L2
pll   E          y x' L' U L D' L' U' L D L' U' L D' L' U L D
zbll  ZBLL U 41  y2 x L2 D2 L' U2 L D2 L' U2 L'
zbll  ZBLL L 4   y2 R U R' U' z' y' R U R' F' R U R' U' R' F R2 U' R' U' F
zbll  ZBLL L 6   y2 z U' R2 U' L' U R2 U' L U2
…(共 17 条,完整清单见先导任务的产出报告)
```

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

| set | 现在 | 目标 | 站长口径 | 动作 |
|---|---|---|---|---|
| `pll` | 21 | **21** | PLL | 只换公式 |
| `zbll` | 472 | **472** | ZBLL(不含 21 个 PLL) | 只换公式 |
| `ell` | — | **25** | ELL(不含 4 个 EPLL) | **新建 set**,从 1lll 里拆出 |
| `1lll` | **3400** | **3397** | 1LLL(不含 ZBLL、EPLL) | +22(缺失的 OLL 20 组) −25(移入 ell) |
| 合计 | 3893 | **3915** | 1LLL 总数 | |

**这四块恰好互不重叠、铺满 3915,别搞混**:

- `ELL ⊂ ZBLL`?**不。** ELL = 角块全还原、棱块任意(**含棱块翻色**);ZBLL = 棱块已定向。
  两者的交集正是 `EPLL`(Ua/Ub/Z/H 4 个),而 EPLL 已经被 `pll` 那 21 个收走。
  所以 `ell` 里剩下的 25 个**棱块全是翻色的**,不在 ZBLL 内。
- 站上 `1lll` 的 subgroup 是 `01`–`19` + `28`–`57`,**整组缺 20**(21–27 在 `zbll` set 里,OLL 跳过在 `pll` 里)。
  `3422 - 3400 = 22` 正是 OLL 20 组(四重对称,case 被大幅约简)。
- 站上的 `1lll = 3400` 与目标 `3397` 只差 3,**但成分完全不同**:要 +22 −25。别当成"差 3 个"糊过去。

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

## 6'. 先导任务 —— **代码已完成,SQL 待灌**

站长要求:**顶层公式集不得以整体转体 `y` 起手,且 body 不得有任何改动。**

### 规范形

```
U^lead + body + U^trail
  lead  = 起手 y 的 k(与 body 自己的起手 U 合并)
  trail = 优先取"能让 setup + alg 精确还原"的那个;取不到就退回"状态保持"的那个
  body  = 中段,一个字节不改
```

`trail` 这条两段式规则不需要"本集合算不算还原"的知识,一条通吃九个集合:
真·整还原的 5 个集合总能取到"精确还原"的 trail(顺手补上缺的收尾 AUF);
`oll`/`coll`/`cmll`/`ollcp` 的替代公式压根不整还原,自动退回"状态保持",原样等价。

脚本:`core/packages/alg-build/canonicalize_ll_algs.mjs`(`--sql` 出 SQL)
本地验证:`core/packages/alg-build/dryrun_ll_algs.mjs`(灌 pg13 → 套 SQL → 读回来逐条验)

### 变更量(9 个 LL 集合,7810 条公式)

| | 数量 |
|---|---|
| 起手 y → U(body 不变) | **5081** |
| 补齐收尾 AUF(本来就缺,与 y 无关) | **550** |
| 跳过(body 净带 x/z 旋转,`x` 是必需握姿) | **18** |
| 无需改 | 2161 |
| 受影响的 case(SQL UPDATE 条数) | **3516** |

### 本地 pg13 dry run(全绿,除 1 条既有坏数据)

| 判据 | 结果 |
|---|---|
| A. 魔友看到的一个字没变 | **5631 / 5631** |
| B. 精确还原 或 状态与原公式一致 | **5631 / 5631** |
| C. 5 个整还原集合全部精确还原 | 6121 / 6122 |
| D. 起手还留着 y 的 | **0** |

### ★ 顺带揪出的既有数据 bug(改写没造成,是新不变式把它们照出来了)

| 位置 | 毛病 | 修法 |
|---|---|---|
| `pll` **Ub** alg[2] (id 4322)<br>`R2' U R U R' U' R3 U' R' U R'` | 是 alg[3] `y2 R2 U R U R' U' R' U' R' U R'` 的**重复条目,丢了起手 y2**(`R2'`=`R2`、`R3`=`R'`,body 完全相同)。没了 y2 谁也解不开,任何 AUF 都救不回来 | **删掉这条**(它是 alg[3] 的重复) |
| `ollcp` **OLLCP10 2** alg[3]<br>`y' z U R U' R U R' U F' U' F R' U` | 末尾的 `U` 应是 `U'`。改一个字符就能还原它那个(本来就正确的)setup | 末尾 `U` → `U'` |
| `1lll` **1LLL 2 28** (id 201) | 末尾 `r` 应是 `r'`。而且 case 的 **setup 是从这条坏公式反推的**,所以打乱和解法错得一模一样、互相抵消,把错误藏住了 | 迁移时由表格覆盖 |
| `1lll` **1LLL 5 42** (id 431,两条公式都坏) | 同上,setup 也坏;没找到单 token 修复 | 迁移时由表格覆盖 |

(集合外另有 `sv` **SV 7** 一条 spam 公式 —— 8 遍小鱼手 + 一个 U,不属先导任务范围。)

### 已落地的代码改动

1. `lib/alg_validation.ts` —— 判据 = **精确还原**;`face` 集合**不再单独拦末尾 U**(见 §4.3',那条规则
   对 face 是可证明的死代码,而且和"必须还原"互斥,导致需要收尾 AUF 的公式两种写法都存不进来);
   `f2l` 集合继续拦(它的判据不看顶层,末尾 U 永远多余)。
2. `lib/alg_display.ts` —— 新增 `displayAlg()`,显示/复制时剥掉收尾 AUF。接了
   `AlgCategoryView`(公式表 + 剪贴板)、`AlgsPanel`(/sim 列表)、`PllPerformerOverlay`。
   **管理端(AlgEditor / ValidationReportModal)故意不接** —— 那里要看库里的真值。
3. `lib/cube3.ts` 的 `mirrorAlg` —— 修好(见 §4.1),12 个测试。
4. 两处 `<VisualCube>` 缩略图补传 `setup`(`AlgCategoryView:174`、`_trainer/trainer-components:252` ×2)。
   **810 个 case 的 `setup ≠ inverse(首条公式)`** —— 例:OLL 2 的首条公式带 `y'`,于是卡片把标准
   OLL 2 图案整体转了 90°。这些卡片本来就画错了;传 `setup` 既修好它,又让它对改写免疫。
5. `tests/alg_leading_y_rewrite.test.ts` —— 15 个测试,锁死 §4.3' 的定理本身 + 规范形 + `displayAlg`。

### 灌库前还要做

- [ ] `pg_dump` 备份 `alg_cases`
- [ ] 生产跑 `.tmp/canonicalize_ll_algs.sql`(3516 条 UPDATE,单个事务)
- [ ] 刷新 `lib/pll-fingertricks.test.ts:36` 的 `PLL_MAIN_ALGS` 快照 —— 21 条里 5 条会变
      (F / Gc / Ra / Ua / Ub;E 和 Ja 正好在跳过的 18 条里,不变)
- [ ] push 前端代码(push = 上线)

> **复用提醒**:`lib/recon_first_stage.ts:124` 的 `relabelY(body, k)` = `normalize([y^-k, …moves, y^k])`
> 已经是一个可用的 ROTATE 实现(靠 cubing.js simplify 让转体自己抵消),**私有未导出**。
> 需要 ROTATE 时提取它,别另写查表版。

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

2. **OLL 字母 ↔ 数字映射**:从表的 `OLL` sheet 提取(该表有 `OLL` 字母列 + `No.` 数字列)。

### 已定(站长 2026-07-13)

- 起手 `y` → `U`,body 不动,补末尾 AUF(§4.3')。17 个 body 含 x/z 的例外保留原样。
- `setup = inverse(站长首条公式)`;表的 `Scramble` 列存 meta,供训练器「Inv case」模式用。

---

## 9'. 进度日志

- **2026-07-13** — 分析完成。表已导出、公式层+值层齐全;case 轨道理论坐实(ZBLL 7776/16+对称 = 493 ✓);
  镜像/旋转/消转体三条规则实测通过;发现 `mirrorAlg` 线上 bug;全量校验跑出表侧 190 条问题公式。
  **未写入任何生产数据。**

- **2026-07-13(续)** — **先导任务代码完成,SQL 待灌**(§6')。
  - 起手 y→U 的**恒等式证严了**(§4.3':`y = U·Dw'`,`Dw` 与顶层支撑的公式可交换),
    判据从"body 只动顶层块"更正为"**`A` 与 `Dw` 可交换**"(前者充分不必要 —— 净 `y` 的 body 照样可改写)。
    判据在 5567 条可解析公式上与实测 oracle **一致 5567/5567**。
  - **推翻了自己的两个假设**:①「九个集合目标态统一 = 整体还原」是错的(`oll`/`coll`/`cmll`/`ollcp`
    只完成本阶段,1173 条公式对本阶段正确却不还原整方);②「按 `sticker.kind === 'face'` 筛选」是陷阱
    (`vls`/`wv`/`sv` 也是 face,却是最后一槽集合;非 LL 集合 474 条起手 y 公式改写成功率 **0/474**)。
  - 收尾 AUF 的存法**站长拍板方案 1**:存进库,前端 `displayAlg()` 显示时剥掉。
  - 改写 5081 条 + 补收尾 AUF 550 条 + 跳过 18 条;本地 pg13 dry run **5631/5631 全绿**。
  - 顺带揪出 4 条既有坏数据(`pll Ub` 重复丢 y2、`ollcp OLLCP10 2` 末尾 U 应为 U'、`1lll` 两个坏 case)。
  - **未写入任何生产数据。**
