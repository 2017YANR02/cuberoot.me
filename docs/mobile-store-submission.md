# CubeRoot 移动端商店提交资料

最后核对：2026-09-11
适用构建：`@cuberoot/mobile` `0.1.0`，Android `versionCode 1000`
应用标识：`me.cuberoot.app`

提交状态：`DRAFT — NOT SUBMISSION READY`。当前已完成 iPhone 开发签名、覆盖安装和局部 UI 验证；门户已有会员有效期和开发者协议证据。4.8 登录 E2E、iOS BLE、会员 IAP、Paid Apps Agreement/税务/收款、全球含中国大陆材料、最终 archive 隐私报告、完整真机矩阵和商店素材仍待关闭。开发签名不等于分发签名、上传或审核完成；进度唯一账本仍是 `docs/mobile-app-roadmap.md`。

适用范围仅为 `core/apps/mobile` 的 Android Google Play 与 iOS App Store 提交。`@cuberoot/app-ui` 虽由五端共用，Windows/macOS Tauri 和 HarmonyOS NEXT 的安装包、签名、公证、分发渠道与商店资料必须按各自平台另行验收；本文件、macOS 本地 DMG 或 Harmony unsigned HAP 都不能证明那些平台已可发布。

这份文件是 `0.1.0` 的版本锁定快照，也是 Google Play 提交表、未来 App Store Connect 提交表和审核备注的单一工作稿。发布下一版本时先复制或整体更新版本事实，不得只改其中一处。每次加入登录、云同步、分析、崩溃上报、广告、付费、BLE 或新的原生权限后，必须先更新本文件和隐私政策，再生成新商店构建。

状态标记：

- `[已核对]`：已从当前源码、依赖或签名构建中验证。
- `[提交前复核]`：内容已有草稿，但必须针对最终上传包再核对。
- `[所有者填写]`：需要公司、账号或市场决策，代码无法替代。
- `[iOS 发布待验]`：开发签名/真机运行已有证据，但发布资格、Release archive、上传或商店状态尚未确认。

## 1. 当前可直接复用的应用事实

| 字段 | 当前值 | 状态 |
|---|---|---|
| 应用名 | CubeRoot | 已核对 |
| Android application ID | `me.cuberoot.app` | 已核对 |
| 当前版本 | `0.1.0`（`versionCode 1000`） | 已核对 |
| 默认商店语言 | English | 提交前复核 |
| 第二语言 | 简体中文 | 已核对 |
| 支持邮箱 | `yrmfxc@gmail.com` | 已核对 |
| 发布者法定名称、地址、电话 | Apple 当前走个人会员路线，Google Play 走组织路线；由所有者确认各商店公开资料，不混用个人/组织身份 | 提交前阻塞 |
| 英文隐私政策 | `https://cuberoot.me/privacy` | 源码已完成，推送部署后复核 |
| 中文隐私政策 | `https://cuberoot.me/zh/privacy` | 源码已完成，推送部署后复核 |
| 登录要求 | 核心计时无需账号；设置中可选登录同一 CubeRoot 网站账号 | 已核对 |
| 广告 | 无 | 已核对 |
| 付费/订阅 | 网站已有会员；2026-09-11 所有者明确要求 App 内会员购买。Apple IAP 尚未实现，商品类型/周期/价格待确认，不能继续填“无” | 提交前阻塞 |
| 用户生成内容/聊天 | 必须包含 Tools 在线页面的实际可达范围，不能仅按本地计时器回答“无”；论坛、评论、公开资料及多人功能须逐项复核 | 提交前复核 |
| 核心功能 | 本地优先计时、43 项目录与按项目 provider、真实比赛打乱的有界在线缓存、历史记录、罚时、备注、统计、JSON 备份与恢复、可选原生 BLE 智能魔方；工具与账号复用网站唯一页面，登录不代表上传计时数据 | 已核对 |

当前 App 不是启动即打开远程整站的 WebView 套壳。计时器、历史、统计和 IndexedDB 存储打进同一个 React + Vite 包；工具与“我的”则在共用三栏内显示网站 canonical 页面，不复制网站卡片、路由或账号表单。已映射的 19 个 WCA 项目会从 CubeRoot API 下载公开比赛打乱并在本机保存最多 50 条、最长 7 天；冷启动无缓存且断网时明确显示不可用/错误，不用随机题冒充比赛真题。无 WCA 映射的项目按网站契约使用同项目本地 provider。账号交互通过系统浏览器走网站唯一 LoginForm 的 PKCE 流，再把短期交接结果写入原生安全存储；当前计时记录、备注和设置仍只保存在本机。

## 2. Google Play Data safety 草稿

Google 将“收集”定义为把数据从设备传给开发者或第三方。当前版本的计时记录与设置只在设备本地处理；用户主动导出 JSON 属于用户发起的本地文件/系统分享流程，App 不会自动上传。智能魔方的扫描结果、蓝牙地址和连接状态在本机处理；成绩会在本机持久化转动、设备型号/名称及可选姿态轨迹，用户可主动分享包含回放数据的链接，不自动上传这些成绩。App 会向 CubeRoot API 请求公开比赛打乱，服务器会处理并记录 IP 地址、设备或客户端类型等标准网络信息，因此最终问卷不能继续按“没有远程 API”直接回答 No。依据：[Google Play Data safety 填写说明](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)。

针对当前 `0.1.0`：

| 控制台问题 | 草稿答案 | 依据 |
|---|---|---|
| App 是否收集或分享需要声明的用户数据 | 提交前复核，不能预填 No | 比赛打乱请求会让自有服务器处理并记录 IP 与客户端类型；计时数据、备注和设置不上传，且没有分析、广告或崩溃上报 |
| 数据是否在传输中加密 | Yes（提交前以最终包和控制台字段复核） | 比赛打乱请求使用 `https://api.cuberoot.me`；不得把 HTTPS 等同于“不收集数据” |
| 是否提供账号创建 | Yes | 可选登录从“我的”进入网站当前 provider 集，实际凭据交互由系统浏览器中的唯一 LoginForm 完成；App 核心计时不要求账号 |
| 是否允许用户请求删除数据 | Yes | App 内提供网站统一账号注销入口；单条记录可删除，清除 App 存储或卸载可删除全部本地数据。最终控制台填写公开删除 URL |
| 是否经过独立安全审查 | No | 当前没有第三方认证，不得误填 |

提交前必须重新执行：

1. 对最终 AAB 的合并 manifest、运行时权限和依赖清单做一次扫描。
2. 确认没有临时调试、日志上传、分析或崩溃上报依赖进入 release。
3. 实机导出一次备份，确认只交给用户选择的系统目标，不会自动上传。
4. 如果功能或依赖发生变化，逐项重填，不复制旧版本答案。

Google 要求所有已发布 App 完成 Data safety 表并提供隐私政策，即使 App 不收集数据；只留在 internal testing 的 App 有单独例外。隐私政策必须是公开、可访问、非 PDF 的网页。

## 3. Google Play App content 草稿

| 项目 | 草稿 | 状态 |
|---|---|---|
| App access | 核心计时、历史、设置、备份无需账号；可选账号区显示网站当前 provider 集，并把登录交给系统浏览器。提交前按最终 provider、Apple 4.8 方案和控制台要求准备可用审核账号或说明 | 提交前复核 |
| Ads | No | 已核对 |
| Content rating | 按整个 App（含 Tools 在线页面、论坛/评论和多人入口）的实际可达内容逐项填写；不得按本地计时器范围预填全 No，由控制台计算评级 | 提交前复核 |
| Target audience | 不默认选择儿童年龄段；由所有者根据实际营销对象选择 | 所有者填写 |
| News app | No | 已核对 |
| Government app | No | 已核对 |
| Financial features | None | 已核对 |
| Health features | None | 已核对 |
| Data deletion URL | `https://cuberoot.me/account?view=delete`（中文入口可用 `/zh/account?view=delete`） | 源码入口已完成，部署后复核 |

App 已允许通过系统浏览器创建同一网站账号，并提供 App 内可达的网站注销入口；提交前必须验证公开删除 URL、真实账号注销和控制台 User Data/Account deletion 回答一致。依据：[Google Play User Data 政策](https://support.google.com/googleplay/android-developer/answer/10144311)。

## 4. Android 权限与 SDK 清单

### 4.1 最终合并 manifest 实测

- `android.permission.INTERNET`
- `android.permission.ACCESS_NETWORK_STATE`
- `android.permission.VIBRATE`（普通权限，用于计时器 ready/stop 触觉反馈，不弹运行时授权框）
- Capacitor 生成的应用签名级动态 receiver 权限
- Android 12+：`android.permission.BLUETOOTH_SCAN`（`neverForLocation`）与 `android.permission.BLUETOOTH_CONNECT`，只在用户点击连接智能魔方后请求“附近设备”授权
- Android 11 及以下兼容：`BLUETOOTH` / `BLUETOOTH_ADMIN`、`ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION` 均限制为 `maxSdkVersion=30`
- BLE 硬件声明为 `required=false`；没有 BLE 或不授权的设备仍可使用普通计时器
- 没有相机、麦克风、通讯录、存储或通知权限；不使用蓝牙扫描推断或记录位置
- `android:allowBackup="false"`

源 manifest 只显式申请 Internet；Network 插件贡献网络状态权限。上述结果来自本地签名 release 构建，上传前要对最终 AAB 再跑同一检查。

### 4.2 当前运行时依赖

- `@capacitor/core` / `@capacitor/android`：官方原生容器
- `@capacitor/browser`：承载网站唯一 LoginForm 的 PKCE 登录交互，并在用户主动操作时打开外部页面
- `@capacitor/app`：接收系统浏览器登录后的 App deep link，并读取 App 标识
- `@capacitor/network`：只显示设备在线/离线状态
- `@capacitor/haptics`：只在计时器 ready 和停止时提供设备触觉反馈，不读取或上传数据
- `@capacitor-community/bluetooth-le`：用户主动连接时扫描并连接附近的兼容智能魔方；设备名称/地址用于本机连接与 GAN 密钥派生，转动和状态在本机处理，不上传扫描列表、地址或实时魔方数据
- `@aparajita/capacitor-secure-storage`：将 CubeRoot 会话保存在 iOS Keychain 或 Android Keystore 保护的加密存储中；禁用 iCloud 同步
- React / React DOM：本地界面渲染
- `@cuberoot/shared`：网站与 App 共用的计时数据模型、迁移和打乱逻辑
- `@cuberoot/timer-ui`：网站与 App 共用的计时界面组件和七段字体
- `@cuberoot/event-icon`：网站与 App 共用的项目图标资产和渲染组件
- `@cuberoot/visualcube`：网站与 App 共用的魔方状态 SVG 渲染器

当前没有 Firebase、广告、分析、崩溃上报、推送、支付或第三方用户画像 SDK。Mobile 本身不复制登录表单，也未集成原生第三方身份 SDK；“我的”显示网站实际 provider，凭据交互由系统浏览器中的网站 LoginForm 执行。加入 BLE 和完整 provider surface 后，最终 AAB、Data safety、隐私政策和审核备注必须保持同一说明，不得继续沿用“仅邮箱/手机”或“无蓝牙权限”的旧答案。

## 5. Google Play 商店文案

### 5.1 英文

App name:

```text
CubeRoot
```

Short description:

```text
Offline speedcubing timer with WCA-style scrambles and local history.
```

Full description:

```text
CubeRoot brings timing, speedcubing tools, and your CubeRoot account together in one app.

• Time solves with touch-and-hold controls or a connected keyboard
• Select supported puzzle events and scramble sources
• Use competition scrambles online or from a valid local cache
• Use optional 15-second inspection with automatic +2 and DNF penalties
• Review solve history, edit penalties, and add comments
• Track your best time, ao5, and ao12
• Export and import a versioned JSON backup
• Choose English or Simplified Chinese and follow the system light or dark theme

No account is required for timing. Optional sign-in uses the same CubeRoot account and configured sign-in options as the website. Your timer history remains local and is not uploaded automatically.

The Tools and Account tabs display CubeRoot's online pages and require a network connection. Local timing and history remain on your device. Competition scrambles require network access or a valid local cache; unavailable competition scrambles are never silently replaced with random ones.
```

Release notes `0.1.0`:

```text
Initial release candidate: local timing and history, puzzle and scramble selection, inspection penalties, statistics, bilingual themes, JSON backup and restore, and online Tools and Account tabs.
```

### 5.2 简体中文

应用名：

```text
CubeRoot
```

简短说明：

```text
离线魔方计时器，支持 WCA 风格打乱、本地记录与统计。
```

完整说明：

```text
CubeRoot 将计时、魔方工具与 CubeRoot 账号整合在同一个 App 中。

• 触摸按住或连接键盘进行计时
• 选择支持的魔方项目与打乱来源
• 在线或通过有效本地缓存使用比赛打乱
• 可启用 15 秒观察，并自动判定 +2 与 DNF
• 查看历史、修改罚时并添加备注
• 统计最佳、ao5 与 ao12
• 导入和导出带版本信息的 JSON 备份
• 支持英文、简体中文及跟随系统的深浅主题

计时无需账号；可选登录复用网站同一 CubeRoot 账号与已配置的登录方式。计时记录仍保存在本机，不会因登录而自动上传。

“工具”和“我的”展示 CubeRoot 在线页面，需要网络连接。本地计时和历史记录保存在设备上；比赛打乱需要网络或有效本地缓存，不可用时不会悄悄替换为随机题。
```

版本说明 `0.1.0`：

```text
首发候选版：本地计时与历史、项目和打乱选择、观察罚时、统计、双语主题、JSON 备份与恢复，以及在线“工具”和“我的”三栏体验。
```

## 6. Google Play 审核备注

可直接粘贴并按最终构建调整：

```text
CubeRoot requires no account or subscription for basic local timing. Competition scrambles require either a valid local cache or network access; the app reports an unavailable state instead of substituting a random scramble. Optional account sign-in from the Account tab uses CubeRoot's canonical provider screen and completes credentials in the system browser; timer records remain local and are not uploaded by signing in.

To test: hold the main timer area until it turns ready, release to start, then tap to stop. History, penalties, comments, backup/import, language, theme, privacy, support, and version are available from the bottom navigation and Settings.

Credential entry for sign-in and user-selected external pages intentionally use the system browser. Tools and Account remain visible in the app's shared three-tab shell. Timer records and preferences remain local to the app and are not uploaded automatically.
```

## 7. 截图和素材拍摄表

至少准备一套英文和一套简体中文手机竖屏素材；最终数量和尺寸以 Play Console 当时显示的要求为准。

| 序号 | 页面 | 要展示的状态 | 注意事项 |
|---|---|---|---|
| 1 | Timer | 清晰打乱和未启动计时器 | 不出现测试浮层或调试信息 |
| 2 | Timer | 一次已完成成绩 | 使用可信但不夸张的示例成绩 |
| 3 | History | 多条记录、+2/DNF 和备注 | 不放真实个人信息 |
| 4 | Timer | best、ao5、ao12 快速统计 | 数据应与历史记录一致 |
| 5 | Settings | 语言、主题、观察、备份、隐私、支持、版本 | 完整显示 App 自主管理能力 |

需要的非截图素材：

- [x] 512×512 App 图标已有统一生成源。
- [x] Android launcher 和系统启动页由同一品牌源生成。
- [ ] Google Play feature graphic。（在最终商店视觉方向确认后制作）
- [ ] Android 真机竖屏截图。（MuMu 可先产草稿，最终应用代表性真机复核）
- [ ] 宣传视频。（首发非必需，不为凑资料制作）

## 8. 发布者与控制台待填项

以下内容不得由代码猜测：

- [ ] Google Play 组织账号已完成注册、付费和验证。
- [ ] 公开开发者/组织名称与营业执照一致。
- [ ] 公开地址和联系电话已确认。
- [ ] 目标受众年龄段已由所有者确认。
- [ ] App 类别已确认；候选为 Sports，但以实际定位为准。
- [ ] 国家/地区发布范围已确认，并排除无法履约或法律要求尚未满足的地区。
- [ ] 生产上传密钥已在密码管理和离线备份流程中保存。
- [ ] Play App Signing 已启用，内部测试 AAB 已验证安装、升级和回滚。
- [ ] 最终隐私政策 URL 已在线打开并与当前构建一致。

CubeRoot 走组织账号路线，不把新个人账号的 12 人/14 天要求自动套用。完成组织验证后，以 Play Console 对该账号实际显示的测试门槛为准；无论是否有硬性人数要求，都应做 internal/closed 真实设备测试。官方个人账号规则：[App testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)。

## 9. Apple App Store 预备草稿

这是 iOS 本地技术验证后的起点，不代表已经完成 App Store 提交：

- `[已核对]` iOS 与 Android 使用同一个 `@cuberoot/app-ui` React 产品层和同一 Capacitor 8 宿主；`@capacitor/ios` 为 `8.5.0`，Bundle ID 为 `me.cuberoot.app`。
- `[已核对]` Xcode 26.6（build 17F113）已完成 iOS 26.5 Simulator Debug 构建、安装和启动；Automatic Signing 已启用。
- `[已核对]` iOS App Icon 与深浅启动图由网站 canonical 品牌 SVG 机械生成，并纳入 CI 漂移检查；不是第二套手工素材。
- `[已核对]` 2026-09-11 选择 Team 后，`me.cuberoot.app` 开发签名、`codesign` 校验、iPhone 15 Pro Max / iOS 26.6.1 覆盖安装与启动通过；当前共享 bundle 已 build + sync，Appium 截图确认“难度”顶栏、“最优打乱”设置内和 1 条旧成绩保留。完整回归范围见路线图，不将这条局部证据视为商店验收。
- `[已核对]` 2026-09-11 Apple Developer 门户显示个人 Team `R25HL7AXXK`、续费日期 `2027-09-11`，Program License Agreement 于 9 月 10 日接受、Developer Agreement 于 9 月 3 日接受，所见页面无待处理提示；页面没有字面 `Active`，不另造该标签。
- `[iOS 发布待验]` 上述协议不是 App Store Connect Paid Apps Agreement；IAP 税务/收款、Release Archive、上传和 TestFlight 仍待验证。
- `[iOS 发布待验]` 网站当前显示第三方主账号 provider，但尚无完成真实账号 E2E 的 Apple 4.8 等价登录；在网站唯一 LoginForm/后端同源补齐并实测前，不得提交审核或隐藏 provider 冒充完成。

- iOS 与 Android 都会请求公开比赛打乱；可选登录还会处理邮箱或手机号对应的 CubeRoot 账号、显示名、WCA ID、会话凭证与标准网络信息。App Privacy 必须针对最终构建重新判断联系人信息、用户 ID、IP/客户端信息的类别、用途、关联性和保留方式，不能预填“Data Not Collected”。计时记录、备注和设置仍只保存在设备本地。
- 必须在最终 iOS archive 中生成并检查 Xcode Privacy Report，核对 App 与第三方 SDK 的隐私清单、required-reason API、诊断、分析、账号和网络行为；当前尚无可用于发布结论的 archive/report 证据。
- `[模拟器证据]` 当前 Debug `.app` 内能看到 Capacitor 与 Cordova 自带的 `PrivacyInfo.xcprivacy`，两者声明不跟踪、无收集项和无 required-reason API；KeychainSwift 源包也带同类清单，但没有作为独立文件出现在当前 `.app`。这只是未签名 Simulator 包扫描，不能替代最终 Release archive 的合并隐私报告，也不能决定 App Store Connect 的数据标签。
- App Store 的隐私回答要包含第三方伙伴代码的数据实践，不能只看 CubeRoot 自己写的代码。依据：[Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)。
- 支持 URL 和隐私 URL 可沿用公开网页；截图、设备尺寸、年龄评级和出口合规要在 App Store Connect 中按最终构建填写。
- Windows 不能完成最终 iOS 签名和上传；需要 macOS/Xcode 或受控的 macOS CI。上传构建的官方路径见：[Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)。

### 9.1 开发与商店准备并行

先做账号、配置与资料，不必等所有界面定稿；最终截图和上传包则来自已验收候选版。下表是操作说明，不是第二份进度账本；完成状态只更新路线图第 0 节。

| 现在可准备 | 操作路径 / 边界 |
|---|---|
| 会员与协议 | Apple Developer → Account → Membership details 核对会员状态、到期日与 Team；App Store Connect → Business 核对协议。法律协议由 Account Holder 阅读并接受，AI 不代签 |
| 应用条目 | App Store Connect → Apps → `+` → New App；先查是否已有 CubeRoot，复用 `me.cuberoot.app`，不要新造 Bundle ID。名称、默认语言与 SKU 由所有者确认后创建 |
| 登录配置 | 在现有网站唯一账号体系中配置 Sign in with Apple，沿用 App 的系统 Browser → PKCE → 一次性票据流程；门户资源、私钥和真实账号验收见下节，不创建 iOS 私有账号系统 |
| 资料草稿 | 准备双语介绍、支持/隐私 URL、真实账号删除路径、审核账号与 BLE 测试说明；类别、年龄、地区、公开身份、欧盟 trader 和大陆备案由所有者确认 |
| 最终候选版 | 完成核心计时、升级数据保留、登录/注销、BLE、离线与权限测试后，拍最终截图；从同一候选版 Archive、校验、上传，再在 TestFlight 测同一个构建 |

官方说明：[账号首页与会员信息](https://developer.apple.com/help/account/basics/account-landing-page/)、[新建应用条目](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/)、[App Store Connect 工作流](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-workflow/)。创建条目不等于上传，更不等于提交审核或公开发布。

### 9.2 Sign in with Apple 门户与验收

先查询现有资源再创建；以下是维护流程，已完成的门户配置见本节证据，不要重复注册资源。源码、门户配置与线上启用仍是不同层级：

1. Apple Developer → Certificates, Identifiers & Profiles → Identifiers → `me.cuberoot.app` → Sign in with Apple → Configure；首次启用时配置 primary App ID，保留既有 Bundle ID。
2. Identifiers → Services IDs：复用已有、与 CubeRoot 匹配的 Services ID；没有时再通过 `+` → Services ID 注册。进入 Sign in with Apple → Configure，选择上述 primary App ID，登记真实网站域名与后端 HTTPS return URL；值必须与服务端配置逐字一致，不能拿 `me.cuberoot.app://auth/callback` 代替 Apple 的 Web return URL。
3. Keys → 对应 Sign in with Apple key：确认 primary App ID 与 key ID。新私钥仅在确有需要时创建，下载后直接进入仓库外受控密钥存储；不进 Git、不贴聊天、不写进 App bundle 或前端环境变量。生产配置值应走既有后端 secret 管理，不能把源码接入记成生产启用。
4. 如需给隐藏邮箱用户发送邮件：Services → Sign in with Apple for Email Communication → Configure，登记实际发信域名/地址并核对 SPF/DKIM；“能登录”不等于 relay 邮件可达。
5. 分别实测首次授权、隐藏邮箱、再次登录、取消、过期/重复回调、已有账号绑定/解绑，以及 App Browser 回跳、退出与账号注销。删除使用 Apple 登录的账号时，还必须验证 Apple token 撤销，不只清本地 Keychain 或站内账号。

官方依据：[Web 配置](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/)、[私钥与 primary App ID](https://developer.apple.com/help/account/capabilities/create-a-sign-in-with-apple-private-key/)、[邮件 relay](https://developer.apple.com/help/account/capabilities/configure-private-email-relay-service/)、[账号删除](https://developer.apple.com/support/offering-account-deletion-in-your-app/)。门户/生产配置、E2E 和最终审核必须分开记账。

当前后端配置契约（代码接入不等于已部署；私钥实际值不得填入本文）：

| 服务端变量 | 取值来源 / 用途 |
|---|---|
| `APPLE_LOGIN_ENABLED` | 完整配置并准备启用时设为 `1`；未配置不能显示可用登录 |
| `APPLE_CLIENT_ID` | `me.cuberoot.web`；2026-09-11 已实际注册并关联 primary App ID `me.cuberoot.app` |
| `APPLE_TEAM_ID` / `APPLE_KEY_ID` | 实际 primary App ID 所属 Team 与对应 Sign in with Apple key ID |
| `APPLE_PRIVATE_KEY` | `.p8` PEM 内容，仅由既有安全部署环境注入，不进前端、App、日志或 Git |
| `APPLE_REDIRECT_URI` | `https://api.cuberoot.me/v1/auth/apple/callback`，必须与 Services ID 的 HTTPS return URL 一致 |
| `APPLE_TOKEN_ENCRYPTION_KEY_V1` | 独立 32-byte base64 服务端密钥，用于 Apple refresh token 的 AES-GCM 加密；与签名 key/JWT secret 分离 |
| `JWT_SECRET` / `PUBLIC_SITE_ORIGIN` | 复用现有 CubeRoot 会话和 canonical 网站 origin，不再建 Apple 专属会话体系 |

Apple `form_post` 回调通过 303 返回网站既有 `/auth/social/callback`。浏览器交接以 state + S256 challenge/verifier 绑定，再复用已有 App PKCE/一次性票据；不把 verifier 或长期 token 放 URL。身份依据 Apple 验签后的 `sub`，不按邮箱自动合并，也不保存 Apple 邮箱；仅请求 email scope，不请求姓名。refresh token 加密保存在现有 `auth_identities`；解绑/注销前必须验证 Apple revoke 成功，失败保留记录供重试。当前尚无真实 Apple 登录、隐藏邮箱、解绑/注销、外部撤销通知和五端 PKCE E2E 证据；不能提前关闭 Apple 4.8 门槛。

首次身份选择增量（2026-09-11，本地实现）：Google、Apple、微信、QQ、支付宝和 WCA 的网站授权，未知身份先不创建账号，用户明确选择新建或验证已有账号后再确认绑定。`0232_auth_identity_pending` 仅保存短期票据摘要、已验证身份资料及必要的 Apple 加密凭据，认证尝试 15 分钟过期，后台每分钟清理到期记录；成功确认时身份和凭据在同一事务迁入原账号体系。浏览器仅在 sessionStorage 保存短期不透明票据，不把它放入 URL。放弃未完成流程不等于撤销 Apple 授权；既有解绑/注销的 revoke 规则不变。最终隐私披露需包含这段短期认证数据处理；此项不证明个人授权或五端回跳已验收。

2026-09-11 门户配置证据：primary App ID `me.cuberoot.app` 和 Services ID `me.cuberoot.web` 已注册、关联，域名 `cuberoot.me`、`www.cuberoot.me`、`api.cuberoot.me` 与上表 HTTPS return URL 已配置，所有者 Save 后返回列表。先前“没有可用 identifier，无法建 SIWA key”的阻塞已解除；所有者已生成并下载 `.p8`，本机 `openssl pkey -check -noout` 返回 `Key valid`，文件权限设为 `600`。私钥内容和本机路径不记入本文件、不入 Git；仍未证明生产已注入配置、Apple 令牌交换或登录 E2E。IAP 商品/价格/周期决策继续待所有者确认，SIWA 配置不意味着已启动付费商品配置。

同日后续部署证据：源码 `83ef9a85d` 的 Core / Next / Vercel 部署已成功，`0231` 迁移摘要与生产 ledger 一致，服务器 Apple 配置已安全注入，公开 provider 返回 `apple: true`。隔离浏览器已从生产中文登录按钮进入 Apple 官方授权页面，确认显示 CubeRoot Web Login；有效 state 的取消回调也已通过。完整记录见路线图阶段 6。此项仅关闭配置、部署与授权入口检查，不证明个人凭据授权、隐藏邮箱、App 回跳、绑定/解绑或撤销/注销通过；`DRAFT — NOT SUBMISSION READY` 不变。

### 9.3 首发与后续更新

防重复账号本地增量：邮箱/手机号验证码及抖音未知身份先进入既有 15 分钟待确认流程，明确新建或验证旧号后才完成；`0234_auth_identity_choice_providers` 扩展既有表的 provider 约束，不新建账号体系。抖音通过网站原账号生成的独立 10 分钟绑定码进行目标预览与主动绑定，验证码仍只保存摘要并限次验证，pending 不进入 URL 或小程序持久化存储。此项需后端迁移、网站部署与新版小程序发布；旧小程序遇到新身份确认响应不得静默创建。尚不代表真实 provider、五端回跳、退出/注销或商店验收通过，也不代表微信手机号授权或 Apple IAP 已接入。

2026-09-12 后续增量：微信手机号实时验证已本地接入既有账号体系；命中手机号原账号后显示目标并要求确认，未知号码保留验证旧号/明确创建。微信与手机号同事务绑定，不自动合并；短期手机号认证资料 15 分钟过期并清理，成功后必要身份数据进入原账号身份表。隐私政策已同步数据用途与生命周期。仍需部署、微信实时手机号能力/额度及后台隐私声明核验、新版小程序上传和真机验收；不据此勾选 iOS 原生、Apple IAP 或商店发布完成。

兼容性门槛：不可撤销的账号合并请求现在必须携带已确认来源账号 `expectedSourceUid`，服务端在验证/消费合并码之前核对。旧客户端缺字段或跨标签切换账号均失败关闭；网站与 API 应协同发布，旧页面刷新后再操作，不能为了兼容恢复可能合并错误来源账号的旧路径。账号绑定码及合并码签发同样必须核对 `expectedUid`。

2026-09-11 登录 UI/UX 本地验收补充：网站唯一登录/绑定组件已覆盖 Apple provider 可用性、失败重试、等待取消与卸载/BFCache 恢复；请求时限包含响应体读取。App 的账号管理 Browser 启动有独立期限，旧 web-ticket 不得在登出/换号后恢复旧会话。真实 LoginForm 的中英 × 320/390px × 深浅主题 × 正常/等待/取消/真实 502 错误共 32 格浏览器验证通过，无溢出/截字/页面异常；API 使用隔离响应，未连接 Apple。服务暂不可用错误复用双语提示，不直接显示英文后端错误。这些是组件/协议回归证据，尚未完成真实 Apple 授权、隐藏邮箱、退出/注销及五平台回跳矩阵，不能据此解除 4.8 提交阻塞。

本次智能魔方增量会在本机成绩中保存动作与可选姿态轨迹、设备型号/名称，并提供用户主动分享回放入口；不新增自动上传。最终隐私说明、审核备注和数据问卷须与这一持久化/分享行为对齐，不能再把所有转动数据描述成“只在内存中”。

| 环节 | 首发 | 后续 App 代码更新 |
|---|---|---|
| ① 测试 | 首发核心矩阵 | 测变更范围，并保留升级、登录/注销与 BLE 等必要回归 |
| ② 商店资料 | 创建条目并准备完整资料 | 复用既有条目；更新版本说明及有变化的截图、隐私、权限等 |
| ③ 构建上传 | build + sync → Release Archive/校验 → 上传/处理 | 同样需要新构建与上传；先与控制台核对版本和未用 build number |
| ④ TestFlight | 项目首发建议完成内部测试 | 按风险安排；不是 Apple 规定每次上架的必经步骤，外部测试另有 Beta App Review |
| ⑤ 审核发布 | 选择已测试构建提交 App Review，通过后按所有者确认的方式发布 | 同样提交新版审核；不是只做第 ⑤ 步 |

仅更新兼容 API、比赛/公式等服务器数据通常不需新 App 包；`app-ui`、`timer-ui`、宿主、原生权限或包内 React/TS/CSS 变化则需重建受影响平台。网站部署不等于用户手机里的包自动更新；不要为免审核增加远程可执行代码热更新。日常命令继续复用 Mobile README，不另建第二套发布脚本。

官方依据：[上传构建](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)、[TestFlight](https://developer.apple.com/testflight/)、[创建后续版本](https://developer.apple.com/help/app-store-connect/update-your-app/create-a-new-version/)、[发布流程](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/overview-of-publishing-your-app-on-the-app-store/)。流程资料核对日期：2026-09-11；账号、隐私或政策变化时重新核实。

### 9.4 会员内购：复用现状与实施边界

2026-09-11 所有者确认 App 内购买会员，全球发行包含中国大陆。本节仅记录源码/公开 API 盘点和待决策范围，没有创建商品、接 StoreKit、修改会员或发起付款。

| 单一来源 | 当前责任 |
|---|---|
| `core/apps/api/src/routes/membership.ts` | `/v1/membership/plans`、`me`、`orders`、支付通知、管理员套餐/开通；`grantMembership` 与 `settlePaidOrder` 维护网站现有权益 |
| `core/apps/api/migrations/0046_membership.sql` 及后续会员 migrations | `membership_plans`、`membership_orders`、`memberships`；现有续约合约在 `membership_contracts`，不是 Apple 订阅 |
| `core/apps/api/src/utils/membership.ts` | `hasActiveMembership` 服务端权益闸；音乐、私有素材、复盘及师生资料等现有消费者继续复用 |
| `core/packages/client/lib/membership-api.ts`、`hooks/useMembership.ts`、`app/[lang]/membership/` | 网站会员读取、购买与管理 UI；App 不复制会员等级、价格规则或独立账号 |
| `core/apps/api/src/utils/recon_helpers.ts`、shared `account.ts` | `requireAuth` 通过 `ownerKey(uid,wcaId)` 解析既有账号，未绑定 WCA 的账号也有合成归属键；Apple 用户不应被迫再注册 WCA |

不要误接 `platform_commerce.ts` 的 `platform_memberships`：它属于另一套平台商城/课程商品域，不是 `/membership` 的核心会员。现有支付 provider 为支付宝、微信、虎皮椒和 Airwallex；所查 Mobile/API/app-ui/shared 没有 StoreKit 或 App Store Server API 集成。

公开 `/v1/membership/plans` 在 2026-09-11 返回个人月度 CNY 29.99、个人年度 CNY 299、企业月度 CNY 699、企业年度 CNY 6980，支付宝/微信渠道可用；这是当日网站价格快照，不是已确认的 Apple 商品价格。数据表支持永久/月/年等周期，旧 migration 的 seed 价格不是当前价格；`monthly_auto_renew`/`yearly_auto_renew` 下单仍明确拒绝，不能把既有微信合约管理当成已可购买的自动续费。

IAP 不只是加一个支付按钮：

- StoreKit 商品/购买/恢复放 iOS 薄宿主，服务端验签交易和 App Store 通知，再更新同一会员权益；展示价格来自当前 StoreKit storefront，不用网站 CNY 数字冒充全球商店价。
- 按真实商品建立 `productId → membership plan/entitlement` 映射与账号绑定，服务端对 transaction/original transaction、环境、Bundle ID、所有者及重放做校验；恢复购买不得转移到任意登录账号。
- 当前网站开通使用 `max(now,现有到期)+周期`，不能直接当 Apple 订阅事件处理器，否则续费/恢复/重放可能重复加时。Apple 到期、撤销、退款与其他渠道权益须按来源证据汇总，不能因一笔 Apple 退款抹掉其他渠道仍有效的会员。
- 当前 `settlePaidOrder` 先将订单设为 paid 再调用 grant，两步不在同一事务；接 IAP 前须在同一权益服务中解决幂等与原子性，不能复制另一套“iOS grant”绕过旧逻辑。
- 必须补购买取消/pending、断网、服务端通知乱序/重复、退款/撤销、恢复、到期、换账号/绑 WCA、升级与沙盒/生产隔离验收；App Store Server API key 与 Sign in with Apple key 不是同一用途。

商品创建前由所有者确认：个人/企业哪些档位首发；是否同一会员权益；月/年是自动续费还是一次购买固定期限；是否提供永久；各 storefront 价格与基准币种；免费试用/优惠、家庭共享；网站已有剩余时长与 Apple 订阅并存规则。自动续费订阅适用于持续服务、非续期订阅适用于固定期手动购买、永久权益通常对应非消耗型商品；不得未经确认将一次性年卡改成连续扣费。[Apple 商品类型](https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/in-app-purchase-types/)

### 9.5 IAP 协议与全球（含中国大陆）材料

- Account Holder 在 App Store Connect → Business 接受 Paid Apps Agreement，提供税务和收款资料；Apple 当前说明该协议需处于 Active 才能做 IAP sandbox 测试。Developer Program 的年费/已接受协议不替代这一步，AI 不代签协议或猜税务答案。[IAP 配置流程](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases/)
- App → Monetization → In-App Purchases / Subscriptions 创建经所有者确认的商品、组、价格、地区与审核资料；每种 IAP 类型的首个商品须与新 App 版本一起提审，后续同类型商品是否单独提交以当时控制台条件为准。[IAP 提审](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase/)
- 数字会员在 iOS 内销售采用 IAP；跨平台可复用在网站取得的权益，但应按 3.1.3(b) 提供相应 App 内购买。全球地区规则有差异，不能将某一 storefront 的外部支付例外套用全球，也不能把网站微信/支付宝收银台直接嵌入中国区 App 当内购。[App Review 3.1.1 / 3.1.3(b)](https://developer.apple.com/app-store/review/guidelines/#payments)
- 中国大陆：App → App Information → Availability in China mainland，核对 App 对应 ICP filing number 和简体中文元数据与 MIIT 备案一致；网站域名备案不能自动证明 App 已备案。按实际内容判断是否还涉及游戏审批、出版、宗教或新闻许可证，不为规避材料虚报类别。尚未验实任何 CubeRoot App 备案或这些许可，不据网站资料预填。[Apple App Information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/)
- 其他目标地区也须检查资料和支付可用性，欧盟 trader/公开联系方式独立核实。用户确认全球包含中国是发行目标，不是各地区合规已完成的证据；App 与每个 IAP 商品的可用地区均需复核。
- 内购加入后，本文“无支付 SDK/无购买”仅描述旧候选包，不再可作为正式提交答案。最终需更新 App Privacy/Data safety 的购买记录、账号关联、退款/保留规则、隐私政策、服务条款、自动续费说明与商店文案；采购功能通过前不得把草稿写成已可购买。

## 10. 每次提交前的最终复核

以下 Android 与 iOS 条目按本次目标平台执行，共通资料仍须一致；只通过其中一端不能勾选另一端发布状态。

- [ ] `package.json` 版本、Gradle versionName/versionCode 和商店版本一致。
- [ ] 使用生产上传密钥生成 release AAB，并由 `jarsigner` 验证。
- [ ] 最终 AAB 权限、SDK、Data safety 和隐私政策一致。
- [ ] release 包在 Android 真机上完成安装、冷启动、计时、杀进程恢复、导入导出和外链测试。
- [ ] release 包在代表性真机完成附近设备授权、智能魔方扫描/连接/自动计时/断线恢复，并确认拒绝权限不影响普通计时。
- [ ] 从上一商店版本升级后，本地数据不丢；回滚策略已演练。
- [ ] 英文与中文商店文案、截图、版本说明和 App 内实际界面一致。
- [ ] 隐私、支持链接可从未登录的公共网络访问。
- [ ] internal/closed 测试反馈已清零或有明确的接受记录。
- [ ] 控制台警告、内容评级、目标受众、国家/地区和价格均已复核。
- [ ] 保存最终 AAB 的 SHA-256、构建提交 SHA、上传时间和 Play release ID。
- [ ] iOS：门户会员/协议、Bundle ID、版本/build number、分发签名与 entitlement 已对齐；Release Archive、Validate App 和 Privacy Report 通过。
- [ ] iOS：最终候选版完成 iPhone 核心、Apple 登录/回跳/注销、BLE 与升级数据保留验收，支持型号只引用实测矩阵。
- [ ] iOS：App Store Connect 已处理目标构建，资料与所选构建一致；记录 archive/导出产物摘要、源码 SHA、版本/build number、上传与审核状态。TestFlight、App Review 和公开上架分别记录。
