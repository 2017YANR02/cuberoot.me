---
name: cuberoot-mobile
description: "Use for CubeRoot native App work rooted at core/apps/mobile: Capacitor Android/iOS implementation, Windows-Mac handoff, Xcode/TestFlight/App Store or Google Play release, or deciding whether a CubeRoot website/mobile change requires a store release. Do not use for ordinary responsive web work or unrelated Mac setup."
---

# CubeRoot 移动端开发与发布

维护 `core/apps/mobile` 时遵循本流程，让 Android 和 iOS 共用一套 React 业务代码，并让 Windows、Mac 上的 Codex 从同一仓库事实继续工作。

## 按任务读取事实源

先读仓库根 `AGENTS.md`，再只加载本次需要的资料：

- 日常实现：`core/apps/mobile/README.md`、`package.json`、`capacitor.config.ts` 和相关源码。
- 账号、上架或进度：再读 `docs/mobile-app-roadmap.md` 与 `docs/mobile-store-submission.md`。
- 修改共享契约：再读 `core/packages/shared` 中相关入口与消费者。
- iOS 首次接入、签名或 TestFlight：读 [references/ios-release.md](references/ios-release.md)。

以当前源码和工具输出为准，不凭旧对话硬编码 Node、pnpm、Capacitor、Xcode、SDK 或商店政策版本。政策、费用、审核规则、SDK 提交门槛可能变化；需要回答或执行时查官方最新资料。

## 守住唯一架构

- 唯一移动 App 是 `core/apps/mobile` 的 React + Vite + Capacitor 工程；Android 和 iOS 不各写一套业务 UI。
- 稳定、无运行时依赖且已有多端消费者的数据模型、校验、算法、状态机放 `core/packages/shared`；不要从网站或 Android 复制到 iOS。
- 网站专属 Next 路由、SEO、服务端组件留在 client；移动导航、离线仓储和原生桥留在 mobile。
- Android/iOS 只分别实现权限、BLE transport、Keychain/Keystore、通知、深链、分享等平台适配；协议解析和业务规则尽量共享。
- `dist/` 和 Capacitor 同步进去的 Web 产物是生成物，不是源码；改 React/shared 后重新 build + sync。
- 不把远程网站设为 App 的启动运行代码，也不把整站 WebView 当正式产品。

当前永久标识从配置读取并保持一致；除非用户明确决定迁移，否则不要更改 `me.cuberoot.app` 和 `CubeRoot`。

## Windows 与 Mac

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

## 验证与进度记账

按变更范围做相关 tests、mobile typecheck/build、目标平台 sync 和 native diff；权限、BLE、分享、后台、升级与 release 需要真机/控制台证据。登录、SDK、数据流或付费变化还要复核商店隐私声明。

`docs/mobile-app-roadmap.md` 是唯一进度账本。只在有实现与验证证据时把 `[ ]` 改为 `[x]`，并在“当前证据”写命令、设备/控制台结果或 commit。用户口头确认设备、安装或付款可记作已具备条件，但不能替代 build、真机、签名或商店状态证据。

用户要求审计或任务涉及签名、发布时，让独立 agent 检查重复实现、跨包边界、双平台回归、凭据泄漏、路线图勾选和发布证据，处理发现后再提交。
