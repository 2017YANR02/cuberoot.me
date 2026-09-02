# Mobile Timer 打乱来源对抗性审计

审计日期：2026-08-30

状态：**未达到完整 Web parity**。本报告记录 2026-08-30 起形成的 Android/iOS 打乱来源证据，以及后来迁入 `@cuberoot/app-ui` 的共享边界；不把显式报错、缺少 provider、源码存在或某一宿主构建成功计作五端“已经支持”。既有 OPPO/iOS 行保持历史证据含义，HarmonyOS NEXT、Windows 和 macOS 必须另取设备/实体电脑证据。

## 审计范围

- 五端 App：`core/packages/app-ui/src/App.tsx`、`data/real-scramble-pool.ts`、Timer repository 与相关测试；平台宿主只提供 capability adapter。
- 跨端契约：`core/packages/shared/src/timer/event-catalog.ts`、`scramble-runtime.ts`、`manual-scramble-queue.ts`。
- 共享 UI：`core/packages/timer-ui` 的来源选择器与手动队列编辑器。
- Web 事实源：`core/packages/client/app/[lang]/timer/_shell/SoloView.tsx` 与 `_lib/scramble/wca_pool.ts`。

## 43 × 3 路由矩阵

每个项目分别审计 `real`、`random`、`manual`，共 129 个格子。当前结果如下：

| 来源 | 真题池 | 同项目本地 provider | 全局手动队列 | canonical 空槽 | 合计 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `real` | 19 | 23 | 0 | 1 | 43 |
| `random` | 0 | 42 | 0 | 1 | 43 |
| `manual` | 0 | 0 | 43 | 0 | 43 |
| 合计 | 19 | 65 | 43 | 2 | 129 |

因此 129/129 都有明确路由语义，但真正随机生成仍是 42/43。两个非生成格都是 `custom` 的 Real/Random：shared runtime 返回 manual/empty，Mobile 将该槽标为 ready、显示 `—`，允许计时并冻结空打乱，复现网站当前行为。它们绝不能被三阶打乱或伪造的随机算法替代；这一局部契约通过也不能据此描述为完整复刻。

### `real` 的 19 个真题池

`222`、`333`、`444`、`555`、`666`、`777`、`333oh`、`333fm`、`333mr`、`333ni`、`333bld`、`333mbld`、`444bld`、`555bld`、`pyra`、`skewb`、`sq1`、`mega`、`clock`。

`333mr` 和 `333ni` 都查询 WCA `333`，但必须继续按各自 Timer EventId 隔离 pool、current、inflight 和 cache，不能共用 `333` 的消费状态。

### `real` 的 24 个未映射项目

Web 的当前规则不是禁用“真题”：来源仍保持 `real`，然后使用同一项目的本地 provider。这不是网络失败降级，绝不能改成 `333`。

- 当前有同项目 provider：`666bld`、`777bld`、`magic`、`mmagic`、`r3`、`r4`、`r5`、`ll`、`oll`、`pll`、`coll`、`cmll`、`zbll`、`eg1`、`eg2`、`fto`、`redi`、`cross`、`f2l`、`kilominx`、`gear`、`ivy`、`mpyram`。
- 只有 `custom` 不存在随机生成器；它由手动输入语义负责。

### `random` 的 manual/empty 边界

`custom`。

`custom` 的 shared capability 是手动输入，不是随机生成器。这里的空字符串不是“生成结果”，而是网站明确允许计时/保存的 canonical 空槽；必须由 `timerScrambleAllowsEmptySlot` 显式授权，不能把任意 provider 失败产生的空字符串当作支持，更不能回退三阶。

## 已验证的不变量

- 所有生成调用携带原始 EventId；没有 `scramble333` 或显式 `event: '333'` 兜底。
- mapped `real` 的冷网络失败、非 2xx、错误 response shape 和零条有效同行项目记录都会显式失败，不转成本地随机打乱。
- real pool、current、inflight 和 cache 都按 Timer EventId 分开；缓存最多 50 条、TTL 为七天，并复用 shared 官方 competition/event/round/group/extra/number slot identity 去重。相同文本的不同官方 occurrence 必须同时保留，同一 slot 的重复输送只留首条；v6 会失效曾按文本吞 occurrence 的 v5 cache，旧版 333 cache 仍不暴露给 `333mr`/`333ni`。
- 异步生成完成时校验 request id、EventId 和来源；切项目或来源后旧结果不能覆盖当前打乱。旧 fetch 可以安全填充其原项目的独立后台池。
- 手动输入是一个跨 43 项 persisted raw queue；每个非空行只 trim，正文保持 opaque，不校验记号。
- 编辑队列、进入手动来源或在手动来源中切项目都会从第一条重新开始；`next`/完成一次 solve 后顺序消费并循环。
- 空手动队列显示粘贴提示，但仍可启动计时并保存空打乱；attempt 在启动时冻结 EventId 和 scramble。
- 来源状态不持久化，App 重新加载从 `real` 开始。
- 来源与配置控件在 `holding`、`ready`、`inspecting` 保持与 Web 一致的可用状态；变更会先 cancel active arm/inspection、使旧 slot 失效并生成新槽。只有 `running` 具有真实 disabled 语义。

## 发现的反例与缺口

| 编号 | 严重度 | 发现 | 当前证据 / 影响 |
| --- | --- | --- | --- |
| F1 | 已修复 | 完整 `TimerStoreData` 的异步回调原先没有统一 revision gate。 | `LatestSnapshotGate` 已接入 App 的 add/update/delete/import/settings 全 mutation；只有最新 revision 可应用完整快照，最新失败 reload canonical store。纯逻辑乱序 fixture 与 App source guard 已通过。 |
| F2 | 已修复 | 真题缓存原先接受远未来 `fetchedAt`。 | 现在拒绝非有限、负数及超过当前时间 5 分钟容差的时间戳；边界 fixture 已锁定。 |
| F3 | 已修复（待真机） | 2/129 个来源格子是 `custom` 的 manual-only 边界。 | shared capability/空槽 predicate、Mobile ready/`—`/可起表/attempt snapshot 已锁定；仍待 OPPO 触摸与重启实证，且不能用 333 fallback。 |
| F4 | 高（进行中） | mapped `real` 的完整来源配置尚未全部关闭。 | 日期/比赛/搜索/国旗/轮次/组别、2×2 类型/口径、完整 WCA difficulty/merge/optimal、222/pyra/skewb 按步数、完整来源元数据、有限池进度与公开打卡已迁到 shared/timer-ui；逐类用户错误文案及全组合 identity/真机矩阵仍未完成。 |
| F5 | 已修复 | mapped `real` 的暂态失败策略曾与 Web 不一致。 | Web/Mobile 现在共用 `startTimerRealScrambleRetry`：立即尝试一次、6 次退避、共 7 次；confirmed empty 不重试，取消会终止当前 fetch/timeout，任何分支都不得随机回退。 |
| F6 | 已修复 | 来源回调原先只依赖 disabled 控件阻止计时中修改。 | 共享控件仍有真实 disabled，Mobile `onChange` 现在另有 phase guard 与提示。 |
| F7 | 已修复 | Web `wca_pool.ts` 两处注释曾错误声称 caller 会 fallback 到 generated scramble。 | 注释已改为 transient 保持空槽/重试、confirmed empty 显式报告，明确禁止 substitution。 |
| F8 | 已修复（待真机） | Mobile 只有 selected-comp 路径按官方 slot 去重；普通/date merge、cache、live+2×2 预计算仍按打乱文本吞掉重复 occurrence。 | 这些入口现统一复用 shared `timerWcaCompetitionScrambleSlotIdentity`；fixture 覆盖重复文本不同 slot、同 slot 重复页、cache 重启及 2×2 类型/按步数预计算。未改 `App.tsx`，整体 parity 仍未完成。 |
| F9 | 已修复 | Web 的 random live、比赛难度和 precomputed 曾在严格 slot identity 前接受脏字段，一条坏行可中断后续有效题。 | 三入口及 restore/comp 全量现统一使用 shared strict decoder 并逐行跳过；valid-after-invalid fixtures 覆盖三种来源。 |
| F10 | 已修复 | selected-comp 网络失败 `null` 曾被折成权威空数组并永久写入 `knownEmpty`。 | `null` 现保持 transient、清 inflight 后允许下一次重试；只有权威 `[]` 才缓存 empty，两种分支均有回归。 |
| F11 | 已修复 | durable save 期间登出/换号及 pending retry 曾可能使用旧 token 或让新账号认领旧成绩。 | 首次 owner 随 pending 持久到 retry；完成时只读 live session，auth busy/登出/owner mismatch fail closed，同 owner刷新 token 可用。 |
| F12 | 已修复 | API 曾复制 strict mark key validator，且会把缺失/非法 `x` 静默归为 `0`。 | API 与 Web/App 共用 shared marks key decoder；query 只规范化 `0/1` 与整数，非法 body/query 返回 400 且不执行 SQL。 |

## 自动化证据与边界

矩阵测试逐格枚举 43 × 3，并锁定 19 个真题池、23 个同项目 real fallback、`custom` canonical 空槽、42 个 random provider、同项目路由和无 333 fallback。真题池测试覆盖精确 event/source query、官方 occurrence slot identity、相同文本不同 slot、同 slot 重复输送、2×2 预计算与重启 cache、alias cache 隔离、损坏 envelope/row、TTL、上限、旧版 cache、七次重试/取消/超时、confirmed empty、错误 response shape、错误 event 和 unsupported event。

WCA difficulty 共享层新增证据：`timer_wca_difficulty_shared.test.ts` 与 source shared tests 共 19 项，锁定 normalize/query/identity、catalog cache+inflight、`steps_layout.json` 404 静态回退、coverage error/retry/authoritative empty；`timer-wca-difficulty-ui.test.ts` 3 项锁定受控方法/阶段/颜色/范围/合并、unindexed 提示、键盘 range debounce 与 unmount flush；Mobile 的 real/source 六文件共 68 项锁定 merged event provenance、未建索引旁路、最优缺失与权威空分型。它们仍不能代替 OPPO 的 320/340、IME、长比赛名和所有配置组合实测。

2026-09-02 来源进度/打卡收口证据：API 2 files / 12 tests、App 36 files / 263 tests、Client 7 files / 58 tests，六个相关包 typecheck、Mobile production build、Android sync/install 均通过；多轮独立审查最终 P0=0、P1=0。该证据不冒充非零足迹弹层的真机视觉验收，也不关闭逐类 loading/empty/error 与全配置矩阵。

纯逻辑/源码 guard 可以证明路由契约，但还不能模拟完整 React 生命周期、IndexedDB 调度和网络乱序。后续应补可注入 repository/fetch 的 App-level 测试，至少覆盖：

1. event update → manual edit → 两个 promise 乱序回调；
2. add solve → manual edit、settings update → source/event change；
3. real A 请求中切 B、切 random/manual、再切回 A；
4. 真题未来时间戳与设备时钟回拨；
5. 真题配置迁移后，每个配置字段参与 pool/cache/inflight identity。

本审计没有声称 43 个项目都有随机生成器：生成能力仍是 42/43。只有 `custom` 经 shared 显式 predicate 授权的空文本可作为 canonical ready 槽；其他 explicit unsupported、provider 空返回或 333 替代项一律不算通过。
