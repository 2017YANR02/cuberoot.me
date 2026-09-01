# 五端 `/timer` 完全一致跟踪

状态：`ACTIVE — NOT COMPLETE`

最后更新：2026-09-01

产品决定：仓库所有者要求 Android、iOS、HarmonyOS NEXT、Windows 和 macOS 的整个计时器与网站 `/timer` 保持完整 UI/UX 一致，且不得复制形成多端维护。`@cuberoot/app-ui` 是五端唯一 React 产品层；本文中早期“Mobile”证据行仍特指当时的 Android/iOS 快照，不自动升格为其他三端证据。

## 1. 本文回答什么

本文是网站与五端计时器一致性的唯一执行跟踪表，用来回答：

1. 哪一端是当前行为事实源。
2. 哪些能力已经由 Web 和五端共用同一实现，哪些只有某一平台证据。
3. 哪些界面只是看起来相似，实际仍是假控件或缺失功能。
4. 每一项需要哪些自动化与真机证据才能标记完成。

`docs/mobile-app-roadmap.md` 继续负责整个 App 的发布路线；本文只负责 `/timer` 产品面。两者冲突时，计时器 UI/UX 一致性以本文为准，App 是否达到商店发布条件仍以总路线图为准。

`docs/mobile-timer-zero-omission-audit.md` 是本文的对抗审计附录：保存 43 项、所有来源/配置、单人/多人/联机、设置/弹层/设备/异常状态的快照和自动化守卫设计。任何“完整复制”审核必须同时读该附录，不得只检查本文已知反例。

## 2. “完全一致”的验收定义

“完整”按零遗漏解释：网站 `/timer` 在任一可达状态中出现的每个可见内容、控件、菜单项、弹层、错误、空态、加载态及其操作结果，都必须进入本表并有真实实现。没有登记不等于不需要；高成本、暂缓或平台受限只能保持为明确未完成/阻塞项，不能静默删除、用静态文字代替、点击无响应、改开浏览器或仍宣称整体完成。

这里的“一项”不是页面标题或菜单入口，而是完整的笛卡尔积：`项目 × 人数模式 × 打乱来源 × 来源配置 × 计时阶段 × 数据状态 × 语言 × 主题 × 视口/输入方式`。例如二阶项目能出现在菜单里，只证明“目录入口”存在；若网站二阶支持真题而 App 禁用真题，或者网站有手动输入而 App 没有输入控件，二阶与来源 parity 都是不合格。任何一个可达组合缺失，整体 `/timer` 必须继续标记 `NOT COMPLETE`。

“尽可能复刻、代价过高可以算了”不得由实现者自行解释为删功能。只有仓库所有者在看到具体成本、替代方案和用户影响后明确批准，才能把单项标为“平台豁免”；未获明确批准一律是待完成，不是范围外。

以下各项必须同时一致，不能只凭一张相似截图验收：

- 信息架构：顶部控件、打乱来源、计时区、统计、设备入口、面板和弹层的顺序与层级一致。
- 控件集合：网站存在的人数、项目、来源、难度、解法、更多、设置等控件，App 不能用静态文字冒充。
- 交互结果：点击、长按、键盘、触摸、返回、刷新、切换项目/人数/来源后的状态迁移一致。
- 模式：`1～4 人`本地模式与`联机`模式均进入同一产品语义，不得在 App 内静默无响应或跳到浏览器代替完成。
- 数据与持久化：session、成绩、罚时、备注、设置、打乱来源和恢复行为遵守同一契约；平台存储 adapter 可以不同。
- 状态反馈：加载、空数据、离线、权限拒绝、连接中、已连接、计时中、DNF、`+2` 和错误状态一致。
- i18n、主题与可访问性：英文/简体中文、深浅主题、字号、焦点、TalkBack/VoiceOver 语义及触摸目标一致。
- 视觉：在相同内容视口下，字体、字号、间距、对齐、图标、颜色 token、断行、响应式断点和弹层位置一致。
- 可读与不遮挡：正文、按钮、打乱、统计、菜单和提示不得被系统状态栏、底部手势区、三栏底栏、软键盘、弹层或其他固定元素遮住；文字不得因裁切、低对比度、错误叠层或不可预期省略而看不清。
- 无溢出：任何支持视口和字号下都不得出现非设计内的横向滚动、控件越出屏幕、弹层被截断、长名称挤压相邻操作或点击区域落在可见视口外。允许滚动的长列表必须有明确滚动容器，并能触达首尾所有项目。
- 内容全量性：项目、来源、比赛、session、统计列、菜单和设置不得抽样验收；网站集合与 App 集合必须由自动化证明完全相等。
- 来源全量性：每个项目在网站可用的真题、随机、手动及其比赛/日期/轮次/组别/难度/案例配置，App 必须逐项相等；不能用“Mobile 当前 provider 支持多少”代替与网站做集合差分。
- 操作全量性：输入、清空、粘贴、提交、刷新、上一条/下一条、禁用原因、校验错误、恢复和持久化都属于功能，不能只比控件标签。
- 行为事实源自动盘点：验收清单必须从当前 Web `/timer` 的可达控件、菜单模型、配置 catalog、状态机与持久化契约生成或逐项差分；禁止由 Mobile 已实现内容反推范围，也禁止只挑常用项目、正常路径或截图可见区域抽样。
- 对抗性复核：每个产品面至少需要一条独立审查线主动寻找“网站可用、App 缺失/无响应/结果不同”的反例；实现者自测通过不能单独把项目标成完成。
- 跨端同源：任一平台的业务修复必须进入 `@cuberoot/app-ui`、`@cuberoot/timer-ui` 或运行时中性的 shared 契约；除权限、BLE transport、安全存储等明确平台边界外，不得新增宿主私有业务实现。

允许的平台差异只有：系统状态栏/导航条、安全区、系统权限面板、原生 BLE transport、系统安全存储、震动/保亮、窗口和系统分享/打印器。任何新增豁免必须写入本文并由目标平台证据证明是必需差异。

## 3. 单一实现边界

```text
core/packages/shared
  计时/统计/打乱/智能魔方协议/状态机/序列化等运行时中性逻辑
             ↑
core/packages/timer-ui
  Web + 五端真实共用的 React UI 与交互原语
             ↑
core/packages/app-ui
  五端唯一 React 产品组合与 capability contracts
             ↑
core/packages/client   core/apps/mobile   core/apps/desktop   core/apps/harmony
Next/Web transport     Capacitor adapters Tauri adapters      ArkTS/ArkWeb adapters
```

固定规则：

- 网站 `/timer` 的当前可见行为是迁移期间的产品事实源，但其 app 私有源码不是可复用 API。
- `app A -> app B` 源码依赖、宿主 deep import `core/packages/client`、复制 `SoloView`/`BattleView`/CSS 到宿主均禁止。
- 多端使用的产品 UI 留在 `@cuberoot/app-ui` 与 `@cuberoot/timer-ui`；稳定的纯逻辑提取到 `@cuberoot/shared` 公开 subpath。
- Next 路由、`nuqs`、SEO、Web Bluetooth 留在 client adapter；Capacitor、Tauri 和 Harmony 的权限、BLE 与安全存储留在各宿主 adapter。
- 不新建第二套账号、timer schema、BLE 协议、多人状态机或视觉 token。
- 不把远程 `/timer`、iframe、系统浏览器跳转或整站 WebView 当作 App 内功能完成证据。
- 不允许“先画出来以后再接”：没有真实事件和状态的元素不得呈现成可操作控件。

## 4. 当前诚实基线

2026-08-30 的 Android 画面与源码证明当前尚未完全一致：

| ID | 已发现差异 | 当前证据 | 状态 |
| --- | --- | --- | --- |
| BASE-01 | 人数选择器已由 `@cuberoot/timer-ui` 共用；五端 App 可进入 `@cuberoot/app-ui` 的真实 2/3/4 人与联机页面，不再只读“1人”或外跳。Web 仍消费自己的 Battle/NetBattle 视图，完整 UI/UX 尚未收敛为同一个 React 视图 | capability guard + App 多人集成测试；五端设备和 Web/App 集合差分仍缺 | `进行中` |
| BASE-02 | 原静态“3×3”已换成 Web/Mobile 共用项目选择器；43 项、二阶选择和重启恢复已在 OPPO 实证，但全项目能力与全视口视觉矩阵未完成 | shared catalog、共用组件、OPPO CDP | `进行中` |
| BASE-03 | 静态“解法”文案已删除；222/pyra/skewb 的完整还原与逐面/V 提示已由 Web/Mobile 共用同一 solver/UI。333 六方法的 mask、阶段、执行、双语标签和可取消调度已迁到 runtime-neutral `@cuberoot/puzzle-solvers/timer-333-step`，Web 分步面板与复盘参考成为真实 consumer；但顶栏 StageSolver 的 Rust/WASM Worker/表宿主、六方法 React 面板仍未接 Mobile，SQ1/Megaminx 与 More 独立通用求解器也缺 | small hints 共用 UI；333 package exact golden + 旧 Web 路径 identity migration + stale/cancel/error 回归；Mobile 尚无 333 consumer，因此整体不完成 | `进行中` |
| BASE-04 | 重复比赛名根因是 Mobile 同时渲染两条来源；上方重复条已删除，只保留打乱下方唯一出处 | OPPO 重装后 `Brockport Bolt 2025` 只出现一次 | `待独立审核` |
| BASE-05 | 三项来源入口、手动队列、比赛/日期、比赛搜索、国旗、轮次/组别、2×2 配置、WCA 难度/合并/最优及非二阶按步数已改为 Web/Mobile 共用 UI/纯逻辑；随机难度、完整出处/错误文案及其他项目相关配置仍未关闭 | shared source/editor/WCA difficulty/by-steps 对比 `ScrambleSourceBar` / `WcaSourceConfig`，Web/Mobile 定向回归 | `进行中` |
| BASE-06 | 五端 App 已接真实 2～4 人本地模式和联机模式；但网站与 App 仍分别维护 Battle/Net React 视图，完整 UI、设置、历史、视频、多 BLE 与五平台设备矩阵尚未收敛 | Web `TimerShell`/Battle/Net 对比 `@cuberoot/app-ui` 的 `BattleModes`，并由定向集成测试锁基础流程 | `进行中` |
| BASE-07 | session CRUD/项目关联、7 个 quick action、完整成绩行、快捷菜单/底部操作表、备注、Undo、8 类派生标签及筛选均由 `@cuberoot/shared/timer` 与 `@cuberoot/timer-ui` 单源维护。App 智能魔方成绩通过共用 recorder 落盘 `moves/device/stageSegments`。成绩对比的二选/第三项替换、删改清理、session+event 渲染期隔离、普通/+2/DNF/DNS/FMC/MBLD 结果、阶段/HTM/TPS/case 差异、焦点/Backdrop/Escape/Android Back 与窄屏布局也已迁入同一 shared model + timer-ui modal，Web 和五端只传成绩与文案；旧 Web 私有 modal 已删除。完整 SolveModal/复盘 UI/统计图表仍缺；网站主路径当前没有传入 `onBulkDelete`，不可达的批量删除代码不冒充既有 parity 要求 | shared history action/filter/tag/move/compare 合同；Web/App 共用 History/compare DOM，32+5 定向回归和四包 typecheck 通过；Mobile build、Capacitor sync、Android assembleDebug 通过。最新 APK 已覆盖安装到 OPPO，但手机仍锁屏，成绩对比、GAN 实拧、标签点击/TalkBack/全视口真机验收未完成 | `进行中` |
| BASE-08 | 19 个 Timer EventId 已按 shared map 请求精确 WCA 项目；比赛索引/中英本地化/城市检索/日期区间、二阶类型、WCA/最优、完整 3×3-family 难度/合并与 222/pyra/skewb 真题按步数已接共享契约；pyra/skewb/ivy/gear 随机按步数也走同一 Worker host。完整来源元数据、用户可见异常分型、全配置/真机矩阵仍未关闭 | shared map/difficulty adapter、strict competition merge、exact-event pool、68 项 Mobile pool/source 回归、19 项 shared contract、3 项 UI interaction | `进行中（P0）` |
| BASE-09 | shared editor/opaque queue 已接入，支持持久化、顺序循环、跨项目重置与空打乱；Mobile 已直接消费 shared `ScrambleHistory`，上一条/下一条、队尾生成、solve 后前进和左右键/44px 触摸入口共用同一游标。每个已显示 slot 冻结 event/source identity/source snapshot/case/真题 occurrence/availability；普通/date 池、cache、live+2×2 预计算合并也统一按 shared 官方 competition/event/round/group/extra/number slot identity，而非打乱文本。回看重复文本真题后保存不会串 occurrence；context 重置与异步 stale/cancel 已锁。仍缺 OPPO/iOS 真机交互与完整视觉矩阵 | Mobile history 既有 57 项/typecheck/Vite build；occurrence pool 4 files 50/50、重复文本不同 slot、同 slot 重复输送、cache 重启与 boundary fixture | `待真机（P0）` |
| BASE-10 | “手动输入打乱”不是“手动录入成绩”；普通时间、OK/+2/DNF/DNS、FMC、MBLD、打乱和备注现已迁到 Web/Mobile 共用规则与弹层，Mobile More 和 repository 已接入；仍待 OPPO 完整输入/滚动/返回视觉验收 | shared parser/copy/modal、Web 薄 wrapper、Mobile repository 与 80 项定向回归 | `待真机（P0）` |

因此在下列矩阵全部关闭前，任何文档、提交说明或交付消息都不得声称“计时器已一模一样”。

独立审计补充的工作量基线：`@cuberoot/timer-ui` 已覆盖更多共用 React 产品面，但网站私有 Battle/Net、完整统计/设置等仍未全部迁移。迁移必须按 P0“完整共享壳与所有可见控件真实事件”→ P1“统计/设置/数据能力”→ P2“全状态视觉矩阵”推进；当前五端 App 已有真实 2/3/4 人与联机入口，仍不等于与网站 Battle/Net 的全部 UI、设置、历史、视频和设备能力相同。

## 5. 实施与验收矩阵

状态只允许：`未开始`、`进行中`、`待独立审核`、`待真机`、`完成`、`平台豁免`。

| ID | 产品面 | 单一来源目标 | 自动化验收 | 设备验收 | 状态 |
| --- | --- | --- | --- | --- | --- |
| PAR-001 | 顶栏人数控件 | `@cuberoot/timer-ui` 共用组件；宿主只提供模式状态/路由 adapter | Web 与 App 都可交互；App capability guard 锁定 1/2/3/4/net 都进入本地产品面 | 五平台逐项切换、活动期禁切与返回恢复 | `进行中` |
| PAR-002 | 1～4 人与联机模式宿主 | 共享规则与最终共用 React 视图；禁止长期保留 Web `BattleView/NetBattleView` 与 App `BattleModes` 两套产品 UI | App 2/3/4/net、create room、同步倒计时与下一轮集成测试已通过；仍需 Web/App surface 集合差分和同一视图迁移 | Android、iOS、HarmonyOS NEXT、Windows、macOS 各模式完整 smoke | `进行中` |
| PAR-003 | 项目选择器 | 43 项目录、分组、ID bridge 来自 `@cuberoot/shared/timer`；弹层来自 `@cuberoot/timer-ui` | 目录全等、选择/恢复、来源兼容与无 333 fallback 测试 | 窄屏弹层、滚动、逐项选择 | `进行中` |
| PAR-004 | 打乱来源入口 | 共用来源控件与 schema；平台只注入 fetch/cache adapter | 自动从 Web 事实源生成 `43 项 × 真题/随机/手动 × 配置` 集合差分；任何 App-only disabled 或缺入口直接失败 | 逐项目切换、输入、配置、重启恢复；二阶真题和手动输入列为首批 P0 反例 | `进行中` |
| PAR-005 | 真题配置与出处 | 共用比赛/日期/轮组/难度交互；单条出处只显示一次 | 缓存、空池、回退、出处 fixture | Brockport Bolt 等真题实测 | `进行中` |
| PAR-006 | 解法、难度和提示 | 共用可见控件及展开状态，不保留静态占位 | 222/pyra/skewb 多题逐公式迁移 fixture、空/错误/stale/运行态与支持边界；333 六方法引擎 exact golden、Web identity migration、调度 cancel/stale/error 已锁，仍缺 Mobile React consumer 与 StageSolver Worker/表 adapter；SQ1/Mega/Trainer/general solver 尚需各自矩阵 | 320/340px 点击、键盘展开、收起、纵向可达、无横向溢出；仍待 OPPO/iOS | `进行中` |
| PAR-007 | 计时 Surface | 已有 `TimingSurface`/`SegmentTime` 继续作为唯一组件 | phase、检查、`+2`、DNF、pointer fixture | 触摸长按、旋转/中断 | `进行中` |
| PAR-008 | 打乱文本与魔方图 | shared 打乱/记号 + `visualcube`；尺寸 token 统一 | 项目 fixture、断行和图态测试 | 横竖屏与动态字号 | `进行中` |
| PAR-009 | 左下统计与成绩历史 | shared timer schema/stats；紧凑统计、成绩行、快捷菜单/底部操作表、注释编辑、Undo toast 及文本/日期/时间/罚时/case/标签筛选已由 Web 与五端共用；bulk/compare/SolveModal/完整统计继续提取共用 | 紧凑 current/best/rolling 与 Mobile 持久化已锁；行 DOM、七项顺序、右键/长按、焦点、视口 clamp、失焦保存、Undo、8 标签顺序/双语/PB/ao/MBLD/DNF 边界、OR 筛选、完整读屏名与窄屏 `2 +N` 单源回归通过；App 智能魔方新成绩也已共用 move/stage producer，完整面板仍缺 | 新 debug APK 已覆盖安装到 OPPO 并与设备 `base.apk` 字节一致；锁屏期间未完成 GAN 实拧、标签点击、TalkBack 和多视口真机验收；iOS 和全状态矩阵仍待验 | `进行中` |
| PAR-010 | session、PB、目标、轮次 | shared 数据契约与共用 UI | 持久化/迁移/边界测试 | 进程重启恢复 | `进行中` |
| PAR-011 | 统计/图表/复盘面板 | 紧凑 StatsPanel/rolling picker 已进入 timer-ui 并由 Web/Mobile 共用；完整 StatsModal、五图与复盘面板仍须迁移，重型能力须有明确平台决定 | 紧凑面板 exact baseline/交互/窄屏与 Mobile source-set/持久化已通过；完整面板仍缺数据一致和懒加载测试 | OPPO 360px 共用 current/best/ao5/ao12 面板可见且无横向溢出；rolling 弹层、展开态、iOS 与完整面板仍缺 | `进行中` |
| PAR-012 | 更多菜单和设置 | 菜单模型与共用设置控件单源；宿主只注入真实平台动作，未绑定项不得显示 | More 12 项与 Settings 8 类/64 字段 exact registry/条件/effect、Web 真实 consumer、App implemented/missing ledger；App 已接 More 10 项、“计时”8 字段、“训练”2 个分段字段及“点击打乱动作”共用 UI/effect，专项/replay 和其余 53 个设置字段仍待迁移 | OPPO 已显示 8/8 计时 setting ID并实证点击打乱三动作；新分段设置/触摸、iOS 与其他三端待验 | `进行中` |
| PAR-013 | 键盘、触摸、检查和系统中断 | shared timer machine + `input-contract`；轮盘 React UI/DOM pointer lifecycle/CSS 走 `@cuberoot/timer-ui`；平台只分类目标并执行纯决策命令 | action/default/rebind/digit precedence、modal/input/running priority、八向 action/enabled map、mouse/touch slop/dead-zone、轮盘 DOM/disabled/highlight/cancel exact golden；Web identity migration | Mobile 已接共用轮盘、默认键盘决策与任意键停表；自定义改键和 OPPO 来电/锁屏/切后台仍待验 | `进行中` |
| PAR-014 | 智能魔方 | GAN v4/clock/state、逐步提示、匹配判定、偏离修正 requester、模式门禁与 Kociemba cubie 运算均为 shared 单源；Web/五端共用 `TimerScrambleStrip`，宿主只保留 transport/Worker adapter。Web `SoloView` 与 App `App.tsx` 的 React lifecycle coordinator 尚未收敛，不得写成完整单源 | 协议、自动计时、提示/修正、同 target coalesce、新 target 续跑、pending Worker 失效、协议错断开/拒绝晚帧及 43 项 capability 矩阵 fixture 已通过；App Solo coordinator 的完整行为 harness 仍缺 | OPPO + GAN 16 UI 已有连接、转动与自动起停证据；本轮新版逐步提示/偏离修正和 Worker 冷启动延迟仍待实体魔方复测 | `进行中` |
| PAR-015 | 多人智能魔方与本地 Battle | `@cuberoot/shared/timer` 的 reducer/`LocalBattleRound` 与模式 capability 是规则来源；App `LocalBattleMode` 已真实消费 reducer，Web 已消费部分共享规则与 round codec，但两端 React 视图尚未合一 | App 2/3/4 人、事件切换、同题分组、计时、罚时、并列/下一轮与 stale/failure reducer fixture；Web/App 共用本地仅 `333`、联机 `333/333oh` 的 BLE 门禁；历史/repository、完整设置、Web/App 同视图和设备矩阵仍缺 | 触摸、横竖屏、五平台与共享/四路真实 BLE 组合 | `进行中` |
| PAR-016 | 联机房间 | DTO、13 项白名单、计分/同步/统计、runtime decoder、admission gate 与注入式 HTTP client 已进入 `@cuberoot/shared/timer`；App `NetBattleMode` 已接创建/加入/恢复/房间/计时 UI，三个宿主都注入同一 client/session contract；Web `NetBattleView` 仍须与其收敛为同一 React 视图 | capability 安全矩阵及 App create room、同步倒计时、settled round 交互已有定向回归；真实 PostgreSQL 并发、版本化 staged rollout、完整 Web/App surface equality 尚缺 | 两设备真实房间、邀请/后台恢复、视频/权限和五平台完整状态 | `进行中` |
| PAR-017 | 登录、在线足迹与同步提示 | 现有唯一账号/票据契约；登录不伪装成绩已同步 | auth 与未同步文案测试 | 系统浏览器回跳 | `进行中` |
| PAR-018 | 中英文、主题与 token | 共用 copy key/组件；禁止 inline 语言分叉与第二套色值 | en/zh key、主题截图、token 守卫 | 系统主题/字体切换 | `未开始` |
| PAR-019 | TalkBack/VoiceOver 与键盘焦点 | 共用语义结构；平台读屏验证 | axe/role/name/焦点测试 | TalkBack + VoiceOver | `未开始` |
| PAR-020 | 响应式、无遮挡、无溢出与视觉回归 | 共用 CSS/token；同视口截图基线；固定层、安全区、软键盘与锚定弹层必须进入布局合同 | 320/360/390/412/768、横竖屏、200% 字号、键盘开闭截图 diff + overflow/可见性断言 | OPPO 与 iOS 逐状态截图；确认内容不被状态栏、手势区、底栏、键盘、菜单或对话框遮住 | `进行中` |
| PAR-021 | 离线、升级和旧数据 | shared schema + Mobile repository adapter | 冷离线、迁移、回滚 fixture | 杀进程/升级安装 | `进行中` |
| PAR-022 | 重复实现守卫 | package 边界 + 精确重复/假控件 ratchet | 已有架构边界测试；App capability guard 要求 1/2/3/4/net 都进入真实本地模式并拒绝浏览器 fallback、Stackmat 占位和无 adapter 的麦克风入口；完整 Web 可达集合和 Battle/Net React 视图重复守卫仍缺 | 不适用 | `进行中` |

### 5.1 项目选择不能只验菜单

网站当前 43 个 `EventId` 必须全部来自 `TIMER_EVENT_PICKER_GROUPS`，Web、Android、iOS 禁止再维护第二份名单。PAR-003 只有以下九栏全部完成后才可关闭：

| 子项 | 完成条件 | 当前状态 |
| --- | --- | --- |
| 2026-09-01 | 历史自动标签从 Web 私有实现收敛到 `@cuberoot/shared/timer/history-tags`，统一 8 类 ID/双语/顺序/toggle/PB/ao/MBLD 规则；Web 与五端共用 `TimerHistoryTagBadges/Filter`，窄屏由组件自身折叠 `2 +N`、宽屏全显，匹配数为 polite live status。Client 定向 21/21、App UI 全集 222/222、shared/timer-ui/app-ui/client typecheck、Mobile/Desktop/Harmony Web build、Harmony unsigned HAP、iOS Simulator 编译与 Android `assembleDebug` 通过；8,788,904-byte APK SHA-256 `20d7047529134cd9577706ef3389ef386d32029355ffd0ac2073a44eb0298bda` 已覆盖安装到 OPPO `PFDM00`，回读 `base.apk` 字节一致 | 关闭 tag 数据源/UI 缺失、Web/App 双实现、ao 厘秒漂移、MBLD 伪 ao 标签、窄屏宿主重复分支和隐藏标签无完整读屏名的代码缺口。锁屏期间不记新 UI/TalkBack 为已验；App 智能魔方 `moves/stageSegments` producer 、bulk/compare 和完整历史面板仍待完成，整体继续 `ACTIVE — NOT COMPLETE` |
| UI / catalog | 43 项、顺序、分组、双语名、图标、焦点、Escape、点外关闭完全共用 | `进行中` |
| active state | 当前项目写入 shared `TimerStoreSettings.event`，重启恢复 | `进行中` |
| scramble correctness | 每个开放项目都有明确 provider；不支持必须显式失败，严禁 unknown/失败回退三阶 | `进行中` |
| history / stats isolation | 新增、修改、删除、统计只操作当前项目 bucket；切换不串数据 | `进行中` |
| attempt snapshot | 开始时冻结 `event + scramble`，停表后即使 UI 状态变化也写入同一上下文 | `进行中` |
| real/source config | 真题、随机、手动及比赛/日期/轮组/难度按项目能力与网站一致 | `未开始` |
| preview / notation | NxN 尺寸与异形项目 renderer/记号正确，不把所有项目画成三阶 | `进行中` |
| event-specific modes | BLD memo、MBLD、relay、trainer case、target/round/rank 等项目语义一致 | BLD memo 与 CFOP 分段已共享接线并通过自动化，其他模式及设备矩阵仍缺，故 `进行中` |
| device gating | 智能魔方只在共享 capability 允许时自动预备/停表，非兼容项目不得误触发；Solo、本地、联机三套矩阵已合入 shared 并遍历全部 43 项，仍待五端实体设备验证 | `进行中` |

核心防假功能测试必须遍历全部 43 项：选择项目后 resolver 收到同一 `EventId`，生成的哨兵打乱与保存的 `solve.event`/`solve.scramble` 一致，历史与统计只读该项目 bucket；异步旧项目结果不得覆盖新项目。仅截图显示菜单或只验证 3×3/2×2 样例均不算完成。

2026-08-30 当前能力基线必须如实保留：目录为 43/43；随机来源真正可生成 42 项（21 个 cubing provider、shared `222`、8 个 trainer provider、8 个 compound provider、Gear/Ivy 两个 shared provider，以及复用既有 `cstimer_module` 的 Kilominx/Master Pyraminx 两个 Worker provider）。`custom` 按 canonical 契约只走手动/空槽，不得伪造随机题。当前 129 个 `项目 × 来源` 格均有明确路由语义：127 格进入真题池、本地 provider 或手动队列，`custom` 的 Real/Random 两格进入网站同款的 ready 空槽并可计时；这不等于存在第 43 个随机生成器。在所有 preview/notation、case metadata、来源配置与真机逐状态等价前，PAR-003/004 仍不能关闭。二阶随机 11 类、真题 10 类及按步数已迁到 shared catalog/predicate/Worker；222/pyra/skewb 解法提示已共用，333/SQ1/Megaminx/Trainer/general solver 仍未等价。

### 5.2 打乱来源必须按网站逐项目做集合差分

禁止再维护一张“Mobile 支持项目”清单然后据此宣布完成。验收程序必须从网站 `/timer` 当前 registry/config 读取事实，生成并锁定下列矩阵：

| 维度 | 必须相等的内容 |
| --- | --- |
| 来源入口 | 每个 `EventId` 是否显示真题、随机、手动，以及默认来源 |
| 真题 | WCA event spelling、比赛池、比赛/日期/轮次/组别/难度选择、出处、空池、加载、错误、缓存和刷新 |
| 随机 | provider、记号、长度/难度/case 配置、生成中、失败和取消旧请求 |
| 手动 | 输入框、粘贴、是否校验、空值、清空方式、是否需要提交、刷新/历史、项目切换和重启恢复；必须与网站事实逐项相等，不能擅自增加“更合理”的校验或按钮 |
| 保存 | 开始时冻结的 `event + source + source config + scramble` 与最终 solve 完全一致，不串项目或来源 |

二阶真题与手动输入是当前已知的最低反例，修复它们只表示矩阵前两处差异关闭，不代表来源 parity 完成。测试必须遍历网站 registry 的全部项目和来源；网站新增来源或配置后，CI 应因集合不等立即失败，迫使 Mobile 同步或记录经所有者批准的平台豁免。

打印/PDF 同样属于完整功能矩阵：Web `more.print` 的内容、顺序、语言与打印样式必须成为单一事实源，五端只实现各自系统打印/分享 transport。中英文 PDF 都由 `core/packages/client/scripts/render-mobile-timer-pdfs.cjs` 从 `@cuberoot/shared/timer` + `@cuberoot/timer-ui` 的同一文档源生成，不维护第二套英文模板。验收至少包含中文 PDF 与英文 PDF 各一份，经真实 PDF 渲染检查确认无裁切、遮挡、溢出、乱码或缺页；只提供中文、只打开网站或另写宿主模板均不算完成。

2026-08-31 当前状态：打印报告 DOM、双语 copy、摘要/完整成绩表、来源与特殊成绩格式、按需快照生命周期均已进入 `@cuberoot/timer-ui` / `@cuberoot/shared/timer`，Web 与五端共用产品层消费同一组件；Android 只保留 `PrintManager + WebView.createPrintDocumentAdapter` transport，iOS 只保留 `UIPrintInteractionController + viewPrintFormatter` transport，Desktop/Harmony 仍需分别验收实际系统打印结果。当前输出目录中的中文、英文 A4 PDF 均为 7 页，已逐页检查宽度、长文本换行、嵌入字体、裁切、遮挡、溢出、乱码和缺页。OPPO Reno7 Pro 5G 已从共用 More 菜单打开 ColorOS 系统打印预览，中文报告可见；取消后返回 App，打印 portal 与 body class 均清理为零。iOS 同一 Mobile build 已由 Xcode 26.6 / iOS 26.5 Simulator SDK 编译成功，并安装启动于 iPhone 17 模拟器；iOS 原生打印面板、取消/完成与真机保存/输出仍待实证。因此只有 Android 设备打印链路已实证；其余四端仍待运行验收，整个 Timer 继续 `NOT COMPLETE`。

网站当前有 19 个 Timer `EventId` 映射到 17 个真实 WCA scramble `event_id`；映射必须来自 shared 单一表，Mobile 不得再维护名单。生产页另有一个必须如实登记的边界：来源为“真题”但当前项目没有 WCA 映射时，Web 保留“真题”选中并落到该项目自己的本地随机 provider；这不是 mapped 真题请求失败时的网络降级。Mobile 在完全一致阶段须复现同一来源解析：无映射只允许同 `EventId` provider，绝不能回退 333；有映射但真题加载失败则显示加载/错误，不得用随机题冒充真题。

#### 网站手动来源的精确基线（2026-08-30）

这里的“手动输入”是打乱队列，不是成绩手动录入。实现和审核不得凭常见产品习惯补功能，当前网站契约为：

1. 来源下拉第三项是“手动输入”；原文 textarea 立即持久化，没有提交按钮、独立清空按钮或 placeholder，删空文本即清空。
2. 同一份原文队列跨全部 43 个项目共享；每个非空行只做首尾 trim，随后作为 opaque 文本使用，不做项目记号或合法性校验。
3. 改动内容立即重置游标与打乱历史，从第一条显示；“下一打乱”和完成一把依次消费，到末尾循环。
4. 左右键只浏览已经显示过的打乱历史，不额外消费队列。
5. 刷新后原文仍在，但来源按网站设置加载规则强制回 WCA 真题；切项目继续使用同一队列。
6. 空队列显示“在上方「打乱来源」粘贴打乱,每行一条”。网站当前仍允许以空打乱开始和保存成绩；Mobile 若禁止开始就是行为差异，不能以“更安全”解释为一致。
7. 开始时必须冻结 `event + scramble`；哪怕计时中编辑队列或切换 UI 状态，保存也不能串到新上下文。
8. SQ1 等展示 adapter 可以无法渲染非法 opaque 文本，但存储的原文与成绩打乱不得被静默改写。

该基线来自网站源码与生产页面的来源切换、textarea 属性和空态实测；后续网站若改变，集合差分与本文必须同步更新。

### 5.3 对抗性审核门槛

任何“完整复刻”“完全一致”“全部做完”的结论必须同时具备：

1. 一份由源码/运行页面生成的 Web 可达功能清单，不能只靠人工记忆。
2. 至少两个独立 agent 审核：一人验证实现，一人专门寻找反例；审查者不得只重复实现者的测试样例。
3. 自动化集合差分为零、全状态截图/交互证据齐全，并由 OPPO Android 与 iOS 各自真机/模拟器验证。
4. 审核发现任一遗漏时，先把遗漏登记为 P0/P1 和失败 fixture，再修代码；不得仅口头补充。
5. 汇报必须同时给“已完成”和“仍缺”数量；不得用 43 项菜单、38 个 provider 或单张相似截图代表整体完成。

## 6. 每个工作包的完成证据

每项从“进行中”改为“完成”前必须记录：

1. 共享入口和两个真实消费者的源码位置。
2. Web、`@cuberoot/app-ui` 与受影响宿主的相关 typecheck/test/build 命令及通过结果。
3. 网站移动视口与 App 相同状态截图；视觉任务需保存可重复截图条件。
4. 所有可见控件的实际点击/键盘/返回结果，不以静态截图代替。
5. Android OPPO Reno7 Pro 5G 的 ADB 证据只算 Android；iOS、HarmonyOS NEXT、Windows 和 macOS 另记各自安装、启动和交互证据。
6. 涉及 BLE 时每个目标平台分别追加 GAN 16 UI 证据；模拟器、桌面本机构建或 unsigned HAP 不替代真实 BLE。
7. 独立 agent 的重复实现、跨包边界、假控件和遗漏状态审计结论。

### 6.1 UI/UX 不遮挡与无溢出硬门槛

以下任一失败都会阻止对应功能和整体 parity 标记“完成”，不得以“主要功能能用”豁免：

1. 视口覆盖：至少验证 320、360、390、412、768 CSS px；Android/iOS/HarmonyOS 设备补充竖屏、横屏、显示大小/字体放大和系统手势导航，Windows/macOS 补充小窗口、缩放与系统大字。
2. 固定层覆盖：系统状态栏、刘海/挖孔、安全区、底部三栏、toast、更多菜单、modal、软键盘出现时，当前焦点、主要动作和最后一行内容仍可见且可触达。
3. 长内容：43 项项目菜单、最长中英文项目名、长比赛名、长打乱、长备注、错误文案与登录 provider 全量渲染；不能只测短样例。
4. 弹层：锚定菜单必须做视口 clamp；首尾项目均能滚动到并点击；关闭后焦点返回触发器；不得越过可见左右边缘或藏在底栏后。
5. 溢出断言：`documentElement.scrollWidth <= clientWidth`；关键控件 `getBoundingClientRect()` 落在可见区域；滚动容器首尾可达；截图没有裁切、重叠、低对比度或意外省略。
6. 键盘与读屏：邮箱、手机、搜索、备注等输入框聚焦后不得被软键盘遮住；TalkBack/VoiceOver 焦点顺序与视觉顺序一致，触摸目标不因缩放重叠。
7. 对照方式：相同语言、主题、项目、来源和数据 fixture 下，将网站移动视口与 App 截图逐状态对照；单张首页截图不能代表菜单、加载、错误、空态、计时中或键盘态。

## 7. 固定审核清单

独立审核至少检查：

- `@cuberoot/app-ui` 或任一宿主是否 import/复制了 `core/packages/client` 私有源码，或出现 app→app import。
- Web 与五端 App 是否还存在相同名字但不同实现的计时 UI、状态机或 CSS。
- 所有看起来可点击的元素是否是真 `<button>`、`select`、链接或具备完整键盘语义的控件。
- App 是否用“即将推出”、无响应、浏览器跳转或静态占位冒充网站已有能力。
- 网站新增/删除 `/timer` 控件时，是否同步更新本矩阵和跨端截图/交互测试。
- 平台豁免是否确属系统能力差异，而不是为了省实现成本。

## 8. 当前证据日志

| 日期 | 证据 | 结论 |
| --- | --- | --- |
| 2026-09-01 | 成绩对比的选择/清理/比较模型进入 `@cuberoot/shared/timer/history-compare`，完整 modal/status/actions/CSS 进入 `@cuberoot/timer-ui`；Web 删除私有 `CompareSolvesModal`，五端 App 消费同一组件。选择状态携带 session+event context，render-time gate 在 passive effect 前即拒绝跨上下文同 ID；Android Back 顺序为关弹层、退对比模式、离开历史。结果覆盖普通/+2/DNF/DNS/FMC/MBLD，阶段优先读已存 `stageSegments`，旧数据才回退 shared producer。四包 typecheck、Web 2 files / 32 tests 与 App 1 file / 5 tests 通过；Debug APK SHA-256 `9aed714e5107dfdd424556391d0bdc8348ad2aa2aa9440eaf28818795ed258a0` 已覆盖安装到 OPPO `PFDM00`（`me.cuberoot.app.debug`，`lastUpdateTime=2026-09-02 04:24:10`） | 关闭 Web/App 两套成绩对比 UI/业务、跨 session 同 ID 串选、删除后幽灵弹层、Android Back 幽灵模式、5ms 边界和 MBLD 缺 payload 伪持平。设备仍锁屏，故只记构建/安装，不记真机视觉和点击通过；完整详情/复盘/统计继续未完成 |
| 2026-09-01 | 网站私有 cube state、CFOP 检测/识别、HTM、朝向归一化和 stage producer 迁入 `@cuberoot/shared/timer/reconstruct/*` 与 shared `stageSegmentsFor`；网站旧入口仅兼容 re-export。Web Solo、Web 本地/联机与五端 App 共用 `TimerSmartCubeMoveRecorder`，锁定第一手 `ts=0`、时间回退/NaN 非负单调、take reset；App 在起表快照设备和原 session，停表后把 `moves/device/stageSegments` 作为同一成绩保存。仓储以稳定 ID 幂等重试一次；持续失败时 App 保留带原 session 的待保存成绩并常驻重试入口，成功后才移除，原 session 被删除也不会误写当前 session。真实 64 通知 fixture 继续得到 OLL 44、PLL T、HTM `[6,25,7,12]`；App UI 34 files / 229 passed，producer 定向 6 files / 60 passed / 7 skipped，repository/时序 3 files / 41 passed；Client 全量主段 573 files passed / 10 skipped、6,651 tests passed / 127 skipped，补充段 1 file / 12 passed。shared/app-ui/client typecheck、Mobile/Desktop/Harmony Web build、Harmony unsigned HAP、iOS Simulator、Android 304-task assembleDebug 与 macOS Tauri 原生 bundle 通过。8,788,904-byte APK SHA-256 `65ea300af612de852f515fec72d29b16fb416e1a3ffd51ab867a92b28b1bb31a` 已覆盖安装到 OPPO `PFDM00` 且回读字节一致；6,297,645-byte macOS x64 DMG SHA-256 `94af17fe41d3dade835ebe929a83858d6d2ea0ff2acfc386c5fea29bf3d61fea` 通过 `hdiutil verify`，未签名 `.app` 已启动 | 关闭 App 丢弃动作流、无设备快照、无分段、跳O/跳P不能自产，以及 Web/App 第二套 producer/move buffer、持续写失败后无恢复入口和重试串 session 的源码缺口。手机仍锁屏，只证明 Android 构建、安装、启动进程和无 crash/ANR 日志；GAN 16 UI 实拧、首/末手、断连后手动停表和标签/TalkBack 必须解锁后实测。Windows 本轮仍只有共享 Web bundle 与未实跑当前提交的 Windows CI 定义，不记原生构建；整体继续 `ACTIVE — NOT COMPLETE` |
| 2026-09-01 | 智能魔方逐步提示、匹配判定、偏离修正 requester 与 Solo lifecycle controller 进入 `@cuberoot/shared/smart-cube`，Kociemba `inverseCubie` 收敛到 `@cuberoot/puzzle-solvers`；网站与五端只留 facelets、Worker、预备回调和 BLE adapter，并共用 `TimerScrambleStrip`。Solo、本地、联机分别消费 shared 的 3×3-shaped（排除 FMC）、仅 `333`、`333/333oh` capability；同 target pending 请求 coalesce，新 target 会在旧 Worker 后续跑；协议错会断开且拒绝晚帧；只有真实 move 到 target 才预备，连接/切模式时 state 相等不会误预备，连接、停表或切题后会重放当前 authoritative facelets。Client 全集 572 files / 6,657 passed / 127 skipped，App 全集 34 files / 222 passed，Mobile 6 files / 18 passed；controller 增量行为 6/6、Client 定向 6 files / 94 passed / 3 skipped；shared/app-ui/client/mobile typecheck、Desktop Vite、Harmony unsigned HAP、Android assembleDebug、Xcode Simulator build 均通过。360×749 production 预览实测本地多人 BLE 按钮 `position=static`、44px 高、边界 12～111px、文档宽 360/360，底部 544px 未压 688px 导航；联网同一真实选择器由 CSS contract 锁定，未创建生产房间。Debug APK（applicationId `me.cuberoot.app.debug`）为 8,788,904 bytes，SHA-256 `5cc6b17112332c4c1e814b7495852365f761e951f0ee6b6fc8d046b3b7935ce7`，已覆盖安装到 OPPO `PFDM00` 且与设备内 `base.apk` 字节一致 | 关闭提示算法、修正 requester、Solo lifecycle、模式门禁与 Kociemba 运算的重复实现，并关闭非兼容项目仍被 GAN 自动起停、协议错后晚帧、state effect 误预备、pending 切题/重连丢请求、连接或切题时首步提示丢失及多人 BLE 按钮绝对定位遮挡的代码缺口。当前只证明最新 APK 构建与安装，手机锁屏期间不能把启动画面或实体魔方操作记成通过。新版 OPPO + GAN 16 UI 逐步提示/故意偏离/修正完成、首个 Worker 冷启动延迟，及 iOS/Harmony/Windows/macOS 真机 BLE 仍待验，整体继续 `ACTIVE — NOT COMPLETE` |
| 2026-09-01 | `scrambleClickAction` 的 `none/next/copy` 枚举、默认 `copy`、normalizer 与 App 持久化进入 `@cuberoot/shared/timer`；Web 与五端产品层改为消费同一 `TimerScrambleClickActionSetting`，App 打乱条按设置执行无操作/换题/复制，错误态仍优先重试；Web 同样复用既有 `attemptCanStart`，真题空集/训练题不可用时不再误触发“换题”。Client 4 files 36/36、App 全集 32 files 210/210，shared/timer-ui/app-ui/client/mobile typecheck、Mobile production build、Capacitor Android sync 与 Android 274-task `assembleDebug` 通过；独立 agent 三轮审查当前 diff | 关闭“App 永远写死点击复制”、Web/App 各维护一套选择控件、枚举双事实源及 Web 不可用状态仍可换题的源码反例；旧 App 数据缺字段时安全落到网站当前默认 `copy`，显式坏值拒绝。该行记录的是提交 `22ee49e14` 时尚无 OPPO 三动作证据的快照；OPPO 缺口已由下方同日 Clipboard 真机行关闭，iOS/Harmony/Windows/macOS、智能魔方修正与完整视觉矩阵仍缺，整体仍 `ACTIVE — NOT COMPLETE` |
| 2026-08-31 | 五端 React 产品组合已收敛到 `@cuberoot/app-ui`，Mobile、Desktop 与 Harmony 只消费其公开入口；Desktop 的 Tauri BLEC 和 Harmony 的 ConnectivityKit transport 均接同一 `useInstalledSmartCube`/GAN 逻辑。macOS `.app` 已本地启动、未签名 DMG 已校验；Harmony unsigned HAP `BUILD SUCCESSFUL`；Windows 只有未实跑 CI 定义，Harmony 当前无 `hdc` 设备 | 关闭“后三端必须复制 Mobile 产品层”的架构反例，但没有关闭任何跨平台 Timer 功能项：macOS/Harmony 无 GAN 16 UI、完整互动与签名证据，Windows 无构建/安装证据，五端 `/timer` 继续 `ACTIVE — NOT COMPLETE` |
| 2026-08-31 | `@cuberoot/app-ui` 已接真实 `LocalBattleMode`/`NetBattleMode`，1/2/3/4/net 不再只读或浏览器 fallback；Mobile、Desktop、Harmony 三宿主均注入联机 client/session contract。定向 capability、local reducer 与 mode integration 为 3 files、13/13 tests 通过 | 关闭“App 只有 1 人/联机无本地页面”的陈旧当前描述；Web 仍有另一套 Battle/Net React 视图，完整设置/历史/视频/多 BLE、staged API 部署、双设备和五平台 UI/UX 矩阵未完成，PAR-001/002/015/016 继续 `进行中` |
| 2026-08-30 | OPPO `PFDM00` 当前页 ADB 截图 | 真题页出现重复比赛名；“1人”点击无响应 |
| 2026-08-30 | `App.tsx` 与网站 `TimerShell`/`SoloView` 源码对照 | Android 的人数、项目、解法存在静态外观；完整一致尚未成立 |
| 2026-08-30 | `git fetch origin` 后 `HEAD...origin/main = 0/0` | 本轮以最新远端为基线，继续保护现有未提交 Mobile/BLE 改动 |
| 2026-08-30 | 共用 `TimerPlayersSelect` + Web/Mobile 定向测试 | “1人”无事件根因已消除；2～4 人/联机宿主仍是 P0 缺口 |
| 2026-08-30 | 删除 Mobile 重复来源条并重装 OPPO | `Brockport Bolt 2025` 只显示一次，等待后续完整视觉矩阵审核 |
| 2026-08-30 | 独立 agent 统计 Web 私有 shell/Battle/Net 与共享 UI 覆盖 | 当前远未完整一致；静态 3×3、解法、麦克风和简化统计/更多仍是明确缺口 |
| 2026-08-30 | 独立 agent 检查依赖边界 | 当前没有 Mobile → client deep import；GAN 核心复用方向正确，设备覆盖仍待扩展 |
| 2026-08-30 | 独立 agent 全量项目审计 | Mobile 的打乱、成绩、统计、预览、真题和智能魔方主链均曾硬编码 333；只换菜单会产生严重假功能 |
| 2026-08-30 | `TIMER_EVENT_PICKER_GROUPS` + `TimerPuzzlePicker` + 24 项定向回归 | 43 项目录已进入 shared，Web 已消费共用 React 控件；Mobile 事件主链和剩余 provider 仍在迁移，不能标完成 |
| 2026-08-30 | OPPO 真机 CDP：项目菜单 43/43；选择二阶后为 11 步 U/R/F 打乱、真题禁用、随机启用；页面 reload 后仍为二阶 | 项目选择、二阶 provider 与持久化主链真实可用；其余 41 项和视觉边界仍按全量矩阵待验 |
| 2026-08-30 | 用户明确要求检查遮挡、看不清和溢出 | PAR-020 升为进行中的硬门槛；以后任何“UI 一致”结论必须附多视口、长内容、键盘、安全区和弹层证据 |
| 2026-08-30 | OPPO 项目菜单真机截图 + CDP computed style | 首轮发现 Mobile 宿主缺少 `--popover`/`--faint-foreground`，浮层透明并与计时数字、打乱图重叠；功能通过不等于视觉通过 |
| 2026-08-30 | 补齐 canonical theme token，并给共用 `TimerPuzzlePicker` 增加旧 WebView 运行时窄屏判定后重装 | 360×749 下菜单为不透明单列；43 项首尾可滚动触达；panel bottom 570 < 底栏 top 689；`scrollWidth === clientWidth === 360`。这是项目菜单单状态通过，不代表 PAR-020 整体完成 |
| 2026-08-30 | 独立 no-dup agent 的 package/能力扫描与定向回归 | app→app/deep import 边界通过；非法 event 不再伪装成 333；Web NXN 映射已改为 shared 薄导出。Web 私有打乱 fallback、两类 picker primitive、real-source 映射和大部分生成 runtime 尚未单源，PAR-022 保持未完成 |
| 2026-08-30 | 独立项目 agent 逐个调用真实 provider | 22/22 开放项目生成非空；20 项 fail-closed unsupported，`custom` 缺输入 UI；没有 333 fallback。目录完整不等于项目功能完整，当前真实可练 22/43 |
| 2026-08-30 | OPPO + Playwright 项目菜单矩阵：360×749、320×568、749×360、360×420 键盘缩高、150% 中英大字号、明暗主题四格 | 43 项首尾可达，最长名称无 item overflow，popup 不压底栏且无横向溢出；该证据只关闭项目菜单的视觉子状态，不代表整个 timer 的 PAR-020 完成 |
| 2026-08-30 | 所有者指出二阶真题被禁用、手动输入缺失 | 上一轮只审了 Mobile provider/capability，没有与网站逐项目逐来源做集合差分，审查结论作废；BASE-08/09 与 PAR-004 升为 P0，并新增零遗漏矩阵和双 agent 对抗审核门槛 |
| 2026-08-30 | shared 19 项 WCA map + per-EventId pool/cache + exact API event tests | 二阶等 mapped 项目不再被禁用或错取 333；完整比赛/日期/轮组/类型/步数配置仍是 P0 |
| 2026-08-30 | shared 三项来源选择器 + shared manual editor/queue + Mobile 129 格对抗矩阵 | 手动基本队列可用；当前 88/129 来源格可路由，41 格缺 provider，整体仍 `NOT COMPLETE` |
| 2026-08-30 | `LatestSnapshotGate` 6 个乱序/恢复 fixture + App 全 mutation revision 接入 | 旧 repository 完整快照不再覆盖较新的手动输入；最新失败会 reload canonical store |
| 2026-08-30 | shared compound provider 组合现有 child generators，覆盖多盲/6、7 阶盲拧/2～5 接力/Magic/Master Magic | 新增 8 项可生成且无第二套 child provider；专用展示、录入、memo 和统计仍缺 |
| 2026-08-30 | shared trainer provider 对 712 个可寻址 case 做 inverse invariant，并让 Web adapter 与 Mobile runtime 共用 `ll/oll/pll/coll/cmll/zbll/eg1/eg2` | 随机可生成提升到 38/43，129 格可路由提升到 119；Mobile 仍丢弃 case metadata，缺 subset/case stats。源码复核确认 Web 对这些 case 项目当前没有逐题答案条，不得把“答案”写成既有 parity 要求 |
| 2026-08-30 | Gear/Ivy shared provider + 既有 GPL `cstimer_module` 的 Kilominx/Master Pyraminx 单一引擎入口；Web/Mobile 只留 Worker/pool adapter | 随机可生成提升到 42/43，129 格可路由提升到 127；`custom` 仍是 manual-only，整体仍 `NOT COMPLETE` |
| 2026-08-30 | 独立功能对抗审计：Mobile 2～4 人/联机仍外跳，解法仍是假文字，缺手动成绩、DNS/FMC/MBLD、session、完整 history/stats/settings/More/reconstruction | 这些全部登记为 P0；打乱来源进展不能代表整个 Timer 完成 |
| 2026-08-30 | Web/Mobile 日期范围改为共用 `@cuberoot/timer-ui` DateRangeInput；ISO 日历规则进 shared；起止互限、逆序拒绝、清空、ARIA、visual viewport 与 raw-input guard 定向回归 | WCA 日期配置不再有 Mobile 第二套控件；其他来源配置与全视口仍待验 |
| 2026-08-30 | shared 2×2 专项状态生成器 + 共用 Worker RPC/pool；生产浏览器与 OPPO WebView 103 实测 EG1、EG2→CLL 快速切换、No Bar、3-gen | 专项打乱不再依赖 Mobile 复制的 csTimer；真机生成约 0.43s，快速切换没有旧类型覆盖新槽，样例通过 canonical state predicate；仍须补 11 类全量真机矩阵 |
| 2026-08-30 | OPPO 手动打乱 textarea 打开真实软键盘：可见高度 749→461，底栏 401～461，输入框 56～135，`scrollWidth === clientWidth === 360` | 当前焦点、输入框和底栏未被 IME 遮挡且无横向溢出；只关闭该输入态，不代表所有弹层/横屏/大字的 PAR-020 完成 |
| 2026-08-30 | 生产 `/zh/timer` 运行页面逐项打开“更多”和 8 类设置，并从可访问树提取完整控件集合 | 当时的 333 桌面上下文可见 9 个 More 动作；把 compact/drill/BLD 条件分支合并后的全局并集是 12 项。设置含计时/智能魔方/打乱/训练/外观/声音与节奏/数据/高级 8 类；Mobile 仍缺大量真实 effect，不能用简化页声称一致 |
| 2026-08-30 | shared 手动成绩规则与 `TimerManualEntryModal`；Web 薄 wrapper；Mobile More + repository；Web 38 / Mobile 42 定向回归 | 普通时间、四类罚时、FMC、MBLD、打乱、备注、IME、焦点与窄屏契约已单源；仍待 OPPO 弹层/软键盘/返回实证，整体仍 `NOT COMPLETE` |
| 2026-08-30 | shared `timerScrambleAllowsEmptySlot` + Mobile custom/manual attempt snapshot 回归 | `custom` 的 Real/Random 复现网站 ready 空槽并显示 `—`；129/129 来源格都有明确路由语义，但随机生成器仍诚实保持 42/43 |
| 2026-08-30 | shared strict competition index + 中英比赛名/城市搜索 + canonical `CountryFlag`；Web/Mobile 共用 `TimerWcaSourceConfig`；Mobile Vite 产出离线 Chinese Taipei SVG；113 项定向回归与三包 typecheck/build | 比赛/日期、搜索、国旗、清空、轮次/组别不再是 Mobile 私有简化实现；单 JSON 内重复 ID fail-fast、past/upcoming 重叠由 upcoming 胜出；完整难度/出处元数据/真机全矩阵仍未完成 |
| 2026-08-30 | 重启 Next dev 使新增 `@cuberoot/puzzle-solvers` exports 生效；`curl /zh/timer` 返回 200；Chrome 360×749 读到 `scrollWidth=innerWidth=360`、`scrollHeight=innerHeight=749` | 先前 `piece-blocks` 解析 500 是热进程未重读 package exports；网站手机首帧无页面级溢出。该证据只是 Web 基线，不能替代 Android 同状态截图 diff |
| 2026-08-30 | shared session 不可变操作 + 共用 `TimerSessionSwitcher` + Web storage/Mobile repository adapter；Web 4 files 22/22、Mobile 3 files 20/20，shared/timer-ui/mobile typecheck | create/switch/rename/clear/delete、项目关联、失败回滚、串行持久化和重启隔离已单源；Mobile 仍缺自动按项目匹配 session 的设置入口与成绩“移动到分组”入口，BASE-07/PAR-010 保持进行中 |
| 2026-08-30 | OLL/PLL/ZBLL canonical JSON 机械生成 shared timer projection：1,534,414 B → 31,766 B；generator `--check`、trainer 23/23、boundary guard 17/17、35 项生成物登记检查通过 | Web/Mobile trainer 不再各自维护 case 数据，`@cuberoot/shared/timer` 恢复 runtime-neutral，避免把 1.5 MB 原始资产塞进 App bundle；subset/case stats/metadata UI 仍待完整迁移，Web 当前无逐题答案条 |
| 2026-08-30 | 非 2×2 按步数稳定层复跑：puzzle-solvers 2 files 10/10、Web 7 files 52/52、Mobile adapter 1 file 20/20，shared typecheck/架构/生成物检查通过 | Pyraminx/Skewb/Ivy/Gear 的 canonical 引擎、Worker host 的切换/取消/stale/error/cache 与两端 adapter 已锁定；仍待 difficulty 释放 App/real-pool 后完成 activeEvent 接线与真机全配置实证 |
| 2026-08-30 | Next 重启后 Chrome 实页逐项验证：Skewb WCA 7–11/默认 8–10 且样题 predicate=9；Pyraminx 自动归一 V/3–5 且真题=3；Ivy HTM 5–7、本地题=5；Gear FTM 4–5、本地题=4；四页 console/build overlay 均为 0 | Web 非 2×2 按步数 UI、真题过滤和本地 Worker runtime 已实证；该证据不替代 Mobile App 接线与 OPPO 真机矩阵 |
| 2026-08-30 | Mobile non-2×2 接线与对抗回归：8 files 85/85 + typecheck；锁定 Pyraminx/Skewb canonical predicate、Ivy/Gear retained-Real identity、legacy cache、A→B→A/cancel/stale/loading/error/cache | App 的 random/retained-Real 步数变更现在进入完整 source identity 并取消旧请求；Pyraminx/Skewb 不再误收 event-only 旧缓存。仍待 APK/OPPO 全项目触摸与视觉实证 |
| 2026-08-30 | Mobile 宿主补齐 canonical `--shell-chip`，theme contract 1 file 6/6 | 共用解法等 chip 不再因宿主缺 token 透明；仍需真机浅/深主题、长内容和遮挡截图验证 |
| 2026-08-30 | WCA difficulty/optimal/merge 纯契约与 transport cache/inflight 迁入 `@cuberoot/shared/timer`，完整受控 UI 迁入 `@cuberoot/timer-ui`；Web/Mobile 只注入 URL/fetch/localization adapter；Mobile 6 files/68 tests、shared contract 19/19、UI interaction 3/3、persistence 11/11 + 17/17、Mobile typecheck 与 architecture boundary guard 通过 | 锁定完整 random query/identity、competition by-difficulty、合并项目真实 event provenance、`steps_layout.json` 404 静态回退、unindexed bypass、503/缺最优/权威空分型及卸载前 range flush；仍未完成随机难度、完整用户文案、OPPO 320/340/IME/全配置真机矩阵，整体 Timer 继续 `NOT COMPLETE` |
| 2026-08-30 | Mobile Vite + 系统 Chrome 对 WCA difficulty 做 340×568 / 320×568 smoke：首次发现横向 fieldset 把 Optimal/Merge/Difficulty 压成重叠三列，改为全宽纵向 section；Web/Mobile 共用搜索框不再为空值预留 44px 清除位。中英两档复跑均为 `root/body scrollWidth === innerWidth`、difficulty viewport overflow=0、5 个 select/range 可聚焦、键盘开关与 range `ArrowRight` 6→7 | `Search competition` 在 320px 可用 148px、实测文字 117.6px；中文 195px/51.6px；颜色完整显示 `CN/六色 · BGORWY`。最长英/中 loading 与 44px 刷新按钮矩形不相交，截图 `/tmp/cuberoot-mobile-wca-final-{en-US,zh-CN}-{320,340}.png`；仍不替代 OPPO、IME、横屏、150% 字号、长比赛名/错误文案全矩阵 |
| 2026-08-30 | shared 成绩历史动作/筛选合同 + Web `HistoryPanel`/`SolveModal`/`SoloView` 真实 consumer；Client 精确 fixture/集合差分 1 file 7/7、shared typecheck、i18n guards 2 files 4/4 | 7 个行级动作、5 个详情动作、8 个筛选及不可变罚时/备注/删除/移组目标规则不再由 Web 私有实现；Mobile UI、批量/对比、完整详情/复盘/统计与真机视觉仍缺，整体继续 `ACTIVE — NOT COMPLETE` |
| 2026-08-30 | 222/pyra/skewb 解法提示迁入 runtime-neutral `@cuberoot/puzzle-solvers/timer-small-hints` 与共用 `@cuberoot/timer-ui/TimerSmallPuzzleHints`；Web 的 2×2/Skewb 历史实现改成薄 adapter；2 条/项目逐公式 golden、旧 adapter 等价、展开/关闭/loading/error/空 face/全空/stale/运行淡出、Mobile event-only 空打乱共 17 项定向回归通过 | Mobile 静态“解法”已删除；完整还原与六面/四 V/六面答案单源。系统 Chrome 340×760 与 320×700 实测 DOM 顺序 `TimingSurface → StatRail → hints → DeviceActions`，展开后相邻矩形不重叠、`scrollWidth === clientWidth`、键盘 Enter 与 focus ring 生效、底部可滚动触达。333 StageSolver/六方法、SQ1、Megaminx、TrainerCaseBar 与 More general solver 仍明确 `NOT COMPLETE`，且该证据不替代 OPPO/iOS 真机 |
| 2026-08-30 | shared `settings-contract` 登记 8 类/63 个偏好与命令 surface；Web 类别/字段 copy 与 8 个计时字段默认/normalizer 真实消费；Web legacy `inspection`→`inspectionSec` 与 Mobile 宽范围 timing migration fixture | 当日快照：新 Web 字段会由 exact source-set/类别计数守卫暴露；新 Mobile store 默认 hold 统一为 550，旧 300 作为有效自选值保留。当时 Mobile 仍只有观察/hold 两个旧 effect；该状态已由下方 2026-08-31 的 8/8 共用 UI/OPPO 证据取代，其余 7 类设置仍缺 |
| 2026-08-30 | 333 六方法引擎迁入 `@cuberoot/puzzle-solvers/timer-333-step`，共用 `cube-moves` / 3×3 facelet / Thistle 子路径；Web `StepSolve`、`SolverCompareModal` 与复盘参考直接消费包，旧私有路径只留 identity re-export；package 4/4、Web migration/package/F2L 13/13、puzzle-solvers typecheck 与 boundary guard 通过 | 精确锁定 CFOP/Roux/Petrus/ZZ/EODR/Thistle 的顺序、阶段和 move 输出；取消的旧题不得 publish，异常显示 error 而不伪造 0 步结果。`/zh/timer?event=333/222` 均 200 且无 build overlay；Mobile 尚未接 333 React 面板/StageSolver Worker，因此 BASE-03/PAR-006 与整体继续 `NOT COMPLETE` |
| 2026-08-30 | Web `SoloView.moreItems` 的 12 个稳定 action、顺序、compact/event/drill 条件、disabled 与 effect contract 迁入 `@cuberoot/shared/timer`，菜单 React/图标/焦点/Escape/外点/visualViewport 钳位迁入 `@cuberoot/timer-ui`；Web 改为薄 adapter。Mobile 精确接通打乱足迹、语言、全屏、手动录入、清空当前项目 5 项；Web 2 files 24/24、Mobile 2 files 23/23、More 5/5、三包 typecheck 与 Mobile build 通过 | Mobile 不再显示旧历史/导入/导出/打开 Web timer 假 parity 菜单。系统 Chrome 320×568 英文与 340×640 中文实测 `scrollWidth === clientWidth`，长文案、焦点、菜单与共享手动录入弹层无横向溢出。完整统计、专项、BLD 助手、replay、通用求解器、批量打乱、打印共 7 项仍是明确缺口；打乱足迹 iframe 与全屏仍待 OPPO 真机实点，整体继续 `ACTIVE — NOT COMPLETE` |
| 2026-08-30 | Web 键盘与八向触摸事实源迁入 runtime-neutral `@cuberoot/shared/timer/input-contract`；旧 keymap 路径变为 identity re-export，`SoloView` 只分类 DOM target/执行命令，`useGestureWheel` 与默认标签消费共享阈值/方向合同；keymap + exact/golden/migration 2 files 33/33、输入相关 guards 3 files 32/32、shared typecheck 通过 | 锁定 7 个可改键 action、8 个默认绑定、6 个保留 chord、Digit2 优先、modal/input/data-no-timer/running 先后、八向 next/OK/+2/DNF/prev/note/delete/copy、mouse 10/44 与 touch 18/90/200ms；Mobile 仍未接轮盘、改键、任意键停表/撤销，PAR-013 与整体继续 `ACTIVE — NOT COMPLETE` |
| 2026-08-30 | Web 私有 `stats_buckets` 与 `rolling_stats` 纯逻辑迁入 `@cuberoot/shared/timer`，旧路径只保留 identity re-export；`StatsModal` 真实消费 shared 日期范围与连续练习天数；本地日、ISO 周、跨月/跨年、半开窗口、rolling cutoff、streak、mo3/aoN 解析/迁移/替换与统计 golden 共 3 files 25/25，shared typecheck 通过 | Android 后续完整统计、日统计、rolling 列必须直接消费同一算法，不能再造一套；完整 StatsPanel/五类图表/records/case UI 仍未迁入 Mobile，PAR-011 与整体继续 `ACTIVE — NOT COMPLETE` |
| 2026-08-30 | Web 紧凑 `StatsPanel`、`RollingStatsPicker` 与 canonical `CompactSelect` DOM/CSS 迁入 `@cuberoot/timer-ui`；Web wrapper 只注入 `tr`、设置写回与 `RecordBadge`；共享 UI/迁移/rolling 回归 4 files 34/34、i18n 3 files 5/5、catalog 2 files 42/42、timer-ui/shared typecheck 与 boundary guard 通过。系统 Chrome 320px 中文暗色、340px 英文亮色实测统计行和 Sub-X 不换行、文档无横向溢出，popup 在视口内且自定义 placeholder 完整可读；340px 四主题矩阵（系统亮/暗、显式亮/暗反置 OS）颜色两两一致、popup 对比度 17.93/12.93，均无横向溢出 | 当日快照只建立 Web consumer；“Mobile 尚未接入”已由下方 2026-08-31 的 Mobile/OPPO 证据取代。完整 StatsModal、五类图表、records/case/跨分组与 iOS 证据仍缺，PAR-009/011 及整体继续 `ACTIVE — NOT COMPLETE` |
| 2026-08-30 | Web 私有 `GestureWheel`、`useGestureWheel` 与轮盘 CSS 迁入 `@cuberoot/timer-ui`；`/timer` 与 `/alg` 训练页直接成为真实 consumer，旧 Web 三路径只留 identity re-export/CSS import；轮盘 DOM/中英标签/方向几何/disabled/highlight、mouse/touch hold-drag-cancel 与迁移守卫 2 files 28/28，timer-ui typecheck、i18n/theme/architecture guards 59/59 通过 | 八向 React UI、pointer lifecycle 与视觉 token 不再由 Web 私有维护；Mobile 尚未渲染/绑定该轮盘，也仍缺撤销 toast、改键与任意键停表，未做 OPPO/iOS 交互，因此 PAR-013 与整体继续 `ACTIVE — NOT COMPLETE` |
| 2026-08-30 | Mobile 已显示打乱改为 shared `ScrambleHistory` 单一游标；精确冻结 event/source identity/source snapshot/caseId/真题 occurrence/availability，并接上一条/下一条、solve 后前进、左右键、44px 触摸入口与 fullscreen CSS/API fallback/Android back。Mobile History 同时接 shared 7 quick actions、基础筛选和 move-session target；定向 4 files 57/57、Mobile typecheck、Vite build、diff check 通过。系统 Chrome 对 production build 做 320×568 smoke：timer/history 均 `scrollWidth=innerWidth=320`，两枚打乱按钮为 44×44 且落在 14.4～305.6px；History 7 个 action ID 全量可达，日期/时间/case 输入与 quick action 全落在 20～300px | 回看两条文本相同的 WCA 真题后计时会保存被回看 slot 的 exact occurrence provenance；context reset 与 async stale completion 不会覆盖新 slot。tag/对比/批量/完整详情/复盘/统计图仍缺；fullscreen、History 与整套导航尚未在已锁定的 OPPO 真机实点，因此整体继续 `ACTIVE — NOT COMPLETE` |
| 2026-08-30 | Mobile 真题普通/date 池、merge、cache、live+2×2 类型/按步数预计算统一复用 shared `timerWcaCompetitionScrambleSlotIdentity`；v6 cache 主动失效曾按文本丢 occurrence 的 v5 envelope。定向 fixture 锁定相同文本的两个官方 slot 都保留、相同 slot 重复页只留首条、重启后 provenance 不丢 | 修复缓存与预计算层在 history 之前吞 occurrence 的 P0；没有新增 Mobile 私有 identity 或 Web deep import。OPPO/iOS 与其余 Timer 矩阵仍未完成，整体保持 `ACTIVE — NOT COMPLETE` |
| 2026-08-30 | Web“计时”分类的 8 个字段已迁入共用 `TimerTimingSettingsSections`：顺序、双语标签、4 段 section、布尔/整数/枚举 row、hold 范围及两类精度选项均直接消费 shared `settings-contract`/normalizer；Web `SettingsPanel` 只注入既有 `BoolToggle` 外观与持久化 adapter，不再登记第二份字段。组件 DOM/交互与 source-set 回归 2 files 12/12；连同 i18n/theme/catalog/component/architecture guards 的选定套件共 10 files 91/91，`timer-ui` typecheck 与 boundary audit 通过；本地 `/zh/timer` 200，Chrome 实页完整读到 8/8 ID，默认视口及 320×568 均为 modal/main/document 横向溢出 0、console error 0 | 当日快照中 Mobile 尚未成为 consumer；该状态已由下方 2026-08-31 的 Mobile 8/8 接线与 OPPO 证据取代。其他 7 类设置、逐字段真机效果和 iOS 视觉矩阵仍缺；PAR-012 与整体继续 `ACTIVE — NOT COMPLETE` |
| 2026-08-30 | Web Solo/NetBattle 的打乱公式 DOM、空态壳、字体档位、长文本折行、最后一步复制绿勾、智能魔方当前转动、匹配/修正反馈与点击/键盘激活迁入 `@cuberoot/timer-ui/TimerScrambleStrip`；两处 Web 视图成为真实 consumer，旧 `ScrambleHintText` 只留 identity re-export。组件/迁移/窄屏合同 1 file 6/6，catalog/component/theme/architecture 选定回归与 timer-ui typecheck 通过；client typecheck 只剩既有 `.next` pb/wb 4 条陈旧路由错误。系统 Chrome 320×568 实页点击复制出现绿勾，注入 500 字符无空格长题后 `document.scrollWidth=innerWidth=320`、strip `scrollWidth=clientWidth=294`、左右边界 12.8～307.2px | 当日快照中 Mobile 尚未渲染；现已由 Mobile `TimerScrambleStrip` consumer 与离线 LiberationMono 资产取代。完整 OPPO/iOS 长题、复制、智能魔方反馈和全视口触摸证据仍缺；整体继续 `ACTIVE — NOT COMPLETE` |
| 2026-08-30 | `@cuberoot/timer-ui` 为项目、打乱来源、WCA 比赛建议和 session 弹层统一增加可选的受控 `open/onOpenChange`，并用 `TIMER_OVERLAY_IDS` + close reason 报告触发、选择、点外、Escape、禁用等来源；不传 props 时 Web 继续使用原非受控 UI/UX。Mobile 现用唯一 `openOverlay` 受控接入这 4 个弹层，Android Back 在 More、手动录入、全屏、计时阶段和页面导航之前先关闭共享弹层；Capacitor listener 的异步注册/卸载竞态也已 fail-safe 清理。4 个 Mobile 定向文件 29/29、Mobile typecheck 通过；原 Web consumer 31/31 与 timer-ui typecheck 证据保留 | 该接线没有复制菜单状态机，并让 popup 打开时键盘/径向触摸计时受抑制。History row menu 仍需 solve-id/锚点所有权设计，More、手动录入及其余 modal 尚未全部纳入同一 overlay registry，且 OPPO/iOS 系统返回与焦点恢复矩阵未实测；`modal.close-contract`、PAR-013/PAR-020 与整体继续 `ACTIVE — NOT COMPLETE` |
| 2026-08-30 | Web 私有成绩行、七项快捷菜单/移动端底部操作表、详情注释 textarea 与 `shell-info-toast` DOM/CSS 已迁入 `@cuberoot/timer-ui`；`HistoryPanel`/`SolveModal`/`SoloView` 改为真实 consumer，只注入持久化、剪贴板、详情与 Undo effect。定向 DOM/交互/no-dup/i18n/theme/overflow + catalog/component/architecture guards 共 8 files 91/91，`timer-ui` typecheck、boundary audit 与 diff check 通过；client typecheck 仅余本轮前已存在的 `.next` pb/wb stale validator 4 项 | 当日快照锁定一份 row/menu DOM，右键/450ms 长按、七项顺序、缺 effect 不画假入口、首项/方向键/Escape 焦点、点外/scroll/resize/visualViewport 关闭、320×500 clamp、底栏 64px 避让、注释原文 blur-save once、quick delete 无 confirm/host once，以及默认 5 秒可选 Undo toast。“Mobile 尚未接”已由下方 2026-08-31 的共用 consumer、OPPO 长按/Back/IME 证据取代；完整 SolveModal、tag/bulk/compare 与 iOS 全矩阵仍缺 |
| 2026-08-30 | 起表可用性收敛到 `@cuberoot/shared/timer` 的 `timerCanStartAttempt` / `timerCanHandleAttemptPress`；Web 与 Mobile 同时消费，并覆盖触摸、Space/任意键、智能魔方、Stackmat 与 BLE 计时器入口。shared 与 Mobile typecheck 通过；Web 输入 20/20、连同 machine/architecture guards 54/54，Mobile 全集 28 files 191/191 通过；本地 `/zh/timer` 200；client typecheck 仅余已知 `.next` pb/wb 4 条陈旧路由错误 | loading、unavailable、空且未授权及来源身份不匹配时均不能起表；只有 manual/custom canonical 空槽例外。门禁在运行中关闭也仍能停表，不会把一次已开始的成绩卡死。尚未做 OPPO/iOS loading/error/source-switch 真机矩阵，PAR-013/PAR-020 与整体继续 `ACTIVE — NOT COMPLETE` |
| 2026-08-31 | Web/Mobile 打印内容、双语 copy、统计摘要、完整成绩表与按需冻结生命周期迁入 `@cuberoot/shared/timer` + `@cuberoot/timer-ui`；Web 只调浏览器 transport，Android 只调 `PrintManager`，iOS 只调 `UIPrintInteractionController`。Controller/文档/More 定向测试共 14/14，Android Java compile、Mobile build 与三包 typecheck 通过。36 条长备注 fixture 的中文 PDF 为 A4 4 页、英文为 A4 5 页；两份均 36/36 QA 标记、Unicode 字体嵌入、页面宽度无溢出，并以 Poppler 单页渲染和 Ghostscript 交叉逐页检查。OPPO `PFDM00` 的 Mobile More 六项完整可见，实点“打印”进入 ColorOS 系统打印预览；中文报告可见，取消后 App 恢复且 `bodyClass=''`、`portalCount=0`。同一构建由 Xcode 26.6 / iOS 26.5 Simulator SDK 编译成功，并安装启动于 iPhone 17 模拟器 | 关闭“Mobile 另写打印模板/英文 PDF 遗漏”和 Android 打印无法打开/取消后残留遮罩的 P0 反例；iOS 原生系统面板、完成回调与双平台真实保存/纸张输出仍待实证。More 其余 6 项和整个 Timer 继续 `ACTIVE — NOT COMPLETE` |
| 2026-08-31 | 复核 Mobile 已真实消费 `TimerStatsPanel` 与 `TimerTimingSettingsSections`，不是跟踪表所写的“尚未接入”。定向 source-set/持久化/8 字段 effect 回归与三包 typecheck 通过。OPPO `PFDM00` 实页记录页出现 `time/ao5/ao12` 三行共用统计面板，矩形为 x=20、width=320，`body/document scrollWidth=clientWidth=360`；设置页读到 canonical 8/8 `settings.timer.*` ID，所有边界位于 20～340px，并实际滚动到底部且未被底栏遮挡 | 关闭 Mobile “紧凑统计未接”和“仍只有观察/hold 旧 UI”的陈旧记录；完整 StatsModal/五图/复盘、其余 7 类设置、逐字段效果、iOS 与全视口矩阵仍缺，PAR-009/011/012 和整体继续 `ACTIVE — NOT COMPLETE` |
| 2026-08-31 | 复核 Mobile 已真实消费 `TimerHistoryRow`、同一七项 `TimerHistoryQuickMenu`、`TimerHistoryCommentEditor` 与 `TimerInfoToast`。修复 Mobile 把 quick delete 错接到带确认详情删除的差异：快捷删除现在直达 repository，成功后显示共用 5 秒 Undo，并以原 session ID 恢复；详情删除仍确认。再把 History menu 加入 `TIMER_OVERLAY_IDS` 的受控开关，Android Back 继续复用既有 `close-overlay` 优先级。Mobile history/repository 2 files 30/30、shared controlled-menu 8/8、Mobile overlay/Back 2 files 13/13、两包 typecheck、Vite production build、Android 186-task assembleDebug、覆盖安装通过；同一共享资源重新 `cap sync ios` 后由 Xcode 26.6 / iOS 26.5 Simulator SDK 编译成功，并安装、启动于 iPhone 17 模拟器，当前共享计时器界面可见。OPPO Android 输入系统在成绩行原位按住 600ms，七个 canonical action ID 全量出现；panel 360×397、底部预留 64px、`body scrollWidth=clientWidth=360`。真实 `KEYCODE_BACK` 后 menu=false、history=true、rows=1、body class 为空。再展开同一成绩并实点备注 textarea：键盘把 `visualViewport.height` 降为 461，输入框矩形 x=34～326、y=213～301 完整可见，body/document 仍 360/360；未输入文字，Back 后 value 仍为空、viewport 恢复 749 | 关闭“Mobile 私有 History 行/菜单/toast”、quick-delete 二次确认/无撤销、长按入口、Back 直接离开记录页及备注 IME 遮挡的差异；未删除或修改用户成绩。iOS 本轮证据只覆盖当前共享构建安装/启动，不覆盖 History 交互；完整 SolveModal、tag/bulk/compare、iOS 运行交互与全视口矩阵仍缺，整体继续 `ACTIVE — NOT COMPLETE` |
| 2026-08-31 | 独立对抗 agent 审查重复实现、跨包边界、Android 回归、凭据、iOS 签名、路线图与发布准备 | 未发现 Mobile→client/miniprogram/api deep import、第二套 iOS React App、被跟踪的证书/Provisioning Profile/DerivedData/xcuserdata 或 Bundle ID/Automatic Signing 偏差；发现并登记 iOS GAN UUID 无密钥来源、假 Stackmat、多人/联机外跳、商店草稿过期、Apple 4.8 与 archive 隐私报告等缺口。本次只满足增量独立审查，不满足整体完成所需双 agent + 全矩阵门槛 |
| 2026-08-31 | 修复 iOS GAN picker UUID 后 advertisement manufacturer-data 捕获并复用 shared MAC 提取；Mobile 人数改为只读单人、无 microphone adapter 时不渲染 Stackmat，新增 capability ratchet；iOS 图标/深浅启动图由 canonical SVG 生成，HTML 与 React `Suspense` 复用即时品牌 loading。Mobile 35 files 205/205；Client 全集 554 files、6512 tests 通过（另有 10 files、127 tests 按既有条件 skip），`cross_trainer_reach` 12/12，Web/边界/i18n 定向 5 files 37/37；清理未运行 dev 时的 8.6 GB 陈旧 `.next` 后，补齐联机房测试工厂新增的 `revision`/`videoGeneration` 必填字段，定向 33/33 与 Client typecheck 通过，其他相关包 typecheck 也均通过；JDK 21 Android 274-task assembleDebug，Xcode 26.6 / iOS 26.5 Simulator build/install/launch 均通过。最终 Simulator 时间点截图为约 1 秒缓存的原生启动快照、约 3 秒 `CubeRoot` 品牌壳、约 5 秒共用计时器 | 关闭“iOS GAN 必然无法派生 cipher”“假麦克风按钮”“多人模式外跳冒充完成”“Capacitor 默认 iOS 品牌图”和 React 主包加载前纯空白五类反例；iPhone + GAN、签名 Team、Apple 4.8、完整 multiplayer/Stackmat、archive/privacy report 和整个 Timer parity 仍未完成 |
| 2026-08-31 | 三路独立对抗审查发现联机房把公开 `pid` 当写权限、非法项目可入库、视频 token 只验在册和 Mobile 直接搬 Web 会撞路由/同步打乱/原生 BLE/底栏 CSS。首个安全共享包把 DTO、13 项 exact registry、decoder、结算与注入式 transport 提入 `@cuberoot/shared/timer`；Web/API 成为真实 consumer；migration 0185 只存 `{pid:SHA-256}`，所有心跳/写操作/房主管理/视频签发使用私有 capability 且 SQL 二次校验；Mobile 复用现有 native SecureStorage 保存 session。Server 2 files 8/8、Client 3 files 44/44、Mobile 2 files 9/9，shared/server/mobile typecheck 通过 | 关闭“公开 pid 可冒充玩家/房主并换视频 token”和 client/server 重复联机规则的阻断项；未显示半成品入口。共用 controller/React UI、2～4 人本地 reducer、邀请深链、视频权限、底栏/安全区、两设备和 OPPO/iOS 实测仍未完成，PAR-002/015 保持未开始，PAR-016 仅升为进行中，整体继续 `ACTIVE — NOT COMPLETE` |
| 2026-08-31 | 联机房继续收敛到单一 shared 契约：创建、切项目、补题与下一轮不再接受客户端打乱正文，由 API 直接复用 `@cuberoot/shared/timer` 的 13 项生成器；同房/轮/项目并发请求 single-flight，事务内再复验 capability、轮次、roster、成绩与 pending。event/scramble 写入额外绑定预检轮次，慢生成不得污染下一轮；同步房在服务端拒绝倒计时前伪造 inspecting/solving 和交卷后伪造活跃态。同步轮冻结参与名单，晚加入者等下一轮；自动推进必须等齐，只有显式“不等了”传 `force=true`。重复提交成绩只允许改罚时，不覆盖原时间。踢人/离开轮换 `videoGeneration` 后同步等待整房删除并做 3 次有界重试，剩余合法玩家改签新 generation，旧 token 只能重建隔离空房。player/phase/penalty/event/roster 规则也从 API 私有副本收回 shared。shared build、Server typecheck + 3 files 60/60、Client typecheck + 8 files 127/127、Mobile typecheck + 1 file 2/2 通过 | 关闭客户端自选有利打乱、同轮生成风暴、旧轮慢请求污染新轮、晚加入冒充本轮参与者、提前伪造计时态、后台自动跳过未完玩家、罚时重交改写原成绩，以及只踢单个媒体身份后旧 token 可重连旧房的反例。LiveKit retirement 仍非 durable outbox，真实 PostgreSQL 并发、两设备/视频/后台真机、共用 controller/UI 仍缺；新 capability 契约也不能与旧客户端一次无版本原子切换，须按下文 staged rollout 执行。整体继续 `ACTIVE — NOT COMPLETE` |
| 2026-08-31 | 本地 2～4 人对抗审查发现：历史按玩家/项目的平行数组下标拼轮会在换项目后制造假轮次；旋转调用带业务副作用的 `setLayout` 会停表换题；`pointercancel` 被当成 `playerUp` 会误起表；观察/语音/分段设置在多人路径是可见 no-op。先把人数、slot、按键/冲突交换、同项目打乱分组、显隐与胜者规则迁入 `@cuberoot/shared/timer`，Web store 成为 consumer；`setLayout` 改成纯展示状态，3/4 人不再监听无意义布局；新增独立 `playerCancel` 并覆盖 pointercancel/lostpointercapture/卸载。相关 8 files 127/127 与 shared/client/mobile typecheck 通过 | 关闭旋转重置整局和系统取消触摸误起表两个当前 Web 根因，并建立第一批不重复规则；原子 `LocalBattleRound`、完整纯 reducer、WCA 异步 revision/fail-closed、多人设置真实 effect、共用 React `LocalBattleView`、Mobile/多路 BLE 和真机矩阵仍未完成，不能开放 Mobile 入口或把 PAR-015 标完成 |
| 2026-08-31 | 三路独立对抗审查继续攻击本地多人历史，发现平行数组假轮、删最新轮后误改前轮、Reset All 隐藏项目复活、旧版历史升级后不可见、同文本跨项目误合并、quota 假保存、弹层下暗中计时，以及 DOM 把真实 `pointerup`/系统 `pointercancel` 接反。新增共享 `LocalBattleRound` 严格 codec；Web 结算用 UUID 原子保存 2～4 人 event/scramble/raw result/winners，罚时与删除按 round 更新，损坏 raw 保留 recovery 并逐轮救回，写失败与 legacy mirror stale 分型告警。VS 历史/详情/CSV 直接读原子 rounds，旧个人记录仅分区展示且 exact mirror 去重；CSV 复用既有 RFC escaping，含 event/roundId/raw ms/ISO date；弹层抑制四路键盘并加入 dialog/Escape/focus、44px 触点、dvh/safe-area；pointer release/cancel 通过单一映射恢复正确动作。shared build、Client typecheck 与本地多人 5 files 40/40 通过 | 关闭本批已复现的数据错配、静默覆盖、隐藏计时、反向 pointer 语义与旧记录不可见反例；仍未关闭纯 reducer/共用 `LocalBattleView`、原子→IndexedDB repository、多人设置真实 effect、WCA async fail-closed、复盘 solve-id、完整视觉/读屏、Mobile 页面、多路 BLE 和双平台真机，因此 PAR-015 与整体继续 `ACTIVE — NOT COMPLETE` |
| 2026-08-31 | 五端 installed UI 已接真实 2/3/4 人与联机；本地模式补原子轮次持久化、基础统计、按键交换、共享智能魔方轮换、12 秒打乱超时和原位重试；联机补 WCA 身份、邀请二维码、房主转让/踢人及历史统计。生产 Vite 复测又定位 patched cubing.js 把 worker 固定到 `/cubing-chunks/search-worker-entry.js`，而已安装宿主从未生成该资产，导致 3×3 多人永久失败；现把既有 esbuild worker builder 移到 `core/scripts`，Web/Mobile/Desktop/Harmony 四宿主构建共同调用。320px production smoke 得到同一真实 3×3 打乱、Start all enabled、document 320/320、主操作 44px。More 再复用现有统计页与 Tools canonical BLD/solver/bulk 子路由，真实接通 10/12；共享 QR modal 补焦点圈定/恢复、标题关联和 44px 热区 | 关闭“只显示重试但永远无法生成”“每个宿主另写 worker”“More 6/12 陈旧基线”和二维码键盘/触控缺口。专项、replay、其余 7 类设置、Web/App Battle React 视图收敛、视频、多路 BLE、双设备与五平台发布矩阵仍未完成，整体继续 `ACTIVE — NOT COMPLETE` |
| 2026-09-01 | OPPO `PFDM00` 复现 WebView Clipboard API 让“复制打乱”失败；根因修在 `InstalledAppHost.writeClipboardText` 单一 capability，App 打乱、历史打乱、联机房间码和二维码邀请链接均走宿主 transport，Android/iOS 的同一 Capacitor 宿主使用官方 Clipboard 插件，Web/Desktop/Harmony 的浏览器 fallback 复用单一 fail-safe transport，没有为每个功能或平台复制业务逻辑。App UI 32 files 211/211、Mobile 6 files 18/18、Room QR 5/5，App UI/Mobile/Desktop/Harmony typecheck、Vite build、Android/iOS Capacitor sync、Android 304-task assembleDebug 与 Xcode 26.6 / iOS 26.5 Simulator SDK 无签名编译通过；二维码复制失败有可见重试反馈，异步完成不越过卸载；新 APK 覆盖安装成功 | 真机依次实证 `none` 保持原题且无 role/tabindex、`next` 从 Vegas Cubing Cup Winter 2024 换到 Archena 24 Horas 2022、`copy` 保持原题并出现“已复制打乱”；设置行和文档均为 360px 无横向溢出。房间码与二维码邀请链接 transport 有注入式集成回归，未创建生产房间。iOS 本轮只有插件编译证据；iOS/Harmony/Windows/macOS 三动作、智能魔方修正路径和完整设置矩阵仍缺，整体继续 `ACTIVE — NOT COMPLETE` |
