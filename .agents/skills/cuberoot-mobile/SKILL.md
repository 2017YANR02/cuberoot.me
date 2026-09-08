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
- Android/iOS 共用的 Mobile Vite 产物必须保留 `core/apps/mobile/vite.config.ts` 的 `target/cssTarget: chrome103`，直到最低 Android WebView 基线经真机证据正式上调。OPPO `PFDM00` 的 WebView 103 不支持 `color-mix()`、`dvh`，且 Vite 默认压缩会把传统 `max-width/max-height` 媒体查询改成该内核无法解析的 range syntax；共享 CSS 必须给这些能力提供可工作的旧语法/直接色值 fallback，再用 `@supports` 渐进增强。不能只看源码或桌面 Chrome，build 后要检查产物仍含传统媒体查询，并在真机 WebView 验证 computed style、滚动与边界。
- 不把远程网站设为 App 的启动运行代码，也不把整站 WebView 当正式产品。

当前永久标识从配置读取并保持一致；除非用户明确决定迁移，否则不要更改 `me.cuberoot.app` 和 `CubeRoot`。

## `/timer` 契约

修改安装端计时器、成绩历史或打乱来源前，必须完整读取 [计时器契约](references/timer-contract.md)；其中仓库路径均相对仓库根目录，原有零遗漏验收不变。

## 开发电脑与 Windows/macOS 客户端

“在 Windows/Mac 上开发”与“构建 Windows/macOS 客户端”是两件事。前者遵循下面的 Git 交接；后者必须遵循 `docs/cross-platform-app-contract.md`，由同一个 `core/apps/desktop` 工程输出两端，不得复制 Mobile。

- 两台电脑各自完整 clone 同一仓库，并通过 Git 同步源码。
- 两台电脑可同时在 `main` 开发，每项任务形成 commit。
- 每次 push 前固定执行 `git fetch origin`、`git rebase origin/main`、`git push origin main`。
- rebase 出现冲突时逐项核对并解决，完成相关验证后继续 rebase；push 因远端更新被拒时重复上述流程。
- CubeRoot 的 push 会触发部署;本 Skill 保留更严格的例外:须有用户当次授权,已有覆盖本次发布的授权不重复询问。
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

涉及 BLE、智能魔方协议、状态跟踪、打乱引导或自动计时时，必须读取 [智能魔方契约](references/smart-cube.md)；其中仓库路径均相对仓库根目录。

## 验证与进度记账

按变更范围先跑 `@cuberoot/app-ui` typecheck/test，再跑受影响宿主的 typecheck/test/Web build 与原生构建：Mobile 做 Capacitor sync 和目标 Android/iOS 构建，Desktop 在 Windows/macOS 分别做 Tauri native build，Harmony 先同步本地 Web bundle再用当前官方 Hvigor 构建 HAP。CI job 已写入但未实际运行时只能记“定义已存在”；`--no-bundle`、Vite build、unsigned HAP、`.app` 或 `.dmg` 也不能替代安装、设备、BLE、签名/公证或发布证据。权限、分享、后台、升级与登录还要在目标平台实测；SDK、数据流或付费变化要复核商店隐私声明。

五端总体状态只有在 Android/iOS/HarmonyOS NEXT/Windows/macOS 都具备各自 build、安装、系统 adapter、设备/实体电脑和发布证据后才能完成。某一端通过、PWA 可安装、Android 兼容层运行或共享代码存在，都不能替代其他平台证据。

`docs/mobile-app-roadmap.md` 是唯一进度账本。只在有实现与验证证据时把 `[ ]` 改为 `[x]`，并在“当前证据”写命令、设备/控制台结果或 commit。用户口头确认设备、安装或付款可记作已具备条件，但不能替代 build、真机、签名或商店状态证据。

用户要求审计或任务涉及签名、发布时，让独立 agent 检查重复实现、跨包边界、五平台回归、凭据泄漏、路线图勾选和发布证据，处理发现后再提交。
