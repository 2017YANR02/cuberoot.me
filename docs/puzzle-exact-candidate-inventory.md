# 适中魔方完整分布候选盘点

检查日期：2026-10-23。状态：有限目录盘点和本轮选定计算已完成。范围为当前 `/sim` 固定目录、`pgCatalog.ts`（含 28 个 `NATIVE_PUZZLES`）、现役 `puzzle-solvers`、client 小魔方求解器及仓库 csTimer 打乱目录。本表区分实体完整状态、受限生成元子群、不可见朝向商和整转商；小型 PDB 不当成完整魔方。

**第四轮最终状态：170 项已逐一分类，45 个分布入口已接入；UFO 模型边界与最后 10 个公开表见文末最终审计。**

第三轮网站范围为 160 个目录条目（含别名、度量、子目标和 custom 占位）：36 项完整结果、3 项同构复用、92 项超预算、19 项部分结果、7 项统计模型/坐标待核验、3 个 Redi 入口待独立复核，没有通用原因兜底项。累计接入 27 份本地精确结果及完整状态/陪集代表下载，另复用 7 份公开精确直方图和 1 份单列的 Redi 作者报告。二阶和 Clock 沿用已有完整结果。详细交付、资源与检查证据见[主跟踪表](puzzle-exact-distributions-tracker.md)。

第三轮没有新增全空间计算：新增 [Domino HTM/QTM](https://www.jaapsch.net/puzzles/domino.htm)（18/19 步、406,425,600 整转商状态）、[Skewb Ultimate](https://www.jaapsch.net/puzzles/ultimate.htm)（14 步、100,776,960 态）与 [Bicube QTM](https://www.jaapsch.net/puzzles/bandage.htm)（35 步、1,108,800 态），均逐档核对来源与适用口径。[Redi 原作者报告](https://www.speedsolving.com/threads/redi-cube-discussion-and-help.65452/post-1263980) 给出 0–19 步完整表，但原帖只另行暴搜确认 0–8 步，未找到后续深层验证记录，因此界面单独标为“作者报告，待独立复核”。

继续调查的 BSQ 仅允许顶层转动与切层（[qqTimer 原作者文档](https://mzrg.com/qqtimer/megadoc.html)），没有找到相同动作集的公开完整分布；399 个形状及 cube-shape/macros 子表不能直接卷积。源码中无证据的 `closure > 2^53` 注释不是排除证书。Siamese 虽能分成两半，仍缺超过预算的单半完整距离表；Mastermorphix 的保形 PG 小群也不能替代实体。已有模型和保护中止结果保持不变。

追加完成 U/M QSTM（23）、EOLR AC/MC/EO+DM（均13）、DR→HTR（29,400 陪集，13）和 HTR→FR（3,456 陪集，11）。这些数字分别属于限定动作子群或条件子目标，不能当作任意三阶整解直径。

本轮上限：最多 50,000,000 个状态，固定工作数组不超过 128 MiB，单进程 RSS 不超过 512 MiB，一次只调度一个完整枚举。下文运行时间为实施前分级，实际结果以串行计算日志为准。调查未启动全空间 BFS；几何元数据和小度数 Schreier–Sims 投影用于排除大模型。

## 本轮新增结果与现有完整结果

| 候选 | 完整空间 / 计步约定 | 当前实现与结论 | 计算级别 |
| --- | --- | --- | --- |
| Tetraminx | 933,120；固定四顶点框架；每次 ±120° 顶点转动一步；无小尖 | **完成，God 11**；`client/scripts/tetraminx-exact-distribution.mts`；当前 PG 完整闭包与独立 Pyraminx core 直方图逐项一致 | 约 19 MiB 数组 |
| Pyraminx 含四小尖 | 75,582,720；U/L/R/B/u/l/r/b 的 ±120° 各一步，固定顶点框架 | **精确组合完成，God 15**；`client/scripts/derive-pyraminx-tips-distribution.mts`；主体分布与 `(1+2x)^4` 卷积，非新增 BFS；181 个独立回放样例，最深 512 态仅列 12 个 | 20.4 ms；RSS 98.3 MiB |
| Jing Pyraminx | 3,732,480；固定四面中心；每次 ±120° 面转一步 | **完成，God 12**；`client/scripts/jing-pyraminx-exact-distribution.mts`；角 324 × 棱 11,520；与 Jaap 全直方图一致；无中心 logo 朝向目标 | 390.3 ms；RSS 115.5 MiB |
| 真实 Pyramorphix | 136,080；固定 DBL 真角，四个平中心的朝向不可见；整转忽略 | **HTM / QTM 均完成，God 9 / 11**；`client/scripts/pyramorphix-exact-distribution.mts`；公共 2×2 角模型 7! × 3³；不使用 PG `t e 0` | 67.5 / 59.2 ms；RSS 104.9 / 89.4 MiB |
| Dino | 19,958,400；十二种可达整转归一化；八个顶点 ±120° 一步 | **两种目标均完成**；**单个指定配色目标** God 11，**两种镜像目标均接受** God 10；完整分布与独立资料一致 | 固定工作数组约 97 MiB；运行记录见主跟踪表 |
| 3×3 仅半转 `half` | 663,552；仅 U2/R2/F2/D2/L2/B2，固定中心，每个半转一步 | **完成，子群 God 15，最深 144 态全列**；`client/scripts/restricted333-exact-distribution.mts`；不是三阶完整 God | 78.3 ms；RSS 99.1 MiB |
| LSE `lsemu` | 184,320；仅 U/M 的三种非零转量，每个 token 一步；包含顶层角 AUF 与中心位置 | **完成，子群 God 20，最深 2 态全列**；同上模块；5,760 × 32，未删除中心或 AUF | 56.1 ms；RSS 84.6 MiB |
| 二阶镜面 `mirror2` | 与有区别的标准 2×2 物块一一对应时为 3,674,160 | 可复用已知 2×2 分布；是模型同构转用，不算新枚举 | 无需重跑 |

Jing 与 Pyramorphix 独立依据：[Jaap 的 Pyraminx / Jing 全分布](https://www.jaapsch.net/puzzles/pyraminx.htm)、[真实 Pyramorphix 全分布及 DBL/U/R/F 模型](https://www.jaapsch.net/puzzles/pyramorf.htm)。Dino 目标区别见 [Jaap 的 Dino 全分布](https://www.jaapsch.net/puzzles/dinocube.htm)。没有独立直方图的两个受限模型，已通过完整闭包、全边距离差 ≤1、每个非根状态有降距边、独立动作与样例回放证明最短性，未声称外部直方图一致。它们共导出 532 个独立回放样例。串行调度、网站导出数量与原始证据见[主跟踪表](puzzle-exact-distributions-tracker.md)，时间为本机单轮实测。

含小尖 Pyraminx 的依据是**动作图直积分解**：定义相对尖角为 `CORNERS2.orientation - CORNERS.orientation (mod 3)`，八个主转保持这些相对角，八个小尖转各只改变一个相对角。脚本独立核验全部 16 个生成元及主体棱编号重标号，故任意路径下界为主体最短距离加非零尖角数，串接各因子的最短路径达到该下界。全分布来自已完成主体报告的哈希可追溯卷积；未进行新的全图扫描，也未声称存在独立的含小尖直方图参考。原始[报告](../.local/small-puzzle-distributions-20261023/derived/pyram-tips.json)及 [CSV](../.local/small-puzzle-distributions-20261023/derived/pyram-tips.csv)保存在本地生成物目录。

以下实现已保存完整距离分布；重复计算只能算复核或为网站补充样例，不算新增实体结果：

| 项目 | 状态数 | 已有 God | 可核查入口 |
| --- | ---: | ---: | --- |
| Floppy / 133 | 192 | 8 | `client/lib/floppy-solver.ts`：`floppyGraphStats` |
| Pyraminx Duo | 324 | 4 | `puzzle-solvers/src/pyraminx-duo.ts`：`DUO_LENGTH_DISTRIBUTION`、`duoGraphStats` |
| Ivy | 29,160 | 8 | `puzzle-solvers/src/ivy.ts`：`ivyGraphStats` |
| Gear | 41,472 | 6 | `puzzle-solvers/src/gear.ts`：33-token FTM、`gearGraphStats` |
| UFO | 60,480 | 10 | `client/lib/ufo-solver.ts`：`ufoGraphStats` |
| Skewb Diamond | 138,240 | 10 | `client/lib/diamond-solver.ts`：`diamondGraphStats` |
| Cmetrick Mini | 165,888 | 10 | `client/lib/cm2-solver.ts`：当前固定坐标与 token metric、`cm2GraphStats` |
| 八数码 | 181,440 | 31 | `client/lib/slide8-solver.ts`：`slide8GraphStats` |
| Tower / 223 | 241,920 | 14 | `client/lib/cuboid223-solver.ts`：`cuboid223GraphStats` |
| Pyraminx core | 933,120 | 11 | `solver/src/pyraminx_solver.rs`：`JAAPSCH_CORE_HIST`；不含四个小尖 |
| Bicube | 1,108,800 | 28 | `puzzle-solvers/src/bicube.ts`：`BIC_LENGTH_DISTRIBUTION` 与已生成紧凑表 |
| Super Floppy | 3,041,280 | 13 | `client/lib/superfloppy-solver.ts`：`superFloppyGraphStats` |
| Skewb | 3,149,280 | 11 | `puzzle-solvers/src/skewb.ts`：`skewbGraphStats` |
| 2×2 | 3,674,160 | 11 HTM / 14 QTM | `puzzle-solvers/src/cube222.ts`、现存网站理论分布 |

Bicube 的常驻排序 rank+distance 表约 10 MB，但现有 `bicBuildTable()` 仍使用数字 `Map` 和逐层 `number[][]` 前沿，不能据常驻表大小认定建表峰值受限；如复核应读取现存表，或先换成有固定上限的容器。Duo 的中心朝向不计目标；带有定向 logo 的 8,748 状态版本是不同实体目标，当前项目没有该模型，不能凭乘法补作项目结果。

## 已核查的较大现役求解器与小长方体

| 类型 | 排除证据 / 精确范围 |
| --- | --- |
| Redi | `tools/cstimer-scramble/scramble/redi.js` 同时跟踪十二棱排列及八角朝向；仅十二棱投影已是 A12 = 239,500,800，超过上限。Dino 的计数不能当成 Redi 总数。 |
| Siamese 222、123 | `puzzle-solvers/src/sia222.ts` / `sia123.ts`：**每一个半边**的棱投影已 92,897,280。角 PDB 的 3,674,160 / 29,160 都只是投影；A/B 直积虽能将最优距离相加，也不能消除半边巨大完整空间。 |
| Siamese 113 | csTimer `megascramble.js` 的每半边 ⟨U,u,R,r⟩ 包含 123 的 ⟨U,R,r⟩；不能将 113 假定比 123 小。当前没有完整实体求解器/小空间证明。 |
| Domino / 233 | `puzzle-solvers/src/cuboid233.ts`：固定参考系 8!² = 1,625,702,400；通常去四种轴向整转仍 406,425,600。现有两个 40,320 PDB 不是完整分布。 |
| 334、335、336、337 | 各 `cuboid33*.ts` 已有完整状态量级证据；分别约 1.65e17、1.56e11、8.39e24、1.27e20。独立小轨道的距离不能合成总距离，动作同时影响多个轨道。 |
| Cmetrick 3×3 | `cm3.ts`：165,112,971,264，超限。 |
| Square-1、Square-2、Super Square-1 | 本机不直接枚举；`sq2.ts` 当前 `(u,d)/` 子群也已 12·18!，`ssq1.ts` 约 1.15e25。SQ1 已有公开 twist 13 / face-turn 31 的完整计数，本轮已接入，区别于 WCA 12c4。 |
| Square-4 | 已有 40 扇区合法动作和逆转回归；尚缺完成颜色/整转等价核验的精确统计坐标或超预算证书，不能说完全没有模型。 |
| Bandaged Square-1 | `bsq.ts` 已有 12,000,004 状态保护中止且前沿仍快速增长的记录；399 个 shape / 518,400 个 cube-shape coset 不是整个实体，不能以小投影包装完整 God。 |
| Helicopter、Curvy Copter、CTICO | `heli.ts`、`helicv.ts`、`ctico.ts` 已分别给出约 1.18e19、3.03e21、3.56e33 的当前生成元空间；允许 jumbling 的实体还须另外核对范围。 |
| Crazy 3×3、Mirror 3×3、Ghost、Sphere、NxN≥3 | 普通 3×3 级别或更大；外形修改不自动缩小状态空间。 |
| Pyraminx 含四小尖 | 75,582,720，超过本轮直接枚举上限；通过严格直积分解的精确卷积已完成，见上表。933,120 core 本身仍不等同于完整含尖状态。 |
| Megaminx、Kilominx、FTO、Master Pyraminx | 远超本轮上限；现存近最优/分阶段求解器、随机样本与轨道 PDB 都不等于完整分布。 |
| Rex | 有置换模拟器和几何回归；严格带标签的群阶与实体同色花瓣、整转商尚未统一核验，不能跨口径比较后直接判定模型错误或完整空间可枚举。 |
| 15 数码 | 16!/2，超限；当前统计为采样。 |
| Clock | 空间 12¹⁴ 很大，已有结构性精确计算；不应转为逐状态 BFS。 |
| Magic / Master Magic | `magic.ts` 只建模一条文档化折叠路线；并非任意绳态完整模型，不能把路线长度当上帝之数。 |

csTimer 的 `112` 只有同一轴 R/R2/R'，是可直接算出的四态循环（HTM 分布 `[1,3]`）；位于 upstream “Jokes” 区，没有自有实体模拟器/求解器。不把这个恒等式作为主要新增枚举成果。`111` 的 24 种空间朝向在忽略整转时只剩一个状态；LOL、负阶等字符串不是实体模型。接力模式为已有项目组合，不重复列为新的魔方。

## 旧 PG 目录的剩余条目

`sim/engine/exploreBound.ts` 已明确把整个 Pyramorphix / Mastermorphix 家族排除于忠实完整模型。PG `pyramorphix: t e 0` 只有半转；两个不同切深的 `mastermorphix` / `masterpyramorphix` 小群也不能代表实体可变形魔粽。真实形变打乱在 `client/lib/shape-mod-scramble.ts` 分别映射 222 / 333。它们若单独发表，只能明确称作**当前 PG 保形子群**，不能称实体完整 God。

[csTimer 作者的 PG 状态表](https://github.com/cs0x7f/cstimer/wiki/Number-of-states-for-twisty-puzzles)确认 Little Chop 约 1.35e14、Christopher's Jewel 约 2.01e15、Octastar 约 1.29e22、Compy 约 5.24e11；均排除。该表有若干 normal/super 大小反常条目，不能在没有模型核验时作为精确群证明。

其余旧 PG ID 均属于已知大模型族，或含 jumbling 的实体需更广模型；不因较少的 cut/轨道数列为适中：

- `masterskewb`、`professorskewb`；`masterpyraminx`、`mastertetraminx`、`professorpyraminx`、`professortetraminx`、`royalpyraminx`、`royaltetraminx`、`emperorpyraminx`、`emperortetraminx`。
- `masterfto`、`trajbersoctahedron`；`gigaminx`、`teraminx`、`petaminx`、`examinx`、`zetaminx`、`yottaminx`。
- `pentultimate`、`masterpentultimate`、`elitepentultimate`、`starminx`、`starminx2`、`pyraminxcrystal`、`chopasaurus`、`bigchop`。
- `radiochop`、`icosamate`、`astrominx`、`astrominxbigchop`、`redicosahedron`、`redicosahedroncenters`、`icosaminx`、`eitansstar`。
- `cube2dino`、`cube2littlechop`、`dinolittlechop`、`cube2dinolittlechop`、`megaminxchopasaurus`、`starminxcombo`。

`tetraminx`、`jingpyraminx` 在新增表；`skewbdiamond` 已有表；`curvycopter`、Little Chop、Compy、Christopher's Jewel、Octastar 和三个 morphix ID 已分别讨论。以上覆盖旧 PG 目录所有 ID。

## 28 个 native 模型：小度数投影排除证据

只读取当前 `NATIVE_PUZZLES` 描述，以 `getPuzzleGeometryByDesc` 的 `allMoves:true, orientCenters:false, addRotations:false` 生成模型。独立使用仓库 csTimer `grouplib.SchreierSims` 求一个或两个轨道的群阶，没有枚举群元素或求最短路。探针 Node heap 上限 128 MiB，每个群阶调用 VM 超时 1.5 秒。**证据留存限制：原探针为内联执行，原脚本和 stdout 未保存；没有为补档重复运行。** 本地[审计说明](../.local/small-puzzle-distributions-20261023/candidate-audit/README.md)及[记录值快照](../.local/small-puzzle-distributions-20261023/candidate-audit/recorded-native-projections.json)明确区分记录值与缺失的原始运行证据；下列数值不是可直接恢复的完整原始日志。

由 `pg.get3d().stickers` 的 orbit/ord/ori/color 得到同色片签名；投影群阶除以各同色签名重数阶乘、不可见自转对称数、最大整转数（立方/八面体 24，二十/十二面体 60）。所得是**保守可见状态下界**，不是完整精确总数。忽略其他轨道只会降低此下界；故下表每行超过 50,000,000 即足以排除。jumbling 如有额外状态，也不会降低该下界。

| ID | 投影轨道 / 置换度数 | 去同色与整转后的状态下界 |
| --- | --- | ---: |
| superz | CENTERS / 24 | 135,277,939,046,250 |
| cube3dino | EDGES / 24 | 6,311,527,524,141,840,000 |
| dogic | CENTERS2 / 20 | 20,274,183,401,472,000 |
| octahedron4 | CENTERS / 24 | 15,391,623,287,040,000 |
| dinoskewb | EDGES + CENTERS / 36 | 37,344,162,240,000 |
| lattice | EDGES + EDGES2 / 48 | 2,390,026,383,360,000 |
| hyperx | CENTERS / 24 | 135,277,939,046,250 |
| latticex | EDGES / 24 | 6,311,527,524,141,840,000 |
| masterbrilic | CORNERS permutation / 20 | 20,274,183,401,472,000 |
| masterftov2 | C4RNER + EDGES / 48 | 114,960,384,000 |
| quadx | EDGES / 24 | 81,749,606,400 |
| dinoocta | C4RNER + CENTERS / 36 | 88,704,000 |
| fto5 | EDGES + EDGES2 / 48 | 2,390,026,383,360,000 |
| fto6 | CENTERS + EDGES / 36 | 1,844,156,160,000 |
| eto | EDGES / 24 | 6,311,527,524,141,840,000 |
| radiocrystal | EDGES / 60 | > 6e70 |
| cube3skewb | CENTERS / 24 | 135,277,939,046,250 |
| heliskewb | CENTERS / 24 | 67,638,969,523,125 |
| comboctahedron | EDGES / 24 | 40,874,803,200 |
| circoradiolarian | C5RNER / 60 | 194,906,250,000,000 |
| icosababyface | CENTERS / 20 | 20,274,183,401,472,000 |
| cube2heli | CENTERS / 24 | 135,277,939,046,250 |
| cube3heli | EDGES / 24 | 6,311,527,524,141,840,000 |
| radiojewel | CENTERS4 / 20 | 20,274,183,401,472,000 |
| radioweb | CENTERS4 / 20 | 20,274,183,401,472,000 |
| catscradle | CENTERS3 / 20 | 20,274,183,401,472,000 |
| radiocanon | C5RNER / 60 | 194,906,250,000,000 |
| radiojam | CENTERS4 / 20 | 20,274,183,401,472,000 |

本轮可落地的新增实体 Jing、真实 Pyramorphix 与归一化 Dino，以及显式受限 `half` / `lsemu` 均已完成。上述有限目录没有留下已确认适中、尚待完整计算的实体。对动态自定义切割和任意训练子阶段，不作“所有可能模型均已穷尽”的无限范围承诺。

## 第二轮可复核审计（2026-10-23）

第二轮不重复全空间 BFS。新增 `core/packages/client/scripts/audit-exact-puzzle-candidates.mts` 将每个投影的生成元置换、颜色签名、同色/不可见朝向除数、整转上界、精确群阶和保守状态下界全部保存；每次群阶调用限 1.5 秒、置换度数不超过 80，Node heap 上限 128 MiB。各目录保留当次源码副本及 SHA256 manifest。先前内联探针原输出缺失仍是历史事实，以下新证据已补上可复核来源。

- [28 个 native 首批证据](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/manifest.json)：其中 Radio Crystal 的朝向展开度数 120 触及探针 cap，未尝试；改用 60 度纯排列投影的完整证据在下一批。
- [旧 PG 目录及 Radio Crystal 证据](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/manifest.json)。
- [金字塔/斜转等联合轨道证据](../.local/small-puzzle-distributions-20261023/candidate-audit/joint-second-pass/manifest.json)：避免把单个小轨道误判成完整小空间。
- [Gigaminx 角/棱投影证据](../.local/small-puzzle-distributions-20261023/candidate-audit/minx-second-pass/manifest.json)。更高阶五魔沿用相同的可见角块运动投影，不为重复排除而构建巨大几何。

本轮共检查 69 个不同 PG/native ID；其中 67 个具有超过五千万的已记录可见状态下界。另两个 morphix PG 模型的小群是保形子群，继续按不忠实完整实体模型排除。所有 28 个 native 都已取得足够的超限投影证据。

| ID | 核验投影 | 置换度数 | 去同色与整转后的状态下界 | 原始证据 |
| --- | --- | ---: | ---: | --- |
| astrominx | CENTERS | 60 | 18965687731971083484653607874462124667510117975982080000000000000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/astrominx.json) |
| astrominxbigchop | CENTERS | 60 | 37931375463942166969307215748924249335020235951964160000000000000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/astrominxbigchop.json) |
| bigchop | CENTERS | 60 | 15554234651182784842851540158043249992941735505052303360 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/bigchop.json) |
| catscradle | CENTERS3 | 20 | 20274183401472000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/catscradle.json) |
| chopasaurus | CENTERS | 60 | 7777117325591392421425770079021624996470867752526151680 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/chopasaurus.json) |
| christophersjewel | EDGES | 24 | 40874803200 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/christophersjewel.json) |
| circoradiolarian | C5RNER | 60 | 194906250000000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/circoradiolarian.json) |
| comboctahedron | EDGES | 24 | 40874803200 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/comboctahedron.json) |
| compycube | EDGES + CORNERS + CORNERS2 + CENTERS | 54 | 785682374400 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/joint-second-pass/compycube.json) |
| cube2dino | EDGES | 48 | 6311527524141840000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/cube2dino.json) |
| cube2dinolittlechop | CENTERS | 24 | 135277939046250 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/cube2dinolittlechop.json) |
| cube2heli | CENTERS | 24 | 135277939046250 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/cube2heli.json) |
| cube2littlechop | CENTERS | 24 | 135277939046250 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/cube2littlechop.json) |
| cube3dino | EDGES | 48 | 6311527524141840000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/cube3dino.json) |
| cube3heli | EDGES | 48 | 6311527524141840000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/cube3heli.json) |
| cube3skewb | CENTERS | 24 | 135277939046250 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/cube3skewb.json) |
| dinolittlechop | CENTERS | 24 | 67638969523125 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/dinolittlechop.json) |
| dinoocta | C4RNER + CENTERS + EDGES + CENTERS2 + CENTERS3 + CENTERS4 | 80 | 47112200068792320000000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/dinoocta.json) |
| dinoskewb | EDGES + CENTERS | 36 | 37344162240000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/dinoskewb.json) |
| dogic | CENTERS2 | 20 | 20274183401472000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/dogic.json) |
| eitansstar | EDGES:permutation | 60 | 64579359509837737184920823071333303277335537957347665233920000000000000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/eitansstar.json) |
| elitepentultimate | EDGES:permutation | 60 | 64579359509837737184920823071333303277335537957347665233920000000000000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/elitepentultimate.json) |
| emperorpyraminx | EDGES + EDGES2 | 48 | 1167005070000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/joint-second-pass/emperorpyraminx.json) |
| emperortetraminx | EDGES + EDGES2 | 48 | 1167005070000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/joint-second-pass/emperortetraminx.json) |
| eto | EDGES | 48 | 6311527524141840000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/eto.json) |
| fto5 | EDGES + EDGES2 | 48 | 2390026383360000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/fto5.json) |
| fto6 | CENTERS + EDGES | 36 | 1844156160000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/fto6.json) |
| gigaminx | EDGES:permutation | 60 | 64579359509837737184920823071333303277335537957347665233920000000000000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/minx-second-pass/gigaminx.json) |
| heliskewb | CENTERS | 24 | 67638969523125 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/heliskewb.json) |
| hyperx | CENTERS | 24 | 135277939046250 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/hyperx.json) |
| icosababyface | CENTERS | 20 | 20274183401472000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/icosababyface.json) |
| icosamate | CENTERS | 20 | 20274183401472000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/icosamate.json) |
| icosaminx | EDGES | 60 | 1186721206316493019736003416424448000000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/icosaminx.json) |
| lattice | EDGES + EDGES2 | 48 | 2390026383360000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/lattice.json) |
| latticex | EDGES | 48 | 6311527524141840000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/latticex.json) |
| littlechop | CENTERS | 24 | 67638969523125 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/littlechop.json) |
| masterbrilic | CORNERS:permutation | 20 | 20274183401472000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/masterbrilic.json) |
| masterfto | C4RNER + EDGES | 48 | 114960384000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/joint-second-pass/masterfto.json) |
| masterftov2 | C4RNER + EDGES | 48 | 114960384000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/masterftov2.json) |
| masterpentultimate | CENTERS2 | 60 | 7777117325591392421425770079021624996470867752526151680 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/masterpentultimate.json) |
| masterpyraminx | EDGES + EDGES2 | 36 | 3592512000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/joint-second-pass/masterpyraminx.json) |
| masterskewb | EDGES + CORNERS + CORNERS2 | 48 | 1047576499200 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/joint-second-pass/masterskewb.json) |
| mastertetraminx | EDGES + EDGES2 | 36 | 3592512000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/joint-second-pass/mastertetraminx.json) |
| megaminxchopasaurus | CENTERS | 60 | 7777117325591392421425770079021624996470867752526151680 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/megaminxchopasaurus.json) |
| octahedron4 | CENTERS | 24 | 15391623287040000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/octahedron4.json) |
| octastar | EDGES | 48 | 3155763762070920000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/octastar.json) |
| pentultimate | CORNERS | 60 | 23563902142421896679424000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/pentultimate.json) |
| professorpyraminx | EDGES + EDGES2 | 48 | 1167005070000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/joint-second-pass/professorpyraminx.json) |
| professorskewb | EDGES + EDGES2 | 48 | 2390026383360000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/joint-second-pass/professorskewb.json) |
| professortetraminx | EDGES + EDGES2 | 48 | 1167005070000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/joint-second-pass/professortetraminx.json) |
| pyraminxcrystal | EDGES | 60 | 1186721206316493019736003416424448000000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/pyraminxcrystal.json) |
| quadx | EDGES | 24 | 81749606400 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/quadx.json) |
| radiocanon | C5RNER | 60 | 194906250000000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/radiocanon.json) |
| radiochop | EDGES:permutation | 60 | 64579359509837737184920823071333303277335537957347665233920000000000000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/radiochop.json) |
| radiocrystal | EDGES:permutation | 60 | 64579359509837737184920823071333303277335537957347665233920000000000000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/radiocrystal.json) |
| radiojam | CENTERS4 | 20 | 20274183401472000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/radiojam.json) |
| radiojewel | CENTERS4 | 20 | 20274183401472000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/radiojewel.json) |
| radioweb | CENTERS4 | 20 | 20274183401472000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/radioweb.json) |
| redicosahedron | EDGES | 60 | 1186721206316493019736003416424448000000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/redicosahedron.json) |
| redicosahedroncenters | EDGES | 60 | 1186721206316493019736003416424448000000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/redicosahedroncenters.json) |
| royalpyraminx | EDGES + EDGES2 | 48 | 1167005070000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/joint-second-pass/royalpyraminx.json) |
| royaltetraminx | EDGES + EDGES2 | 48 | 1167005070000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/joint-second-pass/royaltetraminx.json) |
| starminx | EDGES | 60 | 1186721206316493019736003416424448000000 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/starminx.json) |
| starminx2 | CENTERS | 60 | 7777117325591392421425770079021624996470867752526151680 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/starminx2.json) |
| starminxcombo | CENTERS | 60 | 7777117325591392421425770079021624996470867752526151680 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/starminxcombo.json) |
| superz | CENTERS | 24 | 135277939046250 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass/superz.json) |
| trajbersoctahedron | EDGES | 24 | 40874803200 | [JSON](../.local/small-puzzle-distributions-20261023/candidate-audit/catalog-second-pass/trajbersoctahedron.json) |

恐龙八面体的六轨完整标签群阶为 `1899129720737872352378880000000`；其可见状态保守下界仍为 `47112200068792320000000`。旧的 88,704,000 只是两轨投影，不能当成整体大小。其它轨道共享转动生成元；本轮没有找到可像独立小尖一样证明最短距离相加的新完整分解。群论直积或独立 PDB 本身不足以证明距离分布可卷积。

二阶镜面已用 [audit-mirror2-isomorphism.mts](../core/packages/client/scripts/audit-mirror2-isomorphism.mts) 核验：[证书](../.local/small-puzzle-distributions-20261023/candidate-audit/mirror2-isomorphism.json)。8 个无序尺寸三元组互不相同，每块的 3 个轴长也不同，24 个角块/扭转组合可区分；其逻辑引擎仍为 `Cube(2)`。因此按形状还原、忽略整转时，完整图与标准二阶同构，HTM/QTM 分布及最优样例可直接转用，不是新 BFS。

新增交付优先项为 Pyraminx Duo（324 态、God 4、现有完整直方图但旧统计页未接）和二阶镜面同构入口。Floppy、Gear、项目 UFO 模型（实体对应待核验）、CM2、Diamond、8-puzzle、Bicube 已有完整数学结果；补充离线样例/全态下载属于交付完善，不冒称新增求得上帝之数。Clock 的完整公开分布已在项目内收录，直接复用。

网站逐项范围数据来自 [puzzle-distribution-coverage.ts](../core/packages/client/lib/puzzle-distribution-coverage.ts)：从现役 PG、sim、csTimer 与 shape-mod 名录汇集，每项可搜索，并区分完整结果、同构复用、超预算、已有部分结果与缺少可靠完整模型。动态自定义切割与任意训练动作集仍不作穷尽承诺。

## 提交前最终有限目录审计（2026-10-23）

本节是前述调查的最终校准，尤其更正早期将 `ufo` 泛称为实体完整结果的表述。本轮只读取目录、源码和原作者公开表，没有启动 BFS、读取大表、重做资产校验或重设资源保护基线。

从实际导出的 `PUZZLE_DISTRIBUTION_COVERAGE` 读取到 **170 个条目、170 个唯一 ID**：`exact` 45、`equivalent` 3、`reported` 3、`partial` 20、`over-budget` 91、`model-incomplete` 8。条目包含别名、独立计步和子目标，不能说成 170 种不同实体；例如 Redi 的 3 个 `reported` ID 引用同一份作者报告。统计入口最终为 45 项，其来源和模型范围仍须分别阅读，不能把作者报告或项目自建模型统称为已独立证明的实体结果。

逐项集合核对结果如下；各目录互相重叠，数量不可相加。没有命中通用的“该目录项尚无……”兜底理由，每项均有具体结果或排除理由。

| 核对事实源 | 本次实际条数 | coverage 遗漏 ID |
| --- | ---: | --- |
| `sim/pgCatalog.ts` 的 `PG_PUZZLES` | 79 | 无 |
| `sim/puzzleOptions.ts` 的固定模拟器目录 | 24 | 无 |
| `lib/cstimer-scramble.ts` 的 `CSTIMER_EVENTS` | 32 | 无 |
| `lib/shape-mod-scramble.ts` 的 `SHAPE_MOD_EVENTS` | 9 | 无 |
| `@cuberoot/puzzle-solvers/native-puzzles` 的 `NATIVE_PUZZLE_IDS` | 28 | 无 |
| `dev/solvers/_fleet.ts` 的已建纯 TS 求解器 | 28 | 无 |
| 同文件的计划求解器 | 4 | 无 |

可在 `core/packages/client` 用以下纯元数据检查复核状态数量；不会调用任何枚举器或求解器初始化：

```sh
node --max-old-space-size=128 --import tsx --input-type=module <<'NODE'
import module from './lib/puzzle-distribution-coverage.ts';
const rows = module.PUZZLE_DISTRIBUTION_COVERAGE;
const counts = {};
for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
console.log({ total: rows.length, unique: new Set(rows.map(row => row.id)).size, counts });
console.log({ fallback: rows.filter(row => row.reason.zh.startsWith('该目录项尚无')).map(row => row.id) });
NODE
```

### 最后一轮可直接复用的完整公开表

这 10 个入口全部复用逐档完整计数，没有新增本地全图计算。联合表的两个边际可交叉核对；有既有本地结果的，另对照其相同计步边际。公开计数不产生新的最优打乱资产，也不复用另一种目标或计步的样例。

| 新入口 | 完整统计域 | 最大最优步数 | 原始证据及重要边界 |
| --- | ---: | ---: | --- |
| `cm2-neutral-htm` | 6,912 个统一重着色等价类 | 8 | [Jaap Cmetrick](https://www.jaapsch.net/puzzles/cmetrick.htm) 的 Mini 联合表；接受四球任意共同朝向，行列任意非零转量一步 |
| `cm2-neutral-qtm` | 同上 | 9 | 同一联合表；行列四分之一转一步、半转两步 |
| `cm3-neutral-qtm` | 6,879,707,136 个统一重着色等价类 | 15 | 同页 Stefan Pochmann 计算结果；九球任意共同朝向，四分之一转计步 |
| `223-qtm-exact` | 241,920 | 15 | [Jaap 2×2×3](https://www.jaapsch.net/puzzles/cube223.htm)；固定一中层块消除整体方向。U/D 半转两步，必须做的侧面半转仍一步 |
| `gear-single-exact` | 41,472 | 12 | [Jaap Gear](https://www.jaapsch.net/puzzles/gearcube.htm) 第一张联合表；无额外底座贴纸的普通齿轮，基本齿轮步逐次计数，不称普通三阶 QTM |
| `sfl-qtm-exact` | 3,041,280 | 16 | [Jaap Super Floppy](https://www.jaapsch.net/puzzles/floppy2.htm) 第二张 imitation 表；允许单独转无角块相连的棱，HTM 边际与已有 God 13 模型相符 |
| `rubiks-ufo-ftm-exact` | 39,916,800 | 14 | [Jaap Rubik’s UFO](https://www.jaapsch.net/puzzles/rubufo.htm)；两层各六段，固定一参考段，盘转任意非零转量一步 |
| `rubiks-ufo-stm-exact` | 同上 | 16 | 同一联合表；盘转每 60° 一步，半翻仍一步 |
| `netblock-ufo-ftm-exact` | 33,362,904 个整转及颜色重标等价类 | 15 | [Jaap Netblock UFO](https://www.jaapsch.net/puzzles/ufo.htm)；三球八分块的真实半球转动，原作者 FTM |
| `netblock-ufo-qtm-exact` | 同上 | 16 | 同一联合表；原作者 QTM，半转计两步 |

Cmetrick 的 24 种等价是所有球统一重着色，不是旋转方形框架。写球朝向为 `O_i` 时，动作左乘 `G`，统一重着色右乘 `C`，满足 `G(O_i C) = (G O_i)C`，并把所有共同朝向目标归为一个目标。CM2 固定目标 165,888 态、CM3 固定目标 165,112,971,264 态不能用这些直方图直接替代；后者公式为 `24^9/16`，再取上述 24 阶商才得到公开统计域。

Netblock 的完整固定配色、固定框架计数为 1,200,622,500；只去整体朝向后为 200,121,075；进一步识别颜色重标后才是 33,362,904。存在有对称性的状态，轨道大小不恒定，不能将每档统一乘 6 或 36 就声称恢复前两个统计域。Rubik’s UFO 则是另一种两盘扇形块实体，不能与 Netblock 混用。

最后检查也明确区分了来源页上的其他机制：官方带阻挡 Super Floppy 与当前 imitation 不同；额外齿轮底座贴纸和 Gear Mastermorphix 不属于本次已登记的普通 Gear 模型。这些已出版变体不继续扩大为本轮新实体目录。

### 八个模型证明缺口与当前不能继续计算的项目

| ID | 已有能力 | 未满足的完整结果条件 |
| --- | --- | --- |
| `ufo` | 项目三球整体半转模型的 60,480 态闭包和 God 10 已精确完成 | 该动作与 Netblock 的半球转动不同，也不是 Rubik’s UFO。几何重推和独立回放只证明项目模型自洽，尚无实体等价证明。网站保留模型结果，标为“项目 UFO 模型”，实体公开结果另列 |
| `mastermorphix` | 真实三阶形变引擎；另有 PG 保形模型 | PG 小群不覆盖实体的全部合法形变；实体完整空间也超预算 |
| `masterpyramorphix` | 当前 PG 切割/保形动作 | 仓库明确排除该家族为忠实完整实体模型，不能以小群直径代替实体结果 |
| `rex` | 已有置换模拟器和几何回归 | 带标签群、可见颜色和整转商尚缺统一核验；没有已证预算内完整统计坐标或最短距离分解 |
| `sq4` | 已有 40 扇区动作模型和正逆转回归 | 尚缺可见颜色、整转等价及全状态统计坐标的完整预算证明 |
| `magic` | 单条折叠路线 | 不覆盖任意绳态和所有合法折叠，路线长度不等于图直径 |
| `mmagic` | 十二板的单条折叠路线 | 同样缺少全部绳态及合法动作模型 |
| `custom` | 参数化任意切割 | 无限参数族必须逐个核验，不属于有限目录穷尽结论 |

其余当前不能新算的原因已有逐项网站说明，归纳如下：

- 67 个 PG/native ID 已有可复核的可见投影下界超过五千万，包含全部 28 个 native；上面的 JSON、脚本和 manifest 是排除证据。一个小 PDB 或外形名称不是反证。Dino Octa 旧 88,704,000 只是两轨投影，完整六轨可见下界超过 `4.71e22`。
- Siamese 单个半边的棱投影已有 92,897,280 态；即使两半动作独立，仍须先有过大的完整因子分布。334–337、minx、Helicopter 和较大 Square 家族也超过当前预算，没有已证最短距离可相加的完整分解。
- BSQ 的既有搜索在 12,000,004 态保护停止时仍有前沿。399 个形状或小陪集表不足以恢复整个合法图，未找到原作者完整距离表，保留部分结果。
- 已接入的 Domino 公开分布去掉四种轴向整转，不能代替原固定框架目标；SQ1 已接 twist/face，而 WCA 同时双层转只算一步的度量仍无本轮完整结果。三阶及其形变的已知直径、样本和子阶段结果也不能冒充完整距离分布。
- Redi 保留作者报告标签：原作者给出全表并独立暴搜核对浅层，发帖时深层核验尚待完成；本轮未找到后续全图核验记录，不把其升级为本机或独立全图证明。
- **CM2 固定配色目标 QTM** 的 165,888 态是明确适中的另一个自然计步，但需要新本地枚举；已完成的中立目标 QTM 不可替代。当前同次系统启动已有保护停止记录，因此本轮不启动，也不重设基线。这是可行但当前不能执行的新增计算，不是数学上不可算。

已证明的二阶镜面同构、Pyraminx 独立小尖卷积，以及 DR→HTR / HTR→FR 等距陪集权重均已交付。除此之外，本轮没有发现尚未接入且能在当前保护状态下直接产生的新完整分布；不将任意新动作集或目录外变体无限加入任务。
