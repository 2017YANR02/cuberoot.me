# Smart Cube Research — 智能魔方训练平台竞品调研

`SMART_CUBE_MIGRATION.md` 对齐的是 csTimer(**功能基线**)。这一份对齐的是**产品形态**：
十个竞品做了什么样的 per-solve 报告、什么样的训练循环、什么样的对战，以及他们被
用户骂的是什么。目标是给 Phase 3(把设备时钟变成指标层)定优先级。

方法与置信度：材料是四份平台调研摘要（XC大师 / 魔方星球 / 中国 QiYi+魔域+计客 /
西方 Cubeast+acubemy+CubeDesk+GoCube+csTimer）加一份 UX 模式库
（Strava / Garmin / Apple Fitness / Whoop / Oura / Duolingo / Anki / chess.com / Lichess）。
本文档只写材料确认过的事实。**材料没建立的一律进第 8 节，不进正文表格。**
「我们现在」这一列是读源码写的，不是印象。

标记：✅ 有 ｜ ⚠️ 部分 ｜ ❌ 无 ｜ ❓ 未验证（材料没建立，不等于没有）

---

## 1. 结论先行

1. **抄 Cubeast 的字段定义原文，一个字都不要自创。** 全行业只有它有严谨的
   recognition vs execution 词表，而且定义是公开的（在它自己 JS bundle 里的 REST API
   文档里）：`step_recognition_time` = 上一阶段最后一转落定 → 本阶段第一转，**AUF 计入识别**；
   `step_execution_time` = 第一转 → 最后一转；`step_turns_per_second = slice_turns / step_execution_time`
   （TPS 只除执行时间，不被思考时间稀释）。用它的定义，我们的数字才可被外部比较，
   也省掉「你的 TPS 为什么和别家不一样」这一整类争论。

2. **per-solve 报告只有两种成熟形状，两个都要。** 魔方星球是「每阶段 5 指标网格」
   （Time / Moves / Rotations / TPS / Fluency × CFOP 四阶段，一屏可扫）；Cubeast 是
   「5 个 tab」（Overview / Steps / Solution / Stats / TPS，分层）。正确做法是前者当第一屏、
   后者当纵深，而不是把所有东西挤到一屏。

3. **optimality feedback 全行业空白，而这是我们最便宜的一块地。** Cubeast 作者把
   「showing how optimal your crosses are」明确列为 Rust 重写之后的未来工作；
   我们的 Rust StageSolver + 34GB 表已经在跑。「你的十字走了 9 步，最优 6 步，这里多花 0.4s」
   没有任何一家能出。

4. **error detection 也全行业空白。** 没有一家检测废步 / 回退 / 撤销 / 走错再改。
   最接近的是 csTimer 在**打乱阶段**划线纠错。我们已经逐步跟踪状态，把这套机制从打乱
   推广到还原是同一件事。

5. **训练侧只有两个机制被证明有效，都不需要新技术。** 唯一被用户自发点名夸的是魔方星球的
   「分步特训」（"the Phase Training is extremely helpful and it works"）；唯一把练习记录
   **反向驱动**下一次练什么的是 XC大师的「复习」自动错题队列。前者要的是 state hijack +
   子步自动停表，后者要的是一个弱项队列 —— 而我们已经有 `/alg` 的 SRS 引擎
   （`lib/alg-srs.ts`，SM-2 变体，4 档评分）。

6. **我们的地基已经比所有竞品深，但上层几乎没在消费它。** 六品牌驱动 + 设备时钟 +
   逐步状态 + CFOP 分段 + OLL/PLL case 标签都在，可 `Solve`（`_lib/types.ts`）里
   **没有 `inspectionMs` / `pickupMs` / `putDownMs` / `deviceModel`**，识别与执行没拆开，
   观察阶段的转动明确不记录（`moves` 注释：Inspection-time moves are NOT recorded）。
   Phase 3 的第一件事是把地基接到指标层，不是加新功能。

7. **收费别犯他们犯过的两个错。** 魔方星球中国区头号差评是零氪玩家拿不到东西；
   acubemy 头号差评是每点一次功能就弹订阅（"…is a red flag"）。Duolingo 用 Energy 计量
   「练习本身」引出了一份请愿书，是同一类错误的完整案例。规则：**免费无限次数 + 完整单把报告**，
   收费只卖历史深度 / pivot 查询 / 导出 / 教练层。永远不对「拧了几把」计费。

8. **对战不是一个功能，是三种格式。** 魔方星球在同一个版本里把「计时赛」拆成擂台赛、
   把「多人速拧」拆成房间赛，加上排位赛季共三种，对应三种不同社交需求。QiYi 的房间是
   **2-32 人 + 自定轮数 + 密码 + 实时观战**，这是中国俱乐部实际用来办线上赛的形状；
   我们现在只有 2 人。

---

## 2. 竞品全景

| 产品 | 平台 | 核心定位 | 解法分析 | 训练 | 对战 | 教学 | 收费 |
|---|---|---|---|---|---|---|---|
| **XC大师** | iOS/iPadOS/macOS/visionOS 单包，无 Web | 三阶前半段专项练习器（最优十字 / XC / 预判），智能魔方是 v4.0 才贴的一层 | 时间 + 一个「解法评级」+ 一段 AI 文字点评。无分段 / 无 TPS / 无停顿 / 无回放 | 求解、十字分级练习、WCA 真题、计时、预判练习、**复习（自动错题队列）**、智能练习 | ❌ 无任何多人证据 | ❌ 近乎为零，被 5★ 评论当面点出 | 免费，无内购，无广告 |
| **魔方星球 CubeStation** | iOS/Android/macOS/HarmonyOS，400MB，CN 与 US 两个分叉包 | GAN 自家硬件的「智能魔方对战平台」，形态是手机游戏 | **5 指标 × CFOP 四阶段** + 可拖拽时间轴回放 + 1x/慢放 + 步骤列表 + AO5/12/100 | 分步特训、公式练习（新包里被删）、大数据诊断 + 公式推荐、双魔方、拍照复原、虚拟魔方 | ✅ 三种格式：擂台赛 / 排位赛（赛季 + 资格赛）/ 房间赛（角色切换 + 观战数据）+ 战队 | ✅ 魔方学院：GAN 教程 + 冠军视频课 + 关卡式解锁 | 免费 + 魔晶内购 ¥1-¥348，皮肤 / 头像框 / 道具，每日任务攒积分 |
| **QiYi Smart Player (Pro)** | iOS/iPadOS/macOS/visionOS + Android | 硬件附属计时与排名 App（App 计时 / 硬件计时器 / 智能魔方三模块） | 解法复盘 + 分段统计（CFOP，Roux 崩）+ 智能打分 + **观察时间柱状图**。无 TPS | 个人练习、复原引导（约 21 步近优解走一遍）、小游戏。**无公式训练器** | ✅ 全球 1v1（按练习成绩匹配，实时显示对手魔方与整体朝向）+ 房间赛 2-32 人 + 密码 + 观战 | ❌ 「AI教程上线时间待定」跨越整个观察窗口；层先/CFOP 教程外链微信文章 | 免费，无内购，云端成绩终身免费存储 |
| **MoYu WCU CUBE** | iOS/Android/macOS/visionOS，425MB | WCU 世界魔方联盟 + 教学平台，覆盖非三阶（2x2 / 金字塔） | 时间 + 步数，陀螺记 rotation（零售文案）。**分段大概没有**（用户在要） | 预判训练、成就挑战、WCU 考级、复原助手、拍照复原、公式练习 F2L/OLL/PLL/COLL、排位赛 | ✅ 全球对战（统一打乱）+ 排位赛 + **战队系统** | ✅ 启蒙板块 + 名师讲堂视频课 + 考级 | 免费，无广告，**强制注册**（头号差评） |
| **Giiker 超级魔方** | iOS/Android，八语言 | 全球首款智能魔方，面向新手与儿童 | 自动计时 + 步数 + 步骤分析 + 3D 动画回放 | 零基础智能快解、**游戏化互动教学（按你手上的真实状态生成教学）**、魔方小游戏 | ✅ 全球在线对战，统一打乱 | ✅ 互动教学是它的主卖点 | 免费。4.8 分 / 8027 评分（这一族里装机量最大），但 2023-10 后停更 |
| **Cubeast** | **仅 Web，仅 Chrome/Chromium**（Angular + Rails） | 唯一的严谨分析产品：per-step 识别/执行词表 + 统计查询构建器 | **行业标杆**：solve 级四个时钟 + step 级五个时间字段 + case + 停顿感知步数 + 5 tab 报告 + 3D 播放器 | Academy：两种练习对象（algorithms_drill / intuitive_solving），命名 + 向导 + rounds + per-case 统计 + CSV，可归档 | ❌ **完全没有**。2020 路线图第 5 条，无路由证据 | ❌ 只有产品文档（knowledge base），无魔方教学 | Premium $5/mo $50/yr、Pro $9/$90、Patron $19/$190，全员 14 天试用；Academy 与 CaseRecognition 是两个付费 flag |
| **acubemy** | Web + Android + iOS | 跨品牌智能魔方 App，四个魔友做的 | 「详细分析与复盘」+ **陀螺 rotation 回放 1:1**（Cubeast 明确做不到的）+ Roux 分析器 | 公式训练带 smart tips（OLL/PLL） | ✅ 1v1 本地或在线；线上赛事路线图定在 2026 年初 | ❓ | freemium。头号差评是点一下就弹订阅 |
| **CubeDesk** | Mac/Win/Linux 桌面 + Web | 「timer + analytics + trainer」，1v1 写进标题 | 只有「Detailed info on each solve」。**上线时无智能魔方支持**，蓝牙是用户请求 | 700+ 公式训练（OLL/PLL/ZBLL）+ 自定义公式创建器 | ✅ 1v1 + 排行榜 + 好友 + 公开 solve 页 / 用户页 | ❓ | 2021 年 $4.99 一次性，后被称免费开源，材料未标日期 |
| **GoCube / Rubik's Connected** | iOS/Android，每款硬件一个独立 App | 玩具与 edutainment，不是分析工具 | Go-Improve：「advanced stats…down to milliseconds」。无分段、无 TPS 命名、无复盘器 | Go-Play 小游戏与任务；v2.9 上了 CFOP Academy | ✅ Go-Compete + 周/月/年排行榜，Solo 与 Pro 分开排 | ✅ **Go-Learn 是全场最强新手引导**：mini-steps + 视频 + 按真实状态实时校验 | 免费，无内购，硬件变现。4.6 分 / 2.4K 评分 |
| **csTimer** | Web，开源 | 免费地板线 | 多阶段自动分段（虚拟与蓝牙都支持）+ 实时复盘 + 电量 + 打乱划线纠错 | 子步自动停表、状态劫持、连续训练（见 MIGRATION 表 D） | ❌ | ❌ | 免费 |
| **我们 `/timer` 现状** | Web（Next），六品牌 BLE 驱动 | 通用计时器 + 智能魔方链路 + 复盘 | HTM/QTM/HTPS/QTPS、首动延迟、最长停顿、停顿次数（>0.5s）、CFOP 分段含十字面与 OLL/PLL case、BLD 记忆段、`CfopCaseStatsPanel` 按 case 聚合 | `DrillModal` 单 case 重复练、`TrainerSubsetModal`、`StepSolve`、`/alg` 公式库 + SRS（未与智能魔方打通） | ⚠️ 2 人对战 + net 房间 | ✅ `/cfop` 13 节 + `/wiki` + `/algdb` + `/math`（与训练器未打通） | 免费 |

---

## 3. 逐个产品剖析

### 3.1 XC大师 — 定位极窄，分析极浅，但有一个我们该抄的机制

**规模与节奏**：中国区 4.4 分 / **只有 8 个评分**，美区 0 条评论；v1.0 在 2 月 11 日，
v4.0 约 7 月 23 日 —— **5 个半月发了 20 个版本**。这是还在找 PMF 的小团队冲刺，
不是成熟产品。搜「XC大师 bilibili」全部落空，中文魔方社区几乎无声量。
自我定位不是训练平台，而是「专业三阶魔方十字、XC 与预判练习工具」，挂在已有工具
C2F2L 的升级版位置上。免费，无内购，无广告，无消息推送。

**解法分析（薄，且智能魔方只有 6 天历史）**。v4.0 更新说明是唯一权威描述：
连接智能魔方自动计时，还原后查看「成绩与解法评级」，另有「AI 解法洞察」，
针对这一把真实还原分析「思路与可改进点」。措辞完全是 LLM 散文式点评，**不是指标看板**。
全部抓取文案里**一个字都没提** TPS、识别/执行拆分、停顿、每阶段耗时、CFOP 分段、
转速曲线、regrip、错误动作、回放。也就是说他们的 per-solve 分析 =
时间 + 一个评级 + 一段 AI 文字，比我们现有的 `stage_segments.ts` 浅。

注意区分两个同名不同物的功能：**「AI 解法解析」**（v1.8，作用在**引擎给出的解法**上，
「讲清每一步怎么走、为什么这么走」配 3D 演示）与 **「AI 解法洞察」**（v4.0，作用在
**你自己那一把**上）。前者是他们对付「缺教程」差评的办法。

**训练模式**（按上线时间，版本号即证据）：求解与查解法（最优十字，平均 7 步 XC /
9 步 XXC / 11 步 3XC / 13 步 4XC，六个底色都能解，可指定任意底色的十字步数，多解法，
部分 4XC 自带 EO 预判，F2L 标注）→ 十字分级练习（从一步十字起逐级加难）→
WCA 真题打乱 → 计时练习（云同步，多设备继续）→ **预判练习**（自称首创，
沉淀「预判目标 / 做法 / 尝试次数 / 失败原因」四个字段）→ **复习**（自称首创，
自动挑出近期错题 + 表现最差的几次练习组成重练队列，v3.4.4 上线）→ 智能练习（v4.0）。

**没有的**：OLL/PLL/F2L 公式训练器、盲拧、大方块、其它 WCA 项目、指法、节拍器、
无智能魔方时的屏幕练习。只做三阶前半段，这是主动选的窄口。

**UI 清单**（材料只支持这些，其余无截图落地）：底部 tab bar 架构，确认有一个
「智能练习」tab 和一个「我的」页（改头像昵称）。确认存在的控件：打乱图 3D 动态 ↔ 2D
视角可切、多解法列表 + 每条的「一键 AI 解析」入口、解法 3D 演示播放器、
步数标签多种显示模式、F2L 高亮标注、**打乱公式字体可放大缩小**、打乱输入 + 快捷输入、
**WCA 观察计时**、设置项**屏幕常亮**、云端收藏、历史记录、分享、深色界面。
首屏 leads with 什么无法回答；v4.0 把智能练习做成 tab 而不是首页，暗示首页仍是求解器。

**差评原文**（只落地 3 条，样本极小）：

> 「比较直观，**要是有教学教程就更好了**」 — 5★，霜舞夜歌，5月18日

> 「夯建议加入计时功能，谢谢啦」 — 5★，冰山骑士101，5月16日
> （5 月 16 日提，6 月 6 日 v3.0 就上了计时 —— 团队跟评论跟得很紧）

从变更日志反推的痛点：v3.4.5 修「出现重复打乱」、加屏幕常亮；v3.4.3 加打乱字体缩放；
v3.4.2 加免登录。都是典型的差评驱动修补。

**该抄什么**：① 「复习」自动错题 + 最弱练习队列 —— 唯一把记录反向驱动下一次练什么的机制，
而我们能按**阶段**挑弱项（他们只能按整题对错），且 SRS 引擎现成；
② 预判的四字段结构化记录，把不可测的认知过程变成可统计条目，我们 `/predict` 缺
「失败原因」这一维，加上就能出别人没有的**预判失败原因分布**；
③ 把「你这把 vs 最优解差多少」压成一个评级放在成绩旁的第一屏；
④ 十字分级练习按最优步数分桶抽题 —— 他们要算，我们 `/scramble/stats` 直接查表；
⑤ 「一键解释这条解法为什么这么走」；
⑥ WCA 观察计时 + 屏幕常亮 + 打乱字体缩放 + 免登录练习，四个小到不值得讨论但会招差评的东西，照抄别争论；
⑦ 学他们敢只做前半段：开一个「只练前 8 秒」模式（打乱 → cross + 首对 F2L → 立刻出评级，
不用拧完），单位时间训练密度远高于整把还原，而这需要智能魔方栈，他们那层薄壳做不了。

---

### 3.2 魔方星球 CubeStation — 分析形状最值得抄，运营是反面教材

**是什么**：GAN 自家硬件的对战平台。开发者 **广州淦源智能科技有限公司**（GANYUAN；
我们内部此前写的「赣元」是错的，每一份抓取到的 listing 都写淦源）。两个并行包：
CN `魔方星球` id1524781423，3.9 分 / 2259 评分，395.7MB；US `CubeStation NEW`
id6473158674，**2.9 分 / 287 评分**，401.6MB，版本历史从 2024-02-26 的 V1.0.0 起。
Android 46000+ 下载。跨店聚合约 2.40 分 / 3.3k 评分。营销宣称数十万玩家、
日均万人开局，与店侧硬数字差两个数量级，材料无法调和。硬件才是真产品：
最便宜 ¥99，旗舰 GAN16 ui ¥699，另支持普通魔方、虚拟魔方、GAN Robot、GAN 蓝牙计时器。

**解法分析 —— 抄形状，然后在严谨度上碾过去**。五个指标就是他们的全部词汇：
`Time / Move / Rotation / TPS / Fluency`，并且**按 CFOP 自动分段后在每一段各算这五个**。
官网原文与两轮搜索完全一致：records each move，segments solutions automatically
according to CFOP，analyzes 5 parameters in each segment，and optimizes solutions。
注意 **Rotation 是与 Move 并列的独立指标** —— 整体转体来自陀螺，Move 是面转。
另有可拖拽时间轴的实时重建（「实时时间线上进行重建…可随意研究情况」）、
复盘录像 1x + 慢放 + 「Analysis Steps」步骤列表面板、**可看别人（含大神直播）的复盘**、
X-CROSS 标记、AO5/AO12/AO100 自动算、DNF 上限 180s、精密角度采集。

材料**没建立**的（不要假设有）：识别与执行拆分、停顿检测或停顿清单、UI 里的逐步时间、
最长停顿、错误动作检测、per-solve 的 OLL/PLL case 识别、alg 级归因、观察时间测量，
以及 **`Fluency`（流畅度）的定义** —— 它是唯一可能编码犹豫的指标，而没有一处定义它。

**训练模式**：**分步特训**（按 CFOP 子步的专项训练，**唯一被用户自发点名夸的功能**，
且从「不在那个朝向上计时器就不停」反推，drill 是靠**状态检测**结束而不是按钮）；
公式练习（能由 GAN Timer 硬件驱动，但在新包里被删）；**大数据诊断 + 公式推荐**
（宣传语是「大数据诊断、公式推荐、分步特训，助你科学进阶」，机制无任何页面解释）；
双魔方练习（删过又回来）；拍照复原（30 步内）；虚拟魔方；AI 教程；
GAN Robot 当打乱源（可给朋友发一模一样的打乱）；**15 秒观察被强制，不能关**。

**统计**：AO5/12/100；V4.21.1.2 上了战绩系统 / 数据系统 / 魔方系统三个命名子系统；
赛季 + 段位 + 榜单（中国 / 国际 / 地区 + 擂台自定义榜单）。**历史数据很脆**：v5 迁移
「Lost all my data from 2,000 previous solves」，单条删除被删掉后到 V5.5 才部分恢复。

**对战（整个产品的重心）**：排位赛（V5.0 全面升级，加资格赛；赛季 S4 在 V6.0）、
擂台赛（V5.0 把计时赛升级成它，是挂在榜单上的打榜格式）、房间赛（V5.0 把多人速拧
升级成它，**角色切换 + 观战者看实时数据**）、战队与战队赛（V4.23.8，同期上聊天与好友）、
单挑作为独立首页入口。赛事目录：娱乐赛 / 高校赛 / 少年赛 / 全民赛 + 活动赛，月月比赛。
段位 青铜 / 白银 / 黄金 / 传奇。

**教学**：魔方学院是首页一级目的地，写进标题三件套「魔方学院、速度打榜、全民赛事、组队建团」。
内容是 GAN 经典教程 + 冠军独家视频课程 + AI 动画演示每一步；V5.0 学院全面升级，
V6.4 重磅更新拆成 Beginner Courses / Systematic Courses / Fun Integration。
弱点不是结构而是素材质量（见下面的音画不同步差评）。

**UI 清单 —— 首页密度是最该记住的观察**。时代周报（全国性商业周报）：
「App 页面布局和功能堪比一款手机游戏，具有练习、对战、单挑、榜单、赛季、战队等应有尽有」，
段位设置「像极了王者荣耀」。**首页 leads with 竞技与进度，不是你上一把成绩。**
从 changelog 能确认为真实屏或面板的还有：每日任务版块（V6.3）、商城（从福利升级而来）、
背包（吞并装扮 tab）、首页入口优化、魔方皮肤与贴纸（装扮魔方可在比赛页面用，
即皮肤对手看得见）、头像框、邮件、兑换码、FAQ 与反馈入口、个人主页、
全屏海报、多账号切换、蓝牙设备列表（排序 / 状态注释 / 连接提示）、
比赛中断连 15 秒提示、账号注销 15 天冷静期、全局音效、房间角色与观战数据视图、擂台自定义榜单。

计时屏的形态，来自最恨这次改版的那条评论（全语料里最具体的 UI 证据）：v4 时
**3D 魔方是屏幕主体**；v5 变成打乱与计时占满全屏，魔方缩成底部一个约 1/4 英寸的
附属物，而且**只在打乱阶段显示**。

**差评原文**：

> 「现在这环境，零氪基本得不到任何东西，你那个魔晶礼包，你自己看看，**你就是个贫民玩家根本攒不了120个**，还觉得特别关心…以及各种bug…」 — jqyue，7月20日

> 「软件很好，CFOP本来不会现在会了一点，就是**讲解视频画面与语音对不上**」 — 一起作业的问题，7月20日（学院的核心资产是坏的）

> 「强度实在太高了**匹配机制有问题，连续十几把都会输**…」 — 哦哦哦669，7月11日

> "1) **Lost all my data from 2,000 previous solves** before the update. 2) …in v5 the scramble pattern and timer take up the whole screen and the cube is literally a **tiny 1/4" afterthought at the bottom** … 3) **Can no longer disable the 15 second inspection timer.** 4) **Can no longer see the cube on screen during a solve** … **This defeats the whole point of a smart cube.** 5) **Can no longer delete solves**…" — Phat_Ron，07/11/2024

> "…a lot of things were taken away from the original version, including **the chats, friend chats, and algorithm trainers**. You can't even make custom algorithms anymore, or even practice algorithms at all. … **the popups are all in Chinese and impossible to read.**" — Aho4TheDub，08/13/2024

> "**The app would not recognize any of the solved algos until i set it to Yellow Top / Green Front. Then the timer worked (and only works on that setting).** … **Also the Phase Training is extremely helpful and it works** (but only in the orientation mentioned before or the timer won't stop)." — i A P，12/11/2025

**该抄什么**：① 每阶段 5 指标网格（最便宜的高价值屏）；② Rotation 作为与步数并列的
独立指标（我们的 GAN 与 QiYi 驱动都出朝向，而且我们能跨品牌算，这是 GAN 结构上做不到的事）；
③ 时间轴可拖拽 + 变速 + 旁边挂步骤列表的回放；④ 分步特训作为显式 drill，靠状态检测结束；
⑤ 房间赛的角色切换 + 观战者看双方实时动作流；⑥ 同一条打乱发给 N 个人（我们有 WCA 级打乱源，
不需要 ¥699 机器人）；⑦ 三种对战格式分开做，不要糊成一个；⑧ **按反面抄**：
solve 过程中 3D 魔方必须一直可见、永不强制观察、永远允许删单条、迁移永不丢历史、
永不删自定义公式练习、不要求固定朝向才能判定完成、不出半汉半英的弹窗。

---

### 3.3 QiYi Smart Player — 统计面板是现成的规格书，教学是两年的空洞

**是什么**：开发者是 **玩心科技（深圳）有限公司**（Wanxin，one-think.com），
不是奇艺玩具自己 —— 硬件品牌把软件外包了。US 3.4 分 / 16 评分，CN 4.4 分 / 71 评分。
免费无内购。三个模块作为入口分叉：**App Timer**（普通魔方 + **叠杯** + **华容道**）、
**Physical Timer**（QY Timer V2）、**Smart Cube**（QYSC-S 竞速版 / QYSC-A 艺术版）。
硬件细节：登录但**不需注册**（手机号或邮箱验证码）、蓝牙与定位权限、10 分钟自动睡眠、
白面转 5 圈解绑、两颗 CR1632 不可充电。

**解法分析**：打乱完成后开始转就自动计时，还原即停。三个命名支柱：解法复盘、
**分段统计**、智能打分。分段是真的且方法感知到位程度有限：CFOP 支持，
但 Roux 下中层步只算单次计数，步数「多到没有参考价值」。打乱被描述为
「rational scramble sequences」而非纯随机。**观察时间柱状图** —— 把观察时间当成
独立的一条分布来跟踪，是整个中国族里唯一一个真正锐利的分析想法。**TPS 缺席**
（一位中国用户在评论里要求加「tps测试」）。识别/执行、停顿、per-case 归因、
regrip、废步：任何抓取文本里都没有。

**统计面板（全枚举，这是整份材料里最具体的规格，抄它零成本）**：
总次数、总平均、标准差、最快、最慢；**5/12/50/100 次的「当前平均」和「最优平均」**；
成绩分布柱状图；成绩趋势折线图；观察时间柱状图；**智能预测成绩区间**，并从中预测
**国家 / 大洲 / 世界排名**；成绩云端存储，主打「终身免费」。注意「最优平均」这一列
大部分计时器都没有。

**训练**：个人练习、复原引导（约 21 步近优解带你走一遍，评测者的判断是「解算器上轨道，
不是教学」）、小游戏。**没有 drill 库**：没有公式训练器、没有 case 重复循环、
没有弱项队列。中国用户在评论里要求加「公式训练」。第三方 DCTimer-BLE 反而补上了
分段训练。

**对战**：全球 1v1，**按练习成绩推出的水平匹配**（不是自报等级），比赛中实时显示
对手的魔方状态与型号，2.4.3 还优化了「对手 body rotation 显示」，即整体朝向也在传。
房间赛 **2-32 人**，轮数与人数自定，密码锁，实时观战，2.4.1 加了入场设置。
**排行榜周 / 月 / 总，个人练习与 1v1 各自一套**。但房间实际是空的 —— sspai 评测者
从未成功参加过一次多人房间赛。**无好友、无聊天**，两位中国用户分别在要。

**教学（材料对此格外明确）**：营销承诺「AI魔方教程即来即学」+ 层先法与 CFOP 图文视频教程；
实际点进 AI 智能教程是一页「**AI教程上线时间待定，敬请期待**」，层先与 CFOP 教程
**外链微信文章**，评测者称之为「割裂」。App Store listing 到现在仍写着 coming soon。

**UI 清单**：三个设备模块是入口分叉。Smart Cube 模块内的九项自陈清单读起来像 3x3 九宫格：
个人练习 / 数据分析 / 解法复盘 / 全球排行 / 1V1 / 房间赛 / 复原引导 / 在线教程 / 小游戏。
sspai 归成三块：个人练习 / 竞赛（含多人房间赛 + 1V1）/ 教学。两位独立评测者的设计判断一致：
功能可读但视觉简陋 —— 「介面很好懂，就不教學了」，但比 GAN 显得「簡陋」「像是工程師稍微
拉幾筆就放出來的成果」。**具体 tab 名与首屏无证据**。

**差评原文**：

> 「能让我知道自己具体在哪些方面存在问题，但**之后如何解决问题**，这个魔方和其配套的应用**还无法给我答案**」 — 少数派评测（整份材料里最好的一句，它就是我们的产品定位）

> 「app內練習 聊天 **優化軟件GUI界面（重點）**這樣才能吸引更多魔友選擇奇藝智能」

> 「希望尽快完成ai智能教程再加一些**公式训练**以及**tps测试**」

> 「风格简约不失大气 **排行榜很客观真实** 建议添加好友功能 建议在排位赛中三次后添加一个ao3」

> "**Down moves don't work at all**" — Sad, Jane's garden, 2024-09-08

> "**TERRIBLE**" — Anynomous1928, 2023-09-29（语言选择器回退中文，直接堵死登录）

---

### 3.4 MoYu WCU CUBE — 机制全是名字，本地化是硬伤

**是什么**：App Store 开发者是汕头市澄海区魔域文化有限公司，应用宝上开发者却是
深圳市智趣未来文化科技有限公司而魔域是运营方（同一产品两个登记主体，外包）。
Education 类，免费，**425.7MB**（QiYi 的 5 倍，几乎肯定是打包了视频课件）。
最锋利的一个数据点：**US 2.1 分 / 26 评分 vs CN 4.1 分 / 220 评分** —— 同一个包，
在国外 2.1、在国内 4.1，这是本地化失败，不是功能失败。事件覆盖超过三阶：
软件计时明确覆盖 2x2 / 3x3 / 金字塔，2.0.8 加了 2x2 解法辅助，另有官方智能二阶硬件演示视频。

**解法分析**：商店文案称有深度数据分析与步数等关键指标；零售文案称陀螺连 rotation 都跟。
**分段大概是没有的** —— 一位中国用户在评论里逐字要求：
「能加一个支持分段的统计吗，就是每个部分花了多久的那种」，而这恰好是 QiYi 有的东西。
计时准确性被用户质疑（还原完之后「硬是加长了好几秒」）；转动跟踪会中途丢步导致成绩不计。

**训练模式（名字确认，机制全部未验证）**：**预判训练**（有独立官方介绍视频，47 秒 ——
一家主流厂商把 lookahead 做成一级命名 drill，是中国族里最有意思的单项）、
成就挑战（2.0 改版头号功能）、**WCU 考级**、复原助手、拍照复原、
公式练习 F2L/OLL/PLL/COLL（只确认是一个列出的板块，是真训练器还是静态公式表未知）、
排位赛、名师讲堂视频课。

**对战与社交**：全球对战（统一打乱）、成绩排名与排行榜、排位赛、**战队系统**
（有独立官方介绍视频，这一族里唯一有 clan 的）、竞速板块。对战模式有个好笑的具体缺陷：
「versus mode often gives only a two-move scramble」。

**教学**：内容最多、也最碎 —— 启蒙板块、名师讲堂、WCU 考级、拍照复原，
教程「从基础到高级」。但打乱记号本身就是新手的墙：

> 「这软件对新手很不友好，计时模式那里的话能给你的打乱都是**公式字母，新手根本看不懂**」 — 2024-11-26

**UI 清单**：只能确立命名板块（竞速板块 / 战队系统 / 预判训练 / 成就挑战 / 复原助手 /
名师讲堂 / WCU 考级 / 计时），2.0 是一次完整视觉重做。**tab 顺序与首页层级未验证。**
唯一大家都同意的 UX 事实是登录强制且痛苦：

> "**Can't use without registration. Registration fails with network exception**" — US App Store

> "**the app is only in Chinese**" — SpeedSolving（该帖头号抱怨），同帖投票 33% 可接受 / 67% 不建议买，
> 并推荐改买 QiYi 或 GAN iCarry2；另有 "I don't think the MoYu smart cube connects to other apps"

**该抄什么**：预判训练的**提升到一级**（我们已有 `/predict`，缺的是命名、置顶、教它、
并把预判失败接到实测停顿上而不是自评）；成就 + 战队 + 考级这一层留存机制 ——
考级尤其贴中国的班级 / 俱乐部 / 学校文化，「PB 曲线」在那个场景不起作用。

---

### 3.5 Giiker 超级魔方 — 装机量最大的那个，已经放弃阵地

4.8 分 / **8027 评分**，比 QiYi 与魔域高两个数量级，装机量上它才是「中国的智能魔方」。
八语言本地化（这一族唯一认真做 i18n 的）。**已冻结**：材料里最后一版是 2.6.19，2023-10-17。
五个卖点：零基础智能快解（识别打乱，算约 30 步解）、**游戏化互动教学**
（按你手上真实状态自动生成教学内容并实时引导 —— QiYi 承诺却从未上线的那个教育学思路）、
进阶训练大数据（自动计时与步数、解法记录、步骤分析、数据统计、**3D 动画回放**）、
魔方主题小游戏（魔方迷宫、魔方快跑，用实体魔方当手柄）、全球在线对战（统一打乱）。

**它证明的两件事**：智能魔方 App 的大众市场是**拿魔方玩游戏的小孩与新手**，不是
20 秒的 CFOP 选手 —— 8027 个 4.8 分来自快解 + 小游戏 + 互动教学，不是来自分段分析；
以及没人在守这个阵地了（两年多无发版）。

---

### 3.6 Cubeast — 唯一的严谨分析产品，也是唯一没有对战的

**是什么**：仅 Web、**仅 Chrome/Chromium**（Web Bluetooth），Angular + Rails，
Paddle 收款，单人开发者，Discord 优先支持。规模无任何 MAU 数据；
唯一代理信号是一个公开分享的 solve 三年后 107 次浏览、0 赞 0 评论，
以及作者自陈「I submitted cubeast to HN some time ago but it didn't get any votes」。
硬件宣称全支持（知识库里有 gan / moyu / gocube / giiker / **gan_robot** / qiyi / timers 路由）。

**解法分析 —— 这一节就是要抄的东西**。solve 级四个时钟外加 timer_time 分开记：

| 字段 | Cubeast 自己的定义 |
|---|---|
| `time` / `timer_time` | 最终成绩 / 计时器测到的时间（去罚时前后） |
| `solving_time` | 去掉 pickup、put-down、罚时后的时间 |
| `inspection_time` | 起表前用掉的观察时间 |
| `pickup_time` | 起表 → 第一转 |
| `put_down_time` | 最后一转 → 停表 |
| `total_recognition_time` / `total_execution_time` | 各阶段识别 / 执行时间之和 |
| `face_turns` / `quarter_turns` / `slice_turns` | 三套步数度量各记一份 |
| `turns_per_second` | slice_turns / timer_time |
| `steps_skipped` | 本把跳过了几个阶段 |
| `device_model` / `device_name` | 型号 + 用户给魔方起的名字 |
| `has_incomplete_solution_penalty` / `incomplete_solution_missing_turn` | 差一步没拧完，并**记下差的是哪一步** |
| `face_up` / `face_front` | 本把的朝向 |

step 级五个时间字段，定义逐字如下（这是我们要照抄的部分）：
`step_recognition_time` = 「上一阶段结束到本阶段第一转之间的时间，**AUF 转动也算在识别时间里**」；
`step_execution_time` = 「本阶段第一转到最后一转之间」；`step_time` = 本阶段总时间；
`step_cumulative_time` = 从开始到本阶段完成；
`step_turns_per_second` = 「slice_turns / step_execution_time」。另有 `step_case`、
`step_has_turns`、`step_skipped`。

三个值得逐字抄的设计判断：① **AUF 计入识别** —— 阶段时钟在上一阶段最后一转落定时启动，
在第一个**非 AUF** 转动时停止；② `step_time = recognition + execution`，且 TPS 只除执行时间，
所以 TPS 是真正的手速而不是被思考稀释的速度；③ **停顿感知的步数度量** ——
「Cubeast notices the long pause between those two turns and will treat them as separate turns」，
即中间停了一下的 U2 记成 2 步而不是 1 步。

阶段粒度**比 CFOP 四段更细**：公开分享页上那把用的是 Layer by Layer，
阶段是 Cross / F2L / EOLL / OCLL / CPOLL / EPLL，末层拆成四小步，跳过的那步渲染成
`No turns` 并计入 `steps_skipped`。方法侧作者自陈「works with all major speedsolving methods」
并点名加过 Roux 与 Petrus。

**弱点是 rotation**：`face_up`/`face_front` 只记本把朝向，作者自陈会「try to guess wide
turns and rotations in some cases」，而用户说「it doesn't usually recognize rotations」。
**错误检测只有罚时形状**（差一步、观察超时、DNF），bundle 里没有任何走错 / 回退 / 恢复的指标。

**报告怎么排（从一个真实公开分享页读下来的）**：
顶条三个大数 **Time / Turns / TPS**，接方法与 ruleset chip，再是打乱串加一个可折叠的
「Recorded scramble」；下面一条阶段 scrubber（`0s | Cross | 0s / 29.46s | 0 / 103`）；
然后 **5 个 tab**：

- **Overview** — 堆叠柱状图，每阶段一柱，series 是 `Pickup, Cross, F2L, EOLL, OCLL, CPOLL, EPLL, Put-down`
- **Steps** — 主表：`Step | Case | Recognition | Execution | Step Time | Total Time | Turns | TPS`，表上印 Pickup time、表下印 Put-down time
- **Solution** — `Step | Turns`，每阶段的实际动作串
- **Stats** — 8 个标量瓦片：观察 / pickup / 识别总计 / 执行总计 / put-down / solving time / 罚时 / 跳过步数
- **TPS** — 存在，内容没抓到

下方是 3D solve player（播放暂停、单步前后、拖拽 seek，100ms tick），再下是社交页脚
（作者、时间、Cube 与 Timer、评论、浏览数、赞）。移动端 changelog 明确
「Display solve analysis above solve player on small screens」—— 窄屏上数字压过动画。

**训练（Academy）**：代码里只有**两种练习类型**：`algorithms_drill` 与 `intuitive_solving`。
关键是**练习是持久化对象而不是模式**：命名 → 多步向导 → 落进带 active/archived 筛选的
练习索引 → 每次跑一轮（round）→ **per-round 与 per-case 统计**（success、成功率、
recognition_time、执行、TPS，各有自己的颜色刻度）+ case 级下钻弹窗 + 每轮 CSV 导出。
作者承认的缺口：**没实现「把魔方打乱到某个 case」**（「one of the most requested features」，
在做 solver）、**练习没有回放**、不能加自己的 case。**没有任何 SRS / 间隔重复。**

**统计是查询构建器而不是固定看板**：`Statistic × Method × Step × Group by × Graph by`，
分组维度含 Group / Overall / Step / Method / **StepCase**（付费）/ Best / Worst，
x 轴可选按天或按 solve 序号。指标枚举就是上面那套字段。聚合含 Ao5/Ao12/Ao100 与
**最佳 Ao5/12/100**，Ao100 去掉最好与最差各 5 个。另有基于 scoped_search 的
**solve 查询语言**（带自动补全）、**尊重当前查询的 CSV 导出**（后台任务，48 小时后删除）、
以及**有文档的 REST API**（Bearer token）。官网自举的例子：比较不同型号魔方之间的 TPS、
看你有多大比例的 solve 做了 XCross、你的 PLL 平均识别时间是多少。

**设备是一等公民**：魔方可命名、收藏、列表、**归档**（「不再出现在连接按钮和弹窗里，
但仍出现在 solve 与统计里」）、删除时给出很重的警告（会连带删除该设备下所有 solve），
每颗魔方一套配色。**蓝牙诚实度 UX 异常显式**，用户可见字符串包括
「Bluetooth signal is weak, it may cause false DNFs, +2s penalties…」、
「Did not receive initial cube state within time limit」、
「This MAC address doesn't decrypt this cube」、
「Your cube is already connected to a phone or another computer」，
以及一条**带重置按钮的失同步通知**。ruleset 按 session 设（只允许 Stackmat 计时 vs
任意方式含魔方本身），并反向盖回每一条 solve。

**社交只有分享**：solve 与 average 的公开分享链接、赞、评论、浏览数、Supporter 徽章。
**路由表里完全没有 racing / battle / 1v1 / leaderboard。**

**收费**（用 bundle 里的 product id 打 Paddle 价格 API 拿到的硬数字）：
Premium $5/mo $50/yr、Pro $9/$90、Patron $19/$190，年付 = 10 倍月付，全员 14 天试用。
墙后确认的只有整个 Academy 与 CaseRecognition（免费用户在统计里失去 StepCase 分组）。

**差评原文**：

> "Cubeast looks pretty awesome, but **it only works in Chrome, which is a non-starte[r]**" — HN 30581829（评论者转而自己写了个 Python/Qt 的）

> "**The statistics section needs an overhaul in general.**" — 作者本人

> 关于阶段百分比视图："Right now no. **It wasn't a feature that was requested a lot** to be honest and I have currently to plans to work on it." — 作者本人（把百分比外包给 Excel，靠导出兜住了）

> "the reconstructions it gives are accurate in that they solve the cube, but **it doesn't usually recognize rotations**"

> "the last few months I've been concentrating on a **rewrite of my puzzles library in Rust**. In will allow me to add features like **live solve analysis, cube solver, showing how optimal your crosses are**, supporting more strange methods." — 作者本人（**我们已经有这一层了**）

另：freshcuber（2025-11）报告新款 QiYi SmartCube（SC-A 艺术版 / SC-S UV）连不上 Cubeast，
老款 MoYu AI 反而更好。

---

### 3.7 acubemy / CubeDesk / GoCube — 三块补丁

**acubemy**（Web + Android + iOS，四个魔友做的，宣称支持所有品牌）：
唯一做到 **陀螺 rotation 在 solve 与回放里 1:1 显示** 的产品，这正是 Cubeast 公开承认
做不到的事；有 Roux 分析器带 case 识别；公式训练带 smart tips（OLL/PLL）；
**1v1 可本地或在线**，用户说这就是他用它的原因。连接流程是已知弱点：一个 connect 按钮、
不能给魔方起名、按原始标识符列出所有蓝牙设备。头号差评：

> "An app that is constantly putting a **'you have to subscribe to premium if you want this feature you just clicked'** at my face is a red flag."

> "had to refresh page and connect again because **it was off by a U move**"（缺一个重置入口）

**CubeDesk**（Mac/Win/Linux + Web，1v1 写进标题）：分析主张只有一句
「Detailed info on each solve」；**上线时没有智能魔方支持**，蓝牙是用户请求。
有 700+ 公式训练与自定义公式创建器、`/stats` 页、session 管理、公开 solve 页与用户页。
2021 年发布帖的用户需求清单值得当**自查表**逐条对我们的 `/timer`：
从 csTimer 导入、画打乱图、观察 8 秒与 12 秒语音、+2/DNF/删除的快捷键、
成绩分布图、计时屏上列出成绩、可中止观察、任意 AoN、十字求解器。

**GoCube / Rubik's Connected**（Particula，每款硬件一个独立 App，免费无内购，
App Store 4.6 分 / 2.4K 评分）：分析到「solve time, speed, moves」就是天花板。
但 **Go-Learn 是全场最强新手引导** —— 「mini-steps + 视频 + 提示 + 实时反馈」的交互式教程，
**因为魔方自报状态，每一小步都能被验证而不是让用户自评**，而且它确实有效：

> "I've set down several of my friends and family members with the learning part of this app and they all managed to **learn the cube in roughly an hour**." — Joshxrs

**四个动词就是它的导航**：Go-Learn / Go-Improve / Go-Compete / Go-Play，新手优先排序 ——
先学，再看数据，再比赛，再玩。两条差评正好是我们的入口：

> "is missing a way to learn intermediate skills (such as a more advanced tutorial, **a OLL/PLL library with practice drills**, or a reading library to read more about cube theory…" — TWCrew, 02/14/2021（这条抱怨从 2021 年立到现在）

> "the teaching method is a **rote memorization** of steps and algorithms…the student is **not taught how or why** the algorithms work" — MikeKiese, 01/19/2025

市场分层由一位 GAN 用户说得最清楚：
> "If your a beginner and looking to start smart cubing, I'd recommend the **GoCube**. If your an Intermediate to Pro go **GanCube**" — Arctic boys, 08/29/2024

---

## 4. 功能矩阵

判断：**必做** = 没有它这个平台不成立 ｜ **应做** = 明确赢过竞品且成本可控 ｜
**可选** = 有价值但可排到后面 ｜ **不做** = 明确决定不做，并写下理由

### A. 单把解法分析

| 功能 | XC大师 | 魔方星球 | Cubeast | GoCube | 我们现在 | 判断 |
|---|---|---|---|---|---|---|
| 整解时间 + Ao5/Ao12/Ao100 | ✅ | ✅ | ✅ 含最佳 AoN | ✅ | ✅ 含 `bestAverageOfN` | — 已齐 |
| CFOP 分阶段耗时 | ❌ | ✅ | ✅ 更细（末层拆 4 段） | ❌ | ✅ `stage_segments.ts` | — 已齐 |
| 每阶段固定指标网格 | ❌ | ✅ 5 指标 | ✅ 8 列表格 | ❌ | ⚠️ 只有 HTM + 时长 | **必做**：竞品的全部分析产品就是这一张表，我们有数据没有屏 |
| **识别 vs 执行拆分** | ❌ | ❌ | ✅ 定义公开 | ❌ | ❌ | **必做**：全行业只有一家有，且我们有设备时钟。逐字采用它的定义 |
| AUF 计入识别 | ❌ | ❌ | ✅ | ❌ | ❌ | **必做**：和上一条是同一件事，不能各写一套 |
| TPS 只除执行时间 | ❌ | ❓ 有 TPS，算法未知 | ✅ | ❌ | ⚠️ HTPS/QTPS 除整解 | **必做**：现在的 TPS 被思考时间稀释，不是手速 |
| 停顿检测（次数 / 最长 / 位置） | ❌ | ❌ | ⚠️ 只用来拆步 | ❌ | ⚠️ 最长停顿 + 次数，无位置 | **应做**：补「停在第几步、当时魔方什么状态」 |
| 停顿感知的步数度量 | ❌ | ❌ | ✅ | ❌ | ❌ | **应做**：几乎免费，且实质修正步数与 TPS |
| pickup / put-down / inspection 作为字段 | ⚠️ 有 WCA 观察计时 | ❌ | ✅ 四个时钟 | ❌ | ⚠️ 首动延迟≈pickup，其余无 | **必做**：`Solve` 加字段，是后面所有屏的前提 |
| 观察时间独立直方图 | ❌ | ❌ | ⚠️ 有字段无专屏 | ❌ | ❌（观察期转动明确不记录） | **应做**：中国族唯一锐利的想法，我们有时钟，顺带能出「观察时长 vs 十字质量」 |
| **最优解对比（你 9 步 / 最优 6 步）** | ⚠️ 有最优解器但无逐步 diff 证据 | ⚠️ 宣称 optimizes solutions，机制未知 | ❌ 作者列为未来工作 | ❌ | ❌（solver 有，未接复盘） | **必做**：全行业空白 + 我们 34GB 表现成，这是最大的差异化 |
| **错误检测（废步 / 回退 / 撤销）** | ❌ | ❌ | ⚠️ 只有罚时形状 | ❌ | ❌ | **必做**：全行业空白，机制与打乱纠错同源 |
| 逐步 case 标注（OLL/PLL/F2L） | ❌ | ❓ | ✅ `step_case` | ❌ | ✅ OLL/PLL 精确 case | — 已齐，需接进表格列 |
| rotation / regrip 计数 | ❌ | ✅ 独立指标（定义未知） | ❌ 明确做不到 | ❌ | ❌（陀螺数据有） | **应做**：我们能跨品牌算，GAN 结构上只能算自家 |
| 陀螺朝向 1:1 回放 | ❌ | ⚠️ 回放有，朝向保真未知 | ❌ | ❌ | ⚠️ `LiveCubeGyroView` 实时有，回放未接 | 可选：先做指标，回放保真排后 |
| 可拖拽时间轴回放 + 变速 + 步骤列表联动 | ⚠️ 解法 3D 演示 | ✅ 1x + 慢放 + 步骤面板 | ✅ 播放器 + scrubber | ❌ | ⚠️ `PlaybackPanel` + 3D，无阶段边界标记 | **应做**：把阶段边界画到时间轴上 |
| 设备型号作为分析维度 | ❌ | ❌ 只有自家 | ✅ 命名 / 收藏 / 归档 + 按设备分组 | ❌ | ❌ | **应做**：「不同型号之间比 TPS」只有智能魔方平台能给，且我们支持的品牌比它多 |
| 报告分层（多 tab / 渐进展开） | ❌ 一段 AI 散文 | ⚠️ 一张网格 | ✅ 5 tab | ❌ | ⚠️ 单一 modal | **必做**：报告不该挤一屏 |
| 一个 0-100 质量分 / 评级前置 | ✅ 「解法评级」（刻度未知） | ❌ | ❌ | ❌ | ❌ | **应做**：强行为钩子，且我们有最优解当锚 |
| 局内实时分析 | ❌ | ❌ | ❌ 作者说要等 Rust | ❌ | ❌ | 可选：我们的 solver 已经是 Rust/WASM，结构上领先，但价值排在事后报告之后 |

### B. 训练

| 功能 | XC大师 | 魔方星球 | Cubeast | GoCube | 我们现在 | 判断 |
|---|---|---|---|---|---|---|
| 子步自动停表 drill | ❌ | ✅ 分步特训（靠状态检测结束） | ⚠️ 练习有但要 2D 图 | ❌ | ❌（csTimer 有，见 MIGRATION 表 D） | **必做**：唯一被用户自发点名夸的训练功能 |
| 状态劫持（免还原重复练同一 case） | ❌ | ❓ | ❌ 作者说在做 solver | ❌ | ❌ | **必做**：智能魔方训练器的核心机关，且 Cubeast 卡在这上面 |
| 连续训练循环（自动出下一题） | ⚠️ 有分级练习循环 | ⚠️ | ⚠️ rounds | ❌ | ❌ | **必做**：与上两条同一个 Sprint |
| 练习是持久化对象（命名 / 归档 / 每轮统计 / 导出） | ❌ | ❌ | ✅ | ❌ | ❌ | **应做**：这一步才把 trainer 变成 training platform |
| **弱项自动队列 / 错题 bin** | ✅ 「复习」自动挑错题 + 最弱练习 | ⚠️ 大数据诊断 + 公式推荐（机制未知） | ❌ 只有 per-case 成功率 | ❌ | ❌ | **必做**：把 per-solve 阶段数据反接成下一次练什么，我们能按阶段挑，他们只能按整题 |
| SRS 排程（按识别延迟评级） | ❓ | ❌ | ❌ | ❌ | ⚠️ `/alg` 有 SRS，与智能魔方未通 | **必做**：全行业没有，我们的引擎现成 |
| 公式库 + case 训练器 | ❌ | ⚠️ 新包删了 | ✅ 两种练习 | ❌ | ✅ `/alg` + `DrillModal` | — 已齐，需接 BLE |
| 预判 / lookahead 作为一级 drill | ✅ 四字段结构化记录 | ❌ | ❌ | ❌ | ⚠️ `/predict` 独立页 | **应做**：置顶 + 接实测停顿 + 补「失败原因」维度 |
| 十字 / XCross 分级抽题 | ✅ 从一步十字起 | ❌ | ⚠️ XCross 只做统计 | ❌ | ⚠️ `/scramble/stats` 有难度分桶，未接抽题 | **应做**：他们要算，我们查表 |
| 只练前半段的短循环 | ✅ 整个产品就是这个 | ⚠️ 分步特训 | ❌ | ❌ | ❌ | **应做**：训练密度远高于整把，且需要智能魔方 |
| 每日建议 / 唯一推荐动作 | ❌ | ⚠️ 每日任务（是任务不是诊断） | ❌ | ❌ | ❌ | **应做**：见第 5 节，Garmin 与 Duolingo 的核心 |

### C. 统计

| 功能 | XC大师 | 魔方星球 | Cubeast | GoCube | 我们现在 | 判断 |
|---|---|---|---|---|---|---|
| 分布直方图 + 趋势线 + 标准差 + 最优 AoN | ❓ | ⚠️ 只确认 AoN | ✅ | ❌ | ✅ 五种图表 + `sdOfBestAoN` | — 已齐（QiYi 的规格我们已经超了） |
| 按 case 聚合的强弱 | ❌ | ❓ | ✅ StepCase（付费） | ❌ | ✅ `CfopCaseStatsPanel` | — 已齐 |
| 统计查询构建器（指标 × 维度） | ❌ | ❌ | ✅ 唯一一家 | ❌ | ❌ | 可选：power user 面，排在 P2，但它是 Cubeast 唯一护城河 |
| CSV 导出 + 查询语言 + REST API | ❌ | ❌ 且丢过数据 | ✅ 三件套 | ❌ | ❌ | **应做**：导出是每一个我们不做的统计的逃逸阀 |
| 7 日 vs 28 日的 Form 判断 + 状态词 | ❌ | ❌ | ❌ | ❌ | ❌ | **应做**：见第 5 节，成本极低 |
| WCA 排名预测 | ❌ | ❌ | ❌ | ❌ | ❌（数据在 `/wca`） | **应做**：QiYi 拿它当猜测，我们拿真数据算 |
| 打乱难度分位归一 | ⚠️ 有真题库 | ❌ | ❌ | ❌ | ⚠️ `/scramble/stats` 有，未接 solve | **应做**：「你这把 12.4 是在难度前 8% 的十字上」没人能给 |
| 习惯归因（热手 / 时段 / 时长 → 成绩） | ❌ | ❌ | ❌ | ❌ | ⚠️ `HourChart` 有时段图，无归因 | 可选：全行业空白，但要样本量，排 P2 |
| 云同步 + 历史深度 | ✅ | ⚠️ 迁移丢过 2000 把 | ✅ | ❓ | ✅ 云备份 | — 已齐，值得把「迁移完整性」当卖点讲 |

### D. 对战与社交

| 功能 | XC大师 | 魔方星球 | Cubeast | GoCube | 我们现在 | 判断 |
|---|---|---|---|---|---|---|
| 1v1 同一打乱 | ❌ | ✅ | ❌ | ✅ | ✅ | — 已齐 |
| 房间 2-32 人 + 密码 + 自定轮数 | ❌ | ✅ 房间赛 | ❌ | ❓ | ⚠️ net 房间，2 人 | **应做**：中国俱乐部办线上赛的实际形状 |
| 观战角色 + 双方实时动作流 | ❌ | ✅ | ❌ | ❓ | ❌ | **应做**：他们最有社交感的功能，我们的 delta 很小 |
| 排行榜周 / 月 / 总，solo 与 1v1 各一套 | ❌ | ✅ 含地区榜 | ❌ | ✅ Solo 与 Pro 分排 | ❌ | **应做**：solo 苦练的人不该在榜上隐形 |
| 按实测成绩匹配 | ❌ | ⚠️ 被骂匹配机制有问题 | ❌ | ❓ | ❌ | 可选：先要人，其次要评分透明 |
| 段位 / 赛季 / 战队 / 成就 / 考级 | ❌ | ✅ 全套 | ❌ | ❌ | ❌ | 可选：留存层，但**不要带抽卡** |
| 复盘分享链接（含评论 / 浏览数） | ⚠️ 只能出图 | ⚠️ 可看别人复盘 | ✅ 赞 + 评论 + 浏览数 | ❌ | ⚠️ `/recon` slug ISR + 站内分享 | **应做**：唯一的病毒面，且我们的基建已经是这个形状 |
| 抽卡 / 消耗性货币 | ❌ | ✅ 魔晶，头号差评 | ❌ | ❌ | ❌ | **不做**：他们的头号差评，我们把「不抽卡」当宣传点 |

### E. 教学

| 功能 | XC大师 | 魔方星球 | Cubeast | GoCube | 我们现在 | 判断 |
|---|---|---|---|---|---|---|
| 状态验证式交互新手教程 | ❌ | ⚠️ 拍照复原 | ❌ | ✅ Go-Learn，约 1 小时教会人 | ❌ | **应做**：分析层没人做，我们有内容 + 有状态流 |
| 课程体系 / 关卡 | ❌ 被差评点名 | ✅ 魔方学院（视频音画不同步） | ❌ | ⚠️ CFOP Academy | ✅ `/cfop` 13 节 + `/wiki` + `/math` | — 已齐，缺的是与训练器互跳 |
| 解释「为什么这么走」 | ✅ 一键 AI 解析 | ⚠️ AI 动画演示每一步 | ❌ | ❌ 被差评点名是死记硬背 | ❌ 全站都是序列，没有一处解释为什么 | **应做**：GoCube 与 XC大师 分别从两头证明了这条需求 |
| 从诊断跳到对应教程小节再回来练 | ❌ | ⚠️ 公式推荐（机制未知） | ❌ | ❌ | ❌ | **必做**：这条闭环没有任何竞品在做，而我们四块内容都有 |
| 打乱对新手可读（2D 展开图 / 3D） | ✅ 3D ↔ 2D 可切 | ✅ | ❌ | ✅ | ⚠️ 有打乱图，逐步提示缺（见 MIGRATION 表 B） | **应做**：「打乱都是公式字母，新手根本看不懂」是在案的差评 |

### F. 平台与收费

| 功能 | XC大师 | 魔方星球 | Cubeast | GoCube | 我们现在 | 判断 |
|---|---|---|---|---|---|---|
| 跨品牌驱动 | ❓ | ❌ 只有 GAN | ⚠️ 宣称全支持，新 QiYi 坏 | ❌ 只有自家 | ✅ 六品牌 + 设备时钟 | — 结构性护城河 |
| Web，免安装，可链接 | ❌ | ❌ 400MB 两个分叉包 | ✅ 但仅 Chrome | ❌ | ✅ | — 结构性优势 |
| 免登录先用 | ✅ v3.4.2 起 | ❌ 半个 App 卡在 Verify | ⚠️ | ❓ | ✅ | — 已齐，值得讲 |
| 免费无限次数 + 完整单把报告 | ✅ 全免费 | ⚠️ 进度被货币门控 | ⚠️ Academy 与 case 识别付费 | ✅ | ✅ | **必做**：写成硬规则，永不对次数收费 |
| 收费只卖深度 | — | ❌ 卖进度与外观 | ✅ | — | — | **应做**：历史深度 / pivot / 导出 / 教练层 |

---

## 5. UI/UX 设计参照

把 UX 模式库映射到具体要建的屏。每屏给四件事：**首屏主数**、**第二层**、
**唯一推荐动作**、**参照出处**。原则来自模式库里被反复验证的四条：
① 首屏领头的数不该是原始测量值；② 第二眼看到的必须是**命名过的**分解与逐项判语；
③ 第三眼是自动检出的里程碑，用户不该自己翻历史找 PB；④ 纵深靠滚动或滑动，不靠塞满一屏。

### 屏 1 — 今日（新首页，路由 `/timer` 之上或旁边）

- **首屏主数**：一张推荐卡 —— 「今天：F2L 第 3 槽 20 次 + 12 把计时」，下面一行理由
  （「近 200 把里第 3 槽比其它槽慢 0.9s」）。一个 Start 按钮，别的选项收进「换一个」。
- **第二层**：3 条每日任务，混三类 —— 量（25 把）、质（5 把零 rotation）、
  定向（把昨天失手的 4 个 case 各练 10 次）；练习连续天数 chip（口径放低到
  「任意 5 把即算一天」）+ 每周 2 天免罚 + 每月 1 次补签；昨天的一条自动检出亮点。
- **唯一推荐动作**：Start。整屏只有一个主按钮。
- **参照**：Garmin 的 Daily Suggested Workout（一天一条，带理由，Readiness 低时偏向恢复）；
  Duolingo 的 Path（只有一个 START 泡）与 Daily Quests（每条都是「一句话 + 一个数」）；
  Oura Today 的 daily highlight（按打开时间不同给不同的一句话）；
  Duolingo Streak Freeze（没有宽恕机制的连续天数会变成怨恨引擎）。
- **为什么**：模式库里最一致的一条 —— 训练类 App 的头号流失原因是选择瘫痪，
  产品的智能预算应该花在**替用户减掉一个决定**上。而这一屏我们能做得比 Garmin 更好的地方是
  **理由可审计**：Garmin 说「做这个」，说不出「因为第 3 槽在 200 把里花掉你 0.9s」。

### 屏 2 — 单把复盘报告（改造现有 `ReconstructModal`）

- **首屏主数**：一个 0-100 的 **Solve Quality**（执行效率 + 流畅度 + 识别成本，
  相对**你自己**近期分布），不是时间 —— 时间在计时屏上已经有了，报告必须补一个**正交**的数。
  刻度要**校准到典型值落在 50-95**（chess.com 的 CAPS2 就是为此重新标定过范围，
  真实用户全挤在 95-99 的分数没有信息量）。
- **第二层**：阶段柱状条 + 每阶段一个判语 chip，词表固定（Great / Fine / Slow / Pause / Error）。
  动作级也要一套固定词表 —— 象棋里的 Blunder，在魔方里的对应物是
  **regrip、>0.35s 停顿、整体转体、回退/撤销、走错公式再改**。词表本身就是产品：
  用户会说「我这把两个 blunder」，不会说「我的 ACPL 是 43」。
- **第三层（滚动 / 侧滑）**：Steps 表（`Step | Case | 识别 | 执行 | 阶段时间 | 累计 | 步数 | TPS`）
  → Solution（每阶段动作串）→ 与最优解的逐步 diff → TPS 曲线 → 原始动作日志带设备时间戳。
- **唯一推荐动作**：「把代价最大的那个 case 现在练一遍」，一个按钮直接进 drill。
- **收尾一行**：自动检出的里程碑，比**滚动 30 天窗口**比，不是历史最好
  （历史 PB 在第二个月之后就不再触发了）：「本月最快 PLL」「40 把以来第一次 sub-2 十字」
  「零整体转体 —— 你只有 7% 的把数是这样」。
- **参照**：chess.com Game Review（Accuracy 领头 + 每步分类词表 + 开局/中局/残局分段准确率
  + 「重试这个 blunder」）；Strava 活动页（地图 → 三大数 → 其余，Relative Effort 在折叠线下方，
  best efforts 要右滑一次才出）；Cubeast 的 5 tab 分层；
  Cubeast 移动端把数字排在动画之上。
- **诚实性**：每个分数挂一个「这个数怎么算的」披露，列出输入项与各自当前贡献，
  外加一句老实的免责：「阶段边界是从魔方状态推断的，不是你的意图，AUF 与预观察转体可能归错」。
  Garmin 的教训是：如果第三方要写文章解释你的分数，你的 UI 就失败了。
- **可纠正**：允许用户给这把打标签（手气好 / 打乱没读懂 / 新公式 / 在试新东西 / 被打断），
  标签进统计筛选维度；也允许改一个检测错的阶段边界，这些纠正就是我们的训练数据。
  Apple 的 Effort 1-10 是可手调的 —— 可编辑的分数是协作，不可争辩的分数是侮辱。

### 屏 3 — 训练（drill）

- **首屏主数**：今天到期的 case 数 + 新 case 数（两个数，像 Anki 的 deck 列表），
  一个 Study 按钮。
- **第二层**：队列有**上限**（「最多 40 次复习 / 5 个新 case」）、一个期望记忆率旋钮、
  以及一个诚实的「你的数据还太薄，正在用默认参数」状态；评级按钮上**预览后果**
  （按下去下次什么时候再来）。评一次不是对/错，而是**识别延迟 + 执行时间相对你自己的基线**。
- **唯一推荐动作**：Study。
- **参照**：Anki deck options（New Cards/Day、Maximum Reviews/Day、Easy Days、
  FSRS Desired Retention 默认 90% 且明说 >97% 会「overwhelming」、Optimize 会诊断
  「Hard misuse」与「复习数不足几百」）；Lichess Puzzle Dashboard（bottom 3 命名成
  Improvement Areas，可重放失手的题）；Duolingo Practice Hub（顶部每日轮换的定向复习 +
  下面一个常驻 Mistakes 区）。
- **注意**：Lichess 论坛的在案抱怨是「不同主题的评分不可比」。**每一个 per-case 统计
  必须显示 n 和置信区间**，否则用户会说它是坏的。

### 屏 4 — 进步（Progress）

- **首屏主数**：一个 **Form** 判断 —— 近 7 天 vs 近 28 天的 Solve Quality / Ao12，
  渲染成一个箭头 + 一个词（Improving / Steady / Slipping）。
- **第二层**：下面是周柱状 + 一条 28 天均线；一个每 7 天出一次的状态词
  （Improving / Maintaining / Overreaching = 把数很多但质量在掉 / Rusty = 长时间没练）；
  以及**永远同时显示最强 3 项与最弱 3 项** case/阶段，让「平台期」永远带着三个具名嫌疑人到场。
  每个阶段时间用**你自己的 p25-p75 带**画，今天的点落在带上；只在你偏离**自己**时报警，
  永不因为「比别人慢」而报警。
- **唯一推荐动作**：把最弱 3 项加入今天的队列。
- **参照**：Apple Training Load（7 天 vs 28 天，白线是 28 天均值）；
  Garmin Training Status 的状态词（Maintaining / Unproductive 就是平台期消息，且自带隐含指令）；
  Lichess 的 Strengths | Improvement Areas 两栏；Oura Vitals 的个人基线锚定。

### 屏 5 — 洞察（`/insights`，独立路由，power user）

- **首屏主数**：一个 metric × dimension pivot。metric = 时间 / TPS / 阶段时间 / 识别延迟；
  dimension = case / 槽位 / 十字底色 / 打乱难度 / 时段 / session 长度 / 设备型号。
- **第二层**：可保存视图；x 轴可切按天或按 solve 序号；CSV 导出尊重当前查询。
- **唯一推荐动作**：保存这个视图。
- **参照**：Cubeast 的统计查询构建器（这是它唯一的护城河）；Lichess Insights；
  chess.com Insights（按时段与星期切分）。**关键是它必须是独立路由**，
  这样默认视图永远不被它污染 —— `/timer` 保持一屏。

### 屏 6 — 房间与联赛

- **首屏主数**：可加入的房间数 / 你的联赛名次。
- **第二层**：三种格式分开入口（榜单打擂 / 排位赛季 / 私密房间 2-32 人 + 密码 + 自定轮数），
  观战角色能看双方实时动作流；周 / 月 / 总榜，solo 与 1v1 各一套。
- **唯一推荐动作**：把同一条打乱发给一个朋友。
- **参照**：魔方星球的三格式拆分与房间观战数据；QiYi 的 2-32 人密码房；
  GoCube 的 Solo 与 Pro 分开排（修「排行榜让人沮丧」的小改动）；
  Duolingo Leagues（每周随机同侪分组）。**不要抄的**：段位氪金、
  「连续十几把都会输」的匹配。

### 跨屏硬规则（从他们的差评反推）

1. solve 过程中 3D 魔方必须一直可见 —— 「This defeats the whole point of a smart cube」。
2. 观察永不强制，可关，可中止。
3. 永远允许删单条成绩。
4. 迁移永不丢历史；把「导出 / 版本化 / 可撤销删除」当功能宣传。
5. 完成判定不得依赖某一个固定朝向。
6. 蓝牙不可靠时**说出来并说出后果**（Cubeast 的做法：「信号弱可能造成误 DNF 与 +2」），
   失同步通知上直接挂重置按钮。
7. 免登录能练；账号只换云同步。
8. 弹窗不许半汉半英。
9. 永不对「拧了几把」计费。

---

## 6. 我们的差异化

论据只用已有资产，不用形容词。

**1. Web + 跨品牌，是他们结构上到不了的位置。**
硬件厂商（GAN / QiYi / 魔域 / Giiker / GoCube）的 App 存在的目的是卖自家魔方，
所以永远不会做跨品牌；魔域的 BLE 加密且不公开，「I don't think the MoYu smart cube
connects to other apps」是在案的。而唯一的第三方深度分析产品 Cubeast **只支持 Chrome**，
这是它被引用最多的缺陷（"a non-starter"），而且它对新款 QiYi 已经连不上。
我们六个品牌的驱动都在跑，还有 csTimer 沙箱做逐帧比对的 parity 测试。
**一个 URL 打开、免安装、免登录能试、跨品牌、能分享的复盘页，是另一个产品品类。**

**2. WCA 数据集把「诊断」变成「定位」。**
QiYi 把「智能预测成绩区间 + 国家/大洲/世界排名」当成一个**猜测**在卖。
我们有真的 WCA 数据集（`/wca` 的历史排名、SOR、`hrs_*_cr`），所以
「你现在的 Ao12 在中国大约排第 N、世界第 M，这是分位曲线」是我们能做到一个数量级更好的事。
更进一步的是**打乱难度归一**：`/scramble/stats` 已经有按项目、按阶段的难度分桶
（十字 / XCross / F2L / EO / DR），所以「你这把 12.4 是在十字难度前 8% 的打乱上拧的」
没有任何竞品能给 —— 他们连打乱难度这个维度都不存在。

**3. Rust/WASM 最优求解器 + 34GB 表 = 全行业唯一能给 optimality feedback 的人。**
Cubeast 作者把「showing how optimal your crosses are」写成 Rust 重写之后的未来工作；
我们的 StageSolver 已经在跑，还有 `block222` / Roux S1-S2 / EOLine / DR / F2B 等
逐阶段求解器，以及 `/scramble/stats` 的整解最优管道。这带来三件别人做不了的事：
① 逐步 diff（「第 4 步你走了 D'，最优是 D2，多花 0.4s」）；
② 把差距压成一个可炫耀的评级放第一屏；
③ **Roux / ZZ / Petrus 的方法感知分析** —— QiYi 的步数在 Roux 下「多到没有参考价值」，
这块地是空的，而我们有对应阶段的求解器。

**4. 公式库 + SRS 把分析闭成循环。**
`lib/alg-srs.ts` 是一个已经在线的 SM-2 变体（4 档评分、忘了就当场重来、21 天算长期记住），
`/alg` 有 PG 里的公式库与 case 集合。全行业**没有一家**按记忆模型排程 case ——
Cubeast 有 per-case 成功率但没有 scheduler，Anki 有 scheduler 但那是背事实。
把评级信号从「对/错」换成**识别延迟**（识别与执行的遗忘曲线不一样），
这是模式库明确点出的一块无人区。

**5. 28 个魔方模拟器 + visualcube 把「教」这件事解锁。**
GoCube 唯一真正差异化的功能是**按真实状态验证每一小步**的交互式教程，
它能在一小时内教会一个不会拧的人 —— 而整个分析层没人做。
我们既有状态流（六品牌都接了 `onState`），又有渲染层（`/sim` 28 个魔方 + `FaceletsCube`），
又有内容（`/cfop` 13 节、`/wiki` 术语表、`/algdb`、`/math` 63 节）。
GoCube 从新手一端、XC大师 从进阶一端，两条在案差评说的是同一件事：
**「缺中级路径」和「只教死记不教为什么」**。这两块内容我们已经有了，缺的只是打通
「诊断 → 跳到对应教程小节 → 回来练分级题」这条闭环。

**6. 设备时钟已经是我们独有的精度地基。**
三家品牌的时钟形态我们都接完了（GAN 32-bit 计数器、QiYi 1.6 tick/ms 且
**历史补齐的每一步各带自己的时刻**、MoYu32 五个 u16 增量），并且明确选择
「拿不到设备时间就留空，绝不插值」。这意味着识别/执行拆分、停顿位置、按停顿拆步
这三类指标在我们这里是**可信的**，而在用 BLE 到达时间的实现里是噪声。
QiYi 那条路径尤其值得讲：**丢通知不损失时序精度**，GAN 做不到。

**7. 分析与对战在同一个产品里。**
Cubeast 有深度分析、没有任何 racing 路由；CubeDesk 与 acubemy 有 1v1、分析很薄。
**没有一家两者兼有。** 我们的 `/timer` 已经有双人引擎 + net 房间 + `/recon` 的
可分享复盘 slug（ISR）。把观战角色和 2-32 人房间加上，我们就是唯一同时占两头的。

**8. 信任本身是可占的位置。**
Lichess 的护城河就是「全免费 + 开放」。这一族的反面证据非常齐：
魔方星球的头号中国差评是零氪拿不到东西、迁移丢了 2000 把成绩、
删掉了自定义公式；acubemy 的头号差评是点一下就弹订阅；魔域与 QiYi 的头号海外差评
都是**登录把人堵在门外**。对一个已经在公开 WCA 统计的站点来说，
「免费无限次数 + 完整单把报告 + 可导出 + 迁移不丢数据 + 不抽卡」是便宜且响亮的定位。

---

## 7. 优先级路线图

尺寸：**S** ≈ 1 个 Sprint 内的一小块 ｜ **M** ≈ 一个完整 Sprint ｜ **L** ≈ 跨 Sprint。
csTimer 对齐项（逐步打乱提示、观察超时判罚、断连打断计时等）不在这里重复，见
`SMART_CUBE_MIGRATION.md` 的优先级汇总；两份表是同一条队列的两个切面。

### P0 — 把地基接到指标层（不做完这些，后面每一屏都建在沙子上）

| # | 项目 | 尺寸 | 为什么是 P0 |
|---|---|---|---|
| P0-1 | `Solve` 数据模型扩展：`inspectionMs` / `pickupMs` / `putDownMs` / `deviceModel` / `deviceName`，观察阶段的转动也落盘 | S | 现在 `_lib/types.ts` 里这些字段全没有，观察期转动明确不记录。后面的观察直方图、pickup 损耗、按设备分组统计**全部依赖它**，而且是纯加字段（可选字段，历史 solve 不需要迁移） |
| P0-2 | 识别 / 执行分解，逐字采用 Cubeast 定义（AUF 计入识别、TPS 只除执行时间、按停顿拆步） | M | 全行业只有一家有，是我们最大的一块「已经有数据、只差算」的价值。定义抄原文可让我们的数字可被外部比较，也一次性关掉「你的 TPS 为什么不一样」这类争论 |
| P0-3 | 复盘报告重构成分层结构：第一屏「阶段 × 指标网格 + Solve Quality」，纵深是 Steps / Solution / Optimal diff / TPS / 原始日志 | M | 两种成熟形状（魔方星球的网格、Cubeast 的 5 tab）我们各取一半；现在的单 modal 塞不下即将到来的指标量 |
| P0-4 | 最优解对比：每阶段跑 StageSolver，出「你 N 步 / 最优 M 步」+ 逐步 diff，并压成一个 0-100 分（校准到典型值落 50-95） | L | **全行业空白 + 我们独占的资产**。Cubeast 作者把它列为未来工作。分数前置是强行为钩子（XC大师 已经证明了这个心理产品化的价值） |
| P0-5 | 错误检测：废步 / 回退 / 撤销 / 走错公式再改，算出「这里多花了 0.8s 和 4 步」 | M | 同样全行业空白，且与 csTimer 的打乱纠错同源机制，我们逐步跟踪状态本来就有条件 |
| P0-6 | 训练模式三件套：子步自动停表 + 状态劫持 + 连续循环，并接上 `/alg` 的 SRS | L | 唯一被用户自发点名夸的训练功能（分步特训）+ Cubeast 卡了很久的「打乱到某个 case」+ 我们现成的 SRS 引擎。这三件事必须一起做，分开做都不成立 |

### P1 — 把指标变成产品

| # | 项目 | 尺寸 | 为什么 |
|---|---|---|---|
| P1-1 | 弱项队列 / 错题 bin：从阶段数据自动挑（识别超过你的带 / 有回退 / 有长停顿），每日轮换一组定向 drill | M | XC大师 的「复习」是唯一把记录反接成课程的机制，而我们能按**阶段**挑弱项，他们只能按整题对错 |
| P1-2 | 「今日」首页：一张推荐卡 + 一行可审计的理由 + 一个 Start + 3 条每日任务（量 / 质 / 定向） | M | 模式库里最一致的一条：减掉一个决定。我们的理由可审计（「第 3 槽在 200 把里花掉 0.9s」），Garmin 做不到这点 |
| P1-3 | 观察时间独立直方图 + 「观察时长 vs 结果时间 / vs 十字质量」 | S | 中国族唯一锐利的分析想法，我们有设备时钟，做完还能往前一步（他们只有直方图） |
| P1-4 | rotation / regrip 计数（陀螺），作为与步数并列的独立指标 | M | 魔方星球有这个指标（定义未公开），Cubeast 明确做不到。我们能**跨品牌**算 |
| P1-5 | 回放升级：时间轴上标阶段边界、变速档位、步骤列表与动画双向联动 | S | `PlaybackPanel` 已在，差的是阶段边界与联动；这是他们 changelog 里改得最勤的屏 |
| P1-6 | WCA 排名预测 + 打乱难度分位注记 | M | 把 `/timer` 直接插进 `/wca` 与 `/scramble/stats` 两个已有资产，是硬件厂商结构上做不到的事 |
| P1-7 | 房间赛 2-32 人 + 密码 + 自定轮数 + 观战角色看双方实时动作流；周/月/总榜 solo 与 1v1 各一套 | L | 中国俱乐部办线上赛的实际形状；观战是他们最有社交感的功能而我们的 delta 很小 |
| P1-8 | Progress 屏：Form（7d vs 28d）+ 状态词 + 最强 3 / 最弱 3（带 n 与置信区间）+ 个人 p25-p75 带 | M | 「平台期」必须带三个具名嫌疑人到场；Lichess 的在案抱怨是薄样本下的 per-case 评分不可比，所以 n 与置信区间是硬要求 |
| P1-9 | 设备作为一等公民：命名 / 收藏 / 归档，solve 绑型号，统计可按设备分组 | S | 「比不同型号之间的 TPS」只有智能魔方平台能给，而我们支持的品牌比 Cubeast 可靠支持的更多 |
| P1-10 | 十字 / XCross 分级抽题（指定底色 + 指定最优步数）+ 「只练前 8 秒」短循环 | M | 他们要算，我们查表；短循环的训练密度远高于整把，而这需要智能魔方栈 |

### P2 — 纵深与留存

| # | 项目 | 尺寸 | 为什么 |
|---|---|---|---|
| P2-1 | `/insights` pivot（metric × dimension，可保存视图）+ CSV 导出 + solve 查询语言 + REST API | L | Cubeast 唯一的护城河。导出还是每一个我们不做的统计的逃逸阀（它作者靠这个把百分比视图推给 Excel 并且过关了） |
| P2-2 | 「一键解释这一把 / 这条解法」，三句话，每句都锚在一个算出来的数上 | M | GoCube 被骂死记硬背、XC大师 被要教程，两头指向同一需求；锚在数字上才不会胡说 |
| P2-3 | 状态验证式交互新手教程（按用户手上的真实状态出下一步并校验） | L | GoCube 唯一的差异化功能，一小时能教会人，而整个分析层没人做。我们有状态流 + 渲染层 + 内容 |
| P2-4 | 诊断 → 教程小节 → 分级题的闭环互跳 | M | 没有任何竞品在做，而 `/cfop` `/wiki` `/algdb` `/math` 四块内容都已存在 |
| P2-5 | 留存层：成就 + 战队 + 考级式分级认证（**不带任何抽卡与货币**） | M | 魔域的三件套贴班级 / 俱乐部文化；魔方星球证明了这一层有效，也证明了货币化它会招什么骂 |
| P2-6 | 分享页升级：赞 / 评论 / 浏览数 + og 卡片 | S | 计时器唯一的病毒面，`/recon` slug ISR 已经是这个形状 |
| P2-7 | 习惯归因（热手把数 / 时段 / session 长度 / 型号 → Ao12 效应量，带 n） | M | 全行业空白（模式库里 Whoop Journal Insights 最接近但那是睡眠不是技能）；要样本量，所以排后 |
| P2-8 | 局内实时分析 | L | Cubeast 作者说这要等 Rust 重写，我们的 solver 已经是 Rust/WASM，结构上领先 —— 但事后报告的价值排在前面 |
| P2-9 | Roux / ZZ / Petrus 的方法感知分析 | L | QiYi 的步数在 Roux 下「多到没有参考价值」，这块地空着，而我们有对应阶段的求解器 |
| P2-10 | 「session 内疲劳检测」（后 15 把比前 15 把差 8% 就提示换 drill） | S | 模式库指出 Garmin/Whoop 只做跨天，跨 30 分钟这个尺度没人做，而对魔方特别自然 |

---

## 8. 存疑与未验证

规则：以下每一条都是材料**没有建立**的，不等于竞品没有。做设计时不许把它们当成
「他们没有，所以我们独占」的论据 —— 只有正文里标了 confirmed by absence 的才可以那样用。
每条后面写「怎么证」。

### 8.1 竞品功能机制（最影响我们判断的）

| 存疑项 | 现状 | 怎么证 |
|---|---|---|
| 魔方星球 `Fluency`（流畅度）与 `Rotation` 的定义 | 两个指标名都确认存在，**没有一处定义它们**。Fluency 是唯一可能编码犹豫的指标 | 借一颗 GAN 智能魔方装 App，故意拧出三种模式（匀速 / 中途长停 / 频繁 regrip）看哪个数变，10 分钟能定 |
| 魔方星球「大数据诊断 + 公式推荐」的机制 | 只确认宣传语。测什么、样本多少、基线是自己还是同侪、怎么选公式，**零解释**。我们「按 5 指标找最弱阶段 → 推该阶段公式」的读法是**推断** | 同上，攒够 20-30 把后看推荐是否随最弱阶段变化 |
| 魔方星球「optimizes solutions」是什么 | 可能是真最优解对比、可能是更短公式建议、也可能是营销词 | 同上，给一把明显走废步的 solve 看它的输出 |
| 魔方星球复盘屏的实际布局 | 只知道有动画、变速、Analysis Steps 列表、时间轴。**没有截图、没有说明文字、没有走查**。定向搜 bilibili 只返回噪声 | 同上，直接截图；或去 GAN 官方 bilibili 频道翻复盘相关视频 |
| 魔方星球是否有识别/执行拆分、停顿指标、逐步时间 UI、错误检测、per-solve OLL/PLL case、alg 级归因、观察时间测量 | **语料里完全没有**。按「未建立」处理，不是「不存在」 | 同上 |
| 魔方星球段位完整阶梯、分析与学院是否本身付费、学院关卡门控细节 | 只有青铜/白银/黄金/传奇四档；关卡门控来源是第三方下载站文案不是 GAN 自己 | 装 App 走一遍学院与个人页 |
| XC大师「解法评级」的刻度与依据 | 确认存在且评的是**解法**不是时间。几档、叫什么、按步数差还是复合，全未知 | 装 App（免费无内购）连一颗智能魔方拧 5 把，看评级怎么变；故意多走两步看分数掉多少 |
| XC大师「AI 解法洞察」的实际输出形态 | 只知道是「思路与可改进点」的散文点评 | 同上，直接截图输出 |
| XC大师 支持哪些品牌的智能魔方、有无 device-clock 时间戳、有无陀螺 | 文案只说「打开蓝牙即可开始」 | 同上；或用我们自己的 fake cube 思路反过来看它连不连非 GAN |
| XC大师「错题」的判据、「最弱几次练习」的排序指标、复习队列长度、有无 SRS | 全未知。能判错说明有对/错判定，能排最弱说明有内部表现分 —— 都是推断 | 装 App 故意做错几道再进「复习」，看进来的是哪几题 |
| XC大师 预判四字段是手填还是自动判定 | 「做法」「失败原因」几乎只能是手填/选项（推断），v3.4.2 加了「预判记录可删除」佐证是可编辑条目 | 同上，走一遍预判练习 |
| XC大师 屏幕清单与首屏 | 只确认「底部 tab 架构」「有智能练习 tab」「有我的页」。**一张截图都没落地**，其余四个模式是 tab 还是二级页不知道 | 装 App 截 4 张图 |
| QiYi 分段统计的阶段边界与检测规则 | 功能名与「CFOP 支持」确认，**阶段清单、检测规则、报告布局全未知**。不要假设与我们的 CFOP stage detection 一致 | 装 App（免费）+ 一颗 QYSC 拧一把看报告；或读 1hrbld 评测的原图 |
| QiYi「智能打分」与「成绩区间预测」模型 | 名字而已 | 同上 |
| QiYi 是否在任何地方显示 TPS | 从「用户在评论里要求加 tps测试」反推缺席，是**间接证据** | 同上 |
| 魔域全部机制：预判训练 / 战队系统 / 成就挑战 / 考级 / 竞速板块 | 名字由官方 bilibili 视频标题与 changelog 确认，**内部怎么运作一律未建立**。预判训练那条视频 47 秒，从未打开 | 魔域文化官方 bilibili 有「一功能一视频」播放列表，逐个看一遍是最便宜的路 |
| 魔域是否有分段统计 | 只有「一个用户在要」这条间接证据 | 同上 |
| 魔域统计清单（图表类型 / 平均窗口 / 云同步保证） | 完全未建立 | 装 App（需注册，注册可能失败） |
| Cubeast 的 TPS tab 里是什么 | tab 存在，内容没抓到 | 14 天免费试用 + Playwright 拧一把，直接读那一屏 |
| Cubeast Premium / Pro / Patron 各解锁什么 | bundle 只暴露两个 flag（Academy、CaseRecognition），却有三个价位 | 读它的定价页；或试用期内看 plan/change 页 |
| Cubeast 的 CSV 导出与 REST API 是否收费 | 导出 UI 在抓到的字符串里没有 premium 分支，但没证实 | 同上 |
| Cubeast 是否在 2020 之后上线过 racing | 路由表里没有 → 大概没有，但未证 | 看它的 changelog 页 |
| acubemy 的指标名、统计清单、定价、「bottleneck detection」是否真存在 | 「bottleneck detection」只出现在搜索摘要里，没有任何 acubemy 自己的页面佐证 | 装 Web 版试一把 |
| CubeDesk 现在是否有智能魔方支持与分段分析、现在的定价 | 2021 年发布帖里蓝牙是**用户请求**；后来的摘要称免费开源但没标日期 | 打开 cubedesk.io 看现状 |
| GoCube CFOP Academy 的内容、Go-Improve 是否有分段 | 只有一行 changelog | 装 App（免费，但需要 GoCube 硬件才有数据） |

### 8.2 规模与商业事实

- **所有产品都没有 MAU/DAU/收入。** 只有评分数：XC大师 8（中国区），
  魔方星球 2259 中 + 287 美 + 46000 安卓下载，QiYi 71 中 + 16 美，魔域 220 中 + 26 美，
  Giiker 8027，GoCube 2.4K。魔方星球营销说「数十万玩家、日均万人开局」，
  与店侧数字差两个数量级，材料无法调和。**怎么证**：看 Sensor Tower 类第三方估算，
  或从应用宝/TapTap 下载量与评分比推。
- **Cubeast 规模无任何数据。** 唯一代理是一个公开 solve 三年 107 次浏览、
  作者自陈发 HN 没人投票。**怎么证**：问它 Discord 服务器人数。
- 开发者汉字名冲突两处：XC大师 是「北京星效律科技」还是「星小绿」未定；
  魔方星球 每一份抓取到的 listing 都写「广州淦源智能科技」而我们内部此前写的是「赣元」。
  **怎么证**：查工商登记。
- 魔方星球 V6.6 的日期在中国区是 2 月 9 日、美区是 Feb 24、应用宝是 2026.2.9，未解。

### 8.3 我们最想要但没拿到的一份文档

**`regulations.topcubers.com/online_e/` 的线上智能赛规则**，只在搜索结果里出现过，
从未抓取。这大概是对我们多人设计最有用的一份缺失材料 —— 中国俱乐部实际用什么规则
办线上智能魔方赛（怎么防作弊、怎么算成绩、房间怎么组织）。**怎么证**：直接抓那一页。

### 8.4 UI 层面的系统性空白

**除 GoCube（四个 Go-* 动词）和 Cubeast（左侧栏 Log / Statistics / Academy / Database / Settings）
之外，没有一个产品的「首屏 leads with 什么」是可回答的。** XC大师、QiYi、魔域
都没有任何截图说明文字落地，任何声称是它们 UI 地图的东西都是编的。
魔方星球是唯一例外中的半个 —— 时代周报确认了首页有练习 / 对战 / 单挑 / 榜单 / 赛季 / 战队
六个板块，并且「布局和功能堪比一款手机游戏」，所以**首页 leads with 竞技与进度，
不是你上一把成绩**这一条可以用。
**怎么证**：App Store listing 的截图说明文字需要能跑 JS 的抓取；
或者装 App 自己截 4 张图，成本比想象低。

### 8.5 UX 模式库里的低置信项

模式库自己标了 [L]（未在本轮核实）的部分，引用时不要当硬事实：
Garmin Training Status 的完整词表与 Readiness 分档阈值、Apple Trends 的 90/365 细节与
Training Load 的判语标签、Strava Fitness&Freshness 的公式、chess.com 与 Duolingo 的
准确底部 tab 列表、Puzzle Rush / Storm 的计分、Lichess Insights 的维度清单、
Anki 统计屏的内容。**怎么证**：需要引用到对外文案时逐条 WebFetch 官方帮助页。

另外模式库明确说：Strava / Garmin / Whoop / Oura / Anki / chess.com 的**用户抱怨
没有在那一轮核实**，所以本文档里不引用它们的抱怨原文，只引用被确认为真的
**间接证据**（第三方解释文章标题的存在本身、MacRumors 帖标题、Duolingo 请愿书标题）。

### 8.6 我们自己这边的未验证

- **实体魔方复验**：GAN 16 UI 在手，其余五个品牌无实体。Sprint 1/4/5 的修复
  在假魔方与 parity 测试上是绿的，真机时序与信号仍未验。
- QiYi 那条「历史补齐的动作各带自己的时刻」的优势是从协议与单测证明的，
  **真机丢包场景没验过**。
- 本文档「我们现在」这一列读的是当前源码（`_lib/types.ts`、`stage_segments.ts`、
  `ReconstructModal.tsx`、`_components/charts/`、`lib/alg-srs.ts`）。若这些文件改动，
  这一列会过期，不要当长期事实引用。

---

## 变更记录

- 2026-07-29：首版。基于四份平台调研（XC大师 / 魔方星球 / QiYi+魔域+计客 /
  Cubeast+acubemy+CubeDesk+GoCube+csTimer）与一份 UX 模式库
  （Strava / Garmin / Apple Fitness / Whoop / Oura / Duolingo / Anki / chess.com / Lichess）。
  与 `SMART_CUBE_MIGRATION.md`（csTimer 功能对齐）和 `SMART_CUBE_PROGRESS.md`
  （Sprint 1-5 已落地的地基）配套读。
