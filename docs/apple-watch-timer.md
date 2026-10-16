# CubeRoot Apple Watch 计时器第一版

用户于 2026-10-14 授权以现有 iOS App 为基础实现配套手表计时器，优先复用已有能力。本页描述产品范围和维护方法；验收状态统一记在 `mobile-app-roadmap.md`。

## 使用

1. 在同一个 Xcode 工程 `core/apps/mobile/ios/App/App.xcodeproj` 中构建 App 和 CubeRootWatch。安装到配对的 iPhone / Apple Watch 后，打开手机 CubeRoot。
2. 在手机选择计时项目、成绩分组和观察时限。手表显示分组和项目；普通随机打乱与状态图由手机现有共享能力生成，每批最多 10 条，手表缓存。图在时间数字下方，长内容可滚动查看。
3. 点击屏幕内容区任意位置（数字、打乱图、文字或空白）起表，再点一次停表；滚动手势不触发点击。开启观察时第一次点击进入观察，第二次点击起表。观察计数及罚时边界沿用网站：恰 15 秒为 OK，恰 17 秒为 +2，超过 17 秒为 DNF（自定义时限按相同规则平移）。8/12 秒在应用前台时震动提醒。异常时的重试按钮独立处理，不触发起表。
4. 停表自动保存并切换下一条打乱，数字保留刚完成的成绩；无需再次确认。手表不提供罚时选择和准备提示，后续成绩修改使用手机既有编辑能力；观察超时与中断状态仍按既有规则记录。存储失败保留停表草稿，重试或重开后继续保存，绝不丢弃原记录。
5. 未联网、手机不在附近时，可继续使用缓存打乱。成绩保存在手表待发送队列。重新连接并打开手机 CubeRoot 后，成绩写入原分组。手机历史、统计、导出及后续编辑使用原有实现。
6. 手机更改项目或分组后，手表保留正在查看/使用的当前题，后续题使用新批次。缓存不足时自动请求补充，手机 App 需要前台运行才能生成；手表没有「下一条打乱」或「获取打乱」按钮。
7. 手表内容下方的「智能魔方」入口直接使用手表蓝牙搜索 GAN v4；默认验收设备为 GAN 16 UI。先断开魔方与其他 App 的连接，唤醒魔方，在手表允许蓝牙并选择设备。连接后由共享逻辑识别打乱、第一手起表及复原停表。此链路不经手机转发；离开手机时仍需有缓存打乱，缓存耗尽后的补充暂需手机。连接、实体转动及离线验收状态以路线图为准。

本版支持 222、333、444、555、666、777、333oh、clock、mega、pyra、skewb、sq1 共 12 个常规计时项目。只支持明确标注的**普通随机**来源，不声称同步手机当前真题、手动或专项来源。盲拧、最少步、专项和手表端完整统计不在首版范围；智能魔方当前接入 GAN v4，其他型号不据此宣称支持。现有五端计时器功能合同不因本版改变。

## 复用边界

- iOS 工程新增 `CubeRootWatch` target，随 App 的 Embed Watch Content 打包；现有 iOS bundle ID 不变，手表 bundle ID 为 `me.cuberoot.app.watchkitapp`。首次真机签名需在两个 target 选择同一开发团队。
- `app-ui/watch-timer-sync.ts` 复用 `timer-ui/random-scramble` 的既有生成器、唯一 App `TimerRepository` 实例与 `LatestSnapshotGate`。没有复制打乱算法、React 计时界面、统计引擎或账号系统。
- 打乱图复用 `timer-ui/TimerScramblePreview` 的项目映射、算法适配和现有 SQ1/Megaminx 等 renderer；其余项目使用 iOS TwistyPlayer 二维视图内部同一个 `TwistyAnimatedSVG`（公开导出名 `ExperimentalSVGAnimator`）与 puzzle SVG/状态数据。手机把 SVG 转为 480 像素宽 PNG，不再为凑满十条缩图；手表只显示/缓存 PNG，不维护第二套魔方状态或贴纸绘制逻辑。图片绑定打乱槽 ID，成绩不携带图片；旧版当前题保持原文，切到新题后使用新版图片。
- `mobile/src/watch-timer.ts` 是薄 Capacitor adapter；Swift `WatchTimerPlugin` 只做 WatchConnectivity 和原生收件持久化。未配对/未安装手表时不生成批次，其他宿主没有此 capability。
- SwiftUI 只实现手表触摸、连续单调时钟、震动和本地队列。`WatchShared/WatchTimerWire.swift` 为两端 Swift 共用的版本化 DTO、原子文件存储与必要原生数值展示；契约测试用真实 Swift 编译执行，核对 TS 观察罚时/格式化边界及 JSON 往返。
- `app-ui/watch-cube.ts` 直接组合 iOS 的 `GanV4CubeConnection` 与共享 `SmartCubeSessionController`、`SmartCubeSoloTimerController`、timer machine 和 `SmartCubeAttemptProducer`。GAN 加解密、状态推进、设备时钟映射、打乱匹配、起停和逐手录像没有 Swift 副本；手动点按也调用同一 timer machine。当前不运行手机的走偏修正 solver Worker。
- watchOS 没有公开 JavaScriptCore/WebKit SDK；本地 `WatchJS` package 仅嵌入未修改的官方 QuickJS 核心（版本、校验值和许可证见其 `UPSTREAM.md`），不包含 CLI、POSIX libc、网络或远程脚本加载。现有 esbuild 把上述共享模块打入 App 内的 `WatchCube.js`；Swift `WatchCubeConnection` 只适配 CoreBluetooth、JSON 消息及连续时钟。引擎设置内存/栈与单次执行时限，诊断写盘失败不能中断计时。
- 品牌图来自既有 iOS 生成图；`assets:ios` 同步生成手表图标，不维护独立设计源。

### 智能魔方三维显示

连接后计时页显示实时三维魔方，断开后恢复已有高清打乱图。智能魔方连接时仅由魔方转动自动起停，
点击屏幕或辅助功能点击均不触发计时；未连接时保留全屏点击起停。运行中保留三维显示。
离开页面或放腕时停止绘制，恢复时采纳当前真实状态，不补播休眠动作。

`timer-ui/NativeCubeScene` 直接运行 iOS 的 `puzzle-render-core` NxN Cube、Twister、
InstancedRenderer 和 Tweener，导出同一几何、颜色、实例及父节点矩阵。
Swift `WatchCubeScene` 只负责 SceneKit 几何/材质/矩阵映射与 watchOS 帧调度，
没有转层规则、魔方模型或还原判断的 Swift 副本。摄像机朝向函数与 iOS SimCubeView 共用，
转动节奏、积压预算、姿态校准/平滑及中层快速跟随继续使用 shared 的既有实现。
SceneKit 的光照结果并非 WebGL 的像素级保证。2026-10-15 用户在 Series 8 确认显示可用，
真机诊断读到 `ready=true`、`failed=false`、6 次转动、最终画面与真实状态一致；长期流畅度与功耗未验。

乱态连接使用原引擎 `engineHomeSid` 与 `cube.stick` 采纳权威的 54 格状态，随后调用
原 Twister 播放实际转动；无需另造求解器或假设连接时已还原。展示状态用原 `cube.serialize`
核对，计时仍独立使用既有 shared tracker。新的 BLE snapshot 与每手派生状态明确分开，
防止每转一步就重置动画。

`WatchScene.js` 在独立的有界 QuickJS/串行队列中运行，最多向原生交付 30 帧/秒。
动画错误仅隐藏三维视图并显示提示，不关闭 BLE 或计时；原计时引擎的执行预算不变。
仅模拟器包含 `--cube-scene-preview` 验证入口，可通过 `CUBEROOT_SCENE_EVENTS`
注入显示事件，不编译进真机包。该入口与正式界面使用同一个原生绘制适配器。

连接后的计时页三维魔方下方及设备页顶部共用同一个「重置魔方」控件：先实际还原并白顶绿前握好，再点按钮。
手表直接调用原 `GanV4CubeConnection.resetDeviceState`，复用设备回写/状态确认/四秒超时，
会话重置使用原 `SmartCubeSessionController`，朝向仍走 shared 的校准函数。
计时中和重置处理中禁止再次重置，等待期间不生成起停或还原成绩；结束后重新采纳最新真实状态，
断线后的迟到回调不能显示成功。按钮、进度和结果文字仅是 SwiftUI 平台适配。

### 复盘

GAN 丢包恢复沿用小程序已采用的队列保留方式，不得清空积压再以已复原快照代替缺失动作。
历史回复及被解堵的整批动作通过共享 MoveClock 的延迟标记保留设备时间轴；iOS 与 Watch 共用。
恢复时间按动作序号关联首次请求的已观察窗口，分片、无关页及重复回复不消耗其他动作的时间锚点。
延迟历史动作缺少时间时保留既有设备时钟，不能以回复到达时间重新起算；已有插值仍是估计，不能恢复硬件未提供的精确逐手时间。
同一缺口 15 秒未取得进展，或积压达到 128 步时走既有协议错误/断线中断路径，避免无限恢复与计数回绕误配。
共享同步器只请求队首缺口，同一窗口 500 ms 内合并重复请求；历史回复不再反向触发状态查询。
同一积压只在取得进展或跨过安全阈值时重新通知宿主，排队中的重复/过期恢复写入被合并或跳过。
Watch 通过 solo controller 的既有 `futureHistory` 规则同步历史局面：已准备且在 timer machine 原有 2 秒窗口内的首手可补收起表；
整把迟到则取消准备并提示重新打乱，不能由旧历史重新准备、起表或留下无法停止的计时。已经运行的成绩仍接收完整历史。
手表诊断最多保留 256 条动作/状态/历史帧和计时事件，不收集陀螺仪流或带设备标识的握手帧。
`watch-last-attempt-timing.json` 在停表时另存最近一把的设备/本地动作时间和起停信息，最多 1024 条，不被停表后的重复协议回复覆盖。
`watch-cube-status.json` 同时记录宿主脚本/消息处理最大耗时及最多 20 个慢消息；连续时钟耗时包含调度暂停，不单独作为 CPU 阻塞证据。
真实录像完整性必须用实体还原及保存数据确认，短时连接成功不代表复盘验收通过。

新完成的智能魔方成绩使用其他平台同一个 `SmartCubeAttemptProducer` 保存原始动作时间戳、
设备和压缩姿态流，停止事件携带整笔录像，随成绩原子落盘。手动成绩及旧版没有录像的成绩
不显示复盘入口，不从打乱推造动作。最近一把保留在手表，停表后展开复盘，也可从「复盘」重新打开。

手表与 React 报告调用同一 `reconstructionSummary` 显示 STM/TPS/流畅率；共享 `prepareReconstruction` 同时服务
`ReconstructReport` 与 Watch，以同一姿态/物理动作输入调用 `buildReconText`、
`correctReconFromLibrary` 和 `simplifyF2lRotations`。显示分段还原步骤与观察/执行耗时，
不显示方法选择器，由共享 `detectSolveMethod` 自动判定 CFOP/Roux/ZZ；ZBLS/ZBLL 沿用 CFOP 案例识别。完整对照、歧义边界与性能证据见 `apple-watch-replay-parity-audit.md`。
点分段用原始 `fromIdx` 定位，回放索引使用原 `playbackIndexAt`，局面使用原 tracker，绘制继续使用 iOS NxN 模型与动画。
支持播放/暂停、开头/结尾、前后一步和与现有 React 控件相同的 0.5×/1×/2×；原始编码器动作保持无损，v1/v2 姿态按原品牌转换契约读取。
Swift 只适配小屏控件和 JSON，未另写分析或转动算法。复盘打开时暂不允许起新一把，放腕暂停回放。

分析包 `WatchReplay.js` 仅在打开复盘时加载。构建从现有公开 AlgFile API 取得 OLL/PLL/ZBLL/OLLCP/1LLL/COLL/ELL/ZBLS/VLS/WV/SV/CMLL
快照到 DerivedData 的 `WatchAlgorithms/`，原 OLL/PLL 索引保存到 `WatchAlgData.json` 并打包；同一构建目录复用快照，更新用
`WATCH_REFRESH_ALGORITHMS=1` 运行原构建入口。文件记录来源和获取时间，运行时仍经过
`loadAlg` 的同一规范化；没有网络时也能识别这些案例。按需读取集合，避免一次性将全部公式放入手表内存。
复盘使用原生私有字段的 ES2022 包，避免在 QuickJS 中生成大量 WeakMap；宿主 timer 和
分批 Promise jobs 只适配调度，分析规则不变。最多一个在途分析，新记录取消旧请求；共享缓存可持久化复用。
分析的存续范围为整个复盘页，与三维控件是否滚出画面无关。非活跃但仍在前台时暂停播放、
继续分析；真正进入后台或关闭复盘后停止调度。串行 worker 以约 16 ms 软预算推进 timer/jobs，
片间让回主线程处理生命周期，不依赖 Always On 的画面刷新频率；单次执行仍有 2 秒 CPU 保护。异步超时使用各次执行累计的 CPU 时间，watchOS 挂起不计入超时；分析日志的 `analysisMs` 也是 CPU 耗时。
沿用现有报告 worker 的两阶段显示：先发布分段，随后补充公式库校正。
QuickJS 的 Debug 构建也开启 C 优化，Swift 宿主仍保留调试配置。
复盘/绘图引擎限额 32 MiB；BLE/计时仍使用独立 16 MiB 引擎和原有执行保护。

同步到 iPhone 后由同一个 `Solve` 的 moves/gyro/device 字段进入现有完整复盘页（包括文字还原步骤和更详细分析）；
报告内容、区块顺序、显隐、还原步骤格式及播放交互统一由 `timer-ui/reconstruct/report-content`、`report-notation`、`report-player` 提供；Web/iOS 使用 React 绘制器，手表只用 SwiftUI 绘制同一节点和适配系统能力。共享规则更新后重新构建并安装手表生效；新增绘制类型或平台能力仍需宿主适配。完整证据及边界见 `apple-watch-replay-parity-audit.md`。
超过 56 KB 的录像通过 WatchConnectivity 文件传输，手机持久化后仍由既有 IndexedDB 导入并 ACK；
ACK 不删除手表最近一把。杀进程后的未完成录像未做逐帧持久化，继续按原机制恢复为 DNF。
手机批次通过 `recordingVersion=1` 确认能无损接收录像；确认前只保留在手表，
防止旧版手机忽略新字段后仍 ACK。新的配置标识会让升级后的手机重新发布能力批次。

### 运行时暂停保护

2026-10-15 真机诊断捕获 `InternalError: interrupted`。执行预算使用线程 CPU 时间，
不把 watchOS 暂停/抢占时间算作脚本运算；计时成绩继续使用宿主 ContinuousClock。
两秒 CPU、内存/栈与 Promise job 数量保护仍保留，时钟不可读取时拒绝执行。
真实 QuickJS 在执行中暂停三秒后恢复的对照已通过，死循环仍会中断；
含修正的 iOS/Watch 联合签名构建和安装通过，手表放腕恢复及完整自动计时仍需真机确认。
「已存手表」表示有待同步成绩，不能单凭这段文案判断刚才产生了新成绩。

## 数据可靠性

- 每个打乱槽和成绩使用独立 UUID；项目、原分组、打乱原文与观察设置在开始时冻结。原始耗时不含罚时，罚时单独保存。
- 手表停表先持久化草稿，再自动原子写入 outbox 并消费当前槽；上次成绩显示一并保存。进程中途退出后保留中断题为 DNF，用时不可恢复，不把墙上时钟差当作有效成绩；该 DNF 不可在手表改为 OK，可在手机按现有流程管理。新旧待传记录在恢复、入队和发送时均剥离图片缓存，避免大图片阻塞成绩接收。
- iOS 原生层在 WebView 未运行时也先持久化 inbox。JS 只在前台通过同一 repository 队列导入。成绩与 receipt 在同一个 IndexedDB 事务中提交，之后才清 inbox 并 ACK。重复投递不覆盖手机后续编辑，清空、删除或导入备份后也不重新复活旧成绩。
- 已删除原分组的首次迟到成绩进入稳定的「已恢复 · 原分组名」，不切换手机当前分组；恢复分组后续被用户删除时，新的未接收成绩可再次恢复它。
- Watch outbox 上限 1000，满后要求先同步；iOS inbox 上限 2000，满后不确认新数据。存储失败会保留待处理数据并阻止新起表；不可读原始文件不会被静默覆盖。
- WatchConnectivity 传输是最终送达，不承诺实时。抬腕/熄屏不自动停表；进程存活时连续时钟保持计时，系统可能挂起 UI 和震动调度。本版不申请假运动会话维持后台。
- 批次带手机安装实例和单调序号，手表持久化已接收水位，拒绝重复、乱序与已退役实例的旧批次，避免多个传输通道把缓存倒退。
- 原生层在加入批次来源/序号后检查最终 Swift JSON 编码字节数；≤56 KB 使用 application context，高清大批次走系统 `transferFile`，最大 950 KB，必要时减少槽数。已有同来源/序号的文件传输不会重复排队；失败后由持久化请求重试。只使用 Canvas 原生 PNG 编码，没有自写 PNG 编码器或降低分辨率。渲染失败仍保留文字打乱。

## 开发与验证

在仓库 `core/` 运行：

```sh
pnpm --filter @cuberoot/mobile cap:sync:ios
pnpm --filter @cuberoot/mobile watch:build
pnpm --filter @cuberoot/mobile ios:build
pnpm --filter @cuberoot/client exec vitest run tests/watch_timer_import.test.ts tests/watch_timer_sync.test.ts tests/watch_timer_native.test.ts
pnpm --filter @cuberoot/app-ui exec vitest run src/watch-cube.test.ts
```

`watch:build` 使用 watchOS Simulator SDK，需已安装匹配运行环境；`ios:build` 构建含手表 App 的 iOS 模拟器包。Xcode 中选择 `CubeRootWatch` scheme 和配对手表可运行。构建脚本不签名、不上传、不发布。

模拟器已验证真实打乱下发、连续两次起停、+2 选择、重开恢复草稿、两笔成绩回传至手机统计、计时中进程退出后恢复 DNF；详细环境及数值在路线图中。Series 8 GPS / watchOS 26.6 (23U67) 已安装启动；用户确认两次起停（含放下手腕后继续计时）正常、准备时有震感。真机还需独立验证离线/配对重连、手机进程关闭后的传输、8/12 秒观察震感、VoiceOver 和电量影响，不能从模拟器或短时触控推断通过。
