# 纪录邮件与 Android / iOS 推送配置

2026-09-27 更新。本地实现不等于生产已启用；最新验收状态见 [App 路线图](mobile-app-roadmap.md#2026-09-15-纪录订阅与通知未完成)。本轮没有购买套餐、注册开发者身份或向真实用户群发。

## 共用行为

网站和各 App 的「我的 → 消息」复用 `/notifications`：项目、单次/平均、纪录级别、选手所属地区共用同一份服务端偏好。绑定 WCA 的本人纪录（含 PR）自动纳入，不受这些筛选排除；邮件仍尊重已验证邮箱与邮件开关，手机仍尊重隐私同意和系统通知权限。比赛首次抓取只建立基线，已有成绩不补发。

手机队列从既有站内纪录通知派生，不重复实现成绩判定或订阅匹配。Android 首次登录后，在客户端和服务端均配置的前提下显示 SDK 隐私同意，再请求系统通知权限。拒绝不影响其他功能；在系统设置重新开启后回到 App。退出/换号先关闭本机推送并撤销旧设备绑定，离线保留仅能撤销该设备的随机凭据，联网重试；不保存旧 JWT 供重试。

## 费用与账号

- 个推官网提供免费接入入口，VIP 按日联网设备月峰值计费，公开最低档为 3,000 元/月；**不是接入就必须买 VIP**。免费账号实际 API、厂商额度和限制须在创建应用后核对，不承诺免费无限量。[产品页](https://www.getui.com/notification-push)、[计费说明](https://docs.getui.com/getui/billing/rules/)。
- 邮件继续使用现有 Resend：当前免费档 3,000 封/月、100 封/天；Pro 为 20 美元/月起。验证码和通知共用额度，比赛集中出成绩时需要留意每日限制。[官方价格](https://resend.com/pricing)。
- iOS 开发者会员已由所有者确认具备；这不等于 Push Notifications capability、APNs 凭据、签名及真机验收已完成。iOS 通道已补源码，实际配置与真机送达仍待验收。

## 1. 邮件

复用服务端 `RESEND_API_KEY` 和 `MAIL_FROM`，无需新建邮件发送实现。发信域名在邮件控制台核验 SPF/DKIM/DMARC；不要公开 API key。收件人必须绑定并验证邮箱，打开邮件通知。先用所有者测试账号验证收信及一键退订，再放开真实订阅；当前邮件沿用 best-effort 发送，失败没有独立补发队列。

## 2. 创建 Android 应用

在[个推开发者中心](https://dev.getui.com/)使用所有者账号完成实际要求的注册/认证，分别创建正式和调试应用，包名严格对应：

| 包 | Android 包名 | 环境变量前缀 |
| --- | --- | --- |
| 正式 | `me.cuberoot.app` | `GETUI_` |
| 调试 | `me.cuberoot.app.debug` | `GETUI_DEBUG_` |

个推控制台的 AppID 是服务商 ID，不是 Android 包名。服务端分别设置 `APP_ID`、`APP_KEY`、`MASTER_SECRET` 三个变量（加上表前缀）。`MASTER_SECRET` 和服务端 key 只进入服务端安全环境，不能进入 App、Git、日志或聊天。Android 构建只读取对应 `APP_ID`，通过 `GETUI_APPID` manifest placeholder 注入公开应用标识；默认空值禁用推送。

部署迁移 `0238`、`0239` 和 API 后，准备真实联调时才设置 `RECORD_PUSH_ENABLED=1` 并重载 API。沿用现有发布工作流，迁移自动执行；本地配置不等于线上配置。关闭该开关会停止发送，但保留过期数据清理。

## 3. 国内厂商通道

只接个推长连接无法证明国内 Android 后台/杀进程到达。各厂商平台需要创建匹配包名和签名的应用、开通推送，再把厂商凭据配置到个推控制台。以下构建入口已写入，只有对应变量完整时才加入厂商依赖，缺部分变量会让构建失败；这些分支尚未用真实账号构建/收取。

以下后缀添加正式 `GETUI_` 或调试 `GETUI_DEBUG_` 前缀：

| 厂商 | 构建变量后缀 |
| --- | --- |
| OPPO | `OPPO_APP_KEY`、`OPPO_APP_SECRET` |
| vivo | `VIVO_APP_ID`、`VIVO_APP_KEY` |
| 小米 | `XIAOMI_APP_ID`、`XIAOMI_APP_KEY` |
| 魅族 | `MEIZU_APP_ID`、`MEIZU_APP_KEY` |
| 荣耀 | `HONOR_APP_ID` |

厂商 SDK 指定的客户端 key 与服务端 `MASTER_SECRET` 不同，不能互换。华为 Android 尚需真实 `agconnect-services.json`、HMS 插件和签名配置后接入；HarmonyOS NEXT 是另一宿主，尚未实现。厂商通知分类/限额也需按实际资格核验，不能把纪录通知冒充系统高优先级消息。[厂商配置指南](https://docs.getui.com/getui/mobile/vendor/androidstudio/)。

## 4. 构建与验收

先在当前 PowerShell 安全注入对应应用变量，再从 `core/` 执行既有命令：

```powershell
pnpm --filter @cuberoot/mobile assets:android
pnpm --filter @cuberoot/mobile cap:sync:android
```

进入 `apps/mobile/android` 后，在 macOS/Linux 运行 `./gradlew :app:assembleDebug`，Windows 运行 `.\\gradlew.bat :app:assembleDebug`。正式包另走现有签名发布流程，不用调试包代替。不能提交密钥/私钥或含它们的临时配置。

联调使用单个所有者测试账号与测试设备，不在个推控制台选择全量推送。需要分别实测：拒绝/允许/撤销权限、本人 PR 自动命中、订阅筛选、前台/后台/杀进程、断网重连、退出及切换账号、卸载重装、点击通知打开对应比赛。通知内容只含公开纪录和比赛链接，可能显示在锁屏；当前点击打开 canonical 网站比赛页，尚非 App 内比赛深链。

服务端每 30 秒扫描，单轮最多 30 条，单条最多 5 次指数退避；只派发绑定后且 1 小时内的通知。厂商接收不等于手机展示；超时重试可能重复送达，固定通知 ID 用于替换同条通知，不声称严格 exactly-once。设备 30 天不刷新、队列超过 7 天定期清理，删除账号/设备级联删除绑定或队列。

隐私政策和商店 SDK 清单已同步源码，包括个推附带的卓信 ID SDK。已关闭推送无关扩展与可选硬件标识采集，移除 SDK 默认带入的电话状态、任务列表、全量应用列表和后台定位权限，禁止明文流量；最终配置的长连接及厂商 HTTPS 通道仍须实测。正式发版仍须扫描最终合并 manifest 并验证同意前不采集；厂商 SDK 条件依赖会改变最终权限，基础 debug 构建不能代替这些验证。

## 5. iOS APNs（仅 wca_record）

iOS 复用同一订阅、站内消息、设备控制器和投递队列，通过薄 Swift RecordPush 插件接 APNs，不引入 Android FCM。仅发送 wca_record，不包含 Bark 的新比赛、报名动态或运维告警。Bark 旧通道保持独立。

### Apple 与服务端配置

1. 在 Apple Developer 的 Identifiers 中核对实际 Bundle ID（当前 Xcode Debug/Release 都是 me.cuberoot.app），启用 Push Notifications。更新对应签名 profile；不要仅凭 Xcode 源码 capability 判断线上已开通。
2. 在 Apple Developer 的 Keys 创建或使用具有 APNs 权限且覆盖该 topic 的 key，记录 Key ID、Team ID。将 .p8 安全放到服务器仅运行用户可读的文件，不能放入 App、Git、聊天或日志。
3. 服务端设置 APNS_TEAM_ID、APNS_KEY_ID、APNS_PRIVATE_KEY_PATH。APNS_ENABLED=1 与既有 RECORD_PUSH_ENABLED=1 必须同时成立；默认关闭。修改线上环境与发布按仓库发布授权执行，不由文档自动授权。
4. 迁移 0255 扩展原设备表，旧 Android 行默认为 getui/production；APNs 的 provider、environment、app_id、client_id 联合隔离。上线由既有 Actions 先迁移再重载 API，不手工 ALTER。

### 构建与权限

Xcode 工程已有 App.entitlements、Push capability、设备 token 回调。APNS_ENVIRONMENT 在 Debug 默认 development、Release 默认 production，同一 build setting 写入 entitlement 和 Info.plist；设备上报分别为 sandbox/production。**实际导出/重签名 profile 的 aps-environment 必须匹配 Info.plist**，不能把开发包 token 发到生产 APNs。TestFlight/App Store 使用 Release production；自定义导出流程若改变环境，须同时修改构建设置并核对最终签名 entitlement。

在 core/ 执行 pnpm --filter @cuberoot/mobile ios:build 完成 Web build、sync 与无签名 Simulator 构建；真实设备使用既有 ios:open/ios:run 和所有者的 Apple Team。Windows 无法完成 Xcode 签名或 iPhone 送达验证。

登录且服务端配置完整后才申请系统通知权限。拒绝不影响登录；之后可在 iOS 设置 → 通知 → CubeRoot 修改权限，再回 App 刷新。内容筛选继续在「我的 → 消息」配置，只有一份账号偏好；本轮不新增独立的 iOS 订阅页面或 App 内设备开关。系统通知权限控制本机是否显示，服务端按账号订阅和设备绑定投递。

设备 token 每次注册更新后通过既有控制器绑定当前账号；退出/换号先 unregister、清除已展示通知，再撤销服务端绑定，离线保留设备专用撤销凭据重试。已被 APNs 接收的在途系统消息无法由服务端撤回；只发送公开纪录，不在锁屏携带登录凭据或私有账号数据。

### 送达与点击

APNs 使用 HTTP/2 + ES256 provider JWT，仅在服务端读取 .p8；按签名环境分流 sandbox/production。临时失败沿用指数退避，永久错误停止该条重试，失效 token 清理设备与关联队列。accepted_at 只代表 APNs 接受请求，不代表手机展示。固定 collapse ID 合并同条重试，不承诺严格一次送达。

前台展示横幅、通知中心列表和声音；点击只接受公开比赛链接，沿用 Android 当前行为打开 canonical 网站比赛页（系统浏览器），支持冷启动暂存点击。**本轮不包含 App 内比赛深链。** 不需要用 silent push 或后台轮询取代系统远程 alert。

验收使用所有者单个测试账号/设备，分别核对 sandbox 开发包、production 发布包；允许/拒绝/撤销权限、token 变化、前台/后台/冷启动、点击、离线退出、换号、卸载重装、用户筛选和本人 PR。不能把本地 HTTP/2 测试或无签名 Simulator 编译当作真实 APNs 送达证据。
