## `/timer` 零遗漏与单一来源

- 网站 `/timer` 的当前可达产品行为是迁移期间的事实源；“一致”指
  `项目 × 人数 × 来源 × 来源配置 × 计时阶段 × 数据状态 × 语言 × 主题 × 视口/输入方式`
  的完整组合，不是标题、颜色或单张截图相似。
- 网站出现的每个控件、菜单项、弹层、空态、加载态、错误态和点击结果都必须登记并实现；
  不支持、点击无响应、静态文字冒充按钮、外跳网站或隐藏入口都不能算 parity。
- 43 项目录和 WCA 映射等纯契约只从 `@cuberoot/shared/timer` 读取；Web/五端 App 共用的
  React 控件放 `@cuberoot/timer-ui`；`@cuberoot/app-ui` 与各宿主不得 deep import client，也不得复制
  `SoloView`、`BattleView`、来源菜单、二阶类型表、手动队列或重试常量。
- 二阶必须覆盖网站的完整状态、3-gen、EG/CLL/EG1/EG2/TCLL+/TCLL-/TCLL/LS/无连色，
  以及 WCA 11 步/最优口径；真题不能假换成本地随机，随机专项也不能只画选择器不接 provider。
- 手动输入是跨 43 项共享的 opaque 多行队列：逐非空行 trim、即时持久化、改动重置、顺序循环、
  允许空打乱；不得添加网站没有的校验、提交或独立清空逻辑。
- 成绩历史的自动标签必须只从 `@cuberoot/shared/timer/history-tags` 读取 ID、文案、顺序、toggle 和 PB/ao/MBLD 派生规则，徽标/筛选器只使用 `@cuberoot/timer-ui`；标签不写入 DB/备份。智能魔方动作只用 shared `TimerSmartCubeMoveRecorder` 收集，分段只调用 shared `stageSegmentsFor`；cube state、CFOP 检测/识别、HTM、朝向归一化和 QTM/TPS/首动/停顿指标均在 `@cuberoot/shared/timer/reconstruct/*`，指标卡只使用 `@cuberoot/timer-ui/TimerReconstructMetrics`，网站旧路径只能兼容 re-export。Web/五端不得再写第二套 move buffer、OLL/PLL、阶段识别器或复盘指标算法；Web 已有完整报告可复用已计算 metrics，完整时间线/回放未迁前不得冒充五端完整复盘。
- 成绩历史的 rolling 值与 strict running PB 只从 shared `rollingStatSeries/projectRollingStats` 计算，MBLD 列可见性只从 `rollingStatColumnsForEvent` 取得；Web/五端必须共用 timer-ui 的 `TimerHistoryColumnsHeader/DayDivider/RollingCells` 和 `TimerRollingStatsPicker`。投影始终基于完整正序历史，筛选只决定显示行与日期计数；FMC 用 event-aware 格式，≤480px 列折到第二行，不得复制 Web 私有循环或固定宽列。
- 分组 CRUD、项目自动匹配、切分组自动切项目、默认名称和双语文案只从 shared 的 `createAndActivateTimerSession/selectTimerEventSession/timerSessionSelectedEvent/timerDefaultSessionName` 与 timer-ui 的 `TimerSessionSwitcher/timerSessionSwitcherLabels` 消费。Web localStorage 与 App repository 只做薄持久化；删除非当前分组不得被当作新选择，首次空库必须返回并持久化同一个 snapshot。弹层 portal 本身必须 `data-no-timer`，Web/App 都要把受控 open 纳入各自键盘/Back 门禁，异步操作、重命名和删除后焦点不得落在 disabled/已删除节点。
- CFOP 分段与 BLD memo 只用 shared `TimerAttemptSplitRecorder` 和 timer-ui `TimerAttemptSplitStatus/Settings`；宿主只传开始/停表时间、按键/触摸命令与 canonical move stream。手动标记 first-sample-wins，自动分段必须复用 `stageSegmentsFor` 并允许 partial normalization 修正；BLD 项目可以连接、核对打乱、录 execution moves 和复原停表，但绝不能由第一手自动起表，否则 memo 时间会丢失。
- “手动输入打乱”和“手动录入成绩”是两项独立能力。成绩录入必须复用
  `@cuberoot/shared/timer` 的 normal/FMC/MBLD、OK/+2/DNF/DNS 规则与
  `@cuberoot/timer-ui` 的 `TimerManualEntryModal`；Web/已安装客户端只负责各自存储 adapter，
  禁止再写时间 parser、FMC 计数器、MBLD 9f12c 规则或第二个表单。
- 43 项里只有 42 项具有随机生成器；`custom` 的 Real/Random 是网站明确允许计时和保存的
  canonical ready 空槽，必须由 shared `timerScrambleAllowsEmptySlot` 显式授权。不得把它伪造成
  第 43 个随机 provider，也不得把其他 provider 的空返回或失败当成同一语义。
- patched cubing.js 的搜索 worker 固定从同源 `/cubing-chunks/search-worker-entry.js` 加载；Web、Mobile、
  Desktop、Harmony 的 dev/build 必须共同调用 `core/scripts/build-cubing-worker.mjs` 生成各自 public 资产。
  禁止每个宿主复制 worker 脚本，也不能把 UI 的超时/重试当成“生成器已可用”的证明；至少实测一条 3×3。
- 人数入口已支持 1/2/3/4/net：`@cuberoot/app-ui/BattleModes.tsx` 的 App UI 必须消费
  `@cuberoot/shared/timer` 的 local-battle reducer 与 net-battle client/session contract；Mobile、Desktop、
  Harmony 只注入 transport/session adapter。不得恢复只读“1人”、`players=` 浏览器 fallback 或再造宿主页面。
  本地多人打乱必须复用 shared generator/host adapter，并有有界超时、明确 error 状态和原位重试；禁止把失败继续
  显示成永久“准备中”。但 Web `BattleView/NetBattleView` 与 App `BattleModes` 尚未收敛为同一个完整 React 视图，
  高级历史 UI、设置、视频、多 BLE、双设备和五平台矩阵未齐，仍不得把多人/联机写成 parity 完成。
- WCA 真题的身份不是打乱文本。缓存、前后浏览、保存来源和自动打卡必须保留
  `competition/event/round/group/extra/scrambleNumber` slot identity；两道文本相同的官方题仍是
  两个不同槽位，禁止以 `Map<scramble, meta>` 覆盖 occurrence。
- 每项完成前至少要有共享契约测试、宿主集成测试、集合差分、无遮挡/无横向溢出检查，及 OPPO
  真机证据；关键结论再由独立 agent 做反例审查。Android 通过不替代 iOS，二者均通过前整体仍是
  `NOT COMPLETE`。
- 成绩对比只从 `@cuberoot/shared/timer/history-compare` 取得选择、清理与比较模型，只从
  `@cuberoot/timer-ui` 取得 status/actions/modal；Web 或 `app-ui` 不得恢复私有 modal。选择状态必须
  携带 `session + event` context，并在 render 阶段 fail closed，不能只等 passive effect 清理；普通、
  `+2`、DNF/DNS、FMC、MBLD、阶段、HTM、TPS 和 case 差异属于同一契约。移动返回顺序固定为
  关弹层、退对比模式、离开历史。
- 成绩详情只从 `@cuberoot/shared/timer/history` 取得分段/BLD 派生规则，只从
  `@cuberoot/timer-ui/TimerSolveDetailModal` 取得基础 DOM/CSS；Web 与 `app-ui` 不得保留第二套
  罚时、分段、备注、移组或删除详情。Web 的重型复盘和各宿主预览只能作为 slot 注入，不能反向
  把 Next/原生依赖带进 `timer-ui`。详情选择必须携带 `session + event` context；删除/移组仅在宿主
  持久化成功后关闭。Android Back 关闭详情前必须 blur 活动备注输入框，保证 canonical onBlur 保存发生。
- 计时器打乱图只从 `@cuberoot/timer-ui/TimerCubePreview` / `TimerScramblePreview` 渲染。NxN、Clock、
  Pyraminx、Skewb 和 FTO 复用该组件内的 `cubing/twisty`；SQ1/Megaminx 复用
  `@cuberoot/puzzle-render-core/{sq1-svg,mega-svg}`。Web 旧 `CubePreview`/`CubingPreview`/renderer 路径
  只能保留 compatibility re-export；`app-ui` 不得恢复私有 `ScrambleCube` 或直接依赖 `visualcube`。
  显示开关、2D/3D 偏好、默认/归一化和设置行只从 shared `TimerScramblePreviewSettings` 契约与
  timer-ui 同名组件读取，宿主只持久化；SQ1/Megaminx 忽略 3D 偏好并保持 canonical 2D。App 单人和联网
  预览均放入独立 `TimingSurface.cornerSlot` 并标记 `data-no-timer`，不得嵌入可点击的打乱条导致拖动
  复制、换题或起表。宿主响应式尺寸由外层容器控制并给共享预览传 `fill`；不可解析打乱必须隐藏，
  不能继续显示上一题。

