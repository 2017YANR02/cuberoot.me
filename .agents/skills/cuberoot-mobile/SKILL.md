---
name: cuberoot-mobile
description: "Use for CubeRoot installed-client work across Android, iOS, HarmonyOS NEXT, Windows, and macOS: shared React App architecture, Capacitor/Harmony/Tauri hosts, native adapters, device testing, signing, stores, or deciding whether a website/App change requires a client release. Do not use for ordinary responsive web work or unrelated computer setup."
---

# CubeRoot 五端已安装客户端开发与发布

维护 CubeRoot 已安装客户端时遵循本流程，让 Android、iOS、HarmonyOS NEXT、Windows 和 macOS 共用一套 React 产品与业务代码；平台工程只做宿主和系统能力适配。

## 按任务读取事实源

先读仓库根 `AGENTS.md`，再只加载本次需要的资料：

- 日常产品实现：先读 `core/packages/app-ui/package.json` 与相关 `src/`；再按目标宿主读取 `core/apps/mobile`、`core/apps/desktop` 或 `core/apps/harmony` 的 package/config/源码。Android/iOS 任务另读 `core/apps/mobile/README.md`。
- 五端架构、HarmonyOS 或桌面客户端：必须完整读取 `docs/cross-platform-app-contract.md`；进度再读 `docs/mobile-app-roadmap.md`。共享源码、宿主源码、本机构建、安装、设备/实体电脑、签名/公证和发布是不同证据层级。
- 修改 App `/timer`：必须完整读取 `docs/mobile-timer-parity-tracker.md` 与
  `docs/mobile-timer-zero-omission-audit.md`；涉及真题、随机或手动来源时再读
  `docs/mobile-timer-source-adversarial-audit.md`。这些文件仍标记 `NOT COMPLETE` 时，
  不得根据局部截图、一个项目或一条 happy path 声称“完全一致”。
- 修改底部导航、工具页或账号页：必须读取 `docs/mobile-three-tab-contract.md`；
  三栏固定为“计时 / 工具 / 我的”，工具与账号深链以网站路由为内容事实源，原生壳只负责
  导航、安全区、登录桥与平台能力，不复制网站卡片或另造账号 UI。
- 账号、上架或进度：再读 `docs/mobile-app-roadmap.md` 与 `docs/mobile-store-submission.md`。
- 修改共享契约：再读 `core/packages/shared` 中相关入口与消费者。
- iOS 首次接入、签名或 TestFlight：读 [references/ios-release.md](references/ios-release.md)。

以当前源码和工具输出为准，不凭旧对话硬编码 Node、pnpm、Capacitor、Xcode、SDK 或商店政策版本。政策、费用、审核规则、SDK 提交门槛可能变化；需要回答或执行时查官方最新资料。

## 守住五端唯一架构

- 五端是一个产品，不是五套业务实现。最高优先级合同是 `docs/cross-platform-app-contract.md`。
- `core/packages/app-ui` 已是五端唯一 React 产品层；三栏、导航状态、安装端认证客户端、在线 surface 容器和计时产品组合只在这里维护。
- `core/apps/mobile` 是 Android/iOS 的 React + Vite + Capacitor 薄宿主；两端不各写业务 UI，也不为统一原生框架而迁移已经成立的 Capacitor 工程。
- `core/apps/harmony` 是 HarmonyOS NEXT 的 ArkTS + ArkWeb 薄宿主；不得用 ArkUI 重写三栏、计时器或账号。源码、unsigned HAP、设备安装、BLE、签名与发布必须分别取证。
- Windows/macOS 使用同一个 `core/apps/desktop` Tauri 薄宿主；不得建两个桌面 React 工程。PWA 可作网站入口，但不算桌面客户端完成证据。
- Mobile、Desktop 和 Harmony 只能 import `@cuberoot/app-ui` 的公开入口，禁止 app→app 源码、CSS 或 `dist` 依赖。
- 稳定、无运行时依赖且已有多端消费者的数据模型、校验、算法、状态机放 `core/packages/shared`；不要从网站或 Android 复制到 iOS。
- 网站专属 Next 路由、SEO、服务端组件留在 client；共享安装端导航与 IndexedDB 产品仓储留在 `app-ui`，系统桥留在各宿主。
- 五端只分别实现权限、BLE transport、安全存储、通知、深链、分享、文件、打印、窗口和生命周期等 platform adapters；协议解析、账号契约、数据规则、对战状态和 React 功能必须共享。新 capability contract 只在第二个真实消费者落地时逐项提取，不为计划中宿主预建空接口。
- `dist/` 和 Capacitor 同步进去的 Web 产物是生成物，不是源码；改 React/shared 后重新 build + sync。
- 不把远程网站设为 App 的启动运行代码，也不把整站 WebView 当正式产品。

当前永久标识从配置读取并保持一致；除非用户明确决定迁移，否则不要更改 `me.cuberoot.app` 和 `CubeRoot`。

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
- 成绩历史的自动标签必须只从 `@cuberoot/shared/timer/history-tags` 读取 ID、文案、顺序、toggle 和 PB/ao/MBLD 派生规则，徽标/筛选器只使用 `@cuberoot/timer-ui`；标签不写入 DB/备份。智能魔方动作只用 shared `TimerSmartCubeMoveRecorder` 收集，分段只调用 shared `stageSegmentsFor`；cube state、CFOP 检测/识别、HTM 与朝向归一化均在 `@cuberoot/shared/timer/reconstruct/*`，网站旧路径只能兼容 re-export。Web/五端不得再写第二套 move buffer、OLL/PLL 或阶段识别器。
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
  宿主响应式尺寸由外层容器控制并给共享预览传 `fill`；不可解析打乱必须隐藏，不能继续显示上一题。

## 开发电脑与 Windows/macOS 客户端

“在 Windows/Mac 上开发”与“构建 Windows/macOS 客户端”是两件事。前者遵循下面的 Git 交接；后者必须遵循 `docs/cross-platform-app-contract.md`，由同一个 `core/apps/desktop` 工程输出两端，不得复制 Mobile。

- 两台电脑各自完整 clone 同一仓库，并通过 Git 同步源码。
- 两台电脑可同时在 `main` 开发，每项任务形成 commit。
- 每次 push 前固定执行 `git fetch origin`、`git rebase origin/main`、`git push origin main`。
- rebase 出现冲突时逐项核对并解决，完成相关验证后继续 rebase；push 因远端更新被拒时重复上述流程。
- CubeRoot 的 push 会触发部署，是否 push 以用户当次授权为准。
- Mac 拉到本 skill 后重新打开仓库或新开会话，即可自动发现 `cuberoot-mobile`。

## 变更是否需要商店发版

先分类再动手：

| 变化 | 是否通常要发新版 App |
|---|---|
| API、数据库、公式、统计、公告等服务器数据，且旧 App 契约兼容 | 否 |
| App 运行时通过版本化 API/静态数据读取的内容 | 否 |
| `core/packages/app-ui`、`core/packages/timer-ui` 或某一宿主中打包的 React/TS/CSS、离线内置数据 | 是，需要发布所有受影响的已安装客户端 |
| Capacitor 插件、原生权限、Android/iOS 原生配置和代码 | 是 |
| 图标、启动图、隐私行为、SDK、登录、支付 | 是，并重新核对商店资料 |

不要追求“网站每次更新 App 自动执行新代码”。远程只下发内容、数据和受控配置；核心可执行代码随审核包发布。API 保持向后兼容，让未升级用户继续使用。

## 平台与账号边界

- 先检测操作系统和工具链；Windows 不执行 Xcode，Mac 不重写 Android 业务层。
- App 登录复用网站唯一账号和 `LoginForm`：系统浏览器 → 90 秒单次 mobile ticket → PKCE S256 + state → App deep link。长期 JWT 与 verifier 不得进入 URL；请求、回调、session 契约统一走 `@cuberoot/shared/auth/web-session`。
- 底栏 Account 始终加载原始 `/account`，不加 `auth=mobile`。iframe 内整个 canonical `LoginForm`（邮箱/手机/密码及 SSO）通过 `@cuberoot/shared/mobile-embed` 委托系统 Browser；native secure session 再申请 90 秒 `web-session` ticket 回灌 iframe。iframe logout/删除与 App logout 要互相清会话；生产/五平台 provider E2E 未验收前不得只凭按钮或单测宣称闭环，外部 Browser 独立 logout 也不能假装会主动通知休眠 App。
- 五端共用 `@cuberoot/app-ui` 的 `InstalledAuthClient` 和同一网站账号/PKCE 契约；`core/apps/mobile/src/mobile-auth.ts` 只接 Capacitor Browser 与 Keychain/Keystore，Desktop 只接系统 keyring，Harmony 只接 ArkTS 系统安全存储 bridge。不要添加原生凭据表单、第二套账号表或平台各自的 token 模型；某个平台源码接线不等于 provider E2E 已通过。
- 移动交接中，provider-null 路径只显示网站现有邮箱/手机号，provider-tagged 路径显示 canonical SSO 列表并继续同一 PKCE 流。启用 WCA、Google、微信、QQ、支付宝等第三方主账号登录前，必须重新核对当时的 Apple 4.8，并先完成需要的 Sign in with Apple 等价路径。
- 登录与同步是两个里程碑。当前计时、备注、设置仍只在本机；没有完成匿名数据合并、冲突、删除和多设备验证前，不得把登录文案或路线图写成“已同步”。账号资料、身份绑定和账号注销继续打开网站统一管理页。
- 修改回跳时同时核对 shared callback allowlist、Android Manifest、iOS URL Types、release/debug application ID 和冷启动 `appUrlOpen` 竞态；不得只修一个平台。
- Android 复用 `core/apps/mobile/package.json` 的现有 scripts；先从 `core/` 运行 build/sync/run，不手写第二套构建流程。
- 没有 Android 真机时，优先使用 Android Studio Device Manager 的官方 AVD 验证安装、启动、布局、计时、存储和基础生命周期；AVD 名称、SDK 版本和本机路径必须现场探测，不能写死旧对话中的值。
- 模拟器或 MuMu 只算基础验证。BLE、真实震感、厂商权限差异、后台/功耗、分享和发布安装体验保留真机门槛；模拟器证据不得把路线图中的真机项目勾为完成。
- macOS 图形模拟器若因内存压力退回软件渲染，先读取 emulator 日志并释放内存；可在当前机器支持时用 `-gpu host` 重试。过期快照可用非破坏性的 `-no-snapshot-load` 冷启动，未经用户授权不要用会清空 AVD 数据的 `-wipe-data`。
- Google Play 当前走组织账号，D-U-N-S 只证明 Google 组织核验；Apple 当前走个人会员路线，须另验会员 Active 和 Xcode 付费 Team。
- `.p12`、`.mobileprovision`、`AuthKey_*.p8`、Android keystore、私钥、密码和本机 Xcode 状态绝不进 Git；缺少 ignore 时先补规则。

## 原生智能魔方

- 当前首个真机矩阵是 OPPO Reno7 Pro 5G `PFDM00`（Android 13 / ColorOS 13.1）+ GAN 16 UI；不要再次询问是否有 Android 手机或首测魔方型号，先用 `adb devices -l` 核对它是否在线。
- GAN 16 UI 按现有网站 registry 归入 GAN v4；服务、特征、加解密、历史补帧和转动解析复用 `@cuberoot/shared/smart-cube/gan-v4`，禁止在 Mobile 复制协议常量或算法。
- 设备时间映射统一使用 `@cuberoot/shared/smart-cube/move-clock` 的 `MoveClock`；状态帧采纳、转动推进和复原判断统一使用 `@cuberoot/shared/smart-cube/cubie` 的 `SmartCubeStateTracker`。网站旧 `move_clock.ts` / `state_track.ts` 只是兼容 adapter，Mobile 不得复制它们或另建第二套状态模型。
- 打乱逐步提示、匹配判定、走偏修正和异步重试统一使用 `@cuberoot/shared/smart-cube/scramble-hint`，Solo 生命周期统一使用 `@cuberoot/shared/smart-cube/scramble-guidance`；Kociemba cubie 运算只从 `@cuberoot/puzzle-solvers/kociemba/cube` 取。Web 与五端必须共用 `TimerScrambleStrip` 和 `@cuberoot/shared/timer` 的 Solo/Local/Net capability helpers；宿主只可提供 facelets、solver Worker、预备回调和原生 transport，不得复制提示算法、生命周期状态机或模式名单。pending solver 必须以当前 facelets 重验，同 target 请求 coalesce，新 target 排在旧请求完成后重试；切题、运行、断线或协议错误时 fail closed。
- 自动计时顺序固定复用 shared timer machine：状态跟踪先应用转动；若此前已预备则该第一手 `start-from-cube` 起表；若应用后状态匹配当前打乱则为下一手预备；只有未复原→复原边沿触发 `stop-from-cube`。不要用 BLE 到达时间代替 `MoveClock` 校准时间，也不要只凭最后一手文字猜复原。
- GAN 连接逻辑统一由 `@cuberoot/app-ui` 的 `useInstalledSmartCube` 消费 shared 协议；Mobile 用 `@capacitor-community/bluetooth-le` 薄 transport，Desktop 用 `@mnlphlp/plugin-blec` 薄 transport，Harmony 用 ArkTS ConnectivityKit bridge。不要从 client app deep import driver，也不要在每个平台或品牌 driver 里复制 GAN 协议。
- Android 12+ 使用 `BLUETOOTH_SCAN` / `BLUETOOTH_CONNECT` 和运行时“附近设备”授权；扫描不用于定位。BLE feature 必须 `required=false`，无 BLE 设备仍可使用本地计时。
- 新型号先过真机 spike：扫描结果、广播/MAC、连接、服务发现、读写、通知、至少一条可解析转动。只有这些证据齐全才在路线图标记支持；模拟器、仅搜到名称或仅连上 GATT 都不算完成。
- 当前 OPPO + GAN 16 UI 已完成上述 spike，并实测打乱匹配后自动预备、第一手起表、复原停表和本地保存，首条硬件计时证据为 `5.20`。以后不要再询问该组合是否能连接；继续测试时从权限拒绝、后台、蓝牙关闭、距离中断和反复重连等尚未完成门槛推进。
- Android 的扫描 `deviceId` 通常是 MAC；iOS 是随机标识，GAN 密钥所需 MAC 必须从 manufacturer data 或受验证的名称规则取得。不得把 Android 假设写进共享协议层。

## 验证与进度记账

按变更范围先跑 `@cuberoot/app-ui` typecheck/test，再跑受影响宿主的 typecheck/test/Web build 与原生构建：Mobile 做 Capacitor sync 和目标 Android/iOS 构建，Desktop 在 Windows/macOS 分别做 Tauri native build，Harmony 先同步本地 Web bundle再用当前官方 Hvigor 构建 HAP。CI job 已写入但未实际运行时只能记“定义已存在”；`--no-bundle`、Vite build、unsigned HAP、`.app` 或 `.dmg` 也不能替代安装、设备、BLE、签名/公证或发布证据。权限、分享、后台、升级与登录还要在目标平台实测；SDK、数据流或付费变化要复核商店隐私声明。

五端总体状态只有在 Android/iOS/HarmonyOS NEXT/Windows/macOS 都具备各自 build、安装、系统 adapter、设备/实体电脑和发布证据后才能完成。某一端通过、PWA 可安装、Android 兼容层运行或共享代码存在，都不能替代其他平台证据。

`docs/mobile-app-roadmap.md` 是唯一进度账本。只在有实现与验证证据时把 `[ ]` 改为 `[x]`，并在“当前证据”写命令、设备/控制台结果或 commit。用户口头确认设备、安装或付款可记作已具备条件，但不能替代 build、真机、签名或商店状态证据。

用户要求审计或任务涉及签名、发布时，让独立 agent 检查重复实现、跨包边界、五平台回归、凭据泄漏、路线图勾选和发布证据，处理发现后再提交。
