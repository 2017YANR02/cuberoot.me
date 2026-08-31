# CubeRoot 五端 App 单一来源合同

状态：`ACTIVE`

最后更新：2026-08-31

仓库所有者决定：CubeRoot 的已安装客户端从现在起按 Android、iOS、HarmonyOS NEXT、Windows 和 macOS 五个平台一次设计，网站继续作为第六个在线 surface 与内容事实源。五端不是五套产品代码；任何实现都必须优先扩展共享层和平台能力接口，不得为某个平台复制计时器、对战、账号、工具目录、智能魔方协议或业务状态。

“一步到位”在本文中的含义是：现在就锁定五端产品范围、源码归属、宿主边界、能力接口、验收矩阵和总体完成口径，并把后续实现放进同一条路线图。它不表示尚未创建的宿主、未跑过的真机或未通过的商店审核可以提前标记完成。

## 1. 五个平台，一个产品

| 平台 | 正式宿主 | 共享内容 | 只允许留在宿主内的代码 |
| --- | --- | --- | --- |
| Android | `core/apps/mobile` Capacitor Android | 共享 React App、`@cuberoot/timer-ui`、`@cuberoot/shared`、网站 Tools/Account surface | Android 权限、BLE transport、返回键、深链、Keystore、签名 |
| iOS | `core/apps/mobile` Capacitor iOS | 与 Android 同一份 React App、UI 和业务逻辑 | Core Bluetooth transport、URL Types、Keychain、系统分享/打印、签名 |
| HarmonyOS NEXT | 计划中的 `core/apps/harmony` ArkTS + ArkWeb 薄宿主 | 与其他客户端同一份 React App、UI、业务规则和网站 surface | ArkWeb 生命周期、鸿蒙 BLE/权限、安全存储、深链、分享和签名 |
| Windows | 计划中的 `core/apps/desktop` Tauri 桌面宿主 | 与 macOS 同一桌面工程，并消费同一份 React App、UI 和业务逻辑 | WebView2 窗口、Windows BLE/凭据库、文件、协议唤起、签名/安装包 |
| macOS | 同一个 `core/apps/desktop` Tauri 桌面宿主 | 与 Windows 同一桌面工程，并消费同一份 React App、UI 和业务逻辑 | WKWebView 窗口、Core Bluetooth/Keychain、文件、URL scheme、签名/公证 |

各平台当前状态和证据只见 [mobile-app-roadmap.md](./mobile-app-roadmap.md)。

网站/PWA 继续可在 Windows 和 macOS 使用，但不再代替本文明确要求的正式桌面客户端。桌面客户端必须由同一个 `core/apps/desktop` 工程输出两端，不得分别创建 Windows React UI 和 macOS React UI。

当前 Android/iOS 的 Capacitor 工程不迁移到 Tauri。为了追求表面上的“一个原生框架”而重做已经成立的移动宿主，会增加迁移和插件风险，却不会减少业务代码；真正需要统一的是 React 产品层、领域逻辑和平台能力接口。

## 2. 唯一允许的代码分层

```text
网站 canonical 内容、账号页、工具子路由
                  core/packages/client
                            │
共享 React 产品层 ──────────┼────────── 计时器共享 UI（目标唯一实现）
@cuberoot/app-ui（第二宿主落地时提取）     @cuberoot/timer-ui
                            │
共享领域、协议、schema、状态机、能力契约
                  @cuberoot/shared
                            │
       ┌────────────┬────────────┬────────────┐
       │            │            │            │
 Capacitor Android/iOS   Harmony ArkWeb   Tauri Windows/macOS
       │            │            │            │
       └──── BLE / storage / auth / file / share adapters ────┘
```

固定规则：

- `@cuberoot/shared` 只放运行时中性的模型、schema、算法、协议、状态机和平台能力契约；禁止引用任一 app。
- `@cuberoot/timer-ui` 必须成为网站和五端计时器 UI 的完整唯一实现；任何宿主不得新增或复制 `SoloView`、本地/联网多人、来源选择、历史、统计、设置或智能魔方交互。迁移进度只见路线图。
- 五端共用的三栏组合、导航状态、在线 surface 容器和 App 级错误/离线状态，在第二个非 Capacitor 宿主真正落地的同一提交中，从 `core/apps/mobile` 提取为 `@cuberoot/app-ui`。在出现第二个消费者前不创建空包；出现第二个消费者后不得让其 import `core/apps/mobile` 源码或 `dist`。
- `core/apps/mobile`、`core/apps/harmony`、`core/apps/desktop` 只能是宿主，不得互相 import 源码、CSS、生成物或私有配置。
- 平台差异保持小而明确，例如 BLE、安全存储、认证、文件、分享、打印、保亮和生命周期 adapter。现有单宿主接口留在所属 app；只有第二个真实消费者出现时，才在同一变更中逐项提取运行时中性 capability contract 到共享层；系统调用始终留在宿主。
- 网站的 Next 路由、SEO、Server Component 和服务端代理仍留在 `core/packages/client`；不得为了五端复用把这些依赖拖进 App UI。
- Tools 和 Account 始终指向网站 canonical 页面和账号系统。宿主只处理窗口、返回、外链、文件、OAuth、权限与安全区，不复制卡片、子页面或登录表单。

## 3. 五端产品一致性

五端共享“计时 / 工具 / 我的”三个产品 surface、相同账号、相同数据、相同功能和相同可达状态。窗口尺寸、鼠标/键盘、触摸、系统返回和安全区可以有响应式表现，但不得因此删除、替换或另写功能。

- 计时：继续以网站 `/timer` 的完整可达行为为事实源，按 [mobile-timer-parity-tracker.md](./mobile-timer-parity-tracker.md) 的零遗漏矩阵实施；目标是五端最终消费同一个完整 `@cuberoot/timer-ui`，当前迁移状态以路线图为准。
- 工具：继续使用网站 `/`、`/zh` 及其全部真实子路由，不建立客户端卡片清单或子页面副本。
- 我的：继续使用网站 `/account`、`/zh/account` 和唯一账号后端，不建立平台专用登录页、provider 白名单或 token 生命周期。
- 本地数据与同步：schema、迁移、冲突、outbox、删除和账号合并规则只有一份；不同系统只替换持久化 adapter。
- 智能魔方：GAN 等协议解析、加解密、补帧、时钟和状态跟踪只有一份；Web Bluetooth、Capacitor BLE、Harmony BLE、Windows BLE 和 macOS Core Bluetooth 都只是 transport。
- 本地与联网多人：对战 reducer、房间协议、服务端权威状态和 UI 只有一份；平台输入差异只进入 input adapter。

如果某个平台缺少能力，不得复制一套降级产品或静默隐藏入口。必须先记录能力缺口，优先补 platform adapter；确实无法实现时，只有仓库所有者明确批准的平台豁免才能进入合同，并且总体状态继续保持未完成。

## 4. 宿主创建顺序与禁止捷径

五端是同一个总体里程碑，但实现可以按依赖顺序推进：

1. 先完成共享领域、`@cuberoot/timer-ui` 和现有 Android/iOS 的事实迁移，消除尚存的 Web/Mobile 重复。
2. 创建第二个宿主时同步提取 `@cuberoot/app-ui`，确保第一天就有两个真实消费者和契约测试。
3. 建立一个 `core/apps/desktop`，同一源码产出 Windows 和 macOS；不得先复制 Mobile 后再“以后合并”。
4. 建立一个 `core/apps/harmony`，ArkWeb 加载本地构建的共享 React App；不得用 ArkUI 重写三栏和计时器，也不得把远程整站作为启动运行代码。
5. 每个真实宿主只接入它实际需要的 adapters；第二消费者出现时同步提取对应 capability contracts，并补契约测试、端到端场景和发布证据。

禁止：

- 把 PWA 截图或浏览器访问当成 Windows/macOS 客户端完成证据。
- 把 HarmonyOS 的 Android 兼容包当成 HarmonyOS NEXT 原生宿主完成证据。
- 为桌面宽屏、鸿蒙系统控件或商店审核复制第二份 React 功能树。
- 让 `core/apps/desktop` 或 `core/apps/harmony` 读取 `core/apps/mobile/src` 或 Mobile `dist`。
- 因为某个平台尚未完成，就让共享 API、schema 或状态模型出现平台专用分叉。
- 用一端模拟器通过替代该端真机、系统集成、签名和商店验证。

## 5. 一次到位的验收合同

进度只在 [mobile-app-roadmap.md](./mobile-app-roadmap.md) 记账，本文不维护第二份勾选状态。五端总体完成必须同时满足：

- 网站/Mobile 计时器完成零遗漏迁移，`@cuberoot/timer-ui` 是完整唯一实现。
- 第二宿主落地时建立有真实消费者的 `@cuberoot/app-ui`，并迁移三栏产品组合。
- `core/apps/desktop` 的同一 Tauri 工程完成 Windows 与 macOS 构建、安装和自动化。
- `core/apps/harmony` 完成 ArkWeb 本地 bundle 与 ArkTS platform adapters。
- 五端共用账号、同步、多人、智能魔方和全部三栏功能；无平台私有业务副本。
- 五端 CI 覆盖共享契约、宿主 typecheck/build、依赖方向、生成物漂移和安装产物检查。
- 五端输入、窗口、语言、主题、离线、弱网、生命周期、辅助功能、BLE 和升级矩阵通过。
- 各平台取得真机/实体电脑、签名、商店或安装渠道证据。

总体完成口径：只有五个平台均通过各自矩阵，且重复实现审计、跨包依赖守卫和共享契约测试全部通过，才能把五端 App 标记为完成。某个平台可以在其发布渠道单独分阶段发布，但不得因此把五端总体里程碑提前标绿。

## 6. 官方技术边界

- Capacitor 官方主路径用于 Android、iOS 和 PWA：[Capacitor Documentation](https://capacitorjs.com/docs)
- HarmonyOS NEXT 使用 ArkTS/ArkUI 宿主并可通过 ArkWeb Web 组件承载与原生交互的 Web 内容：[HarmonyOS 应用开发](https://developer.huawei.com/consumer/cn/app/planning)
- Tauri 可用同一 Web 前端构建主要桌面和移动平台，本项目只把它用于共享的 Windows/macOS 桌面宿主：[Tauri](https://v2.tauri.app/start/)
- Windows PWA 仍是可安装网站和故障回退，不替代本文的桌面客户端验收：[Microsoft PWA](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/ux)
- macOS Safari Web App 同样保留为网站入口和回退，不替代共享桌面宿主：[Apple Safari Web App](https://support.apple.com/guide/safari/add-to-dock-ibrw9e991864/mac)
