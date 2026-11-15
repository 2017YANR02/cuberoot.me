# CubeRoot Apple Watch 计时器第一版

用户于 2026-10-14 授权以现有 iOS App 为基础实现配套手表计时器，优先复用已有能力。本页描述产品范围和维护方法；验收状态统一记在 `mobile-app-roadmap.md`。

## 使用

1. 在同一个 Xcode 工程 `core/apps/mobile/ios/App/App.xcodeproj` 中构建 App 和 CubeRootWatch。安装到配对的 iPhone / Apple Watch 后，打开手机 CubeRoot。
2. 在手机选择计时项目、成绩分组和观察时限。三阶普通随机打乱由手表本地自动补充，沿用最近同步的分组与观察设置；全新手表安装默认三阶「手表」分组、无观察。其他项目的普通随机打乱与状态图仍由手机生成，每批最多 10 条。图在时间数字下方，长内容可滚动查看。
3. 点击屏幕内容区任意位置（数字、打乱图、文字或空白）起表，再点一次停表；滚动手势不触发点击。开启观察时第一次点击进入观察，第二次点击起表。观察计数及罚时边界沿用网站：恰 15 秒为 OK，恰 17 秒为 +2，超过 17 秒为 DNF（自定义时限按相同规则平移）。8/12 秒在应用前台时震动提醒。异常时的重试按钮独立处理，不触发起表。
4. 停表自动保存并切换下一条打乱，数字保留刚完成的成绩；无需再次确认。手表不提供罚时选择和准备提示，后续成绩修改使用手机既有编辑能力；观察超时与中断状态仍按既有规则记录。存储失败保留停表草稿，重试或重开后继续保存，绝不丢弃原记录。
5. 未联网、手机不在附近时，三阶可在本地继续生成新打乱；其他项目可使用缓存打乱。成绩保存在手表待发送队列。重新连接并打开手机 CubeRoot 后，成绩写入原分组。手机历史、统计、导出及后续编辑使用原有实现。既有 1,000 笔未同步上限仍有效，不代表无限容量。
6. 手机更改项目或分组后，手表保留正在查看/使用的当前题，后续题使用新批次。在途的旧配置本地生成结果会被丢弃。三阶在空闲时预生成三条待用题，缓存与分组模板一起持久化；其他项目补充仍需要手机 App 前台运行。手表没有「下一条打乱」或「获取打乱」按钮。
7. 手表内容下方的「智能魔方」入口直接使用手表蓝牙搜索 GAN v1/v2/v3/v4、MoYu32 和 QiYi（含使用相同协议的 Tornado）；默认验收设备为 GAN 16 UI。先断开魔方与其他 App 的连接，唤醒魔方，在手表允许蓝牙并选择设备。连接后由共享逻辑识别打乱、第一手起表及复原停表。此链路不经手机转发；三阶本地打乱同样接入已有打乱匹配与自动计时。连接、实体转动及离线验收状态以路线图为准。

### 三阶本地生成实现

`build-watch-scramble.ts` 从已锁定的 cubing.js 依赖构建原 `random333Scramble` worker 算法，剥离的仅是浏览器 Worker 传输；不复制、不改写上游随机状态与 min2phase 求解算法，也不降级为随机走步。上游模块布局变化会使构建明确失败。随机源使用系统 `arc4random`，沿用上游随机整数采样。独立 QuickJS/串行队列保留生成表，内存限制 32 MiB、单次脚本 CPU 限制 30 秒；BLE/计时和复盘原预算不变。失败保留已有题与成绩，并提供显式重试。

本地题使用共享 `smartCubeTargetFacelets` 计算状态，由既有 WatchCubeScene/SceneKit 适配器显示紧凑三维预览（静态视图 1 FPS）；不另写魔方绘图规则、不请求图片网络接口。手机缓存题仍显示原 PNG。

本版支持 222、333、444、555、666、777、333oh、clock、mega、pyra、skewb、sq1 共 12 个常规计时项目。只支持明确标注的**普通随机**来源，不声称同步手机当前真题、手动或专项来源。盲拧、最少步、专项和手表端完整统计不在首版范围；智能魔方代码已接入 GAN v1/v2/v3/v4、MoYu32 和 QiYi；新增型号仍需逐款实体魔方验收，不能沿用 GAN 16 UI 的通过记录。现有五端计时器功能合同不因本版改变。

## 复用边界

- iOS 工程新增 `CubeRootWatch` target，随 App 的 Embed Watch Content 打包；现有 iOS bundle ID 不变，手表 bundle ID 为 `me.cuberoot.app.watchkitapp`。首次真机签名需在两个 target 选择同一开发团队。
- `app-ui/watch-timer-sync.ts` 复用 `timer-ui/random-scramble` 的既有生成器、唯一 App `TimerRepository` 实例与 `LatestSnapshotGate`。没有复制打乱算法、React 计时界面、统计引擎或账号系统。
- 打乱图复用 `timer-ui/TimerScramblePreview` 的项目映射、算法适配和现有 SQ1/Megaminx 等 renderer；其余项目使用 iOS TwistyPlayer 二维视图内部同一个 `TwistyAnimatedSVG`（公开导出名 `ExperimentalSVGAnimator`）与 puzzle SVG/状态数据。手机把 SVG 转为 480 像素宽 PNG，不再为凑满十条缩图；手表只显示/缓存 PNG，不维护第二套魔方状态或贴纸绘制逻辑。图片绑定打乱槽 ID，成绩不携带图片；旧版当前题保持原文，切到新题后使用新版图片。
- `mobile/src/watch-timer.ts` 是薄 Capacitor adapter；Swift `WatchTimerPlugin` 只做 WatchConnectivity 和原生收件持久化。未配对/未安装手表时不生成批次，其他宿主没有此 capability。
- SwiftUI 只实现手表触摸、连续单调时钟、震动和本地队列。`WatchShared/WatchTimerWire.swift` 为两端 Swift 共用的版本化 DTO、原子文件存储与必要原生数值展示；契约测试用真实 Swift 编译执行，核对 TS 观察罚时/格式化边界及 JSON 往返。
- `app-ui/watch-cube.ts` 直接组合安装端的 `GanCubeConnection`、`Moyu32CubeConnection`、`QiyiCubeConnection`（GAN v4 仍委托原 `GanV4CubeConnection`） 与共享 `SmartCubeSessionController`、`SmartCubeSoloTimerController`、timer machine 和 `SmartCubeAttemptProducer`。GAN 加解密、状态推进、设备时钟映射、打乱匹配、起停和逐手录像没有 Swift 副本；手动点按也调用同一 timer machine。当前不运行手机的走偏修正 solver Worker。
- watchOS 没有公开 JavaScriptCore/WebKit SDK；本地 `WatchJS` package 仅嵌入未修改的官方 QuickJS 核心（版本、校验值和许可证见其 `UPSTREAM.md`），不包含 CLI、POSIX libc、网络或远程脚本加载。现有 esbuild 把上述共享模块打入 App 内的 `WatchCube.js`；Swift `WatchCubeConnection` 只适配 CoreBluetooth、JSON 消息及连续时钟。引擎设置内存/栈与单次执行时限，诊断写盘失败不能中断计时。
- 品牌图来自既有 iOS 生成图；`assets:ios` 同步生成手表图标，不维护独立设计源。

### 多协议直连（2026-10-16）

- GAN 使用实际 GATT 服务识别代际，名称只用于扫描候选。v1 新增共享 csTimer 协议适配，支持已知 1.0.8–1.1.x 加密固件，复用 AES、状态与时钟模块；未知固件明确连接失败。v2/v3、MoYu32、QiYi 复用安装端现有驱动。
- CoreBluetooth 返回服务、特征及读写/通知属性；通知和待完成操作按完整 service/characteristic UUID 分发。不需要 iPhone 转发蓝牙。
- GAN 无法从设备取得真实 MAC 时显示可取消的 MAC 输入。MoYu32 复用 shared 地址协商：原生地址/广播/已验证缓存 → MY32/MY33 的有限候选 → 手输兜底；所有地址都须通过加密状态帧及完整 cubie 合法性验证，名称本身不构成地址证据。成功地址按设备 UUID 保存，重连仍需验证；输入期间暂停握手超时。详见路线图 2026-10-17 记录。
- 历史不足时保护成绩：GAN v1 超过 6 手、v2 超过 7 手、MoYu32 超过 5 手直接报错中断；v3 同步失去进展不再用快照替代历史。QiYi 在发布动作前校验累计状态与快照，满 12 条新历史无法确认边界时保守中断，不保存不完整的正常成绩。
- 手机导入校验已允许这六个协议标签。旧 iPhone 包需要更新后才能导入新型号记录；未接受的记录继续留在手表，不能据代码声称已完成手机同步验收。
- 已通过协议/桥接定向回归、app-ui/mobile 类型检查、watchOS 真机签名构建和原生 QuickJS 16 MiB 引擎加载/手动计时 smoke。新增五款协议的手表实体连接、动作、自动计时、断线及功耗仍待逐项验证。

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
GAN v2/v3/v4、MoYu32、QiYi 调用各自已有的 `resetDeviceState`；GAN v1 没有已确认的硬件重置命令，因此隐藏该按钮。重置复用设备回写/状态确认/四秒超时，
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

### 新开发者首次接手

Watch 是原生 Xcode target，不通过 `pnpm dev` 或网页热更新启动。准备完整 Xcode、支持目标手表系统的 watchOS SDK，以及能直接执行本仓库 `.ts` 脚本的 Node.js（建议 22.18+）和 pnpm 12.6.0。Xcode 的 Command Line Tools 选择完整 Xcode；首次构建会下载公开公式快照，需要网络。

在本机仓库的 `core/` 目录执行：

```sh
pnpm install --frozen-lockfile
pnpm --filter @cuberoot/client build:deps
pnpm --filter @cuberoot/mobile ios:doctor
pnpm --filter @cuberoot/mobile cap:sync:ios
pnpm --filter @cuberoot/mobile ios:open
```

`build:deps` 只构建共享依赖，不执行 Next build。`cap:sync:ios` 构建手机 Web 产物并同步原生工程。Xcode 工程为 `core/apps/mobile/ios/App/App.xcodeproj`；Watch target 自带 build phase，会自动打包共享计时、三维与复盘 JS，无需手工复制。

模拟器：在 Xcode 安装所需 iOS/watchOS runtime，建立配对的 iPhone/Apple Watch 模拟器；先选 `App` scheme 在配对 iPhone 上运行，再选 `CubeRootWatch` scheme 在 Watch 上运行。打开手机 CubeRoot 生成初始打乱。命令 `pnpm --filter @cuberoot/mobile watch:build` 仅做无签名模拟器构建，不启动或安装 App。

真机：将已配对手表的 iPhone 连接 Mac、信任电脑并保持解锁；在 Xcode 的 Device Hub（旧版为 Devices and Simulators）确认手机和手表可用，按设备提示启用 Developer Mode。在 Xcode 登录具有该应用签名权限的开发账号，为 `App` 和 `CubeRootWatch` 两个 target 选择同一获授权 Team。保留现有 bundle ID；不能沿用另一位开发者的私钥，也不能把随意换 Team/标识视为原安装的无缝更新。签名或设备登记缺权限时由团队管理员开通。设备运行与开发者模式参见 [Apple 官方说明](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices)。

先以 `App` scheme 选择自己的 iPhone，点击 Run；再以 `CubeRootWatch` scheme 选择自己的配对手表，点击 Run。不要选 generic device，它只能构建。成功后打开两端 App 核对初始打乱，智能魔方默认使用 GAN 16 UI，先断开它与其他 App 的连接。

### 日常更新已安装版本

- 只修改 Watch Swift 界面：Xcode 中 `CubeRootWatch` → 目标手表 → Run，即可重新编译并覆盖安装，不需要启动网页服务。
- 修改 Watch 消费的 TypeScript：同样重新 Run，build phase 自动重新打包；涉及 `shared/src` 时先在 `core/` 执行 `pnpm --filter @cuberoot/shared build`。
- 修改手机 React/Capacitor 或两端同步契约：先执行 `pnpm --filter @cuberoot/mobile cap:sync:ios`，再分别 Run 手机和手表，避免两端版本不匹配。
- 保持相同应用标识和有效签名覆盖安装，不先卸载，避免丢失尚未同步的本地成绩。更新前确认重要成绩已同步或备份。Xcode Run 是开发安装，不是 TestFlight/App Store 发版；Git pull 或网站部署不会自动更新手表安装包。

### 2026-10-16 首页布局精简

首页将项目、随机来源和手机同步来的分组名放在同一行，以较小字号显示；静态打乱图限制在 120×100 点内等比显示，保留原高清图片；复盘与智能魔方入口并排，无录像时仅显示智能魔方。非计时状态取消内容区强制占满视口的留白，运行中保留整屏触控区域。

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
