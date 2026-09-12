# CubeRoot 五端三栏产品合同

状态：`ACTIVE`

最后更新：2026-09-01

所有者决定：Android、iOS、HarmonyOS NEXT、Windows 和 macOS 共用“计时 / 工具 / 我的”三个产品 surface；紧凑窗口使用底栏，桌面窗口仍消费同一个 React 导航与三栏状态，不得建立平台专用功能树。三栏的内容、视觉、交互、状态和功能完整一致是验收目标，第一原则是不复制网站页面形成多端维护。五端宿主与单一来源的最高优先级边界见 [cross-platform-app-contract.md](./cross-platform-app-contract.md)。

若某项只能通过高成本原生重写实现，优先补通用 capability port 并如实记录平台限制；只有所有者明确接受的高成本豁免可以保留未完成，且当时不得声称“完整一致”。

“完整一致”必须按 [mobile-timer-parity-tracker.md](./mobile-timer-parity-tracker.md) 的零遗漏笛卡尔积验收。实现者无权自行把网站已有功能判成“代价高所以不做”；必须先列明成本与方案并取得所有者明确批准。菜单数量或某个子功能通过都不能代表计时栏完成。

## 1. 唯一产品结构

| 底栏 | 权威内容 | App 行为 | 完成标准 |
| --- | --- | --- | --- |
| 计时 | 网站 `/timer` 的完整 UI/UX；原生 BLE 等只替换 transport | 使用打包进 App 的共享 React 计时器，离线可用 | 按 [mobile-timer-parity-tracker.md](./mobile-timer-parity-tracker.md) 全矩阵验收 |
| 工具 | 当前语言的网站首页 `/` 或 `/zh`，以及从其中进入的所有子页面 | 直接显示网站真实页面；站内卡片和链接继续在同一 Web browsing context 导航 | 首页内容、卡片、路由和子页面不复制；真实点击 smoke 通过 |
| 我的 | 当前语言的网站 `/account` 或 `/zh/account` | 直接显示网站真实账号页和现有登录/账号管理能力 | 使用网站唯一账号系统；不建设 Mobile 第二套账号页 |

“完整网站”在这里是内容事实源，不意味着把 Next 源码复制进任一宿主，也不意味着把整个 App 启动地址改成远程 URL。计时仍保留本地优先和原生能力；工具与我的是明确的在线 Web surface。

## 2. 不重复造轮的固定边界

```text
计时领域逻辑              → @cuberoot/shared
Web + 五端计时 React UI → @cuberoot/timer-ui
工具/我的页面与路由         → core/packages/client（线上网站唯一实现）
五端三栏 React 产品组合       → @cuberoot/app-ui（当前唯一实现）
Android/iOS 宿主与 Web 容器   → core/apps/mobile（同一份 React + Capacitor 代码）
HarmonyOS NEXT 薄宿主         → core/apps/harmony（ArkTS + ArkWeb；unsigned HAP 已构建，设备待验）
Windows/macOS 共享桌面宿主    → core/apps/desktop（同一 Tauri 工程；macOS 本机构建已验，Windows 待验）
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

### 3.1 默认架构：同 App 内嵌真实网站

只要生产 `/`、`/zh`、`/account`、`/zh/account` 未通过 `X-Frame-Options` 或 CSP `frame-ancestors` 禁止嵌入，就采用 App 内 iframe Web surface；每次发布前重新验证响应头：

- 工具和我的各自拥有持久 browsing context，切换底栏不丢失当前子页面。
- iframe 直接访问 `https://cuberoot.me` 的真实路由，站内卡片与子页面无需客户端路由表。
- 底栏由打包的 `@cuberoot/app-ui` 持有，不进入网站源码。
- 网站与原生壳只通过 `@cuberoot/shared/mobile-embed` 的导航消息契约协作：网站报告当前栏的历史深度，宿主把系统返回动作送给当前 iframe；不维护客户端页面路由副本。
- 工具/我的需要网络；离线时计时仍可用，Web surface 显示明确网络状态。
- 两个 surface 复用同一加载/离线/错误/重试 UI；宿主在线且 iframe 发出可见加载事件即可展示页面，同时有界重试 init（当前最多约 10 秒），同源且来自该 iframe 的导航 ACK 可提前停止。ACK 用于返回栈、外链和账号桥能力，不能在生产 bridge 尚未部署时被错误地当作页面可见性的前置条件。
- 跨域 iframe 的初始空白、弱网挂起、HTTP 5xx 和 frame 拒绝不能仅靠父页面 `load/error` 可靠区分；不得用假定时器冒充检测成功。共享层先可靠处理宿主 Network 离线，其他故障以生产 bridge ACK 或已授权的通用宿主能力补齐，不为五个平台各造 WebView 回调。

“我的”必须直接使用未改写的当前语言 `/account` 或 `/zh/account`，不附带 `auth=mobile`。登录入口与网站同样由 `/v1/auth/providers` 的当前配置决定；网站显示邮箱、手机、WCA、Google、微信、QQ 或支付宝中的哪些方式，App 就必须显示并最终支持同一组，不建 Mobile provider 白名单。

`auth=mobile` 是另一条“系统浏览器登录 → 90 秒 PKCE 单次票据 → 原生安全存储”交接流程的参数。未指定 provider 时它会把 `LoginForm` 切成 `firstPartyOnly`；由 Account bridge 明确传入第三方 provider 时，系统浏览器可显示网站 canonical SSO 列表并继续同一条 PKCE 流。把该参数用于“我的”iframe 仍是明确的 parity 回归，不是合规优化。

### 3.2 账号功能与会话一致性

- 页面显示相同按钮只是视觉验收；每个当前已配置的登录、注册、绑定、解绑、退出和注销流程都要五端分别用真实账号端到端通过。
- Account iframe、系统浏览器和宿主安全存储是不同的会话容器。验收必须覆盖“Account 登录入口 → 系统浏览器 PKCE → 原生安全会话 → 90 秒 web ticket → Account iframe”、双向退出/删除、预存 iframe-only 会话和休眠 App 外部退出等边界。
- 第三方登录若通过 `X-Frame-Options`、CSP、弹窗或 App 唤起限制 iframe，必须打开同一个 canonical 网站流程的系统浏览器回退；每个 provider 仍需五端真实账号端到端验收。
- 认证消息必须走 `@cuberoot/shared/mobile-embed`，并复用 `/v1/auth/mobile-session/*` 与 `/v1/auth/web-session/*` 单次票据。长期 JWT 不得进入 URL 或 `postMessage`；不得复制 `LoginForm` 或 import client 私有源码。
- 新版 Web session 请求和结果必须回显同一个 `requestId`，新版宿主只接受当前 in-flight 的同 ID 结果；网站 decoder 暂时兼容独立发布中的旧 App 无 ID 请求，并向它返回无 ID 结果。签发/交换超时、provider 启动失败和重复点击都必须有界，未完成登录再次打开时复用同一 PKCE pending state，不得让早先回调失效。

#### 统一登录与已有账号选择

可视化入口：网站 `/dev/auth`（中文 `/zh/dev/auth`），从 `/dev` 首页“账号全流程”进入。页面覆盖网站/PWA、iOS、Android、微信小程序，并说明 HarmonyOS NEXT、Windows、macOS 与抖音小程序边界；按登录/注册、App 回跳、绑定/解绑、B 并入 A 的账号合并、退出与永久注销分图展示。合并方向、凭据/数据冲突、会员迁移限制、注销数据保留与本地数据边界按当前源码说明，不承诺会员时长相加、全设备退出或远程清空设备。

微信小程序“手机号首次实时验证 → 明确确认绑定微信 → 后续直接登录”于 2026-09-12 本地接入；手机号命中原账号先显示目标，未命中保留旧号绑定码与明确创建选择。冲突不合并、不覆盖，拒绝/不支持可走已有方式；已绑定微信不重复授权。`/dev/auth` 同步流程；本地代码或流程图不构成部署、上传、后台权限或真机验收证据。

防误注册增量（本地实现，待部署/客户端发布与真人验收）：邮箱与手机号普通验证码、抖音未知身份也使用既有短期认证尝试；先验证旧号或明确选择创建，不能直接注册。密码找回保持 existing-only，不能创建账号。抖音旧号绑定复用网站 AccountPanel 生成 10 分钟独立绑定码，小程序验证 pending 身份与绑定码后显示目标账号，主动确认后原子绑定并登录；绑定码仅用于该用途，不接受合并码，不在 URL 传 pending 或长期会话。合并只增加当前账号、方向与二阶段确认，不宣称未验证目标资料已预览，也不扩大会员/数据迁移范围。

合并确认同时绑定服务端 `expectedSourceUid`；另一个标签页切换账号后不能把错误来源账号合并。缺少该字段的旧客户端失败关闭，不回退旧逻辑；未来发布需协同部署 API 与网站，并发布新版小程序，旧页面须刷新后再操作。绑定码与合并码签发均核对 `expectedUid`，不能用页面显示的旧账号为新会话账号签发代码。

2026-09-11 所有者要求所有第三方登录避免无意创建重复账号，界面保持简洁。以下是产品契约，不是上线或真实账号验收证明：

- Google、Apple、微信、支付宝、WCA 及其他已配置第三方身份，已绑定时直接登录；未知身份通过授权后，先不创建站内账号或签发站内会话。
- 未知身份只显示一个问题「你有 CubeRoot 账号吗？」和两个选择「登录已有账号」「创建新账号」；最多一行说明，不增加每次登录都要经过的向导。
- 已有账号沿用 canonical `LoginForm` 验证，再显示将要绑定的账号并主动确认。该过程中未知邮箱、手机号或另一第三方身份不得隐式创建账号；取消、过期或网络失败不得自动降级为注册。
- 不按相同邮箱、昵称、头像或设备自动合并。绑定是增加登录方式，不是合并两个已有账号的会员或业务数据；已有重复账号继续走独立的账号合并功能。
- 临时授权只用于短期、一次性的创建或绑定确认；不进入 URL、日志或长期浏览器存储。服务端校验目标账号、身份归属和并发核销，网页不能自行决定账号归属。
- 网站和 App 系统浏览器共用同一 UI；保留原始语言、目标页面和 Mobile PKCE 回跳。微信小程序已有明确创建/绑定选择时不再重复询问，但它是独立运行时，必须分别验收。

对标记录（2026-09-11，官方公开文档；并非声称已登录这些产品逐屏测试）：

| 产品/平台 | 实际文档行为 | 本项目取舍 |
| --- | --- | --- |
| [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple/) | 建议允许关联已有账号 | 新身份先提供已有账号选择 |
| [Google Firebase](https://firebase.google.com/docs/auth/web/account-linking) | 多个 provider 可关联同一用户 ID，先登录再绑定 | 复用同一站内账号，不按 provider 建用户体系 |
| [Auth0](https://auth0.com/docs/manage-users/user-accounts/user-account-linking) | 绑定前应验证双方身份 | 不仅凭邮箱相同就合并 |
| [Spotify](https://support.spotify.com/us/article/google-login-help/) | 为已有 Spotify 账号增加 Google 登录方式 | 原账号及权益保留 |
| [Notion](https://www.notion.com/help/log-in-and-out) | 同邮箱可用 Google/Apple 快速登录 | 其邮箱前提不适用于本项目全部 provider，不照搬 |
| [GitHub](https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa/recovering-your-account-if-you-lose-your-2fa-credentials) | 已关联社交账号可以替代口令登录 | 已绑定用户不重复询问 |

该方案是根据上述差异和 CubeRoot 多 provider 现状作出的设计选择，不把“所有大厂都先询问”当成事实。

### 3.3 iOS Apple 4.8 发布门槛

若纯 `/account` 在 iOS App 内展示 Google、微信等第三方主账号登录，[Apple App Review Guidelines 4.8](https://developer.apple.com/app-store/review/guidelines/#login-services) 要求同时提供满足其隐私条件的等价登录；邮箱/手机方式必须逐项证明满足要求，WCA 也不得未经审核就假定为公民电子身份例外。

因此，iOS App Store 发布前，网站唯一 `LoginForm` 和后端必须提供满足 4.8 的等价方式（实施优先考虑 Sign in with Apple），并完成真实 iOS 登录与审核取证。该能力应加入网站的 canonical 账号系统，让 Web 和五端自动同源；不另写 iOS 表单，也不通过隐藏网站已有 provider 来冒充“完整一致”。

### 3.4 必须实测的嵌入风险

- Android WebView、iOS WKWebView、Harmony ArkWeb、Windows WebView2 与 macOS WKWebView 的 Cookie/localStorage 分区是否允许账号页稳定登录。
- 邮箱/手机号与全部已配置第三方登录、OAuth、账号删除、下载、文件选择、剪贴板、全屏和外链行为。
- 站内前进/后退、Android 返回键、iOS 边缘返回和底栏切换后的历史恢复。
- 网站未来若新增 `frame-ancestors`，App 是否自动回退且不会白屏。
- COOP/COEP、Web Bluetooth、摄像头、麦克风、WASM/Worker 等特殊页面在 iframe 中的能力限制。
- iframe 正文底部必须能滚动到三栏底栏上方；软键盘弹出后当前输入和提交动作必须可见；页面自身 sticky/fixed 元素不得与 App 底栏或系统安全区叠盖。
- 320/360/390/412/768 CSS px、横竖屏、最长中英文文案、200% 字号下不得出现非设计内横向滚动、裁切、重叠或屏外点击目标。
- 所有菜单、popover、select、dialog 和登录 provider 长列表必须验证首尾可达、视口 clamp、关闭后的焦点恢复，不能只验静态首屏。

### 3.5 低维护回退

若某个页面或动作在 iframe 中被浏览器安全模型阻止，通过宿主 `openExternal` 在系统浏览器打开同一线上 URL。该回退仍复用网站，但底栏会暂时不可见，所以只能标记为“Web 回退”，不能冒充同 App 内完全一致；生产部署与每个真实 provider 的五端验收仍是完成条件。

网站 bridge 必须拦截跨域链接和 `target=_blank`，通过 `@cuberoot/shared/mobile-embed` 请求宿主 `openExternal`；宿主只接受 `http:`、`https:`、`mailto:`，并同时校验生产 origin 与实际 iframe source。下载仍按 WEB-03/WEB-04 单独验收，不能由普通外链通过代替。

自建 Android WebView + iOS WKWebView 双原生容器、完整 Cookie bridge、下载/权限/导航代理属于高成本方案。除非 iframe/Browser 两条低维护路径都无法满足关键工作流且所有者再次授权，不启动该方案。

## 4. 五端协作合同

- 五端当前唯一 React 产品入口是 `@cuberoot/app-ui`；所有平台 AI 都必须先读本文、[cross-platform-app-contract.md](./cross-platform-app-contract.md)、`core/apps/mobile/README.md` 与 `cuberoot-mobile` skill。
- iOS 只补 URL scheme、WKWebView/权限等平台 adapter，不另建 SwiftUI 三栏或复制 React 页面。
- Android 只补系统返回、WebView/权限等平台 adapter，不另建 Compose 三栏。
- HarmonyOS 只补 ArkWeb、权限、BLE、安全存储和系统生命周期 adapter，不用 ArkUI 重写三栏或计时器。
- Windows/macOS 必须由同一个 `core/apps/desktop` 工程输出，只补各自窗口、BLE、凭据、文件、深链、签名/公证 adapter。
- Mobile、Desktop 和 Harmony 只消费 `@cuberoot/app-ui` 公开入口；禁止任何 app→app 源码或生成物依赖。
- 任一 AI 修改共享 App/宿主文件前先检查同文件是否有未提交改动；发现并行重叠时保留对方工作，不覆盖。
- 新增平台差异必须登记到本文；未登记的五端 UI 或业务分叉视为回归。

## 5. 稳定验收 ID

本文只定义不会随进度变化的验收含义；状态、勾选和证据只在 [mobile-app-roadmap.md](./mobile-app-roadmap.md) 第 0 节维护。

| ID | 验收合同 |
| --- | --- |
| NAV-01 | 五端消费同一份“计时 / 工具 / 我的”React 导航；紧凑窗口为三等分底栏 |
| NAV-02 | 切换栏保留计时状态及工具/我的两个 browsing context |
| WEB-01 | 工具栏加载当前语言的网站 canonical 首页 |
| WEB-02 | 首页全部真实卡片可进入正确子页面，页内核心功能可用 |
| WEB-03 | 站内返回、外链、下载、分享、文件和全屏按统一策略工作 |
| WEB-04 | iframe 受限能力使用同一 URL 的 Browser 或原生 adapter 回退，并明确告知状态 |
| ACC-01 | 我的栏加载未改写的当前语言 `/account` |
| ACC-02 | 网站当前全部登录、注册、绑定和解绑 provider 在 App 可用 |
| ACC-03 | Account iframe、系统浏览器和安全会话的登录、退出、注销状态一致 |
| IOS-01 | iOS 复用同一三栏和 Web surface，不出现 SwiftUI 或第二套 React 业务树 |
| IOS-LOGIN-01 | iOS 满足 Apple 4.8 等价登录，同时保持 canonical provider parity |
| QA-01 | 断网、弱网、网站 5xx 和 frame 被拒不影响本地计时，并可恢复 |
| QA-02 | 全平台无系统栏、挖孔、键盘、底栏、toast、菜单或对话框遮挡、溢出和不可点击 |
| XPLAT-01 | 五端消费同一 `@cuberoot/app-ui`，无 app→app import |
| DESKTOP-01 | 一个 `core/apps/desktop` 工程分别产出 Windows/macOS build、install、实体机交互与签名/分发证据 |
| HARMONY-01 | `core/apps/harmony` 通过 ArkWeb 本地 bundle 消费共享 React App，并完成 HAP、设备交互、系统 adapter、签名与分发证据 |

P0/P1 实施顺序与所有阶段证据统一由路线图维护；稳定合同不得用平台暂时缺失来改写。
