# CubeRoot 五端三栏产品合同

状态：`ACTIVE`

最后更新：2026-08-31

所有者决定：Android、iOS、HarmonyOS NEXT、Windows 和 macOS 共用“计时 / 工具 / 我的”三个产品 surface；紧凑窗口使用底栏，桌面窗口仍消费同一个 React 导航与三栏状态，不得建立平台专用功能树。三栏的内容、视觉、交互、状态和功能完整一致是验收目标，第一原则是不复制网站页面形成多端维护。五端宿主与单一来源的最高优先级边界见 [cross-platform-app-contract.md](./cross-platform-app-contract.md)。

若某项只能通过高成本原生重写实现，优先补通用 capability port 并如实记录平台限制；只有所有者明确接受的高成本豁免可以保留未完成，且当时不得声称“完整一致”。

“完整一致”必须按 [mobile-timer-parity-tracker.md](./mobile-timer-parity-tracker.md) 的零遗漏笛卡尔积验收。实现者无权自行把网站已有功能判成“代价高所以不做”；必须先列明成本与方案并取得所有者明确批准。当前 App 远未完成，43 项菜单或某个子功能通过都不能代表计时栏完成。

## 1. 唯一产品结构

| 底栏 | 权威内容 | App 行为 | 完成标准 |
| --- | --- | --- | --- |
| 计时 | 网站 `/timer` 的完整 UI/UX；原生 BLE 等只替换 transport | 使用打包进 App 的共享 React 计时器，离线可用 | 按 [mobile-timer-parity-tracker.md](./mobile-timer-parity-tracker.md) 全矩阵验收 |
| 工具 | 当前语言的网站首页 `/` 或 `/zh`，以及从其中进入的所有子页面 | 直接显示网站真实页面；站内卡片和链接继续在同一 Web browsing context 导航 | 首页内容、卡片、路由和子页面不复制；真实点击 smoke 通过 |
| 我的 | 当前语言的网站 `/account` 或 `/zh/account` | 直接显示网站真实账号页和现有登录/账号管理能力 | 使用网站唯一账号系统；不建设 Mobile 第二套账号页 |

“完整网站”在这里是内容事实源，不意味着把 Next 源码复制进 `core/apps/mobile`，也不意味着把整个 App 启动地址改成远程 URL。计时仍保留本地优先和原生能力；工具与我的是明确的在线 Web surface。

## 2. 不重复造轮的固定边界

```text
计时领域逻辑              → @cuberoot/shared
Web + Mobile 计时 React UI → @cuberoot/timer-ui
工具/我的页面与路由         → core/packages/client（线上网站唯一实现）
五端三栏 React 产品组合       → @cuberoot/app-ui（第二宿主落地时从 Mobile 提取）
Android/iOS 宿主与 Web 容器   → core/apps/mobile（同一份 React + Capacitor 代码）
HarmonyOS NEXT 薄宿主         → core/apps/harmony（计划，ArkTS + ArkWeb）
Windows/macOS 共享桌面宿主    → core/apps/desktop（计划，同一 Tauri 工程）
原生 BLE/权限/分享/安全存储   → 各宿主 platform adapter
```

禁止：

- 在 Mobile 重写网站首页卡片、目录、搜索、账号页面或任一工具子页面。
- Android、iOS、HarmonyOS、Windows 和 macOS 各写一套底栏、工具页或账号页。
- 让 Harmony/Desktop import Mobile 源码或 `dist`，或先复制再承诺以后合并。
- Mobile import `core/packages/client` 私有源码或 CSS。
- 把网站页面抓取、复制或静态导出进 App 后再单独维护。
- 建设第二套登录表单、账号模型或 token 生命周期。
- 用无响应控件、“即将推出”或打开错误页面冒充一致性完成。
- 让系统状态栏、挖孔/刘海、软键盘、三栏底栏、toast、菜单或对话框遮挡正文和操作。
- 以横向溢出、屏外控件、裁切文字、不可读对比度或只能看到但点不到的内容交付。

允许：

- Web 内容继续由网站部署独立更新，无需每次重新上架 App。
- 共享 React 产品层只维护一套 Web 容器、三栏、网络/返回/外链状态；各宿主只维护系统薄适配。
- 网站页面需要 BLE、文件、相机、下载、OAuth 或其他 iframe 受限能力时，对该动作回退到系统浏览器或原生 adapter；不得复制整页。

## 3. Web surface 决策与成本上限

### 3.1 当前首选：同 App 内嵌真实网站

2026-08-30 对生产 `/`、`/zh`、`/account`、`/zh/account` 的响应头检查未发现 `X-Frame-Options` 或 CSP `frame-ancestors` 禁止，因此先采用 App 内 iframe Web surface：

- 工具和我的各自拥有持久 browsing context，切换底栏不丢失当前子页面。
- iframe 直接访问 `https://cuberoot.me` 的真实路由，站内卡片与子页面无需 Mobile 路由表。
- 底栏由打包的 Mobile UI 持有，不进入网站源码。
- 网站与原生壳只通过 `@cuberoot/shared/mobile-embed` 的导航消息契约协作：网站报告当前栏的历史深度，Android/iOS 把系统返回动作送给当前 iframe；不维护 Mobile 页面路由副本。
- 工具/我的需要网络；离线时计时仍可用，Web surface 显示明确网络状态。

“我的”必须直接使用未改写的当前语言 `/account` 或 `/zh/account`，不附带 `auth=mobile`。登录入口与网站同样由 `/v1/auth/providers` 的当前配置决定；网站显示邮箱、手机、WCA、Google、微信、QQ 或支付宝中的哪些方式，App 就必须显示并最终支持同一组，不建 Mobile provider 白名单。

`auth=mobile` 是另一条“系统浏览器登录 → 90 秒 PKCE 单次票据 → 原生安全存储”交接流程的参数。未指定 provider 时它会把 `LoginForm` 切成 `firstPartyOnly`；由 Account bridge 明确传入第三方 provider 时，系统浏览器可显示网站 canonical SSO 列表并继续同一条 PKCE 流。把该参数用于“我的”iframe 仍是明确的 parity 回归，不是合规优化。

### 3.2 账号功能与会话一致性

- 页面显示相同按钮只是视觉验收；每个当前已配置的登录、注册、绑定、解绑、退出和注销流程都要 Android/iOS 真实账号端到端通过。
- Account iframe、系统浏览器和 Keychain/Keystore 是三个不同的会话容器。源码已接上“Account 所有登录入口 → 系统浏览器 PKCE → 原生安全会话 → 90 秒 web ticket → Account iframe”，并同步 iframe logout/删除与 App logout；部署、Android/iOS 全 provider 真实账号和异常恢复仍未验收。预存的 iframe-only 会话不会自动变成原生会话，直接在外部浏览器退出也无法主动通知休眠 App，必须如实保留为 P0 边界。
- WCA 登录页已确认返回 `X-Frame-Options: SAMEORIGIN`，不能在当前 Capacitor iframe 内完成；源码已改走 Browser，Google 弹窗、微信/QQ/支付宝 App 唤起与回调仍不得未经真机实测就标记完成。
- 最低重复的实现已落在 `@cuberoot/shared/mobile-embed` 认证消息，并复用现有 `/v1/auth/mobile-session/*` 与 `/v1/auth/web-session/*` 单次票据衔接系统浏览器、原生安全会话和 Account iframe。长期 JWT 不进入 URL 或 `postMessage`；没有复制 `LoginForm`，Mobile 也没有 import client 私有源码。

### 3.3 iOS Apple 4.8 发布阻塞

纯 `/account` 会在 iOS App 内展示网站现有 Google、微信等第三方主账号登录。[Apple App Review Guidelines 4.8](https://developer.apple.com/app-store/review/guidelines/#login-services) 对这类登录要求同时提供满足其隐私条件的等价登录；现有邮箱/手机方式尚无证据满足“可隐藏邮箱”等全部条件，WCA 也不得未经审核就假定为公民电子身份例外。

因此，iOS App Store 发布必须保持 `BLOCKED`，直到网站唯一 `LoginForm` 和后端提供满足 4.8 的等价方式（实施优先考虑 Sign in with Apple），并完成真实 iOS 登录与审核取证。该能力应加入网站的 canonical 账号系统，让 Web/Android/iOS 自动同源；不另写 iOS 表单，也不通过隐藏网站已有 provider 来冒充“完整一致”。

### 3.4 必须实测的嵌入风险

- Android WebView 与 iOS WKWebView 的 Cookie/localStorage 分区是否允许账号页稳定登录。
- 邮箱/手机号与全部已配置第三方登录、OAuth、账号删除、下载、文件选择、剪贴板、全屏和外链行为。
- 站内前进/后退、Android 返回键、iOS 边缘返回和底栏切换后的历史恢复。
- 网站未来若新增 `frame-ancestors`，App 是否自动回退且不会白屏。
- COOP/COEP、Web Bluetooth、摄像头、麦克风、WASM/Worker 等特殊页面在 iframe 中的能力限制。
- iframe 正文底部必须能滚动到三栏底栏上方；软键盘弹出后当前输入和提交动作必须可见；页面自身 sticky/fixed 元素不得与 App 底栏或系统安全区叠盖。
- 320/360/390/412/768 CSS px、横竖屏、最长中英文文案、200% 字号下不得出现非设计内横向滚动、裁切、重叠或屏外点击目标。
- 所有菜单、popover、select、dialog 和登录 provider 长列表必须验证首尾可达、视口 clamp、关闭后的焦点恢复，不能只验静态首屏。

### 3.5 低维护回退

若某个页面或动作在 iframe 中被浏览器安全模型阻止，使用仓库已有 Capacitor Browser 打开同一个线上 URL。该回退仍复用网站，但底栏会暂时不可见，所以只能标记为“Web 回退”，不能冒充同 App 内完全一致。登录回退的源码闭环已经接线，但在生产部署与每个真实 provider 双平台验收前仍不得声称 OAuth 回退已完成。

自建 Android WebView + iOS WKWebView 双原生容器、完整 Cookie bridge、下载/权限/导航代理属于高成本方案。除非 iframe/Browser 两条低维护路径都无法满足关键工作流且所有者再次授权，不启动该方案。

## 4. 五端协作合同

- Android/iOS 当前唯一业务入口是 `core/apps/mobile`；所有平台 AI 都必须先读本文、[cross-platform-app-contract.md](./cross-platform-app-contract.md)、`core/apps/mobile/README.md` 与 `cuberoot-mobile` skill。
- iOS 只补 URL scheme、WKWebView/权限等平台 adapter，不另建 SwiftUI 三栏或复制 React 页面。
- Android 只补系统返回、WebView/权限等平台 adapter，不另建 Compose 三栏。
- HarmonyOS 只补 ArkWeb、权限、BLE、安全存储和系统生命周期 adapter，不用 ArkUI 重写三栏或计时器。
- Windows/macOS 必须由同一个 `core/apps/desktop` 工程输出，只补各自窗口、BLE、凭据、文件、深链、签名/公证 adapter。
- 第二宿主落地时，同一改动必须从 Mobile 提取有真实消费者的 `@cuberoot/app-ui`；禁止任何 app→app 源码或生成物依赖。
- 任一 AI 修改共享 App/宿主文件前先检查同文件是否有未提交改动；发现并行重叠时保留对方工作，不覆盖。
- 新增平台差异必须登记到本文；未登记的五端 UI 或业务分叉视为回归。

## 5. 执行矩阵

| ID | 任务 | 优先级 | 状态 | 验收证据 |
| --- | --- | --- | --- | --- |
| NAV-01 | 底部“计时 / 工具 / 我的”三等分导航，共用 React 实现 | P0 | `待 iOS` | OPPO 三栏逐项点击通过；同一 React 源码待 iOS 本轮同步截图 |
| NAV-02 | 切换栏保留计时状态与两个 Web browsing context | P0 | `进行中` | 两个 iframe 持久挂载；共享返回协议已接线，待部署后双平台系统返回回归 |
| WEB-01 | 工具栏加载当前语言网站首页 | P0 | `待 iOS` | OPPO 内加载生产 `/zh`，底栏保持可见；待 iOS |
| WEB-02 | 首页所有站内卡片可进入真实子页面 | P0 | `进行中` | OPPO 实点“模拟”进入 `/zh/sim?puzzle=3&img_dist=6`；50 个公开目标 GET 200 只证明路由存活，不等于所有卡片和页内功能已通过，待 Android/iOS 真实点击矩阵 |
| WEB-03 | 站内返回、外链、下载、分享、文件和全屏策略 | P1 | `进行中` | shared 导航协议 + Native back 已实现；下载/分享/文件/全屏与部署后真机仍待验 |
| WEB-04 | 特殊页面能力与 Browser 回退 | P1 | `未开始` | 受限页面清单与明确提示 |
| ACC-01 | 我的栏加载未改写的当前语言 `/account` | P0 | `待 iOS` | OPPO 重装实证 iframe 为 `/zh/account`；邮箱/手机/WCA/Google/微信/支付宝与当前生产 provider 配置一致；待 iOS 同状态确认 |
| ACC-02 | 网站当前邮箱、手机、WCA、Google、微信、QQ、支付宝登录/绑定能力全部可用 | P0 | `进行中` | canonical LoginForm 的所有登录交互已委托 Browser；provider 保留与 social return fallback 有定向测试，待生产部署和 Android/iOS 每个真实账号端到端；绑定/解绑仍需单列验收 |
| ACC-03 | Account iframe、系统浏览器与 Mobile 安全会话的登录/退出/注销状态一致 | P0 | `进行中` | 源码已完成 Browser PKCE→secure session→web ticket→iframe、iframe logout/delete→native clear、App logout→iframe clear；不传长期 JWT。待生产/双平台 E2E；iframe-only 旧会话与外部 Browser 独立 logout 仍是已知边界 |
| IOS-01 | iOS AI 复用同一三栏和 Web surface，不出现业务 UI 分叉 | P0 | `进行中` | 业务代码只有 `core/apps/mobile/src` 一份；本文已进入 README/路线图，待 iOS 同步验证 |
| XPLAT-01 | 第二宿主落地时提取 `@cuberoot/app-ui`，五端消费同一三栏 React 产品层 | P0 | `未开始` | 至少两个真实宿主消费者、无 app→app import、共享契约测试 |
| DESKTOP-01 | 一个 `core/apps/desktop` 同时产出 Windows 和 macOS 客户端 | P0 | `未开始` | 两端 build/install、窗口与系统 adapter、实体电脑矩阵；PWA 不算完成 |
| HARMONY-01 | `core/apps/harmony` 以 ArkWeb 本地 bundle 消费共享 React App | P0 | `未开始` | DevEco build、模拟器/真机、BLE/存储/深链 adapter；Android 兼容包不算完成 |
| IOS-LOGIN-01 | iOS 提供满足 Apple 4.8 的等价登录，同时保持 canonical `/account` provider parity | P0 | `BLOCKED` | 网站唯一 `LoginForm`/后端尚无已验证的等价方式；优先同源实现 Sign in with Apple 并取得 iOS 端到端/审核证据 |
| QA-01 | 断网、弱网、网站 5xx、frame 被拒时不影响本地计时 | P0 | `未开始` | 故障注入与恢复 |
| QA-02 | TalkBack/VoiceOver、动态字号、横竖屏、安全区、软键盘、无遮挡与无溢出 | P0 | `进行中` | 双平台逐状态截图 + overflow/可见性断言；系统栏、手势区、底栏、键盘和弹层均不遮挡 |

P0/P1 表示实施顺序，不表示 P1 可以在声称“三栏完全一致”时省略。只有明确记录的高成本平台豁免可以保留未完成。

## 6. 当前证据日志

| 日期 | 证据 | 结论 |
| --- | --- | --- |
| 2026-08-30 | 生产四个目标 URL 均 HTTP 200，未返回 X-Frame-Options/CSP frame-ancestors | 可以先做低成本 iframe 真机 spike |
| 2026-08-30 | Mobile 已有 Capacitor Browser plugin、PKCE mobile ticket 和 web-session ticket 端点 | provider Browser handoff、secure session→Account iframe web ticket、双向 logout clear 已在源码接线；不新建账号系统，待部署/真实 provider 验收 |
| 2026-08-30 | 独立 agent 只读审计 | 计时器完整 parity 尚未成立；共享边界正确但覆盖面不足 |
| 2026-08-30 | OPPO 真机加载生产 `/zh`，从首页真实“模拟”卡片进入 `/zh/sim?puzzle=3&img_dist=6` | 工具栏直接复用网站，首个真实子路由 smoke 通过，未复制首页或模拟器 |
| 2026-08-30 | OPPO 曾加载 `/zh/account?auth=mobile`，DOM 只剩邮箱/手机相关按钮 | 已定位 parity 回归：`auth=mobile` 会隐藏网站第三方 provider，Account tab 必须改用纯 `/account` |
| 2026-08-30 | Chrome 103 WebView 不支持 `100dvh`，`.app-shell` 高度少 90px；改用 `window.innerHeight` 后重装 | 老 OPPO WebView 的底栏已贴合可见视口，未为 Android 复制布局 |
| 2026-08-30 | `@cuberoot/shared/mobile-embed`、网站 `MobileEmbedBridge` 与 Capacitor back listener | 返回协议单源；两个 Web context 可持久保留且不会把返回动作发给隐藏栏 |
| 2026-08-30 | Account auth 单元：client 定向 18 tests、Mobile 全测 38 tests；shared build 与 Mobile typecheck 通过 | provider/null 请求、PKCE 参数、一次性 web ticket、social return fallback、登录区全入口委托及 logout clear 消息契约通过；这些不是全 provider 真机端到端证据，client 全 typecheck 仍被既有 `.next/types` 的已删除 `/pb` 残留阻断 |
| 2026-08-30 | 从 `listSiteDirectoryEntries()` 读取唯一首页目录，对 50 个非锁定内部卡片的生产中文 URL 并发 GET | 50/50 返回成功，证明目标路由存活且 Mobile 没有第二份卡片路由表；不证明卡片点击后的全部 UI/功能已验收 |
| 2026-08-30 | OPPO 当前构建：`/zh/sim` 深度消息 → 物理 Back → `/zh` | 原生 back listener 正确把返回动作发给当前工具 iframe；网站 bridge 正式生效仍随 Web 部署 |
| 2026-08-30 | `core/apps/mobile/src/App.tsx` 的 Account URL 已恢复纯 `/account` | 源码方向与网站一致；尚需重装 OPPO、iOS 和全 provider 端到端验证 |
| 2026-08-30 | WCA 登录页响应头包含 `X-Frame-Options: SAMEORIGIN` | 当前 Account iframe 不能完成 WCA OAuth；要复用 Browser + 单次 ticket 交接，按钮可见不等于功能完成 |
| 2026-08-30 | Apple 当前 App Review Guidelines 4.8 要求第三方主账号登录同时提供满足隐私条件的等价方式 | iOS App Store 登录合规保持 P0 `BLOCKED`，不以隐藏 provider 代替完整 parity |
| 2026-08-30 | 用户明确要求 UI/UX 逐状态检查遮挡、可读性和溢出 | QA-02 升为 P0 硬门槛；单张相似截图和“能点击”均不足以验收三栏一致性 |
| 2026-08-30 | OPPO 项目菜单首轮视觉审计发现透明浮层与计时内容重叠；修复宿主 token/旧 WebView 窄屏布局后重装复验 | UI/UX 门槛已实际拦下一次“功能能用但看不清”的回归；同类菜单、键盘、横屏和三栏 Web surface 仍须逐状态验收 |
| 2026-08-30 | OPPO Account iframe CDP：URL 为原始 `/zh/account`；视口/文档宽均 360，无横向溢出；当前 7 个登录操作均完整落在可见宽度内，最下按钮底部 555 < iframe 底部 689 | ACC-01 的 Android 页面/provider/无遮挡验收通过；ACC-02/03 已有源码和单元证据，但 OAuth、邮箱/手机真实账号与会话同步仍必须部署后另验，不能随 ACC-01 一起宣称完成 |
| 2026-08-30 | 独立 no-dup agent 扫描包边界、43 项能力与 Web/Mobile adapter | app→app/deep import guard 通过，并消除非法 event→333 与 NXN 映射重复；Web 私有 scramble fallback、通用/计时 PuzzlePicker primitive、real-source 映射及除 2×2 外的生成 runtime 仍是明确待治理项 |
| 2026-08-31 | 所有者把正式客户端目标扩展为 Android/iOS/HarmonyOS NEXT/Windows/macOS，并要求一次到位 | 五端共享层、三个宿主和总体完成口径已写入合同；新三端仍为未实现，不得把设计完成误报为平台适配完成 |
