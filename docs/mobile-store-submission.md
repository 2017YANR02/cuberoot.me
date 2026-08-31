# CubeRoot 移动端商店提交资料

最后核对：2026-08-31
适用构建：`@cuberoot/mobile` `0.1.0`，Android `versionCode 1000`
应用标识：`me.cuberoot.app`

提交状态：`DRAFT — NOT SUBMISSION READY`。当前文件已按共用三栏 App、真实 provider 集和 iOS 本地构建事实更新，但 Apple 账号、4.8 登录等价方式、最终 archive 隐私报告、真机矩阵和商店素材仍会阻止提交。

这份文件是 `0.1.0` 的版本锁定快照，也是 Google Play 提交表、未来 App Store Connect 提交表和审核备注的单一工作稿。发布下一版本时先复制或整体更新版本事实，不得只改其中一处。每次加入登录、云同步、分析、崩溃上报、广告、付费、BLE 或新的原生权限后，必须先更新本文件和隐私政策，再生成新商店构建。

状态标记：

- `[已核对]`：已从当前源码、依赖或签名构建中验证。
- `[提交前复核]`：内容已有草稿，但必须针对最终上传包再核对。
- `[所有者填写]`：需要公司、账号或市场决策，代码无法替代。
- `[iOS 待签名]`：已在 macOS/Xcode 完成本地模拟器构建，但必须等付费 Team、真机签名或 archive 后才能确认。

## 1. 当前可直接复用的应用事实

| 字段 | 当前值 | 状态 |
|---|---|---|
| 应用名 | CubeRoot | 已核对 |
| Android application ID | `me.cuberoot.app` | 已核对 |
| 当前版本 | `0.1.0`（`versionCode 1000`） | 已核对 |
| 默认商店语言 | English | 提交前复核 |
| 第二语言 | 简体中文 | 已核对 |
| 支持邮箱 | `yrmfxc@gmail.com` | 已核对 |
| 组织法定名称、地址、电话 | 待所有者提供，并与商店公开资料一致 | 提交前阻塞 |
| 英文隐私政策 | `https://cuberoot.me/privacy` | 源码已完成，推送部署后复核 |
| 中文隐私政策 | `https://cuberoot.me/zh/privacy` | 源码已完成，推送部署后复核 |
| 登录要求 | 核心计时无需账号；设置中可选登录同一 CubeRoot 网站账号 | 已核对 |
| 广告 | 无 | 已核对 |
| 付费/订阅 | 无 | 已核对 |
| 用户生成内容/聊天 | 无 | 已核对 |
| 核心功能 | 本地优先计时、43 项目录与按项目 provider、真实比赛打乱的有界在线缓存、历史记录、罚时、备注、统计、JSON 备份与恢复、可选原生 BLE 智能魔方；工具与账号复用网站唯一页面，登录不代表上传计时数据 | 已核对 |

当前 App 不是启动即打开远程整站的 WebView 套壳。计时器、历史、统计和 IndexedDB 存储打进同一个 React + Vite 包；工具与“我的”则在共用三栏内显示网站 canonical 页面，不复制网站卡片、路由或账号表单。已映射的 19 个 WCA 项目会从 CubeRoot API 下载公开比赛打乱并在本机保存最多 50 条、最长 7 天；冷启动无缓存且断网时明确显示不可用/错误，不用随机题冒充比赛真题。无 WCA 映射的项目按网站契约使用同项目本地 provider。账号交互通过系统浏览器走网站唯一 LoginForm 的 PKCE 流，再把短期交接结果写入原生安全存储；当前计时记录、备注和设置仍只保存在本机。

## 2. Google Play Data safety 草稿

Google 将“收集”定义为把数据从设备传给开发者或第三方。当前版本的计时记录与设置只在设备本地处理；用户主动导出 JSON 属于用户发起的本地文件/系统分享流程，App 不会自动上传。智能魔方的扫描结果、蓝牙地址、转动和状态也只在本机运行内存中处理。App 会向 CubeRoot API 请求公开比赛打乱，服务器会处理并记录 IP 地址、设备或客户端类型等标准网络信息，因此最终问卷不能继续按“没有远程 API”直接回答 No。依据：[Google Play Data safety 填写说明](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)。

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
| Content rating | 无暴力、色情、赌博、受控物质、粗俗语言、聊天或 UGC；在问卷中逐项如实选 No，由控制台计算评级 | 提交前复核 |
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
CubeRoot is a focused speedcubing timer that works offline and keeps your solves on your device.

• Time solves with touch-and-hold controls or a connected keyboard
• Generate 3×3 WCA-style scrambles
• Use optional 15-second inspection with automatic +2 and DNF penalties
• Review solve history, edit penalties, and add comments
• Track your best time, ao5, and ao12
• Export and import a versioned JSON backup
• Choose English or Simplified Chinese and follow the system light or dark theme

No account is required for timing. You may optionally sign in with the same CubeRoot email or phone account used on the website. The app contains no ads or analytics SDKs. Your timer history remains local and is not uploaded automatically.

For CubeRoot's complete collection of speedcubing tools, use the Full website link in Settings.
```

Release notes `0.1.0`:

```text
First Android release: offline 3×3 timer, WCA-style scrambles, inspection penalties, local history and statistics, bilingual themes, and JSON backup and restore.
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
CubeRoot 是一款专注的速拧计时器，可离线使用，计时记录只保存在你的设备上。

• 触摸按住或连接键盘进行计时
• 生成三阶 WCA 风格打乱
• 可启用 15 秒观察，并自动判定 +2 与 DNF
• 查看历史、修改罚时并添加备注
• 统计最佳、ao5 与 ao12
• 导入和导出带版本信息的 JSON 备份
• 支持英文、简体中文及跟随系统的深浅主题

计时无需账号；你也可以选择使用网站相同的 CubeRoot 邮箱或手机号登录。App 不包含广告或分析 SDK，也不会自动上传你的计时记录。

需要更多魔方工具时，可在设置中打开 CubeRoot 完整网站。
```

版本说明 `0.1.0`：

```text
首个 Android 版本：离线三阶计时、WCA 风格打乱、观察罚时、本地历史与统计、双语主题，以及 JSON 备份和恢复。
```

## 6. Google Play 审核备注

可直接粘贴并按最终构建调整：

```text
CubeRoot requires no account, subscription, or special setup for its bundled timer. Local timer features are available immediately. Competition scrambles require either a valid local cache or network access; the app reports an unavailable state instead of substituting a random scramble. Optional account sign-in from the Account tab uses CubeRoot's canonical provider screen and completes credentials in the system browser; timer records remain local and are not uploaded by signing in.

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

- `[已核对]` iOS 与 Android 使用同一个 React + Vite + Capacitor 8 App；`@capacitor/ios` 为 `8.5.0`，Bundle ID 为 `me.cuberoot.app`。
- `[已核对]` Xcode 26.6（build 17F113）已完成 iOS 26.5 Simulator Debug 构建、安装和启动；Automatic Signing 已启用。
- `[已核对]` iOS App Icon 与深浅启动图由网站 canonical 品牌 SVG 机械生成，并纳入 CI 漂移检查；不是第二套手工素材。
- `[iOS 待签名]` Apple Developer 账号登录异常，尚未验证会员 Active、付费 Team、iPhone 真机签名、Archive、上传和 TestFlight。
- `[iOS 待签名]` 网站当前显示第三方主账号 provider，但尚无通过最终 iOS 审核验证的 4.8 等价登录方式；在网站唯一 LoginForm/后端同源补齐并实测前，不得提交审核或隐藏 provider 冒充完成。

- iOS 与 Android 都会请求公开比赛打乱；可选登录还会处理邮箱或手机号对应的 CubeRoot 账号、显示名、WCA ID、会话凭证与标准网络信息。App Privacy 必须针对最终构建重新判断联系人信息、用户 ID、IP/客户端信息的类别、用途、关联性和保留方式，不能预填“Data Not Collected”。计时记录、备注和设置仍只保存在设备本地。
- 必须在最终 iOS archive 中生成并检查 Xcode Privacy Report，核对 App 与第三方 SDK 的隐私清单、required-reason API、诊断、分析、账号和网络行为；当前尚无可用于发布结论的 archive/report 证据。
- `[模拟器证据]` 当前 Debug `.app` 内能看到 Capacitor 与 Cordova 自带的 `PrivacyInfo.xcprivacy`，两者声明不跟踪、无收集项和无 required-reason API；KeychainSwift 源包也带同类清单，但没有作为独立文件出现在当前 `.app`。这只是未签名 Simulator 包扫描，不能替代最终 Release archive 的合并隐私报告，也不能决定 App Store Connect 的数据标签。
- App Store 的隐私回答要包含第三方伙伴代码的数据实践，不能只看 CubeRoot 自己写的代码。依据：[Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)。
- 支持 URL 和隐私 URL 可沿用公开网页；截图、设备尺寸、年龄评级和出口合规要在 App Store Connect 中按最终构建填写。
- Windows 不能完成最终 iOS 签名和上传；需要 macOS/Xcode 或受控的 macOS CI。上传构建的官方路径见：[Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)。

## 10. 每次提交前的最终复核

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
