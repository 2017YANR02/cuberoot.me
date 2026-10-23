# 魔方完整距离分布跟踪

更新：2026-10-23。状态：**第四轮交付；新批量计算保留资源保护停止状态**。累计接入 45 份完整分布入口：27 份本地模型结果（其中 UFO 的实体对应关系待核验）、17 份公开完整精确直方图，以及 1 份待独立复核的 Redi 作者报告。保留 4,663 条独立回放样例和 27 套全态或完整陪集代表下载。用户已授权本轮本地提交；推送、生产部署，以及实际 1.36 GB 发布包准备、全量恢复与生产激活尚未执行。

第一轮结果：[完整分布合并 CSV](../.local/small-puzzle-distributions-20261023/all-distributions.csv)、[汇总与资源证据](../.local/small-puzzle-distributions-20261023/final-summary.json)。手机预览：<https://dev.cuberoot.me/zh/scramble/stats?event=tetraminx>。

手机直达：[233 HTM](https://dev.cuberoot.me/zh/scramble/stats?event=233-htm-exact)、[233 QTM](https://dev.cuberoot.me/zh/scramble/stats?event=233-qtm-exact)、[Skewb Ultimate](https://dev.cuberoot.me/zh/scramble/stats?event=skewb-ultimate-exact)、[Bicube QTM](https://dev.cuberoot.me/zh/scramble/stats?event=bic-qtm-exact)、[Redi 作者报告](https://dev.cuberoot.me/zh/scramble/stats?event=redi-published)。这些是本机开发预览，不是生产发布。

## 目标与完成条件

在 `/scramble/stats` 展示每个已完成项目的完整最短距离直方图、上帝之数、准确计步规则、状态总数、每个非空步数档的可回放样例及下载入口。复用已有求解器、项目目录、预览和 `EnumeratedDistView`，不新增平行的统计页面。

候选来自当前模拟器、打乱器和求解器目录；逐项记录已覆盖、可新增、同构复用或不适合本轮的具体原因。先做能完整枚举的项目，不以采样最大值、受限动作子群或近最优解长度冒充完整魔方的上帝之数。

本地精确计算完成一个项目须同时满足：

- 固定状态定义、整转等价规则与合法动作及计步规则。
- 全可达闭包计数与各档总数一致；最深档非空；有最短路径见证。
- 独立状态模型回放样例；新坐标实现另核对转移、边距离条件与独立参考。
- 保存完整分布、来源、执行时间、内存及保护记录。
- 接入现有网站入口，非空柱均有样例；页面不在点击柱子时现场搜索。
- 完成与修改范围相符的类型、数值及接线验证。

本轮用户已授权提交；仅提交本任务代码、小型结果和文档，不夹带其他任务。提交、推送、部署和维护者视觉验收分别记账。

公开结果只导入完整计数与来源，不冒称本轮重新枚举，也不提供不存在的全态打乱和独立样例。若原作者明确表示还待进一步核验，单列“作者报告”，不并入已核验精确结果。

## 计算边界

调查与实现并行，完整枚举串行；一项完成并保存后才启动下一项。首轮用固定大小类型化数组和有界前沿，工作进程 V8 old-space 上限 128 MiB，包装器进程树 RSS 停止线 512 MiB。启动保守空闲余量至少 3 GiB，运行至少 2 GiB。

整轮固定系统启动标识及 Swapouts 基线，持续检查内存压力、换出和进程树 RSS。触线保留结果并停止后续工作，不自动重设基线重启。运行时监测不代表操作系统禁止换出。既有结果不因新增候选而重复求解。

一般候选优先约 5,000 万态以内且固定数组预算不超过 128 MiB；这只是调查上限，不能替代真实模型、峰值预算和运行前资源检查。超过预算、需要大表或无可靠完整模型的项目记录原因，继续处理其他候选。

## 已计算项目（第一轮）

| 项目 | 可达状态 | 上帝之数 | 计步规则 | 当前证据 | 网站状态 |
| --- | ---: | ---: | --- | --- | --- |
| Ivy 枫叶 | 29,160 | 8 | 每次 ±120° 转动一步 | 既有求解器本轮复算；完整分布与各档独立回放通过 | 改读离线结果，无浏览器建图 |
| 223 | 241,920 | 14 | U/D 各转幅及 R2/F2 每招一步 | 既有求解器本轮复算；完整分布与各档独立回放通过 | 改读离线结果，纠正计步文案 |
| Skewb 斜转 | 3,149,280 | 11 | 每次 ±120° 转动一步 | 原始距离数组无不可达项；完整分布及 cubing.js 回放通过 | 新增「所有状态」，保留 WCA 真题 |
| Super Floppy | 3,041,280 | 13 | R/L/U/D 的 90°、180°、270° 均一步 | 既有求解器本轮复算；完整分布与独立几何回放通过 | 改读离线结果，补 0 步展示 |
| Tetraminx 截顶金字塔 | 933,120 | 11 | 固定顶点框架，±120° 一步，无小尖角 | 7,464,960 条边、2,048 次转移核验；最深 32 态全列 | 本地接入，149 个样例 SVG 还原通过 |
| Jing Pyraminx 晶氏金字塔 | 3,732,480 | 12 | 固定面中心框架，±120° 面转一步 | 全空间 BFS 与 Jaap 分布一致；最深 21 态全列 | 本地接入，150 个样例 SVG 还原通过 |
| Pyramorphix 二阶金字塔 HTM | 136,080 | 9 | 面转 90°、180°、270° 均一步 | 真实形变模型，隐藏平块扭转等价；最深 64 态全列 | 本地接入，注明二阶坐标示意 |
| Pyramorphix 二阶金字塔 QTM | 136,080 | 11 | 90°、270° 一步；180° 两步 | 与 HTM 同一可见状态空间；最深 172 态全列 | 本地接入，注明二阶坐标示意 |
| Dino 原配色 | 19,958,400 | 11 | 八角 ±120° 一步；12 种等价整转忽略 | 319,334,400 条边；最深 24 态全列；独立三维贴纸回放 | 本地接入，原近最优求解器口径已纠正 |
| Dino 接受镜像配色 | 19,958,400 | 10 | 与上一行同动作，但接受两种配色目标 | 从同一距离表经标签自同构推导，无第二次 BFS；最深 1,004 态取 12 例 | 本地接入；0 档两个目标保留 |
| 三阶仅半转 | 663,552 | 15 | 仅 U2/R2/F2/D2/L2/B2，每招一步 | 3,981,312 条边；3,072 次独立转移核验；最深 144 态全列 | 本地接入，明确受限子群 |
| LSE 仅 U/M | 184,320 | 20 | U/U2/U′/M/M2/M′ 每招一步，包含 AUF 和中心位置 | 1,105,920 条边；3,072 次独立转移核验；最深 2 态全列 | 本地接入，明确受限子群 |
| Pyraminx 含四小尖 | 75,582,720 | 15 | 主体或小尖每次 ±120° 转动各计一步 | 已验证主体图 × C3⁴，卷积而非大图枚举；最深 512 态取 12 例 | 本地接入，区别于忽略小尖口径 |

## 第二轮新增与整合

| 项目 | 状态或陪集数 | 最大最优步数 | 口径与证据 |
| --- | ---: | ---: | --- |
| Pyraminx Duo | 324 | 4 | 无独立小尖；完整独立几何闭包，最深 79 态全列 |
| Floppy 133 | 192 | 8 | 既有整图结果，全部 192 态独立回放 |
| Gear | 41,472 | 6 | 既有 33 招 FTM，单轴非零转量各计一步 |
| 项目 UFO 模型（实体对应待核验） | 60,480 | 10 | 既有转盘与翻转动作图 |
| Cmetrick Mini | 165,888 | 10 | 同一行或列的非零转动计一步 |
| Skewb Diamond | 138,240 | 10 | ±120° 一步；修正旧文案 |
| 8-puzzle | 181,440 | 31 | 相邻单块滑入空格一步 |
| Bicube | 1,108,800 | 28 | 只读既有紧凑表，逐条按合法带块动作恢复，不运行高内存 Map 建表 |
| U/M QSTM | 184,320 | 23 | U/M 四分之一转一步、半转两步；完整物理域，含角 AUF 和中心 |
| EOLR AC 准备目标 | 184,320 | 13 | 192 个目标；整颗还原状态距目标 2 步 |
| EOLR MC 准备目标 | 184,320 | 13 | 192 个目标；整颗还原状态距目标 3 步 |
| EO+DM | 184,320 | 13 | 48 个目标；六棱定向、DF/DB 及中心归位 |
| DR → HTR | 29,400 陪集 | 13 | DR 内十种动作；每陪集 663,552 个物理态，共 19,508,428,800 态 |
| HTR → FR（固定 UD） | 3,456 陪集 | 11 | 六面半转；每陪集 192 态，共 663,552 个 HTR 态 |

前八项复用已有数学模型并补离线交付，不宣称新的数学发现。后六个子目标/子群结果按限定域、限定动作和目标定义呈现，不称为任意三阶整解上帝之数。HTR/FR 全部陪集、独立物理签名与每条生成元边均核验；物理态各档计数为陪集数乘固定权重，CSV 同时列出 `physical_count`。

## 全部状态下载

27 套下载共 **407 个 gzip 文件，1,358,102,234 字节，130,213,764 行**。行数跨不同计步/目标，且 HTR/FR 为完整陪集代表，不能视作唯一物理状态数。全态 CSV 使用 `optimal_length,scramble`，每个非空深度另有 TXT；identity 恰好一行，AC/MC 的 identity 位于 2/3 步档。

- [前 15 套流式校验](../.local/small-puzzle-distributions-20261023/offline-download-verification.jsonl)：234 文件、5,746,476 行。
- [新增 12 套流式校验](../.local/small-puzzle-distributions-20261023/full-state-download-verification.jsonl)：173 文件、124,467,288 行；验证进程 RSS 峰值 194.36 MiB。
- 所有文件已核 SHA-256、解压行数、CSV 深度频数和 identity。第三轮将文件同卷迁移至忽略的 `stats/scramble/exact-puzzles/<event>/<sha256>/<file>`，字节未改，不再进入 Next 的 public 打包边界。正式发布走独立 Release 资产清单，不提交 Git，也不把开发预览冒充正式部署。
- 长导出每 250,000 行落盘断点，保留距离表与同一 PID；完成结果经生成键、直方图和各文件 SHA 校验后复用。[故障回归](../.local/small-puzzle-distributions-20261023/download-resume-check.json) 已验证按行恢复、丢弃未提交尾部、完成结果零迭代复用及拒绝生成器漂移。
- Dino 双口径共用 PID 98860 和原始 20 MB 距离表；Tetraminx/含尖 Pyraminx 共用 PID 99809，不在逻辑批次间重启或重载表。

第二轮五批计算及导出总墙钟 **149.71 秒**（不含开发、资料调查和页面验收）；进程树采样峰值 **438.36 MiB**，保守可用余量最低 **7.84 GiB**，沿原系统启动标识 Swapouts **0 → 0**、压力 **1**，无 OOM 或保护中止。[完整资源汇总](../.local/small-puzzle-distributions-20261023/second-pass-compute-summary.json)。监测不等同于操作系统强制禁止换出。

## 第一轮执行证据

首轮正式串行运行共 1.50 秒；工作进程最高 RSS 145.78 MiB，监测进程树峰值 258.06 MiB，保守空闲余量最低 12.76 GiB，Swapouts 0 → 0。各项耗时包含导入、枚举、样例和校验，详见原始记录；不是跨机器性能承诺。

结果：[完整分布 CSV](../.local/small-puzzle-distributions-20261023/distributions.csv)、[汇总](../.local/small-puzzle-distributions-20261023/summary.json)、[逐项结果与校验](../.local/small-puzzle-distributions-20261023/run-report.json)、[资源采样](../.local/small-puzzle-distributions-20261023/resources.jsonl)。这些本机证据不提交 Git。

第二批 [网站样例记录](../.local/small-puzzle-distributions-20261023/site-witnesses/run-report.json)：Jing 完整计算 390.3 ms / RSS 115.5 MiB；Tetraminx 因新增网站样例需求扩至每档 12 例及最深全部 32 例，耗时 103.2 ms / RSS 94.6 MiB。原始 PG 内部动作记号只在导出时转换为网站标准记号，并逐条核对转换前后 transformation 完全一致。

第三批 [Pyramorphix 记录](../.local/small-puzzle-distributions-20261023/pyramorphix/run-report.json)：HTM 67.5 ms / RSS 104.9 MiB；QTM 59.2 ms / RSS 89.4 MiB。单色平块朝向不作为可见状态，不能用普通二阶完全复原判定替代。两种分布均与 [Jaap 的完整搜索](https://www.jaapsch.net/puzzles/pyramorf.htm) 一致。所有批次沿用首批系统启动标识和 Swapouts=0 基线。

第四批 [Dino 记录](../.local/small-puzzle-distributions-20261023/dino/run-report.json)：完整枚举、双目标推导及样例校验共 4,563.6 ms；工作进程峰值 RSS 176.17 MiB。逐层断点使用同一 PID 65671，最终保存 19,958,400 字节距离表及 SHA-256；不在层间重启或重载模型。单目标/双目标直方图均与 [Jaap 的 Dino 搜索](https://www.jaapsch.net/puzzles/dinocube.htm) 一致。

第五批 [受限三阶记录](../.local/small-puzzle-distributions-20261023/restricted333/run-report.json)：half 78.3 ms / RSS 99.1 MiB；lsemu 56.1 ms / RSS 84.6 MiB。没有假称外部参考直方图；精确性来自完整闭包、根距离为 0、全部边距离差不超过 1、所有非根状态有降距边，以及独立 cubing.js 转移和样例回放。

五批运行总墙钟约 7.96 秒（不含研究、开发、网站验证）；进程树采样峰值 **297.58 MiB**，最低保守可用内存 **11.59 GiB**，同一系统启动内 Swapouts 始终 **0**、压力等级始终 **1**，无 OOM 或资源停止。采样峰值不当作操作系统强制内存上限。

含小尖金字塔另用 [20.4 ms 的精确组合](../.local/small-puzzle-distributions-20261023/derived/pyram-tips.json) 完成，工作进程峰值 RSS 98.3 MiB。相对尖角坐标为 `(CORNERS2.orientation − CORNERS.orientation) mod 3`；16 个合法生成元各作用于唯一因子，验证 1,024 次独立转移、81 个尖角状态和已有 149 个主体样例，得到 `coreHistogram × [1,8,24,32,16]`。下界为各因子距离之和，拼接最短因子路径达到下界，因此得到完整最短距离分布，无需枚举 7,558 万状态或创建对应表。未把继承的主体边证书冒充一次新的全图扫描。

## 候选队列

| 项目或范围 | 当前判断 | 下一步 |
| --- | --- | --- |
| Jing Pyraminx、Pyramorphix、Dino、half、lsemu | 计算、独立回放、网站接入及浏览器下载验证完成 | 本地交付 |
| Floppy、项目 UFO 模型（实体对应待核验）、Cmetrick Mini、Diamond、Gear、8-Puzzle、Bicube、Pyraminx Duo | 已有精确数学实现；Duo 旧入口缺失已于第二轮补齐 | 复用；修正 Diamond 120° 文案与 Bicube 0 档；不重复完整计算 |
| 其余模拟器与打乱项目 | 有限目录盘点完成，28 个 native 模型均有超限可见状态下界 | 见[候选盘点](puzzle-exact-candidate-inventory.md)，不启动大空间枚举 |
| 含小尖 Pyraminx | 已证明直积分解，完成精确组合及全部样例回放 | 本地交付 |
| 233、Redi | 本机全枚举仍超预算；第三轮找到可复用公开表 | 233 按整转商单列两种度量；Redi 单列作者报告，见下文 |
| 更大长方体和大型组合魔方 | 现有群规模超出本轮小内存全空间边界 | 保留既有求解能力；不生成冒充精确分布的采样结果 |

## 执行入口与接线

- 串行包装器：`core/packages/client/scripts/measure-small-puzzle-distributions.mts`。
- 单项执行器：`core/packages/client/scripts/small-puzzle-distribution-worker.ts`。
- Tetraminx 精确模型：`core/packages/client/scripts/tetraminx-exact-distribution.mts`。
- Jing / Pyramorphix 模型与共同有界 BFS 同目录；导出入口 `export-exact-puzzle-distributions.mts` 只读取已完成报告，不重新枚举。
- 网站消费 `_data/precomputed-exact-puzzles.json` 中的小型直方图及有界样例，登记在 `docs/generated-artifacts.json`。共 27 项静态分布、4,663 个独立回放样例，672,172 字节；旧结果复核与同一状态空间的不同计步/目标分别标明。
- 包装器的只读系统查询及 Node 子进程契约登记在 `core/architecture-boundaries.json`。
- 生成给网站消费的数据时，由对应生成入口登记来源和验证方式，不手抄完整结果、不提交大体积统计快照。

网站入口 `/zh/scramble/stats?event=<id>`，id 为 `ivy`、`223`、`sfl`、`tetraminx`、`jingpyraminx`、`pyramorphix`、`pyramorphix-qtm`、`dino`、`dino-mirror`、`half`、`lsemu`、`pyram-tips`；Skewb 使用 `?event=skewb&src=all` 保留 WCA 真题。下载分别明确标为「完整分布」与「示例及最优解」，有界样例不称作全部状态清单。

保护异常回归：[mock 脚本与实际输出](../.local/small-puzzle-distributions-20261023/guard-verification/README.md)。验证记录写入失败仍先发终止信号并安排 KILL、保留锁，以及跨输出目录复用已完成结果并检查 CSV SHA。mock 不冒充实际 OS 信号或禁换出机制。

## 验证与交付记录

| 阶段 | 状态 |
| --- | --- |
| 27 项完整分布与独立样例检查 | 完成：4,663 例；来源报告与 SHA 对应 |
| 相关计算脚本严格 TypeScript 检查 | 通过 |
| Client typecheck、两个共享 package 构建 | 通过；开发服务运行期间未做 Next build |
| 最小预览回归 | 第一轮 13 项；第二轮先覆盖 25 项 4,383 例，再只检查新增 HTR/FR 280 例与公开 3 份计数边界。后一次 4/4 通过，43 ms，均无 BFS |
| 架构边界检查 | 通过：225 个既有精确身份、246 处引用、36 个手动合同 |
| 浏览器功能验收 | Headless Chrome：13 项 HTTP 200、God/态数、最深档数量、实际下载 CSV 逐档一致，无 pageerror；[首十项](../.local/small-puzzle-distributions-20261023/browser-smoke.json)、[追加三项](../.local/small-puzzle-distributions-20261023/browser-smoke-additional.json)。Dino 双目标 0 步档另确认保留两个状态 |
| 手机预览（375px） | 新增首 12 项实际 `dev.cuberoot.me` 页面、下载 SHA/解压行数、无水平溢出均通过；[首批记录](../.local/small-puzzle-distributions-20261023/browser-mobile-delivery-all.json)。HTR/FR 与公开 3 项，以及 Roux 三个 identity 边界均通过，0 pageErrors、0 水平溢出；[最终记录](../.local/small-puzzle-distributions-20261023/browser-mobile-final-all.json)。公开 127 档 CSV 逐行核验；一处测试选择器误判及恢复已记入证据 |
| 下载完整性 | 407/407 gzip 的 SHA、行数、分档总数及 identity 校验通过；不是仅检查文件存在 |
| 其余有限目录候选盘点 | 完成；具体范围、同构复用、超限与证据限制见候选文档，不声称穷尽无限自定义模型 |
| 提交 / 推送 / 部署 | 本轮获授权进行本地提交，哈希见交付消息及本机提交收据；未推送、未生产部署 |
| 维护者视觉验收 | 未进行，不与浏览器功能检查混同 |

## 公开完整分布复用

| 入口 | 完整分布 | 最大最优步数 | 验证与限制 |
| --- | ---: | ---: | --- |
| `15p-exact` | 10,461,394,944,000 态，81 档 | 80 | Korf / Schultze 2005 原论文表 2 与 Kociemba 表逐档一致，求和为 16!/2，最深 17 态 |
| `sq1-twist` | 435,891,456,000 态，14 档 | 13 | Masonjones / Jaap；顶底层转免费，保留中层状态 |
| `sq1-face` | 11,958,666,854,400 个可切位置，32 档 | 31 | Shuang Chen 2017；单层或切片各一步，双层转两步，区别于 WCA 12c4 |
| `233-htm-exact` | 406,425,600 态，19 档 | 18 | Jaap；白中心朝上，绕 U/D 四种整转等价。联合表边际逐档核对 |
| `233-qtm-exact` | 同上，20 档 | 19 | U/D 半转计两步；侧面必需的半转仍计一步，不是三阶 QTM |
| `skewb-ultimate-exact` | 100,776,960 态，15 档 | 14 | Nguyen / Crépeau，经 Jaap 公开；与 OEIS A079758 一致。Jaap 页误链 A079874 已避开 |
| `bic-qtm-exact` | 1,108,800 态，36 档 | 35 | Jaap 全状态联合表行和核对；HTM 列和与本机已有分布一致，未误用 440 个形状表 |
| `redi-published` | 作者报告 1,571,364,748,800 态，20 档 | 作者报告 19 | Shuang Chen 2017；深层尚无后续独立核验记录，单列待复核，不并入公开精确结果 |

以上只读公开计数与 CSV 下载，没有重新计算巨量状态，也没有全态打乱资产或逐档独立回放样例；柱子禁点，图下明确说明。SQ1 计数从数学页抽为单一公共数据源，原数学页继续复用。资料逐档校验见 [15p 来源核对](../.local/small-puzzle-distributions-20261023/published-15p-source-check.json)、[Domino / Ultimate](../.local/small-puzzle-distributions-20261023/published-domino-ultimate-source-check.json)、[Bicube](../.local/small-puzzle-distributions-20261023/published-bicube-source-check.json)、[Redi](../.local/small-puzzle-distributions-20261023/published-redi-source-check.json)。三阶 HTM/QTM 已知直径与深度分布估计分开，不冒充完整精确直方图。

Redi 计数为十二棱偶排列与八固定角朝向的完整域 `12!/2 × 3⁸`；48 种对称仅用于压缩计算，不再除总数。原作者另行暴搜确认了 0–8 步，发帖时计划继续检查深层；目前未找到后续核验记录，因此界面摘要和最大步数均明确加“作者报告”。

## 第三轮交付与资源边界

- 407 个 gzip 仅做同卷 rename，迁移前逐文件 stat 核对大小、目标不存在及同卷；不读正文、不重新枚举。原完整校验仍对应相同字节；[操作清单](../.local/small-puzzle-distributions-20261023/asset-path-migration.json) 保留源/目标、大小、SHA 和旧清单 SHA，原始计算报告未改。
- 下载清单 SHA 为 `176ac3d459e1e66efafd098a5c27c8740ba8695b666e9cb8afd53eaf5455b822`。开发环境走流式 `/stats/`，避免把最大 286 MB 文件整体读入 Node 内存。
- [资产入口与发布步骤](../scripts/exact-puzzles/README.md) 已实现独立的按项目 tar、内容 SHA 清单、恢复、Release 上传和静态站逐文件验证。复用 `wca-data-latest`，不扩大日常 WCA 快照尺寸限制，不改共享 Release body，也不把大文件打进 Next。
- 生产下载入口绑定完整清单的已发布验证收据；当前收据为空，因此生产隐藏全态/逐档下载，完整直方图和有界样例 CSV 仍可用。微型 gzip 的打包→空目录恢复、重复恢复、损坏和路径拒绝夹具通过；本轮未准备或恢复整套 1.36 GB 发布包，也未上传或激活生产文件。
- 2026-10-23 16:00 UTC 复核发现同一次开机 Swapouts 已由原 0 增至 16 页、压力等级 1。当时无本任务求解进程；该系统累计值无法归因到本任务，既有计算结束时的 0 换出证据仍按原时间有效。已写入[资源保护停止记录](../.local/small-puzzle-distributions-20261023/protected-stop.json)，禁止重置基线或自动续算。之后仅做可逆元数据迁移、源码、小夹具与正常页面验证，不启动新枚举或大文件批校验。
- 新图标按嵌入立方体的十二面体及四个斜转切平面生成，与普通 Skewb 分开；共享 SVG / 图标目录注册完成，图标目录回归 3/3 通过。
- 新增五页的 375×812 手机回归通过：110 个 CSV 档位逐行一致、0 水平溢出、公开表无伪造样例入口，Redi 三个目录入口均显示待独立复核。迁移后的 Duo 全态下载实取 904 字节，SHA 与全部 324 行吻合；Ivy 0 档 21 字节也经实际开发域名核验。见[手机记录](../.local/small-puzzle-distributions-20261023/browser-mobile-third.json)。
- 客户端 typecheck、图标目录 3 项、公开计数 1 项、生产发布收据 1 项、资产恢复小夹具及相关严格 TypeScript 检查均通过。架构检查当前为 227 个既有身份、248 处引用、37 个手动合同。新增 `.github/workflows/exact_puzzle_assets.yml` 仅跑小夹具，不下载或重算语料；尚未 push，不能声称远端 CI 已通过。
- 手机验证脚本曾因 10 秒 hydration 等待、把含 `redi` 的五个名称都当作 Redi 本体，以及向仍在运行的 React 页面注入图标夹具而失败。已分别延长有界等待、按结果状态筛选、在空白页隔离夹具；只续验失败部分，最终页面错误数为 0，未为通过测试修改产品语义。

## 未完成候选的具体说明

网站「覆盖情况」现列 **170 项：45 项完整结果、3 项等价复用、91 项超预算、20 项部分结果、8 项模型或统计坐标待核验、3 个 Redi 入口标为待独立复核**。每项都有明确原因，没有落入笼统兜底文案的目录项。项目、别名和不同度量/子目标分别计数，不代表 170 种互不相同的实体。

- 69 个追加 PG/native ID 中，67 个有去同色与整转后仍超过五千万的可见投影证书；2 个 morphix 描述只有保形子群，不能代替真实形变模型。
- `mastermorphix` / `masterpyramorphix`、`magic` / `mmagic`、`custom`、`rex`、`sq4` 的七项限制逐个说明。Rex/SQ4 已有动作模拟器；缺的是统一颜色、整转口径后的完整统计坐标或预算证明，不称为完全没有模型。
- 233、Redi、Siamese、较大长方体及大型组合魔方的完整空间超过本机枚举预算；找到公开表的另列，未找到的保留具体限制，小 PDB、分阶段解和采样最大值不当作完整分布。
- 三阶及更高阶、Bandaged SQ1 等保留现有部分成果与保护中止证据；不重置资源基线强行续算。
- 无限自定义切割和任意动作集不作穷尽承诺。逐项来源、排除证书与同构证明见[候选盘点](puzzle-exact-candidate-inventory.md)。


## 第四轮：最后有限目录审计与提交边界

本轮新增 10 份公开完整计数，均不启动本地全图枚举。公开表只有完整分布 CSV，没有伪造的逐状态打乱或独立回放样例。

| 入口 | 状态或等价类 | 最大距离 | 严格范围 |
| --- | ---: | ---: | --- |
| `cm2-neutral-htm` | 6,912 | 8 | 四球允许任意共同朝向；统一重着色商，HTM |
| `cm2-neutral-qtm` | 6,912 | 9 | 同上，QTM |
| `cm3-neutral-qtm` | 6,879,707,136 | 15 | 九球统一重着色商；不是固定目标 165,112,971,264 态 |
| `223-qtm-exact` | 241,920 | 15 | U/D 半转两步，侧面必须做的半转仍一步 |
| `gear-single-exact` | 41,472 | 12 | 基础齿轮转动；区别于已有任意同轴转量一步的 God 6 |
| `sfl-qtm-exact` | 3,041,280 | 16 | 可单独转无角棱的 imitation 机制；非额外阻挡的官方版本 |
| `rubiks-ufo-ftm-exact` | 39,916,800 | 14 | 两层各六块，固定一个参考块；面转计步 |
| `rubiks-ufo-stm-exact` | 39,916,800 | 16 | 同一实体，每 60° 层转一步 |
| `netblock-ufo-ftm-exact` | 33,362,904 | 15 | 三球实体，整转与统一颜色重标商；FTM |
| `netblock-ufo-qtm-exact` | 33,362,904 | 16 | 同一商，原作者 QTM；半转两步 |

原始表：[Cmetrick](https://www.jaapsch.net/puzzles/cmetrick.htm)、[223](https://www.jaapsch.net/puzzles/cube223.htm)、[Gear](https://www.jaapsch.net/puzzles/gearcube.htm)、[Super Floppy](https://www.jaapsch.net/puzzles/floppy2.htm)、[Rubik’s UFO](https://www.jaapsch.net/puzzles/rubufo.htm)、[Netblock UFO](https://www.jaapsch.net/puzzles/ufo.htm)。联合表逐档行列和、总数与已知旧度量交叉核对；新计数另有来源 SHA 固定回归，避免只核总数漏掉中间档错误。

**UFO 边界修正**：旧项目三球模型的 60,480 态 / God 10 是该动作模型的完整结果；现有独立回放只验证同一几何假设，不能证明它对应实体 Netblock UFO 或 Rubik’s UFO。页面标题、摘要、详情、覆盖状态与求解器目录均明确限定项目模型，禁用实体求解链接。两种实体只接公开计数，不复用这个模型的预览。Netblock 商的对称轨道大小不等，分布概率按等价类等权；不能按固定倍数还原有色实体态分布。旧样例和全态文件保留用于模型复核，不篡改原报告或伪造重算证据。

**没有继续计算的项目**：Cmetrick Mini 固定配色 QTM 的 165,888 态本可纳入预算，但仍须遵守原保护停止记录，因此列为未启动；不拿允许任意共同朝向的公开表替代它。其余超预算、模型缺口、只有阶段/抽样结果的项目见[逐项候选清单](puzzle-exact-candidate-inventory.md)。额外贴纸 Gear、官方 blocked Super Floppy 等不同实体规则不混入现有项目。自定义切割与任意动作集不属于有限穷尽范围。

**计算与资产安全**：同一启动周期 Swapouts 从原基线 0 增至 16 后的保护记录原样保留；不能断言由本任务引起，也不重设基线。第四轮只做公开计数导入、轻量回归、类型检查、手机功能预览与元数据核对，无新 BFS、无大表加载。资产清单读取先检查大小，再以最多 1 MiB 的固定缓冲读入，超限夹具已验证。

**交付边界**：本地提交只包含显式清单及三个混合文件中的本任务条目；不包含生成的 1.36 GB corpus、其他任务或本机凭据。生产下载仍由与清单摘要匹配的发布收据控制，当前收据为空，避免代码先提交后出现不存在的线上下载。开发域名可读已校验本地资产。

手机直达：[Cmetrick Mini HTM](https://dev.cuberoot.me/zh/scramble/stats?event=cm2-neutral-htm)、[Cmetrick QTM](https://dev.cuberoot.me/zh/scramble/stats?event=cm3-neutral-qtm)、[223 QTM](https://dev.cuberoot.me/zh/scramble/stats?event=223-qtm-exact)、[Gear 基础转](https://dev.cuberoot.me/zh/scramble/stats?event=gear-single-exact)、[Super Floppy QTM](https://dev.cuberoot.me/zh/scramble/stats?event=sfl-qtm-exact)、[Rubik’s UFO](https://dev.cuberoot.me/zh/scramble/stats?event=rubiks-ufo-ftm-exact)、[Netblock UFO](https://dev.cuberoot.me/zh/scramble/stats?event=netblock-ufo-ftm-exact)。

第四轮验证：新增 10 入口在真实 `dev.cuberoot.me` 的 375 × 812 手机视口逐项检查上帝之数和完整 CSV，146 档逐行与数据源一致，另检查旧 UFO 的模型说明及待核验覆盖状态；11 项均无水平溢出，0 pageErrors。客户端 typecheck、公开表/UFO 边界 2 项窄回归、图标目录 3 项回归通过。未重复运行全状态枚举。[手机记录](../.local/small-puzzle-distributions-20261023/browser-mobile-fourth.json)与[交付汇总](../.local/small-puzzle-distributions-20261023/fourth-pass-delivery-summary.json)。
