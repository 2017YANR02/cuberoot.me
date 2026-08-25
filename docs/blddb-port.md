# BLDDB 移植:进度与后续

盲拧公式库 [nbwzx/blddb](https://github.com/nbwzx/blddb)(GPL-3.0)在本站的两条落地路线,
以及还剩什么没搬。最后更新 2026-08-01。

> 上游 clone 在本机 `D:\cube\blddb`(**不在仓库里**,CI 上不存在)。仓库里的是它的静态导出
> (`tools/blddb/`)和数据(`tools/blddb/data/`),由统一入口调度 `scripts/upstream/sync-blddb.ps1` 同步。

---

## 0. 两条路线

| | 路线 A:iframe 原版 | 路线 B:本站原生 |
|---|---|---|
| 入口 | `/blddb` → `/tools/blddb/`(next build 静态导出) | `/alg/3bld/lookup`、`/alg/3bld/tables`、`/alg/3bld/sheets` |
| 数据 | 编译期内联进 chunk | 运行时按需拉 `/tools/blddb/data/*.json` |
| 改不改 | ❌ fork,不动 | ✅ 自有 UI |
| 存在理由 | 穷举 Nightmare 全集(37MB)、自定义编码编辑器 | 中文、站内配色/编码方案、与其它 3BLD 工具同一套设置 |

两条都留着。原生页面吃的是**同一份数据**,所以上游数据一更新两边同步跟上。

### license 边界

只读上游的**数据**,编码逻辑本站按同一套记号自己实现(`_lib/blddb.ts`)。唯一用到上游
**代码**的是起手拇指位置(`finger.ts`):在同步期由 `.sync/blddb_postprocess.mjs` 用 esbuild
打包后跑一遍,只把结果(一条公式一个字符)写进数据 —— 那份 GPL 代码不进 client bundle。

---

## 1. 上游导航 27 条路径的覆盖表

| 菜单 | 上游路径 | 本站 | 状态 |
|---|---|---|---|
| 3BLD | `/corner` `/edge` `/twists` `/flips` `/parity` `/ltct` | `/alg/3bld/lookup?type=…` | ✅ |
| 3BLD / Settings | `/code` | 只有彳亍 / Speffz 两个预设,**没有**自定义编码编辑器 | ❌ |
| BigBLD | `/bigbld/{wing,xcenter,tcenter,midge}` | 同一个 lookup 页,类型下拉的「高阶」组 | ✅ |
| BigBLD / Settings | `/bigbld/code` | 同上;但「翼棱编码位置」那个约定开关已单独做进显示选项 | ❌(部分) |
| Nightmare | `/nightmare/{corner,edge}` | `/alg/3bld/tables?sheet=corner\|edge`,每个 case 一条推荐解 | ⚠️ 只有推荐解网格,穷举模式仍在 iframe |
| Nightmare | `/nightmare/{2e2e,2c2c,2flips,4flips,2twists,3twists,parity,ltct,5style}` | `/alg/3bld/tables?sheet=…` | ✅ |
| Tools | `/sheets` | `/alg/3bld/sheets` | ✅ |
| Tools | `/commutator` | `/alg/commutator` —— 早就有,是同作者 `nbwzx/commutator`(MIT)的独立移植 | ✅ |
| Tools | `/checker` | 没有 | ❌ |
| Settings | `/settings` | 拆进 lookup 页的「显示选项」面板 + 全站 3BLD 配置 | ✅ |
| Readme | `https://docs.blddb.net` | 外链,不搬 | — |

24 / 27 覆盖。没搬的三条见 §4。

---

## 2. 已完成

### 2.1 三阶六套(commit `1e6352f561`)

棱 / 角三循环、奇偶、翻角、翻棱、奇偶带翻。等价写法(循环移位 × 整体换贴纸)自己算,
键的唯一性锁在 `tests/blddb_lookup.test.ts`。

### 2.2 显示开关 + 速查表 + 名录(commit `97fec61fe1`)

- **起手拇指位置**:同步期算,数据里一条公式一个字符;六套三阶记录同时补成定长四位
  `[公式[], 用者[], 换位子[]|null, 起手[]]`,角 / 棱两份反而从 2364+3441KB 缩到 1142+1603KB。
- **左右镜像**:先把查询镜过去,查到的公式再镜回来(两次镜像抵消),标签保持你这个 case。
  规则表单一源 `@cuberoot/shared/alg-mirror`。
- 含逆 case、结果排序(编码 / 位置)、按作者三盲成绩筛、五个换位子写法开关,存 `blddb-prefs`。
- 站内视频弹层(抖音 / Google Drive / YouTube,中文界面抖音优先,不发探测请求)、
  `?highlight=` 深链、粘贴 `UFR-UFL-UBL` 自动填。
- `/alg/3bld/tables`:11 张速查表。`/alg/3bld/sheets`:93 位作者的公式表名录。

### 2.3 高阶四套(commit `4bda741e4e`)

翼棱 / 角心 / 边心 / 中棱。**没有**第二套 150 格编码表 —— 四档全挂在三阶那 48 个贴纸上,
字母共用,细节见 `_lib/blddb.ts` 的 `BIG_BASE`。两处会静默出错、已锁进测试的:

- **翼棱镜像要连手性一起翻**。被编码的那片由叉积 `ccw(X,Y) = X × Y` 选出,镜面反射行列式
  是 −1,叉积跟着变号 → 镜过去落在同一条棱**没被编码**的那片上,必须换成伙伴片 `YXz`。
- **翼棱编码位置**约定(标准 `UFr` / 非标准 `FUr`):两种约定下一条棱的两块翼互换字母,
  选错查到的是另一块翼的公式,不会报错。做成了显示选项里的开关。

跟着上游的三个类型差异:按作者**四盲**成绩筛(不是三盲)、公式表链接回退到 `bigbld` 键、
**不给起手**(上游那套握法判断没在宽层 / 内层记号上验证过,数据里那一位留空)。

**高阶不配图**,也别顺手换成 TwistyPlayer:VisualCube 分词器没有 `m`(整步静默丢掉,画出
一个看着像真的错图);cubing.js 认这些记号,但这份数据里 `l` 与 `Lw` 是同一条公式里的两个
不同动作(`Lw U L' U l2 …`)—— 小写是**单层内切**,不是本站别处的两层宽。

---

## 3. 同步与数据

```powershell
pwsh -NoProfile -File .\sync_upstream.ps1 -Only blddb  # 拉上游 → next build 静态导出 → 拷 tools/blddb/ → 第 7 步后处理
```

人工和仓库外调用统一使用 `sync_upstream.ps1 -Only blddb`，canonical 实现在 `scripts/upstream/sync-blddb.ps1`。

第 7 步 `.sync/blddb_postprocess.mjs` 干四件事,幂等:

1. 三阶六套算起手 + 补成定长四位;
2. 高阶四套归一成同一个四位元组(上游那边是 `[公式, 用者[], 换位子]` 的裸字符串),起手留空;
3. 拷 `{corner,edge}NightmareSelected.json`;
4. `public/data/nightmare/*.ts` → JSON。

数据量:三阶六套 3.2MB + 高阶四套 1.9MB + 速查表 235KB ≈ 5.4MB,全部按需拉、模块级缓存。

**改了 JSON 形状必须 bump `_lib/blddb.ts` 的 `DATA_VERSION`** —— `/tools/*` 是 24h `max-age`
发的,不换 URL 的话老浏览器会拿旧结构的缓存喂新代码,直接崩在读新字段那一行。

---

## 4. 没做的,以及为什么

### 4.1 Nightmare 穷举全集(37MB)

`{corner,edge,flips,parity,twists,ltct}Nightmare.json`,穷举生成、每个 case 都有解。
菜单里那 11 页只要 235KB(推荐解 + 静态表),已经搬了;37MB 是**模式切换**(人工集 ↔ 穷举集)
才要的。原生页面查不到时提示去完整库,iframe 那边随便查。

要搬得先解决:37MB 进 git、静态源站带宽、客户端一次拉 6MB 单文件。**建议维持现状。**

### 4.2 `/checker`(公式校验器)

粘一条公式,告诉你它解的是哪个 case。工作量不小(要在客户端跑 5×5 状态机 + 记号翻译层,
见 §2.3 的记号坑),而本站 `/alg/commutator` 已经覆盖了「换位子 → 公式」这个方向。

### 4.3 `/code` `/bigbld/code`(自定义编码编辑器)

在魔方展开图上逐格填字母,存 localStorage。本站现在只给彳亍 / Speffz 两个预设。
真要做,应该做成**全站 3BLD 设置**的一部分(`bld-config-store` 的 scheme 从 id 变成 48 位串),
影响读码 / 默写 / 公式表 / 查询四处,不是 lookup 页一页的事。

### 4.4 别的可做项(优先级从高到低)

- **高阶给个案例图**。要么给 VisualCube 补 `m` / 内层记号,要么写一层「BLDDB 记号 → cubing.js
  记号」的翻译(`l` → 单层内切)。后者顺带能给高阶开状态级测试(见 §5)。
- **高阶的记忆 / 浮动训练器**。真要做就该在 `alg/_blddb/` 提取共用层,再开 `/alg/bigbld/*`
  路由;现在高阶挂在 `/alg/3bld/lookup?type=wing` 下是因为编码和显示开关跟三阶完全共用,
  单开路由要挪 lib、store、两个组件、页面主体加 CSS,只为 URL 好看不划算。
- **`sourceToYoutube.json` 没用上**。`algToUrl.json` 对高阶公式 0 命中(14008 条一条视频都没有),
  按作者维度的 YouTube 链接可能能补上一部分。

---

## 5. 怎么验

三层,前两层在仓库里,第三层是一次性的。

1. **结构不变量**(`tests/blddb_lookup.test.ts`):贴纸格分类、编码方案互译、等价类封闭、
   **任意两个键不得互为等价写法**(破了 = 同一个 case 两个代表元,查到哪个全看候选顺序)。
2. **镜像与数据形状**(`tests/blddb_mirror.test.ts`):三阶那六套拿 cubing.js 的 KPuzzle 比
   **真实魔方状态**(`state(mirror(A)) == state(B)`,只比该类型说死的那几轨);
   高阶比结构合法性 + 全量公式切得动词、镜两次回到原文。
   CI sparse-checkout 拉了角 / 奇偶 / 翻角 / 翻棱 / 奇偶带翻 / 翼棱 / 中棱,缺的自动 skip。
3. **拿上游转换器当 oracle**(一次性,写断言之前跑的,脚本没进仓库)。要重跑:

   ```js
   // 1) 打包上游转换器
   esbuild.build({ entryPoints: ['D:/cube/blddb/src/utils/bigbldCodeConverter.ts'],
     bundle: true, format: 'cjs', platform: 'node', outfile: '<tmp>/up.cjs',
     absWorkingDir: 'D:/cube/blddb' })
   // 2) 在一个临时 vitest 里 require 它,对全量键比三样:
   //    UP.customCodeToVariantCode(k, type)        vs  variantKeys(k, type)
   //    UP.customCodeToPosition(k, type)           vs  positionsOf(k, type)
   //    UP.customCodeToVariantCode(k, type, true)  ∋   mirrorChichu(k, type)
   ```

   2026-08-01 跑过一次:高阶 5388 个键三项全过。注意上游 `codeTypeToPositions` 在 node 下
   拿不到 localStorage,翼棱那档会退化成 48 片全给 —— 拿彳亍方案串筛出真正被编码的 24 片再比。

---

## 6. 相关文件

| 干什么 | 在哪 |
|---|---|
| 同步 | 根 `sync_upstream.ps1 -Only blddb`；canonical 实现为 `scripts/upstream/sync-blddb.ps1`，后处理为 `.sync/blddb_postprocess.mjs` |
| 编码 / 取数 | `core/packages/client/app/[lang]/alg/3bld/_lib/blddb.ts` |
| 页面 | 同目录 `lookup/`、`tables/`、`sheets/` |
| 显示偏好 | `_store/blddb-prefs-store.ts`、`_components/BlddbOptions.tsx` |
| 镜像规则表(单一源) | `core/packages/shared/src/alg_notation.ts` 的 `MIRROR_SWAP` / `MIRROR_EXEMPT` |
| 数据 | `tools/blddb/data/`(三阶六套 + `bigbld/` + `nightmare/` + `*NightmareSelected.json`) |
