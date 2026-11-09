# 纪录与比赛通知：邮件及 Android / iOS 推送配置

2026-11-08 更新。本地实现不等于生产已启用；最新验收状态见 [App 路线图](mobile-app-roadmap.md#2026-09-15-纪录订阅与通知未完成)。本轮没有购买套餐、注册开发者身份或向真实用户群发。

## 共用行为

网站和各 App 的「我的 → 消息」复用 `/notifications`：项目、单次/平均、纪录级别、选手所属地区共用同一份服务端偏好。绑定 WCA 的本人纪录（含 PR）自动纳入，不受这些筛选排除；邮件仍尊重已验证邮箱与邮件开关，手机仍尊重隐私同意和系统通知权限。比赛首次抓取只建立基线，已有成绩不补发。

手机队列从既有站内通知派生，不重复实现成绩判定或订阅匹配。Android 首次登录后，在客户端和服务端均配置的前提下显示 SDK 隐私同意，再请求系统通知权限。拒绝不影响其他功能；在系统设置重新开启后回到 App。退出/换号先关闭本机推送并撤销旧设备绑定，离线保留仅能撤销该设备的随机凭据，联网重试；不保存旧 JWT 供重试。

## 比赛系统通知与版本兼容

消息设置中的「同时发送手机系统通知」默认关闭，不改变既有只进消息箱的订阅。需新版 App 已登录、授予通知权限、完成设备绑定，并在服务端配置相应通道。公示按地区/项目订阅，报名开放/截止复用比赛关注与提前量。关闭开关、取消关注、账号切换后不再派发相应待处理消息；已被服务商接受的在途通知不能保证撤回。

迁移 0318 将现存设备标为版本 1，仅收纪录；新版注册时声明版本 2。能力版本发生变化会重设绑定时刻，不追发旧通知。后台每次尝试重新核对报名官方详情，回源失败则退避，取消/变更/过期终止旧提醒。有效期不晚于原触发点后 10 分钟；提前提醒不晚于里程碑，开报提醒不晚于报名截止。Getui TTL 与 APNs expiration 都按剩余有效期计算，重试不续期。服务商离线保留到期不等于移除设备上已经展示的通知。

Android 在线与厂商消息共用受限的显式 Activity intent，release/debug 各绑定自己的包名；iOS 使用四类 kind 与对应 thread/collapse ID。目的地仅公开比赛页，不能塞入登录回调、外部网址或私有页面；不通过通知 URL 携带登录票据，也不因点击自动标已读。协议依据：[个推公共参数](https://docs.getui.com/getui/server/rest_v2/common_args/)、[APNs 请求与过期头](https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns)。

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

部署迁移 `0238`、`0239`、`0255`、`0317`、`0318` 和兼容 API 后，准备真实联调时才设置 `RECORD_PUSH_ENABLED=1` 并重载 API。沿用现有发布工作流，迁移自动执行；本地配置不等于线上配置。关闭该开关会停止发送，但保留过期数据清理。

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

### 本地配置检查

复制 `core/apps/mobile/.env.android-push.example` 为同目录的 `.env.android-push.local`，只在本机填写客户端参数，该文件已忽略。也可通过当前 shell 注入变量。不会自动读取 API `.env`，已有 shell 变量（包括空值）优先于文件。文件只允许模板中的变量，填入服务端 `GETUI_APP_KEY` / `GETUI_MASTER_SECRET` 或其他未知项会被拒绝。

从 `core/` 执行（文件参数相对 Mobile 包目录）：

```sh
pnpm --filter @cuberoot/mobile android:push:check release --push-env-file .env.android-push.local
pnpm --filter @cuberoot/mobile android:push:check debug --push-env-file .env.android-push.local
pnpm --filter @cuberoot/mobile android:apk:debug --push-env-file .env.android-push.local
pnpm --filter @cuberoot/mobile android:apk:direct --push-env-file .env.android-push.local
```

检查与构建使用同一份配置加载逻辑；构建入口在 Gradle 前检查，厂商依赖和字段清单统一来自 `apps/mobile/android/push-vendors.json`。检查只输出包名、状态、变量名和缺项，不显示值，不联网验证凭据或发送通知。未提供 `--push-env-file` 时只检查当前环境；`configured` 只表示字段齐全。

- `ANDROID_PUSH_REQUIRED=false`（默认）：允许全部留空，报告 `disabled`，保留无推送的普通构建；厂商字段只填一半或缺基础 App ID 仍报错。
- `ANDROID_PUSH_REQUIRED=true`：缺少当前包的个推 App ID 即失败。未知布尔值也失败，避免拼错后跳过门禁。
- `ANDROID_PUSH_VENDORS=oppo,vivo,xiaomi,meizu,honor`：声明本次必须具备的厂商，可只列实际接入的项；缺任一必需项或厂商名拼错即失败。未声明的完整厂商组仍按既有 Gradle 逻辑加入；不要用清空名单来禁用已填写的组。
- Debug 只检查 `GETUI_DEBUG_*`，Release 只检查 `GETUI_*`，不回退借用另一包的参数。Gradle 会配置两种 variant，因此另一包残留的半组参数仍可能阻断构建；不用的组全部留空。

正式包继续要求现有发布签名；不能用 Debug 验证替代正式签名核对。不要使用 `VITE_*` 存储这些字段，不提交填过值的文件或把服务端凭据放到客户端环境。

### CI 注入位置与凭据清单

`app_release.yml` 仅在 **Build unsigned Android artifacts** 步骤注入下列仓库级 Actions secrets，覆盖 direct APK 与 Play AAB；不注入 Windows、Web 构建、签名或发布步骤。构建 job 不绑定 `app-release` environment，所以只放在该 environment 的同名 secret 不会被此步骤读取。签名环境与签名凭据的既有隔离保持不变。

| 用途 | 仓库级 Actions secrets（正式包） | 调试本地文件 |
| --- | --- | --- |
| 个推基础 | `GETUI_APP_ID` | `GETUI_DEBUG_APP_ID` |
| OPPO 客户端 SDK | `GETUI_OPPO_APP_KEY`、`GETUI_OPPO_APP_SECRET` | 对应 `GETUI_DEBUG_OPPO_*` |
| vivo 客户端 SDK | `GETUI_VIVO_APP_ID`、`GETUI_VIVO_APP_KEY` | 对应 `GETUI_DEBUG_VIVO_*` |
| 小米客户端 SDK | `GETUI_XIAOMI_APP_ID`、`GETUI_XIAOMI_APP_KEY` | 对应 `GETUI_DEBUG_XIAOMI_*` |
| 魅族客户端 SDK | `GETUI_MEIZU_APP_ID`、`GETUI_MEIZU_APP_KEY` | 对应 `GETUI_DEBUG_MEIZU_*` |
| 荣耀客户端 SDK | `GETUI_HONOR_APP_ID` | `GETUI_DEBUG_HONOR_APP_ID` |

仓库级 Actions **variables** 使用 `ANDROID_PUSH_REQUIRED`（建议推送正式接入后设 `true`）与 `ANDROID_PUSH_VENDORS`。默认缺少配置时日志明确报告各通道 disabled，不把普通构建成功记作推送就绪。这里只接入工作流定义，不自动创建或修改 GitHub secrets/variables。

API 服务端另需 `GETUI_APP_ID`、`GETUI_APP_KEY`、`GETUI_MASTER_SECRET`；调试应用使用对应 `GETUI_DEBUG_` 三项。后两项禁止放进上述客户端配置或 workflow。厂商服务端授权还需按各控制台配置到个推，本地检查不能证明控制台开通、包名/签名匹配或密钥有效。当前缺项与实际验证记录以[路线图](mobile-app-roadmap.md)为准。

### 真机验收（另行安排）

联调使用单个所有者测试账号与测试设备，不在个推控制台选择全量推送。需要分别实测：拒绝/允许/撤销权限、本人 PR 自动命中、订阅筛选、前台/后台/杀进程、断网重连、退出及切换账号、卸载重装、点击通知打开对应比赛。通知可见内容是公开纪录、比赛公示或报名时间，可能显示在锁屏；元数据包含消息 ID 与收件账号 UID 供本机防止换号误跳，不含登录凭据。新版点击在 App 内工具栏打开 canonical 比赛页；旧版仍只接收纪录并使用浏览器。

服务端每 30 秒扫描，单轮最多 30 条，单条最多 5 次指数退避；只派发绑定后且 1 小时内的通知；报名提醒另受下述更短截止时间约束。厂商接收不等于手机展示；超时重试可能重复送达，固定通知 ID 用于替换同条通知，不声称严格 exactly-once。设备 30 天不刷新、队列超过 7 天定期清理，删除账号/设备级联删除绑定或队列。

隐私政策和商店 SDK 清单已同步源码，包括个推附带的卓信 ID SDK。已关闭推送无关扩展与可选硬件标识采集，移除 SDK 默认带入的电话状态、任务列表、全量应用列表和后台定位权限，禁止明文流量；最终配置的长连接及厂商 HTTPS 通道仍须实测。正式发版仍须扫描最终合并 manifest 并验证同意前不采集；厂商 SDK 条件依赖会改变最终权限，基础 debug 构建不能代替这些验证。

## 5. iOS APNs

iOS 复用同一订阅、站内消息、设备控制器和投递队列，通过薄 Swift RecordPush 插件接 APNs，不引入 Android FCM。允许 wca_record、comp_announcement、comp_registration_open、comp_registration_close；后三类须主动开启比赛系统通知且设备上报 pushVersion=2。既有 comp_reg（指定选手报名动态）与 Bark/运维消息不进入本队列。

### Apple 与服务端配置

1. 在 Apple Developer 的 Identifiers 中核对实际 Bundle ID（当前 Xcode Debug/Release 都是 me.cuberoot.app），启用 Push Notifications。更新对应签名 profile；不要仅凭 Xcode 源码 capability 判断线上已开通。
2. 在 Apple Developer 的 Keys 创建或使用具有 APNs 权限且覆盖该 topic 的 key，记录 Key ID、Team ID。将 .p8 安全放到服务器仅运行用户可读的文件，不能放入 App、Git、聊天或日志。
3. 服务端设置 APNS_TEAM_ID、APNS_KEY_ID、APNS_PRIVATE_KEY_PATH。APNS_ENABLED=1 与既有 RECORD_PUSH_ENABLED=1 必须同时成立；默认关闭。修改线上环境与发布按仓库发布授权执行，不由文档自动授权。
4. 迁移 0255 扩展原设备表，旧 Android 行默认为 getui/production；APNs 的 provider、environment、app_id、client_id 联合隔离。上线由既有 Actions 先迁移再重载 API，不手工 ALTER。

### APNs 本地离线检查与凭据清单

APNs 私钥属于 API 服务端，不注入 Mobile、Vite 或 iOS 打包 CI。可复制 `core/apps/api/.env.apns.example` 为同目录被忽略的 `.env.apns.local`，在本机填写；也可显式检查现有 API `.env`。检查器只读取下列字段，不执行 shell 文件、不修改环境文件、不启动 API/队列、不连接 Apple、不生成 provider JWT 或发送通知。

| 变量 | 用途与待准备内容 |
| --- | --- |
| `RECORD_PUSH_ENABLED` | 共用发送开关，运行时必须为 `1`；准备阶段保持 `0` |
| `APNS_ENABLED` | APNs 通道开关，运行时必须为 `1`；准备阶段保持 `0` |
| `APNS_TEAM_ID` | 拥有该 APNs key 的 Apple Developer Team ID |
| `APNS_KEY_ID` | Apple Developer 中该 APNs key 的 Key ID |
| `APNS_PRIVATE_KEY_PATH` | 未加密 EC P-256 私钥文件路径；对应 `.p8` 必须确有 APNs 权限，不能把 ASC/IAP key 当作已授权的 APNs key |

从 `core/` 执行，配置文件参数相对 API 包目录：

```sh
pnpm --filter @cuberoot/server apns:check --push-env-file .env --environment sandbox
pnpm --filter @cuberoot/server apns:check --push-env-file .env.apns.local --environment production
pnpm --filter @cuberoot/server apns:check --push-env-file .env.apns.local --environment production --require-enabled
```

- 不传文件时只检查当前进程环境；不会自动加载 `.env`。已有环境变量（包括空值）优先于文件。读取完整 API `.env` 时只保留 APNs 的五个字段，其他字段不输出也不使用；未知 `APNS_*` 名称会报错，避免拼写错误被忽略。使用专用 `--push-env-file`，不要改成会被 Node/pnpm 提前处理的 `--env-file`。
- 全部未配置且 APNs 未开启时报告 disabled/missing，可退出成功。提供部分凭据、APNs 已开启却缺凭据、开关不是 `0/1`、不支持的 topic/环境或私钥不合格时失败。`--require-enabled` 额外要求两个开关都为 `1` 且凭据完整；该参数只检查，不设置开关。不要为通过检查直接开启生产全队列。
- 私钥检查包含当前检查进程可读取、普通文件且不超过 16 KiB、未加密 EC P-256，以及本地签名/验签。Unix 文件不得给予 group/other 权限，建议 `0600`；Windows 需另查 ACL。不打印 Team ID、Key ID、私钥路径、内容、签名或原始文件/加密库异常。相对私钥路径按 API 工作目录解析，建议使用绝对路径。
- 默认 topic 为 `me.cuberoot.app`，与当前 Xcode Debug/Release 相同。服务端保留对 `me.cuberoot.app.debug` 的兼容，但这不代表当前有该 Bundle ID 的 iOS 签名包。`--environment sandbox|production` 仅记录**期望环境**，不会从 `.p8` 推断环境、Team、Key ID、授权 topic、是否撤销或 Apple 控制台状态。
- 私钥本地有效、`Runtime configuration gate: configured` 和退出码 0 均不等于推送可用。最终仍须核对实际导出 App 的 entitlement / Info.plist / profile 环境一致、Apple key 授权及服务器运行用户可读；检查进程可读不证明生产进程可读。当前缺项与验证结果记录在[路线图](mobile-app-roadmap.md)，真机送达与点击另行验收。

### 构建与权限

Xcode 工程已有 App.entitlements、Push capability、设备 token 回调。APNS_ENVIRONMENT 在 Debug 默认 development、Release 默认 production，同一 build setting 写入 entitlement 和 Info.plist；设备上报分别为 sandbox/production。**实际导出/重签名 profile 的 aps-environment 必须匹配 Info.plist**，不能把开发包 token 发到生产 APNs。TestFlight/App Store 使用 Release production；自定义导出流程若改变环境，须同时修改构建设置并核对最终签名 entitlement。

在 core/ 执行 pnpm --filter @cuberoot/mobile ios:build 完成 Web build、sync 与无签名 Simulator 构建；真实设备使用既有 ios:open/ios:run 和所有者的 Apple Team。Windows 无法完成 Xcode 签名或 iPhone 送达验证。

登录且服务端配置完整后才申请系统通知权限。拒绝不影响登录；之后可在 iOS 设置 → 通知 → CubeRoot 修改权限，再回 App 刷新。内容筛选继续在「我的 → 消息」配置，只有一份账号偏好；本轮不新增独立的 iOS 订阅页面或 App 内设备开关。系统通知权限控制本机是否显示，服务端按账号订阅和设备绑定投递。

设备 token 每次注册更新后通过既有控制器绑定当前账号；退出/换号先 unregister、清除已展示通知，再撤销服务端绑定，离线保留设备专用撤销凭据重试。已被 APNs 接收的在途系统消息无法由服务端撤回；可见内容只含公开纪录和比赛信息，账号归属只作为路由元数据，不在锁屏展示或携带登录凭据。

### 送达与点击

APNs 使用 HTTP/2 + ES256 provider JWT，仅在服务端读取 .p8；按签名环境分流 sandbox/production。临时失败沿用指数退避，永久错误停止该条重试，失效 token 清理设备与关联队列。accepted_at 只代表 APNs 接受请求，不代表手机展示。固定 collapse ID 合并同条重试，不承诺严格一次送达。

前台展示横幅、通知中心列表和声音；新版点击经 Swift bridge 交给共享导航，只接受公开比赛路径。冷启动等待安全会话恢复，其他账号/已退出的点击忽略，重复回调去重；准备计时、观察或正在计时时延后跳转。 不需要用 silent push 或后台轮询取代系统远程 alert。

验收使用所有者单个测试账号/设备，分别核对 sandbox 开发包、production 发布包；允许/拒绝/撤销权限、token 变化、前台/后台/冷启动、点击、离线退出、换号、卸载重装、用户筛选和本人 PR。不能把本地 HTTP/2 测试或无签名 Simulator 编译当作真实 APNs 送达证据。

## 6. 隔离 API 与推送验收入口

使用专用验收入口，不能把普通 Mobile App、网站 dev 反代或 `dev:local` 当作推送隔离环境。普通 App 的生产登录/API 行为没有在本轮全局改址。

### 本地浏览器检查

从 `core/` 在两个终端分别启动：

```sh
pnpm --filter @cuberoot/server push:acceptance
pnpm --filter @cuberoot/mobile push:acceptance:dev
```

1. API 固定监听 `127.0.0.1:3339`；页面为 `http://127.0.0.1:4175/`，端口占用会失败，不自动改端口、启动代理或回退生产。
2. API 把随机配对令牌写入本机 `core/apps/api/.push-acceptance/session.json`（目录 `0700`，新文件 `0600`，已忽略）。把 `pairingToken` 填到页面密码框；不用真实账号 JWT。令牌不放 URL、日志或构建产物。已有同名文件时拒绝覆盖；异常退出遗留文件须确认旧 API 已停止后手动删除，再启动。
3. 选测试账号 A/B，点击“连接并绑定”。浏览器使用模拟的 native adapter，但复用正式 `RecordPushController`；服务端复用设备字段校验和通知 payload 契约。测试身份、设备凭据、CID/token 全部只在内存中，既不读取正常 App Keychain，也不接生产账号/数据库。
4. 选择四类通知之一并生成测试 payload，再模拟点击；可检查重复点击、勾选暂缓后恢复、切换测试账号后点击旧通知、退出撤销。点击复用共享 `NotificationOpenQueue`，只展示目标路径，不加载生产网站或跳外部浏览器。
5. API 一次只允许一台测试设备绑定；两名测试用户的 session 互相隔离，同用户重新配对替换旧 session。整轮一小时后失效，需要重启。页面刷新会丢失本机内存撤销凭据；要绑定新实例需重启 API，不能拿生产设备 secret 解锁。正常 Ctrl-C 会删除当前进程创建的配对文件。

这是 **fixture API**：没有 PG、业务扫描、邮件、Bark、APNs/个推发送器或测试群发入口；不会读取 API `.env`，即使 shell 带有生产 DB/推送变量也不启用相应组件。生成 payload 不代表服务商接受、消息入箱、订阅调度、真实送达或正式 Tools 页面落页通过；这些证据仍分开验收。

### 原生测试产物与发布隔离

```sh
pnpm --filter @cuberoot/mobile push:acceptance:build
```

产物只进 `dist-push-acceptance/`，带 `push-acceptance.json` 标记，普通 build/sync 仍用 `dist/`。专用 Vite 配置不加载生产 App、登录客户端、WebSurface 或静态资源集合；只开放指定验收 API 与本地开发 WS，禁止 iframe 和跨站请求。API 地址必须为显式 loopback/私网 IPv4 origin，不接受生产域名、DNS 别名、公网 IP、userinfo、路径或查询串；每次 fetch 禁止重定向、携带 cookie 和生产 fallback，并校验 fixture 响应标记。

后续有设备时，先提供手机可达且受系统信任的**私网 HTTPS**入口，只转发到本机 fixture API；本轮不自动配置证书、LAN 暴露或隧道。原生验收入口拒绝默认明文地址，不放宽正常 App 的 ATS/明文网络策略。通过 `PUSH_ACCEPTANCE_API_ORIGIN` 指定该 HTTPS origin 后重新生成验收产物；API 的 Origin allowlist 已包含 Capacitor 宿主 origin。

本机 macOS/Linux 的显式同步入口（本轮跳过原生验收，未执行验收资产同步或安装）：

```sh
CUBEROOT_PUSH_ACCEPTANCE=1 pnpm --filter @cuberoot/mobile exec cap sync android
# 或对应 iOS 宿主
CUBEROOT_PUSH_ACCEPTANCE=1 pnpm --filter @cuberoot/mobile exec cap sync ios
```

仅使用 Android Debug 包或 iOS development/sandbox 签名包。原生 start/status/stop 均检查测试宿主及 HTTPS 条件；插件注册本身仍可能联系 APNs/个推等系统或厂商服务，不能把“生产业务 API 隔离”说成“所有网络离线”。本轮 fixture API 始终不发送，真机推送传输和系统通知点击仍另行安排。iOS Debug/Release 当前同 Bundle ID，未来安装前仍须核对是否替换既有 App；本轮没有安装。

Android 构建 wrapper 和 Gradle Release 任务图拒绝验收标记；iOS 发布脚本及 App target 的 Release 构建阶段同样拒绝。验收结束后清除本次命令的环境开关，运行目标端原有 `cap:sync:android` / `cap:sync:ios` 恢复正常资产，再走既有发布流程；不能删除 marker 后发布验收代码。
