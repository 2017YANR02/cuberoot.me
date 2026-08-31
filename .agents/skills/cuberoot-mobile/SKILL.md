---
name: cuberoot-mobile
description: "Use for CubeRoot installed-client work across Android, iOS, HarmonyOS NEXT, Windows, and macOS: shared React App architecture, Capacitor/Harmony/Tauri hosts, native adapters, device testing, signing, stores, or deciding whether a website/App change requires a client release. Do not use for ordinary responsive web work or unrelated computer setup."
---

# CubeRoot 移动端开发与发布

维护 CubeRoot 已安装客户端时遵循本流程，让 Android、iOS、HarmonyOS NEXT、Windows 和 macOS 共用一套 React 产品与业务代码；平台工程只做宿主和系统能力适配。

## 按任务读取事实源

先读仓库根 `AGENTS.md`，再只加载本次需要的资料：

- 日常实现：`core/apps/mobile/README.md`、`package.json`、`capacitor.config.ts` 和相关源码。
- 五端架构、HarmonyOS 或桌面客户端：必须完整读取 `docs/cross-platform-app-contract.md`；进度再读 `docs/mobile-app-roadmap.md`。五端目标已确定不等于后三端已实现。
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
- `core/apps/mobile` 是现有 Android/iOS React + Vite + Capacitor 宿主；两端不各写一套业务 UI，也不为统一原生框架而迁移已经成立的 Capacitor 工程。
- HarmonyOS NEXT 使用计划中的 `core/apps/harmony` ArkTS + ArkWeb 薄宿主；不得用 ArkUI 重写三栏、计时器或账号。
- Windows/macOS 使用计划中的同一个 `core/apps/desktop` Tauri 宿主；不得建两个桌面 React 工程。PWA 可作网站入口，但不算桌面客户端完成证据。
- 第二个非 Capacitor 宿主落地时，在同一变更中把五端共用的 React App 组合提取为有两个真实消费者的 `@cuberoot/app-ui`。此前不建空包；此后禁止 app→app 源码、CSS 或 `dist` 依赖。
- 稳定、无运行时依赖且已有多端消费者的数据模型、校验、算法、状态机放 `core/packages/shared`；不要从网站或 Android 复制到 iOS。
- 网站专属 Next 路由、SEO、服务端组件留在 client；移动导航、离线仓储和原生桥留在 mobile。
- 五端只分别实现权限、BLE transport、安全存储、通知、深链、分享、文件、打印、窗口和生命周期等 platform adapters；协议解析、账号契约、数据规则、对战状态和 React 功能必须共享。
- `dist/` 和 Capacitor 同步进去的 Web 产物是生成物，不是源码；改 React/shared 后重新 build + sync。
- 不把远程网站设为 App 的启动运行代码，也不把整站 WebView 当正式产品。

当前永久标识从配置读取并保持一致；除非用户明确决定迁移，否则不要更改 `me.cuberoot.app` 和 `CubeRoot`。

## `/timer` 零遗漏与单一来源

- 网站 `/timer` 的当前可达产品行为是迁移期间的事实源；“一致”指
  `项目 × 人数 × 来源 × 来源配置 × 计时阶段 × 数据状态 × 语言 × 主题 × 视口/输入方式`
  的完整组合，不是标题、颜色或单张截图相似。
- 网站出现的每个控件、菜单项、弹层、空态、加载态、错误态和点击结果都必须登记并实现；
  不支持、点击无响应、静态文字冒充按钮、外跳网站或隐藏入口都不能算 parity。
- 43 项目录和 WCA 映射等纯契约只从 `@cuberoot/shared/timer` 读取；Web/Mobile 共用的
  React 控件放 `@cuberoot/timer-ui`；Mobile 不得 deep import client，也不得复制
  `SoloView`、`BattleView`、来源菜单、二阶类型表、手动队列或重试常量。
- 二阶必须覆盖网站的完整状态、3-gen、EG/CLL/EG1/EG2/TCLL+/TCLL-/TCLL/LS/无连色，
  以及 WCA 11 步/最优口径；真题不能假换成本地随机，随机专项也不能只画选择器不接 provider。
- 手动输入是跨 43 项共享的 opaque 多行队列：逐非空行 trim、即时持久化、改动重置、顺序循环、
  允许空打乱；不得添加网站没有的校验、提交或独立清空逻辑。
- “手动输入打乱”和“手动录入成绩”是两项独立能力。成绩录入必须复用
  `@cuberoot/shared/timer` 的 normal/FMC/MBLD、OK/+2/DNF/DNS 规则与
  `@cuberoot/timer-ui` 的 `TimerManualEntryModal`；Web/Mobile 宿主只负责存储 adapter，
  禁止再写时间 parser、FMC 计数器、MBLD 9f12c 规则或第二个表单。
- 43 项里只有 42 项具有随机生成器；`custom` 的 Real/Random 是网站明确允许计时和保存的
  canonical ready 空槽，必须由 shared `timerScrambleAllowsEmptySlot` 显式授权。不得把它伪造成
  第 43 个随机 provider，也不得把其他 provider 的空返回或失败当成同一语义。
- WCA 真题的身份不是打乱文本。缓存、前后浏览、保存来源和自动打卡必须保留
  `competition/event/round/group/extra/scrambleNumber` slot identity；两道文本相同的官方题仍是
  两个不同槽位，禁止以 `Map<scramble, meta>` 覆盖 occurrence。
- 每项完成前至少要有共享契约测试、宿主集成测试、集合差分、无遮挡/无横向溢出检查，及 OPPO
  真机证据；关键结论再由独立 agent 做反例审查。Android 通过不替代 iOS，二者均通过前整体仍是
  `NOT COMPLETE`。

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
| `core/apps/mobile/src` 中打包的 React/TS/CSS、离线内置数据 | 是 |
| Capacitor 插件、原生权限、Android/iOS 原生配置和代码 | 是 |
| 图标、启动图、隐私行为、SDK、登录、支付 | 是，并重新核对商店资料 |

不要追求“网站每次更新 App 自动执行新代码”。远程只下发内容、数据和受控配置；核心可执行代码随审核包发布。API 保持向后兼容，让未升级用户继续使用。

## 平台与账号边界

- 先检测操作系统和工具链；Windows 不执行 Xcode，Mac 不重写 Android 业务层。
- App 登录复用网站唯一账号和 `LoginForm`：系统浏览器 → 90 秒单次 mobile ticket → PKCE S256 + state → App deep link。长期 JWT 与 verifier 不得进入 URL；请求、回调、session 契约统一走 `@cuberoot/shared/auth/web-session`。
- 底栏 Account 始终加载原始 `/account`，不加 `auth=mobile`。iframe 内整个 canonical `LoginForm`（邮箱/手机/密码及 SSO）通过 `@cuberoot/shared/mobile-embed` 委托系统 Browser；native secure session 再申请 90 秒 `web-session` ticket 回灌 iframe。iframe logout/删除与 App logout 要互相清会话；生产/双平台 provider E2E 未验收前不得只凭按钮或单测宣称闭环，外部 Browser 独立 logout 也不能假装会主动通知休眠 App。
- Android/iOS 共用 `apps/mobile/src/auth/mobile-auth.ts`，会话通过 `@aparajita/capacitor-secure-storage` 进入 iOS Keychain / Android Keystore 保护的存储；不要添加原生凭据表单、第二套账号表或平台各自的 token 管理。
- 移动交接登录当前只显示网站现有邮箱/手机号。启用 WCA、Google、微信、QQ、支付宝等第三方登录前，必须重新核对当时的 Apple 4.8，并先完成需要的 Sign in with Apple 等价路径。
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
- 自动计时顺序固定复用 shared timer machine：状态跟踪先应用转动；若此前已预备则该第一手 `start-from-cube` 起表；若应用后状态匹配当前打乱则为下一手预备；只有未复原→复原边沿触发 `stop-from-cube`。不要用 BLE 到达时间代替 `MoveClock` 校准时间，也不要只凭最后一手文字猜复原。
- 原生 central BLE 默认使用与 Capacitor 8 同主版本的 `@capacitor-community/bluetooth-le`，由 Mobile 的薄 `BleTransport` adapter 包装；网站继续使用 Web Bluetooth adapter。不要从 client app deep import driver，也不要在每个品牌 driver 里直接调用 Capacitor 插件。
- Android 12+ 使用 `BLUETOOTH_SCAN` / `BLUETOOTH_CONNECT` 和运行时“附近设备”授权；扫描不用于定位。BLE feature 必须 `required=false`，无 BLE 设备仍可使用本地计时。
- 新型号先过真机 spike：扫描结果、广播/MAC、连接、服务发现、读写、通知、至少一条可解析转动。只有这些证据齐全才在路线图标记支持；模拟器、仅搜到名称或仅连上 GATT 都不算完成。
- 当前 OPPO + GAN 16 UI 已完成上述 spike，并实测打乱匹配后自动预备、第一手起表、复原停表和本地保存，首条硬件计时证据为 `5.20`。以后不要再询问该组合是否能连接；继续测试时从权限拒绝、后台、蓝牙关闭、距离中断和反复重连等尚未完成门槛推进。
- Android 的扫描 `deviceId` 通常是 MAC；iOS 是随机标识，GAN 密钥所需 MAC 必须从 manufacturer data 或受验证的名称规则取得。不得把 Android 假设写进共享协议层。

## 验证与进度记账

按变更范围做相关 tests、mobile typecheck/build、目标平台 sync 和 native diff；权限、BLE、分享、后台、升级与 release 需要真机/控制台证据。登录、SDK、数据流或付费变化还要复核商店隐私声明。

五端总体状态只有在 Android/iOS/HarmonyOS NEXT/Windows/macOS 都具备各自 build、安装、系统 adapter、设备/实体电脑和发布证据后才能完成。某一端通过、PWA 可安装、Android 兼容层运行或共享代码存在，都不能替代其他平台证据。

`docs/mobile-app-roadmap.md` 是唯一进度账本。只在有实现与验证证据时把 `[ ]` 改为 `[x]`，并在“当前证据”写命令、设备/控制台结果或 commit。用户口头确认设备、安装或付款可记作已具备条件，但不能替代 build、真机、签名或商店状态证据。

用户要求审计或任务涉及签名、发布时，让独立 agent 检查重复实现、跨包边界、双平台回归、凭据泄漏、路线图勾选和发布证据，处理发现后再提交。
