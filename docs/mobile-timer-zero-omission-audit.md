# 五端 App `/timer` 零遗漏对抗审计

状态：`ACTIVE — GAP FOUND — NOT COMPLETE`

审计快照：2026-08-31

事实源：当前 Web `/timer` 可达页面与 `core/packages/client/app/[lang]/timer/**` 源码

对比目标：`core/packages/app-ui` 的五端唯一 React 产品层，以及 `core/apps/mobile`、`core/apps/desktop`、`core/apps/harmony` 三个薄宿主

> 本文是 `docs/mobile-timer-parity-tracker.md` 的对抗审计附录，不是第二套需求。Tracker 记录进度，本文保存一次“专门找遗漏”的全量事实快照和 CI 守卫设计。表内既有 `Mobile`、OPPO 和 iOS 行是迁移期间形成的 Android/iOS 历史证据，不自动证明 HarmonyOS NEXT、Windows 或 macOS；当前五端产品实现只认 `@cuberoot/app-ui`，每个平台仍须分别补齐构建、安装、设备/实体电脑和交互证据。Web 新增可达功能时，即使本文未及更新，任何 App 也不自动获得豁免。

## 1. 审计结论

当前五端 App 还远没有复制完 Web `/timer` 的 UI/UX 与功能。项目选择器已有 43 个入口、手动打乱已开始接入共享队列组件、真题 event map 已迁到 shared，这些只关闭了局部反例，不是整体 parity；某个宿主能构建也不能替代产品面和其他平台验收。

快照中至少存在以下硬性 gap：

| 编号 | 事实源能力 | Mobile 快照 | 结论 |
| --- | --- | --- | --- |
| GAP-001 | `1～4 人 + 联机` 是 `/timer` 内的五个完整模式 | 五端 App 已有真实 2/3/4 人与联机页面、本地原子轮次/基础统计及联机房主管理/历史统计，不再只读“1人”或外跳；但 Web 与 App 仍是两套 Battle/Net React 视图，完整设置、视频、多 BLE、高级历史展示、双设备和五平台矩阵未齐 | P0，入口/基础流程落地不等于完整模式 parity |
| GAP-002 | Web 顶栏有人数、项目、来源、难度、解法、更多、设置的真实交互 | WCA 真题难度与 222/pyra/skewb 解法提示已改成 Web/Mobile 共用真实 UI，原静态“解法”已删除；More 通用求解器已复用 Tools 子页；333/SQ1/Mega 顶栏解法、随机难度与大量条件控件仍缺 | P0，局部产品面仍缺 |
| GAP-003 | Web 随机来源对 43/43 `EventId` 都有已注册的语义 | shared runtime 42 个 generated；`custom` 的 Real/Random 已按网站接成显式 ready 空槽并可计时，仍待 OPPO 触摸/重启验收 | P0，菜单/生成器数量不等于完整功能 parity |
| GAP-004 | 真题有比赛/日期、比赛搜索、轮次、组别、难度、步数、2×2 类型、最优口径、来源元数据与空/错误状态 | Mobile 已共享比赛/日期/搜索/国旗/轮组、2×2 配置、完整 WCA 难度/合并/最优、222/pyra/skewb 真题按步数和底层错误/空分型；完整出处元数据、逐类用户文案与全配置/真机异常矩阵仍未关闭 | P0，底层契约通过仍不等于完整真题 UI parity |
| GAP-005 | 手动来源还包含编辑后重置、顺序循环、已显示打乱历史的上一条/下一条、空打乱可起表与 attempt snapshot | Mobile 已直接消费 shared editor/queue/`ScrambleHistory`，覆盖上一条/下一条、队尾生成、solve 后前进、左右键、空槽和冻结 attempt；仍缺 OPPO/iOS 真机全状态证据 | P0，源码与自动化已接，待设备矩阵 |
| GAP-006 | Web 有 session 切换/新建/重命名/清空/删除/项目关联、搜索筛选、成绩对比、成绩详情、移动分组 | session CRUD/项目关联、共用成绩行/七项菜单/备注/Undo、行级罚时/复制/删除、完整筛选/tag、成绩对比与基础成绩详情已接五端共享产品层。详情的原始/生效成绩、日期、罚时、打乱、CFOP/BLD/MBLD 分段、备注、移组、删除和关闭只保留一份 `timer-ui` DOM；Web 仅注入重型复盘。Web/五端的打乱图也已统一为同一 `TimerCubePreview`，覆盖网站当前的 NxN、Clock、Pyraminx、Skewb、SQ1、Megaminx、FTO 和 relay/custom 分派；完整复盘仍缺。`HistoryPanel` 的批量删除分支当前在网站主路径没有 consumer，不把不可达代码当网站现有功能 | P0，基础详情/预览单源不等于完整复盘 parity |
| GAP-007 | Web 有成绩/图表/统计三栏、5 图、完整统计、case/跨分组/按天、纪录对比 | 紧凑 current/best 面板与 rolling picker 已迁 timer-ui 并由 Web/Mobile 真实消费；OPPO 已显示 time/ao5/ao12 共用面板且 360px 无横向溢出。完整 StatsModal/五图、case/跨分组/按天与纪录对比仍缺 | P0，紧凑面板接线完成不等于完整统计完成 |
| GAP-008 | Web 设置有 8 类、64 个字段（其中 1 个仅开发环境） | 8 类与 64 个稳定 ID、copy/value/visibility/disabled/effect 已迁 shared；“计时”8 字段、“训练”的 CFOP 分段/BLD memo 及“外观”的打乱图、2D/3D、点击打乱动作已由 Web/Mobile 共用真实 UI/effect，App effect ledger 为 13 项。OPPO 已读到 canonical 8/8 计时 ID、20～340px 内容边界与滚动底部，并实证点击打乱三动作；新增两项尚待解锁后验收，其余 51 字段、iOS/其他三端和全视口仍缺 | P0，13 项接线完成不等于 64 项设置 parity |
| GAP-009 | Web “更多”包含打乱足迹、统计、语言、专项、盲拧助手、全屏、手动录入、replay、求解器、批量打乱、打印、清空 | 12 项 action/条件/effect 已共享；App 已真实接通 10 项：统计复用现有共享统计页，盲拧助手/通用求解器/批量打乱复用 Tools canonical 子路由，其余 6 项保留既有 App effect。专项仍绑定 Web 私有 drill target，replay 仍绑定 Web 私有 decoder/重建状态，未用外跳 Web timer 或占位冒充 | P0，剩余 2 项及深层交互矩阵未完成 |
| GAP-010 | Web 有智能魔方、智能计时器、Stackmat 麦克风，各自完整弹层、状态与错误 | Mobile 只显示真实 BLE 入口；Android GAN v4 主链已真机跑通，iOS UUID 后 manufacturer-data MAC 提取有 adapter/握手单测但无真机；Stackmat/智能计时器未实现且不渲染假入口 | P0，缺失能力保持不可见且仍登记为 gap |
| GAP-011 | Web 有手动录成绩、FMC/MBLD 特殊输入、轮次模拟、目标、每日目标、分段、BLD memo | 手动成绩/FMC/MBLD 与 CFOP 分段/BLD memo 已共享接入；分段共用 recorder/status/settings，手动键盘和 44px 触摸均可标记，智能三阶自动分段复用 canonical move-stream producer。轮次、目标、每日目标仍缺，新增分段路径待 OPPO 真机 | P0 |
| GAP-012 | Web 触摸有八向操作轮盘与撤销，键盘有可重绑快捷键，还有全屏/运行隐藏/UI fade | Mobile 已直接消费 shared 八向轮盘、默认键盘决策、任意键停表、分段/BLD memo 键与 44px 触摸标记、删除撤销 toast 与起表门禁；但自定义改键持久化/UI、运行隐藏全 UI 和完整真机矩阵仍缺 | P1，但声称“UI/UX 完全一致”前仍是硬门槛 |

任何一项不等都必须保持整体 `NOT COMPLETE`。

## 2. 真题来源的关键边界（已源码取证）

Web 在 `source=wca` 时切到没有 WCA 映射的项目，当前产品行为不是禁用选项，也不是自动把来源改成 random：

1. 来源菜单仍固定显示 `WCA 真题 / 随机状态 / 手动输入`，且 `value` 仍是 `settings.scrambleSource`。证据：`SoloView.tsx:2477-2494`。
2. `wca_pool.ts:234-255` 用 `timerWcaScrambleEventId(spec.event)` 生成池 key；无映射时 key 为 `null`。
3. `wca_pool.ts:575-580` 中 `hasWcaSource(spec)` 等价于 `specKey(spec) !== null`。
4. `SoloView.tsx:571-575` 只有“来源是 wca 且存在可用 WCA spec”才读真题池。
5. 无映射时继续走 `SoloView.tsx:576-595` 的当前 `event` 本地 provider；`SoloView.tsx:474-478` 还明确把此边界写入按步数签名。

因此完全复制 Web 的 Mobile 验收必须同时证明：

- 选中值仍是“真题”；
- 无映射项目实际调用同一 `EventId` 的本地 provider；
- 不能暗中变成 333；
- 这只适用于“无映射”，已映射项目的真题网络失败/空池不得用随机题冒充。

shared 映射快照是 19 个 Timer ID：

| Timer `EventId` | WCA API `event_id` |
| --- | --- |
| `222` | `222` |
| `333` | `333` |
| `444` | `444` |
| `555` | `555` |
| `666` | `666` |
| `777` | `777` |
| `333oh` | `333oh` |
| `333fm` | `333fm` |
| `333mr` | `333` |
| `333ni` | `333` |
| `333bld` | `333bf` |
| `333mbld` | `333mbf` |
| `444bld` | `444bf` |
| `555bld` | `555bf` |
| `pyra` | `pyram` |
| `skewb` | `skewb` |
| `sq1` | `sq1` |
| `mega` | `minx` |
| `clock` | `clock` |

## 3. 43 项全量差分

全局规则：Web 的三个来源入口对所有 43 项都保持可见；手动来源对每项都把每个非空行当作 opaque 打乱。下表的“真题语义”写 `local`，指第 2 节的“保持真题选中 + 同项目本地生成”，不是隐藏/禁用真题。

| # | `EventId` | Web 真题语义 | Web 随机/项目特性 | Mobile 随机快照 | 已知差异 |
| ---: | --- | --- | --- | --- | --- |
| 1 | `333` | `333` | 3×3；难度直接生成；云端最优；解法/智能魔方/复盘 | cubing `333` | 真题难度/合并/最优已共享；随机难度、解法/复盘与完整 UI 仍缺 |
| 2 | `222` | `222` | 完整状态 + 3-gen/EG/CLL/EG1/EG2/TCLL+/TCLL-/TCLL/LS/无连色；WCA/最优；底面/底层/HTM/QTM 按步数；解法 | shared pocket + shared specialist Worker | 比赛/日期/轮组、随机 11 类、真题 10 类、WCA/最优与按步数已接共享契约；完整还原+六面解法已共用并通过空/错/stale/窄屏回归，仍待 OPPO 与全类型矩阵 |
| 3 | `444` | `444` | 4×4 | cubing `444` | 预览已共用；真题详细配置与显示设置矩阵未对齐 |
| 4 | `555` | `555` | 5×5 | cubing `555` | 同上 |
| 5 | `666` | `666` | 6×6 | cubing `666` | 同上 |
| 6 | `777` | `777` | 7×7 | cubing `777` | 同上 |
| 7 | `333bld` | `333bf` | 3BLD；memo 分段；盲拧助手；复盘 | cubing `333bf` | memo 采集/详情显示已共享；助手/复盘仍缺 |
| 8 | `333fm` | `333fm` | FMC 打乱；手动录入解法校验与 OBTM 步数 | cubing `333fm` | FMC 录入/统计语义缺 |
| 9 | `333oh` | `333oh` | 3×3 OH；难度直接生成 | cubing `333oh` | 真题难度已共享；随机难度和全量 UI 仍缺 |
| 10 | `mega` | `minx` | Megaminx；解法提示 | cubing `minx` | 专用预览已共用；解法缺 |
| 11 | `pyra` | `pyram` | V/整体按步数；解法 | cubing `pyram` | 真题/随机按步数与完整还原+四 V 解法已共享；真机范围矩阵仍缺 |
| 12 | `clock` | `clock` | Clock 记号与专用预览 | cubing `clock` | 专用预览已共用；真机视觉矩阵缺 |
| 13 | `skewb` | `skewb` | HTM 按步数；解法 | cubing `skewb` | 真题/随机按步数与完整还原+六面解法已共享；真机范围矩阵仍缺 |
| 14 | `sq1` | `sq1` | SQ1 紧凑记号；专用预览；解法 | cubing `sq1` | 专用预览已共用；字符格式/解法未对齐 |
| 15 | `444bld` | `444bf` | 4BLD；memo 分段 | cubing `444bf` | memo 采集/详情显示已共享；复盘仍缺 |
| 16 | `555bld` | `555bf` | 5BLD；memo 分段 | cubing `555bf` | memo 采集/详情显示已共享；复盘仍缺 |
| 17 | `333mbld` | `333mbf` | MBLD 打乱；已还原/已尝试/时间录入；WCA 计分/DNF | shared compound | 生成已接；录入、组合显示、统计仍缺 |
| 18 | `magic` | local | Magic 专用生成 | shared compound | provider 已接；专项显示仍待验 |
| 19 | `mmagic` | local | Master Magic 专用生成 | shared compound | provider 已接；专项显示仍待验 |
| 20 | `333ni` | `333` | 3BLD NI；memo/盲拧助手 | cubing `333bf` | 真题 alias 已建表，memo/助手缺 |
| 21 | `333mr` | `333` | Mirror Blocks 使用 3×3 打乱 | cubing `333` | alias 与 3×3 预览已共用；专项显示矩阵仍待验 |
| 22 | `666bld` | local | 6BLD；memo | shared compound | provider 已接，BLD memo/显示仍缺 |
| 23 | `777bld` | local | 7BLD；memo | shared compound | provider 已接，BLD memo/显示仍缺 |
| 24 | `r3` | local | 3×3 relay 专用组合打乱 | shared compound | provider 已接，组合显示仍缺 |
| 25 | `r4` | local | 2～4 relay 专用组合打乱 | shared compound | provider 已接，组合显示仍缺 |
| 26 | `r5` | local | 2～5 relay 专用组合打乱 | shared compound | provider 已接，组合显示仍缺 |
| 27 | `cross` | local | Web 当前也是普通完整 3×3 打乱；可作为从完整状态练 Cross，但没有 Cross 答案面板 | cubing `333` | 两端都是普通 3×3 语义；provider 算法不同仍需 fixture，文档不得虚构 Web 已有专项状态/答案 |
| 28 | `f2l` | local | Web 源码明确是普通 3×3 占位，未保证 Cross 已还原，也没有 F2L 答案面板 | cubing `333` | 两端当前都未实现真正 F2L 目标；完整 parity 不能掩盖网站本身的产品缺口 |
| 29 | `ll` | local | LL 专项状态；保存 OLL+PLL case identity；case stats | shared trainer | provider/metadata 已接；Mobile 丢 metadata，case stats UI 缺；Web 当前没有逐题答案条 |
| 30 | `oll` | local | OLL case；57 案例子集；case stats/专项练习 | shared trainer | provider 已接；Mobile subset/case stats/metadata 保存缺；Web 当前没有逐题答案条 |
| 31 | `pll` | local | PLL case；21 案例子集；case stats/专项练习 | shared trainer | provider 已接；Mobile subset/case stats/metadata 保存缺；Web 当前没有逐题答案条 |
| 32 | `coll` | local | COLL case identity/case stats | shared trainer | provider 已接；Mobile case stats/metadata 保存缺；Web 当前没有逐题答案条 |
| 33 | `cmll` | local | CMLL case identity/case stats | shared trainer | provider 已接；Mobile case stats/metadata 保存缺；Web 当前没有逐题答案条 |
| 34 | `zbll` | local | ZBLL case identity/case stats | shared trainer | provider 已接；Mobile case stats/metadata 保存缺；Web 当前没有逐题答案条 |
| 35 | `eg1` | local | EG-1 case identity/case stats | shared trainer | provider 已接；Mobile case stats/metadata 保存缺；Web 当前没有逐题答案条 |
| 36 | `eg2` | local | EG-2 case identity/case stats | shared trainer | provider 已接；Mobile case stats/metadata 保存缺；Web 当前没有逐题答案条 |
| 37 | `custom` | local | 手动/自定义语义 | manual | 不得将自定义默认成 3×3；完整流程未验收 |
| 38 | `fto` | local | csTimer FTO random-state worker；专用预览/解法 | cubing `fto` | 专用预览已共用；provider 等价与解法仍缺 |
| 39 | `kilominx` | local | csTimer Kilominx random-state worker | shared `cstimer_module` Worker provider | 预览缺 |
| 40 | `gear` | local | csTimer Gear random-state；FTM 按步数 | shared Gear provider | 按步数缺 |
| 41 | `ivy` | local | csTimer Ivy random-state；HTM 按步数 | shared Ivy provider | 按步数缺 |
| 42 | `redi` | local | csTimer Redi random-state | cubing `redi_cube` | provider 等价性、预览未验 |
| 43 | `mpyram` | local | csTimer Master Pyraminx random-state worker | shared `cstimer_module` Worker provider | 预览缺 |

表中的“Mobile generated”也不自动等于 parity。例如同为 3×3 文本的 provider 仍可能在长度、分布、前缀转体和元数据上不同。`cross` 当前网站事实就是普通完整 3×3；`f2l` 则是网站源码已承认的占位实现，不能在 Mobile 文档里虚构网站已有专项状态或答案。

## 4. 单人界面可达面全量清单

下列每个 ID 都是一个独立验收单元。“入口在”不代表完成；必须点击后产生与 Web 相同的状态和数据结果。

### 4.1 壳、顶栏与打乱条

| Parity ID | Web 可达行为/状态 | Mobile 快照 |
| --- | --- | --- |
| `mode.players` | `1人/2人/3人/4人/联机`，切换是页内大模式并可返回 | 已接真实 1/2/3/4/联机页内模式并可返回；本地/联网基础 round、同步开始与下一轮已跑自动化。与 Web 的设置、历史统计、视频、多智能魔方、房主管理及真实多设备 UI/UX 仍须逐项差分，不能把入口可用记为完整 parity |
| `event.picker` | 43 项、分组、顺序、图标、中英名、滚动/关闭/焦点 | 已用共享 catalog/picker；全视口与全功能未完成 |
| `source.picker` | 真题/随机/手动，选中文案、弹层样式、键盘与触摸 | 已接 Web/Mobile 共用 controlled 组件；内部值 adapter（Mobile `real` / Web `wca`）仍需全状态交互/视觉验收 |
| `source.manual.editor` | 共享 textarea，原文立即持久化，无提交/清空按钮 | 已接共享 editor，需集成证据 |
| `source.manual.queue` | trim 非空行，opaque，顺序循环，修改重置，跨项目共享 | 已接 shared parse/take，需证明全部边界 |
| `source.manual.empty` | 显示精确空队列提示，仍允许空打乱起表/保存 | shared predicate + Mobile attempt snapshot fixture 已接；待真机 |
| `source.wca.mode` | 比赛/日期二分 | 已接 Web/Mobile 共用 config 与 shared normalize；待全状态真机矩阵 |
| `source.wca.comp` | 比赛搜索、选择、国旗、清空，日期范围 | 已接共用搜索/日期控件、严格比赛索引、共享中英比赛名/城市与 canonical 国旗；待离线/长名/键盘/全量比赛真机矩阵 |
| `source.wca.round-group` | 轮次与组别筛选 | 已接共用 config 与 source identity；待完整请求/缓存组合和真机验收 |
| `source.wca.difficulty` | 方法/阶段/底色子集/步数/合并口径/覆盖提示 | 已接共用 `TimerWcaDifficultyConfig` 与 shared catalog/query/cache/inflight；内部底色键不得作为可见文案，OPPO 中文竖屏当前值/展开列表已验无编码泄漏和横向溢出；App 通过既有 `topControlsSlot` 将“最优打乱/合并/难度”保持在同一行，OPPO 360px 与 CDP 320px 均验同高、无相交、无横向溢出；19 项 shared contract、3 项 UI interaction 通过，待英文、横屏、大字、TalkBack、长文及全组合真机矩阵 |
| `source.wca.steps` | 222/pyra/skewb 真题按步数，各项目度量和 WCA 可达范围 | 三项目均接 shared normalize/identity + canonical Worker predicate；Mobile pool/source 定向回归通过，待全范围真机抽题 |
| `source.wca.222-type` | 完整状态、EG、CLL、EG1、EG2、TCLL+、TCLL-、TCLL、LS、无连色 | 10 类共用 catalog 已接；precomputed/live 筛选与 full source key 有 fixture，待完整比赛/日期范围和真机全类型矩阵 |
| `source.wca.222-mode` | WCA 恰 11 步 / 最优等态口径 | 共用 mode 控件、请求、cache/inflight identity 已接；待完整真题配置组合验收 |
| `source.random.difficulty` | 当前可达项目的方法/阶段/颜色/槽位/步数直接生成、loading/empty/rare/retry | 缺 |
| `source.random.steps` | 222/pyra/skewb/ivy/gear 按精确度量与步数生成 | 五项目均由 shared 设置/identity 驱动；222 与非二阶各走既有 canonical Worker host，待 OPPO 全项目切换/取消/stale 矩阵 |
| `source.random.222-type` | 真题 10 类之外再有 3-gen，每类独立 worker 队列 | 已接 runtime-neutral generator + shared RPC/pool；本地浏览器与 OPPO 已验证 EG1/CLL/No Bar/3-gen 样例，仍待 11 类全量真机矩阵 |
| `source.random.optimal333` | 登录可用、种子禁用、loading/failure/retry | 缺 |
| `source.config.persistence` | 来源、细项、队列与切项目后的精确恢复规则 | 完整 WCA difficulty/optimal/merge 与 by-steps 字段进入 shared store decode/normalize/migration；Web 11 项 + Mobile repository 17 项通过，仍待进程重启真机组合矩阵 |
| `scramble.prev-next` | 已显示打乱历史的上一条/下一条，与生成队列分离 | 已消费 shared `ScrambleHistory` 并覆盖键盘/触摸/队尾生成/solve 后前进，待 OPPO/iOS 真机矩阵 |
| `scramble.click-action` | 无操作/下一条/复制，复制勾和智能魔方修正路径特例 | 枚举/default/normalizer/persistence 与选择控件已由 Web/五端共用；产品层统一调用宿主剪贴板 capability，Android/iOS 薄宿主使用 Capacitor Clipboard，打乱、历史、联网房间码和二维码邀请链接复用同一 transport。OPPO `PFDM00` 已实证无操作不响应且不可聚焦、下一条更换真题、复制保持原题并提示成功，360px 无横向溢出。仍待 iOS/Harmony/Windows/macOS 三动作、智能魔方修正路径与完整视觉矩阵 |
| `scramble.format` | SQ1 等项目显示 adapter，存储仍保留 canonical 原文 | 未证明 |
| `scramble.preview` | 2D/3D/NxN/异形专用 renderer，显示开关、拖动、朝向 | Web/五端共用 `TimerCubePreview`/`TimerScramblePreview`；显示开关、2D/3D 默认/归一化/持久化与设置 UI 也已共享，单人和联网均从独立 `TimingSurface.cornerSlot` 渲染，避免拖动误触打乱动作。cubing.js 与 SQ1/Megaminx renderer 均为单源，不可解析手动题 fail closed；SQ1/Megaminx 保持 canonical 2D。OPPO 已装入对应源码构建，但手机仍被通知层遮挡；拖动/朝向、无遮挡及全设备视觉矩阵仍待关闭 |
| `scramble.source-meta` | 国旗、本地化比赛名、项目、轮/组/题号/加赛、深链 | Mobile 仅比赛名 + 项目 + round/group/# |
| `scramble.source-progress` | 稀有池 `seen/total`、全练过、非最优标志、打乱足迹人数 | 缺 |
| `scramble.loading` | WCA、csTimer worker、难度 worker、云端最优各自区分 loading | 仅通用 loading |
| `scramble.empty-error` | 比赛无项目、日期无题、难度无匹配、难度库待更新、稀有、短暂网络失败各自文案/重试 | 仅通用 error/unsupported |
| `scramble.smart-hint` | 已拧步骤变暗、当前高亮、打乱完成、不符、拧回原打乱、复制原打乱 | Web/五端产品层已共用 `TimerScrambleStrip`、shared 提示/匹配/偏离修正 requester 与同一 Solo lifecycle controller；Web/App 只保留 facelets、Worker 和预备回调适配。Android 最新 APK 已安装，OPPO 新版逐步提示、故意偏离、修正完成和 Worker 冷启动延迟仍待解锁后用 GAN 16 UI 实测，其他四端也未验收 |
| `scramble.trainer-case` | 随机难度直接生成时显示方法/阶段/步数与按需答案；当前 internal EventId 真可达集合是 `333/333oh/333fm` | 缺；不得误当成 LL/OLL/PLL 等 case provider 的逐题答案 |
| `scramble.trainer-subset` | OLL/PLL 子集选择；LL/OLL/PLL/COLL/CMLL/ZBLL/EG1/EG2 保存 case identity 并进入 case stats | Mobile 丢失/未展示部分 metadata、subset 与 case stats；Web 当前没有这些项目的逐题答案条 |
| `solution.small` | `222/pyra/skewb/SQ1/Megaminx` 的下方独立提示；前三项为完整还原+逐面/V，SQ1 为异步近最优+WCA 步数，Mega 当前只显示状态/错位贴纸 | 222/pyra/skewb 已接同一 solver/UI，支持 event-only 空打乱、展开/关闭、loading/error/stale、运行淡出；SQ1/Mega 仍缺 |
| `solution.panel` | 仅 `333` 的顶栏解法入口：手机全屏、桌面右栏/全屏，StageSolver + 六方法分步解法，展开/收起/前后题/计时淡出 | 六方法 runtime-neutral 引擎/阶段/调度已单源且 Web 为真实 consumer；Mobile React 面板、StageSolver Rust/WASM Worker/表 adapter、展开/导航/计时淡出仍缺。原静态文字已删除，不得把 engine migration 或 small hints 当成 333 面板完成 |

### 4.2 计时生命周期与输入

| Parity ID | Web 可达行为/状态 | Mobile 快照 |
| --- | --- | --- |
| `timer.phase` | idle/holding/ready/inspecting/running/stopped，各自颜色、数字和指令 | 基础状态机已 shared；计时数字的完整字形必须位于计时 Surface 可见边界内，禁止被来源配置、父级裁切或后续内容遮挡；视觉和全状态边界未全验 |
| `timer.practice` | 关闭计时时按压只换打乱，无读数/无成绩 | 缺 |
| `timer.inspection` | 0/WCA；8s/12s 警告；+2/DNF；观察期非 x/y/z 操作警告 | Mobile 基础 0/15，其余缺 |
| `timer.precision` | 运行 0/1/2/3 位，结果 2/3 位，运行隐藏 | Mobile 缺设置 |
| `timer.result` | OK/+2/DNF/DNS，生效时间和项目格式化 | Mobile 简化成绩行，完整语义未对齐 |
| `timer.target` | 目标差值、超时、pulse | 缺 |
| `timer.rank` | WR/CR/NR 区域排名徽章、国家选择 | 缺 |
| `timer.live-moves` | 动作列表、TPS、CFOP 阶段、BLD memo | 缺 |
| `timer.sound` | start/stop/8/12 提示音、音量/试听 | 缺 |
| `timer.voice` | 中/英男女语音观察 | 缺 |
| `timer.metronome` | 开关、BPM、tap tempo、观察提示秒数 | 缺 |
| `input.space-anykey` | Space 与“任意键停表”规则，Escape，数字快捷键 | Mobile 已接 shared 默认决策，包括 Space、Escape、任意键停表、Digit 成绩入口、默认分段/BLD memo 键与 44px 触摸标记；基础成绩详情已共享，自定义改键和完整复盘仍缺 |
| `input.keymap` | 可重绑、解绑、恢复默认，组合键拒绝与冲突处理 | Mobile 已执行 shared 默认 map/effect，但尚未持久化 overrides，也缺重绑/解绑/恢复 UI |
| `input.gesture-wheel` | 八向：next/OK/+2/DNF/prev/note/delete/copy，以及撤销 toast | Mobile 已渲染同一 `GestureWheel` 并接通 8 个 effect 及 shared Undo toast；边缘 clamp 和 OPPO/iOS 真机交互仍待验 |
| `input.pointer-stop` | running 时点击屏幕任何非豁免区停表，不重入 hold | Web/Mobile 已同用 shared policy；门禁只拦截新起表，running 即使来源变为 loading/unavailable 也仍可停表，待真机多区域验收 |
| `input.modal-suppression` | 菜单/输入/弹层/设备控件不触发计时 | shared modal/input/data-no-timer/phase priority + Web consumer 已锁；Mobile 未全量接入/证明 |
| `lifecycle.interrupt` | visibility、锁屏、后台、权限弹框、旋转、来电时不生成假成绩 | 需 Android/iOS 真机矩阵 |
| `display.fullscreen` | 全屏进/出、Escape/系统返回、安全区 | 缺 |
| `display.distraction-free` | running fade，可选运行中隐藏全部 UI，reduced-motion | 缺 |

### 4.3 成绩、session、统计与复盘

| Parity ID | Web 可达行为/状态 | Mobile 快照 |
| --- | --- | --- |
| `session.switcher` | 切换/新建/重命名/清空/删除，项目关联 | CRUD、项目↔分组自动联动、默认名称/双语文案、失败回滚、稳定首次 snapshot、44px 触点、portal/Tab trap、busy/rename/delete 焦点与受控 Back 已由 shared/timer-ui 单源实现，Web localStorage 与 App repository 仅保留持久化 adapter。Client 74 项、App 全集 233 项、四包 typecheck 与五端共享构建通过；最新 APK 已在 OPPO 真机验证 IME 不遮挡、两级 Back、新建、重命名、删除取消/确认/活动回退和清空取消，测试分组已删除且原 7 条成绩保留。TalkBack、横屏/大字及其他平台实体机仍待验 |
| `history.search-filter` | 文本搜索、日期、时间、罚时、case、tag 筛选 | 8 个 filter ID 与 8 类派生 tag 的解析/计算/筛选/清空语义已迁 shared，Web 和五端产品层共用同一 tag 徽标/筛选器；筛选不跨重启持久化，与网站一致。App 新产生的智能魔方成绩已通过 shared recorder/producer 落盘 `moves/device/stageSegments`，可自产跳O/跳P；OPPO 实拧、点击/TalkBack/全视口仍待验 |
| `history.columns` | 可选 rolling columns，日分组，空态 | rolling series/strict running PB/MBLD 排除规则已迁 `@cuberoot/shared/timer`，Web 与五端共用 `TimerHistoryColumnsHeader/DayDivider/RollingCells`、同一 picker 和设置持久化；FMC 按步数显示，筛选只改变可见行与日计数、不重算历史列。≤480px 统计列折到第二行且成绩行最小 44px，PB 标签优先可见。Client 60 项、App 全集 232 项、四包 typecheck、五端共享 Web build 与当前 Mac 可运行的四类原生构建均通过；三名独立 agent 最终 GO，等宽 Chrome 320/360、200% 字号、normal/compare、长成绩、多标签、44px 触点和 AX 审计通过。最新 APK 已覆盖安装到 OPPO 且回读一致、无 crash/ANR；设备仍锁屏，真实点击、TalkBack 与横竖屏矩阵待关闭 |
| `history.quick-actions` | OK/+2/DNF/DNS、备注、复制、删除 | 7 个稳定 action ID/effect/visible/disabled/active、完整成绩行与单一快捷菜单/底部操作表（右键/长按、焦点、Escape/点外/scroll/resize、viewport clamp、quick-delete once/no-confirm）已迁 `timer-ui` 并由 Web/Mobile 共用。Mobile quick delete 已接 repository restore + 共用 5 秒 Undo；菜单也接入受控 overlay。OPPO 600ms 原位长按打开 sheet，七项、360px 宽度、64px 底部预留及真实 Back 只关菜单已验；备注 textarea 在 461px IME 视口完整可见且无横向溢出。iPhone 17 模拟器只验证了当前共享构建安装/启动，History 交互与全状态矩阵仍缺 |
| `history.compare` | 二选/取消/第三项替换、结果/阶段/HTM/TPS/case 差异、删改与上下文清理、焦点/关闭/返回 | 选择和比较模型在 shared，完整 UI 在 timer-ui；Web/五端共用，render-time context gate 与定向回归通过。最新 APK 已安装，OPPO 仍锁屏，窄屏点击/可读/无遮挡真机验收待补 |
| `history.bulk` | 选择、批量删除 | `HistoryPanel` 保留可选代码，但网站 `SoloView` 当前未传 `onBulkDelete`，主路径不可达；不为 App 复制死代码。若网站重新开放，先提取 shared 原子操作与共用 UI 再五端接入 |
| `solve.detail` | 原始/生效成绩、日期、4 罚时、打乱/图、分段、BLD/MBLD、备注、tag | Web/五端已共用同一 `TimerSolveDetailModal`、同一打乱预览和同一基础复盘指标卡，基础字段、动作、焦点、关闭、窄屏布局、脏旧分段归一化及网站当前预览项目均为单源；tag 继续属于共用成绩行。Web 重型复盘仍由动态 slot 注入，故完整 parity 未关闭 |
| `solve.move-session` | 移动到其他 session | shared 不可变 move effect、详情 action/目标规则与共用详情入口已由 Web/五端消费；成功写仓储后才关闭，失败保持详情可见 |
| `solve.reconstruction` | 动作流、谱子、方法/阶段、质量、时间线、回放、反馈 | App 智能魔方成绩的 `moves/device/stageSegments` 已与 Web 共用 producer 并落盘；QTM/QTPS、首动延迟、最长停顿和停顿次数已由 shared 单次计算并由 Web/五端共用同一指标卡。完整动作谱、方法/阶段质量、时间线、回放和反馈仍缺 |
| `solve.auto-recap` | 智能魔方停表后内联 recap，下一把收起 | 缺 |
| `panel.times-chart-stats` | 成绩/图表/统计三 tab，桌面 rail/手机整屏 sheet | 缺 |
| `chart.types` | 分布/趋势/散点/时段/日历五图 | 缺 |
| `stats.overview` | count/best/PB 日期/mean/σ/CV/mo3/bo3/ao5/12/50/100/1000 当前与最佳 | 紧凑 current/best、σ/CV/count、展开 extras、Sub-X 与 rolling picker 已由 Web/Mobile 共用；OPPO 基础面板 360px 无横向溢出。完整字段、rolling 弹层/展开态和五图仍缺 |
| `stats.periods` | 今日/昨日、本/上周、本/上月、今/去年，趋势差 | 缺 |
| `stats.tabs` | 概览/按天/图表/case，7/30/90/365/全部日期范围 | 缺 |
| `stats.case-cross-session` | case stats、CFOP case stats、跨分组统计 | 缺 |
| `stats.records` | 个人 PB 与 WCA 纪录 overlay/差值 | 缺 |
| `goal.daily-target` | 每日次数进度、每项目目标时间 | 缺 |
| `round.simulation` | ao5/mo3/bo3/bo1、cutoff、单把/累计 time limit、DNS 尾部 | 缺 |

### 4.4 “更多”和所有弹层

| Parity ID | Web 可达行为/状态 | Mobile 快照 |
| --- | --- | --- |
| `more.marks` | 打乱足迹页 | 已绑定 App 内 Tools WebView 的本地化 `/timer/marks` 深链；待 OPPO 真机实点/返回栈验收 |
| `more.stats-mobile` | 手机形态中打开完整统计 | 已打开 App 内现有共享统计页；完整 StatsModal/五图仍由统计 gap 追踪 |
| `more.language-mobile` | 手机形态中英文切换并同步 URL | More 内已绑定 shared copy 与 Mobile 持久化语言设置；320/340px 实点生效，待真机重启验收 |
| `more.drill` | 可用项目显示专项练习，选 case/退出 | 缺 |
| `more.bld-helper` | 333bld/333ni/333mbld 条件显示 Speffz 记忆助手 | 按 shared visibility 显示并在 Tools surface 打开 canonical `/alg/3bld/helper` |
| `more.fullscreen` | 全屏切换 | 已绑定 Fullscreen API 并监听真实 `fullscreenchange`；待 OPPO WebView 支持/系统栏实点验收 |
| `more.manual-entry` | 手动录入成绩，不是手动打乱 | Mobile More 已接 shared modal；340px 中英文/无溢出浏览器审核通过，待 OPPO 软键盘/返回验收 |
| `manual-entry.normal` | 时间格式、OK/+2/DNF/DNS、打乱、备注、校验 | shared 规则/UI 与 Mobile repository 已接；定向回归绿，待真机 |
| `manual-entry.fmc` | 解法 parser/是否还原/OBTM 计数、步数 override、打乱/备注 | shared parser/完成态 oracle/UI 已接；定向回归绿，待真机 |
| `manual-entry.mbld` | 已还原/已尝试/时间、WCA 9f12c 计分与 DNF、输入错误 | shared 规则/UI 已接；边界回归绿，待真机 |
| `more.replay` | 从剪贴板粘贴 replay URL，校验/导入/错误 | 缺 |
| `more.solver` | 独立于顶栏 `solution.panel` 的 3×3 通用求解器：输入打乱、warmup/loading、解析/求解错误、解与逆序、复制；Facelet 入口当前禁用 | 在 Tools surface 打开 canonical `/scramble/solver?event=333`，不复制求解器 |
| `more.bulk` | 选项目/数量、生成、复制、下载、loading/error | 在 Tools surface 打开 canonical `/scramble/gen?mode=batch`，不复制生成器 |
| `more.print` | 计时器打印布局；中文与英文各可导出 PDF | 已迁入共用 `TimerPrintController/TimerPrintDocument`；Web/Android/iOS 共用同一冻结快照、摘要与完整成绩表，原生层只替换系统 print transport。当前输出目录中的中文、英文 A4 PDF 均为 7 页，已逐页渲染确认长备注换行、嵌入字体且无裁切、遮挡、横向溢出、乱码或缺页。OPPO `PFDM00` 已从 Mobile More 打开 ColorOS 系统打印预览，中文报告可见；取消后返回且打印 portal/body class 清理为零。iOS 由 Xcode 26.6 / iOS 26.5 Simulator SDK 编译成功并安装启动，但 iOS 原生面板、完成回调与双平台真实保存/输出仍待验；不是整个 Timer 完成 |
| `more.clear-event` | 无成绩 disabled；确认后只清当前项目 | shared 确认文案/纯 session 操作与 Mobile repository 已接；同 session 只清 active event、保留其他项目及重复清空回归通过，待 OPPO 确认/失败恢复验收 |
| `toast.undo` | 有撤销动作的消息，5 秒自动收起 | 共享 `TimerInfoToast` 已由 Web/Mobile 共用，统一可选 Undo、默认 5 秒、安全区/底栏避让和窄屏换行；Mobile 最后一次与任意历史行 quick delete 均接真实 restore effect。仍缺 OPPO 实点删除/撤销和 iOS 证据 |
| `modal.close-contract` | 点遮罩、关闭键、Escape/系统返回，焦点恢复，嵌套弹层不串 | 项目、来源、WCA 比赛建议、session、History quick menu、成绩对比与成绩详情已共用稳定 overlay 合同；Mobile 唯一 `openOverlay` 接入七者。成绩详情按 session+event context 查找，Android Back 先 blur 保存备注再关闭；自动化已锁定，OPPO 仍待实点。成绩对比另有 modal→compare mode→History 的返回顺序、焦点恢复和 context fail-closed 回归。More/手动录入与其余 modal 的完整真机矩阵仍未验，故整体未完成 |

### 4.5 设置全量表

Web 当前有 8 类、64 个可达偏好/命令 surface；稳定 ID 与交互策略见 shared `settings-contract.ts`，Web source-set guard 会在新增/删除字段时失败。清单单源不等于 Mobile 已实现：下表每一项仍必须使用同一设置 schema/归一化规则，不能把 Web `TimerSettings` 和 Mobile `TimerStoreSettings` 长期保留为两个不对等的业务模型。

| 类别 | Web 项目 | Mobile 快照 |
| --- | --- | --- |
| 计时 | 计时开关、WCA 观察、按住阈值、切项目匹配 session、切 session 匹配项目、隐藏运行时间、运行精度、成绩精度 | shared 已统一默认/normalizer，`TimerTimingSettingsSections` 已成为 Web/Mobile 共用真实 UI consumer；Mobile 8 字段 effect 已接且 OPPO 读到 8/8 canonical ID、无横向溢出并可滚动到底。仍缺逐字段效果、iOS、横屏/大字与全视口证据 |
| 智能魔方 | 自动预备：打乱正确/关/静止 2s/双拨；实况 3D/q2look/net/2D；记录姿态；每把后展开复盘 | 缺设置 UI，行为部分写死 |
| 打乱 | 最优打乱、真题自动打卡、预打乱朝向、训练预朝向、颜色中立、同步种子/计数器 | 缺 |
| 训练 | CFOP 分段、BLD memo/执行分段、每项目目标时间、每日目标、轮次模拟开关/赛制/cutoff/time limit/累计口径 | 缺 |
| 外观 | 计时器字体/字号、打乱字体/字号、紧凑打乱、打乱图、3D 魔方、点击打乱动作、运行隐藏全 UI、排名徽章、排名国家 | “打乱图”“3D 魔方”“点击打乱动作”已用 shared schema/default/normalizer、共用 UI 与真实 effect；单人/联网复用同一预览 renderer，3D 拖动区与打乱点击区隔离。OPPO 已完成点击打乱三动作与 360px 无溢出实证；新增两开关只具备自动化、构建和安装证据，仍待解锁后实点。其余 8 项仍缺，且 iOS/Harmony/Windows/macOS 的实体环境视觉与交互矩阵未验 |
| 声音与节奏 | 提示音、音量/试听、观察语音、节拍器、BPM/tap、自定义 beep 秒数/试听 | 缺 |
| 数据 | 本机自动备份频率/立即备份/列表/恢复；云备份状态/上传/覆盖恢复/登录；CubeRoot/csTimer/dcTimer 导入及 session/event 映射；CubeRoot/csTimer JSON/CSV/Speedstacks 导出；重算分段 | Mobile 只有 CubeRoot JSON 整库导入/导出/一次撤销 |
| 高级 | 所有可重绑快捷键、解绑/重置；同步种子应用/清空/当前计数/重置计数；恢复所有默认设置 | 缺 |

设置还有通用状态需逐项验收：默认值、老版迁移、值归一化、项目不支持时的隐藏/禁用、提示文案、立即持久化、取消/关闭后恢复、失败不覆盖旧值，以及同一账号/设备升级后的数据意义。

### 4.6 设备全量表

| Parity ID | Web 可达行为/状态 | Mobile 快照 |
| --- | --- | --- |
| `device.picker` | 统一设备入口区分智能魔方/智能计时器/Stackmat | 图标位置近似，功能集不等 |
| `device.smart-cube.protocols` | GAN v2/v3/v4、Giiker、GoCube、MoYu/MoYu32、QiYi 等 Web 已有 driver，统一选择 | 只实证 GAN v4 |
| `device.smart-cube.connect` | 扫描/连接/加密/MAC 输入/超时/拒绝/断连/重连/重置 | Android 主链已实证，断线/协议错误会清除共享 tracker 与可视状态；iOS picker UUID 后用 exact-name scan 捕获 manufacturer data 并复用 shared GAN MAC 提取，单测通过但尚无 iPhone/GAN 实证；拒绝、后台、蓝牙关闭、距离中断与反复重连仍未完成设备矩阵 |
| `device.smart-cube.status` | 型号、电量、协议、最后动作、魔方时钟/丢步诊断 | Mobile 只显名称/最后动作 |
| `device.smart-cube.scramble` | 状态定锚、打乱匹配、逐步提示、走偏修正、第一手起表、还原停表 | 3×3 GAN v4 自动起停主链已有旧版实证；提示、匹配、走偏修正、同批帧和 pending Worker 现在由 Web/五端共享并有自动回归，但最新 OPPO 可视提示/走偏修正仍待实体魔方复测，不能据此宣布设备完成 |
| `device.live-cube` | 3D/q2look/net/2D、陀螺仪、朝向、校准、fallback | 缺 |
| `device.smart-timer` | GAN/QiYi timer 选择、连接、MAC、读数、错误、断开 | 缺 |
| `device.stackmat` | 麦克风权限、输入设备、监听、信号级别、状态、精度、解码错误、停止 | 未实现；Mobile 不渲染麦克风假入口 |
| `device.permission` | 未支持/未开蓝牙/拒绝/不再询问/系统设置返回后重试 | 需 Android、iOS、HarmonyOS NEXT、Windows 和 macOS 各平台状态矩阵 |

## 5. 本地多人模式（2～4 人）

Web `BattleView` 是完整产品面，不是“一个外部网址”。五端 App 当前已通过 `@cuberoot/app-ui/LocalBattleMode` 渲染真实 2/3/4 人入口，消费 `@cuberoot/shared/timer` 的 `initialLocalBattleState/transitionLocalBattle`，并接入项目选择、同项目共享题、独立计时、同步开始、罚时、胜者和下一轮。Web 也已消费共享规则与原子 `LocalBattleRound`，但仍保留另一套 `BattleView` React 产品面；App 基础页面存在不等于下列 Web 全能力、历史持久化、多 BLE 或五平台 UI/UX 已完成。

- 2 人左右对战，3/4 人田字格，3/4 人上排翻转，手机/横屏布局。
- 每人独立项目、计时状态、OK/+2/DNF、分数、ao5、按键、打乱图、背景。
- 所有人同项目时共享打乱，混合项目时打乱归属正确，不串人/串项目。
- 真题/随机来源，比赛/日期配置，打乱复制与提示。
- 精度 1s/0.1s/0.01s/0.001s，观察关/8/15/∞，语音提示，显示打乱图，同时开始。
- 键位绑定、打乱字号、1/2/4 分段、起表延迟、隐藏运行时间。
- 每玩家背景色/背景图/透明度/重置，不得被安全区或顶层控件遮住。
- 每玩家智能魔方与共享传递魔方模式，连接/丢连/防串人。
- 成绩历史、VS 历史、轮次详情、复盘、删除、CSV 导出。
- 高级功能：手动录入、导入、CSV/JSON、模拟、分享、heatmap、撤销、里程碑/疲劳提示。

对抗审查已锁定以下迁移前阻断项，不得把旧实现原样复制到 Mobile：

- 新历史已改用原子 `LocalBattleRound`；旧 `session + event + playerIndex` 数据只作为个人统计镜像和只读 legacy 分区，不按下标迁移。下一步须把原子 rounds 接进现有 IndexedDB timer repository，并让个人统计从它可靠派生，最终退役非事务双写。
- Web WCA 异步打乱必须增加 source identity + revision，旧请求不得覆盖新请求；网络失败、确认无题、耗尽都不能静默随机回退，未知项目也不能回退 3×3。
- 任一玩家活动时必须锁定项目/source 等上下文变更；目前换项目会重置其他玩家当前轮。
- 多人设置中的观察、语音、分段必须在共用 reducer 中产生真实 effect，或 Web/Mobile 同时移除；当前可见 no-op 不能成为 App 验收范围。
- `pointerId`、timer handle、RAF、语音、震动、BLE channel 属于平台 adapter，不进入持久化共享 DTO；Mobile “每人一颗”还需要最多四路 native BLE channel pool。
- 下一步必须让 Web 与五端 App 消费同一个完整 `LocalBattleView`，或用精确 surface equality 证明两者不是会漂移的平行 UI。当前 App 入口可用，但在设置、历史、持久化、多 BLE 与全状态未齐前仍只能标为进行中，不能据此宣称 parity 完成。

共享 reducer 的强制边界（独立 Agent 于 2026-08-31 对照现有 timer 架构复核）：

- `@cuberoot/shared/timer` 已提供 `initialLocalBattleState()` + `transitionLocalBattle(state, action, config)`，App 已真实消费；玩家计时动作统一包装为 `{ type: 'player-timer', playerId, action: TimerMachineAction }`，内部必须继续复用现有 `transitionTimer()`，不得重新定义 idle/inspection/holding/ready/running/stopped。
- reducer 只返回不可变 `state / effects / accepted`；同步开始只负责用同一 `nowMs` 向合格玩家分发既有 `start-now`。过期打乱通过 revision/source identity 拒绝，异步请求本身不进 reducer。
- 完整共用 React 视图应收敛到 `@cuberoot/timer-ui`，五端产品编排留在 `@cuberoot/app-ui`；localStorage/IndexedDB、BLE、震动、声音、路由、认证、联网和 scramble provider 全部由 Web/宿主 adapter 注入。当前 App `BattleModes.tsx` 与 Web `BattleView` 并存仍是待关闭的 UI 重复边界。
- 依赖方向固定为 `apps → timer-ui → shared`。shared 禁 React/Next/nuqs/Zustand/DOM/timer/storage/Capacitor/BLE/API；timer-ui 禁依赖任一 app 源码或平台插件。`RoundResult` 是 WCA 单人赛制，不能冒充本地多人 round。
- 迁移测试必须显式覆盖 2/3/4 人、各自/同步开始、提前松手/系统取消、最后一人完成才结算、并列/+2/全 DNF/改罚时、活动期上下文锁、过期打乱、智能魔方只影响目标玩家、controller 卸载清理和 repository 重启/失败/损坏恢复；架构守卫要求 Web 与 Mobile 都导入同一个 shared transition。

## 6. 联机模式

Web `NetBattleView` 同样是完整产品面。五端 App 当前已通过 `@cuberoot/app-ui/NetBattleMode` 提供创建/加入、session 恢复、房间码、项目、WCA 身份、同步准备/倒计时、计时、罚时、玩家状态、房主转让/踢人、邀请二维码、历史统计和下一轮 UI；Mobile、Desktop、Harmony 均注入同一个 shared client/session contract。共享安全底座仍是 Web/API/App 的房间 DTO、13 项白名单、runtime decoder、结算和 capability 鉴权。该本地源码与集成测试不等于版本化 staged rollout 已部署，也不等于 Web/App React UI、视频、真实双设备和五平台验收完成。

发布不得假设同一次 push 能让已经打开的 Web 页面、已安装 Mobile 和 API 原子切换。当前安全契约拒绝无 capability 的旧写请求，直接覆盖原 `/v1/battle/rooms` 会让旧页面在部署瞬间失效；为了兼顾安全与不中断，发布前必须选择并验证以下 staged rollout，且旧公开 `pid` 绝不能获得换取 capability 的兼容入口：

1. 先以版本化路径或默认关闭的服务端 feature gate 部署新增的 capability + 服务端权威打乱契约；旧路径只能承接部署前客户端，不能把公开 `pid` 升级成私有凭据。
2. Web 与五端 App 切到新契约；用遥测确认新建房间均含 `player_auth`，并让已打开的旧 Web 和旧客户端收到明确的刷新/重进提示。
3. 等待旧房间 24 小时 TTL 全部过期；期间不得让旧路径创建新房。
4. 删除旧路径/feature gate 和兼容代码，再把 API、Web、五端 App 的安全矩阵与真实两设备流程重跑一遍。

版本化路径或 gate 尚未落地，所以当前代码只能作为本地安全基础，不能推送上线；这也是联机模式的明确发布阻断项。

- 大厅：创建、输入房间码加入、邀请 URL 自动加入、加载/重试/房间过期/退出。
- 身份：昵称或 WCA 姓名/ID 搜索、登录后自动同步名字、房内改名。
- 房间：房间码、复制邀请链接、二维码、离开，项目属于每个玩家。
- 玩家：在线/离线、待开始/已准备/观察中/计时中/已完成，项目、成绩、罚时、分数、房主。
- 轮次：各项目打乱生成与归属、等待、不等了直接下一轮、服务端 CAS 防重复推进。
- 同时开始：房主开关、全员准备、3 秒倒计时、取消准备、智能魔方仅负责停表的特例。
- 房主管理：转让房主、踢人二次确认，被踢/房间消失处理。
- 结果：OK/+2/DNF、修改罚时同步本地成绩、上传失败/重试/网络断开。
- 历史与统计：胜场、single/ao5/mean，每轮打乱和每人成绩，进行中标识。
- 视频房间：视频开关/条带、权限、断线，不遮挡计时与房间操作。
- 智能魔方：连接/重连/断开，打乱匹配、第一手起表、还原停表，动作流/复盘保存。

## 7. 必须拍到的状态矩阵

截图不能只拍 idle + 333 + 深色 + 竖屏。下列维度的有意义组合都必须有 DOM 断言与视觉基线：

| 维度 | 必测值 |
| --- | --- |
| 平台 | Web Chromium；Android WebView/OPPO；iOS WKWebView/Simulator 与真机；HarmonyOS NEXT ArkWeb/设备；Windows WebView2/实体电脑；macOS WKWebView/实体电脑 |
| 视口 | 320/360/390/412/768 px，竖屏/横屏，分屏/小窗口 |
| 缩放/字号 | 100%/150%/200%，系统大字与最长中英文案 |
| 语言/主题 | English/简体中文，light/dark/system 动态切换 |
| 计时 | idle/holding/ready/inspection 0/8/12/+2/DNF/running/stopped OK/+2/DNF/DNS |
| 来源 | mapped WCA，unmapped retained-WCA local，random，manual 非空/空，loading/error/empty/rare/unsupported |
| 内容 | 最长 NxN 打乱，SQ1/Clock/MBLD/relay，最长比赛名/session 名/备注/玩家名 |
| 弹层 | 项目/来源/比赛菜单，More，8 设置类，手动输入键盘，成绩/统计/设备/房间弹层 |
| 系统区域 | 状态栏、挖孔/刘海、底部手势区、三栏底导航、软键盘开/关、横屏安全区 |
| 断网/权限 | 冷离线、缓存可用、超时、5xx、蓝牙/麦克风拒绝、连接中切后台 |

每个 fixture 都要断言：

- `documentElement.scrollWidth <= documentElement.clientWidth`，且每个设计为局部滚动的容器可到首尾。
- 所有必须可操作元素的 bounding box 与安全可视矩形相交，且不被 fixed/sticky/dialog/底栏/键盘覆盖。
- 长名称和长打乱只在产品明确允许的地方换行/省略，其余不截断、不撑开兄弟控件。
- 弹层打开时焦点进入，Tab 顺序可达，关闭后焦点返回触发器；TalkBack/VoiceOver 有正确 role/name/value/state。
- 控件对比度、disabled/loading/error 区别不仅依赖颜色，不出现透明弹层与底下文字重叠。

## 8. 可自动化的 parity guards

下列守卫必须是 CI 的真失败门槛，不能是只输出 TODO 但仍 green 的报告。

### Guard A：可达产品面 manifest 精确集合相等

在 runtime-neutral package 建立稳定 `TimerParitySurfaceId` manifest，至少包含本文第 4～6 节的每个 ID。Web 与五端 App 分别注册真实 consumer，CI 用 exact set equality 检查：

```text
webSurfaceIds == canonicalSurfaceIds
installedAppSurfaceIds == canonicalSurfaceIds - ownerApprovedPlatformExemptions
```

单纯注册字符串不算完成。每个 ID 必须有 host interaction test，真点击/输入并断言状态或数据效果；未绑定测试的注册项也要失败。

### Guard B：`EventId × source × config` 穷尽能力表

- 表必须覆盖 43 个 ID，不能有 default/unknown fallback。
- 三个来源入口的可见性/选中值和 Web 完全相等。
- random provider 返回的 `result.event` 必须与 request 一致，且项目专项 invariant 通过；`cross`/`f2l` 不能用“反正都是 333 字符串”蒙混。
- 42 个 generated event 必须逐项通过 invariant；`custom` 的 random/retained-real manual-only 边界必须与网站空打乱行为逐状态相等。在该对照完成前整体 parity 保持失败，不能因为 UI 显示了 unsupported 就变成通过。

### Guard C：真题 event identity 和回退语义

穷尽 19 个映射，并专门锁：

- `222 -> 222`，不是 333；
- `333bld -> 333bf`、`333mbld -> 333mbf`、`mega -> minx`、`pyra -> pyram`；
- `333mr/333ni -> 333`，但 cache/history 仍以各自 Timer ID 隔离；
- 无映射的 `oll/ivy/r3/custom` 等在 source=wca 时保留选中值，且只调同项目本地 provider；
- mapped + 空池/404/5xx/超时显示 Web 对应状态，绝不填本地随机题。

### Guard D：手动队列完整 fixture

两端跑同一组 fixture：空文本、只有空行、行首尾空格、重复行、非法记号、Unicode，顺序 1→2→3→1，编辑后回到 1，切项目同一队列，刷新原文仍在但来源回到真题，左右只浏览已显示历史，空打乱可起表/保存，attempt 开始后冻结 event+scramble。

### Guard E：设置 schema 和迁移等价

- 建立共享设置描述 manifest：key、type、default、normalize、visibility/capability、copy key、category。
- Web 与 `@cuberoot/app-ui` 两个渲染入口从同一 manifest 消费；无所有者豁免时，可见字段 exact equality。
- 导入每个历史版本 fixture，迁移后两端语义一致。
- 禁止再扩大 Web-private `TimerSettings` 和 Mobile-only `TimerStoreSettings` 的业务字段差集。

### Guard F：菜单/弹层动作 registry

More、设置、成绩、统计、设备、对战与房间的每个 action 都有稳定 ID、可见条件、disabled 条件、effect contract 和测试。禁止下列假通过：

- Web 已有功能但任一 App 点击显示 `coming soon`；
- 打开系统浏览器代替 App 内 timer 模式；
- 静态 `<div>`/文字伪装按钮；
- 菜单项存在但 onClick 无数据效果。

### Guard G：成绩数据与统计 baseline

用同一数据库 fixture 对 Web/`@cuberoot/app-ui` 断言：session 顺序/关联，每 EventId 隔离，OK/+2/DNF/DNS，FMC/MBLD，comment/tag，move/gyro/stage/bld payload，移动 session，删除，PB、rolling stats、period stats、case stats、round/cutoff/time-limit。数值用精确 baseline，不用放宽的大于/非空断言。

### Guard H：响应式、无遮挡与无溢出

用第 7 节的 fixture matrix 生成两端同视口截图，并执行 overflow、bounding-box visibility、z-index occlusion、safe-area、keyboard resize、focus/ARIA 断言。截图差分不允许用大面积 mask 掉计时器主体，重新生成 baseline 必须在 PR 中展示原图/新图/diff。

### Guard I：禁止重复造轮和假 fallback

静态守卫至少拒绝：

- `@cuberoot/app-ui` 或任一宿主 deep import client app 源码，或复制 `SoloView/BattleView/NetBattleView`/CSS；当前 App `BattleModes` 与 Web Battle/Net 平行视图必须进入集合差分并继续收敛，不能被 ratchet 漏过；
- app A 依赖 app B；
- 重复定义 EventId 目录、WCA map、source union、penalty union、timer phase 状态机、统计规则、GAN 协议；
- `unknown/default/error -> 333`，或失败时填另一项目/另一来源；
- 当 Web 已有同名功能时出现 `coming soon`/`open full web timer` 作为 parity 完成路径；
- 任一 App/宿主另造视觉 token、文案列表或设置默认值。

当前已落地的第一条 ratchet 是 `core/packages/app-ui/src/mobile-capability-surface-guard.test.ts`：它锁定已安装客户端 1/2/3/4/net 都进入真实 App 内模式、拒绝 `players` 浏览器 fallback，并禁止在没有原生麦克风 adapter 时渲染 Stackmat/coming-soon 入口。完整 registry 集合差分及 Web/App Battle/Net UI 重复守卫仍按 Guard A/J 待实现。

### Guard J：自动化审计报告和完成门槛

CI 每次生成共享产品层报告，并把宿主/平台证据分开列出：

```text
canonical IDs / Web implemented / installed App implemented / exempt / missing / untested
Android / iOS / HarmonyOS NEXT / Windows / macOS: build / install / device / interaction / signing / release
```

只有同时满足下列条件才能把整体状态改成 `COMPLETE`：

1. `missing = 0` 且 `untested = 0`；
2. 所有 exemption 都有仓库所有者针对具体项的明确批准；
3. Web 与 `@cuberoot/app-ui` 自动化互动/数据/视觉证据都通过；
4. Android、iOS、HarmonyOS NEXT、Windows 和 macOS 分别完成对应设备或实体电脑状态矩阵，且源码、本地构建、安装、设备、签名和发布证据不混写；
5. 实现者之外至少两个独立 agent 对抗审查，一人专门找功能反例，一人专门找遮挡/溢出/可访问性反例。

## 9. 实施顺序（不改变最终范围）

1. 先建 Guard A/B/C/I，让新 gap 不再静默增长。
2. 把整个可见 timer shell 和 source/config 组件逐步提取到 `@cuberoot/timer-ui`，平台只注入 URL/存储/网络/BLE/权限 adapter。
3. 把 Web 已成熟的 scramble/session/settings/stats 纯逻辑迁到 `@cuberoot/shared/timer`，由 Web 与 `@cuberoot/app-ui` 成为真实 consumer；不在任何宿主重写。
4. 先关闭可证明的 P0 反例：二阶真题全配置、手动队列完整契约、43 项 provider，然后统计/session/设置/设备/多人/联机。
5. 最后跑 Guard H 的全状态视觉矩阵和五平台设备/实体电脑验收；这不是可在功能测试通过后省略的“美化”。

## 10. 事实源索引

- 模式宿主：`TimerShell.tsx`
- 单人页面：`SoloView.tsx`
- 来源配置：`ScrambleSourceBar.tsx`、`WcaSourceConfig.tsx`、`GenDiffConfig.tsx`、`GenStepsConfig.tsx`
- 真题池：`_lib/scramble/wca_pool.ts`
- 随机注册：`_lib/scramble/index.ts`、`register.ts`、`nonwca.ts`
- 设置：`_lib/settings/index.ts`、`SettingsPanel.tsx`
- 成绩/统计：`HistoryPanel.tsx`、`SolveModal.tsx`、`StatsPanel.tsx`、`StatsModal.tsx`、`charts/**`
- 手动录入：`ManualEntryModal.tsx`
- 设备：`BluetoothModal.tsx`、`BluetoothTimerModal.tsx`、`StackmatModal.tsx`、`_lib/bluetooth/**`、`_lib/stackmat/**`
- 本地多人：`BattleView.tsx`、`_battle/**`
- 联机：`NetBattleView.tsx`
- 共享项目/真题 map/Mobile provider：`core/packages/shared/src/timer/event-catalog.ts`、`scramble-runtime.ts`
- 五端共享产品层：`core/packages/app-ui/src/App.tsx`、`data/real-scramble-pool.ts`、`data/timer-repository.ts`
- 当前宿主：`core/apps/mobile`（Android/iOS）、`core/apps/desktop`（Windows/macOS）与 `core/apps/harmony`（HarmonyOS NEXT）

## 11. 已发现的 Web 自身边界（不得凭注释猜）

复制期间以“真正可达行为”为准，不是以注释或理想设计为准：

- 无 WCA 映射时保持真题选中并同项目本地 fallback，这是当前明确行为，见第 2 节。
- `trainer-source.ts` 的 `TRAINER_EVENTS` 包含 WCA spelling `333bf/333ft`，而 `SoloView` 传入 internal `EventId`；因此当前真可达难度生成项目必须用 UI/fixture 实测，不能直接把注释所说的“3×3 族”写入 Mobile 能力表。
- Web `generateScramble` 底层仍有 unknown 时返回 333 的历史 fallback；迁移时应用 exhaustive registry 消除这条危险路径，而不是把它复制到 shared/Mobile。同一个已登记的 Web 可达项目行为仍要保持。
- 如果 Web 本身有 bug，先用用户可见的 fixture 和产品决定修正 Web，再让 shared UI 同时供 Web/Mobile 消费；不应为“一模一样”刻意新造一个已知 bug。
