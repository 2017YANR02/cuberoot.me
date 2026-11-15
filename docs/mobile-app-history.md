# 五端 App 迭代与决策历史

状态：`HISTORICAL`。从路线图迁出，逐段保留原文、决策、提交及验收限制。旧命令、未发布和未验收描述只代表各记录时点；当前入口见[路线图](mobile-app-roadmap.md)。

### 2026-11-10：Duo 安全区与响应式计时布局

- iOS 薄宿主读取 UIKit 安全内容与竖栏区域；共享 React 的“计时 / 工具 / 我的”三个按钮移入系统允许的竖栏，保留可访问名称和 44px 点击区。弹窗、菜单和在线 iframe 同时避让，未创建第二套原生导航。
- 有原生安全几何的计时工作区按容器尺寸排布：短横屏将打乱与数字/预览分列，统计横向排列；安全内容至少 800×560 时可使用现有成绩/复盘右栏。求解器保留原来的 1024px 断点，避免同时挤入两个侧栏；Web 和其他宿主默认断点不变。
- 本机 Xcode 27.2 / iOS 27.2 Duo Simulator 构建及覆盖安装已完成。已观察合上竖屏三图标导航、设置避让，以及合上横屏的数字、魔方图和完整统计；此前四形态基线及旋转/折叠计时保持证据保存在本机 `.local-data/ios-duo-layout-2026-11-09/`。App 定向 44 项、菜单/布局编辑器定向 28 项及相关类型检查通过。
- 用户随后要求提交推送并暂不检查，停止追加验收。最后的展开布局修正、长打乱触摸滚动、半折/分屏、软键盘完整矩阵、缩放与旧 SDK 编译仍未完成视觉/设备验收；未做真实 BLE、签名或商店发布，不据此标记整体 parity 完成。

### 2026-11-08：推送隔离 API 与专用验收入口（本地实现，未发布）

API 第一批本地提交 `26be5a4ac3`；Mobile 入口、发布保护和说明作为第二批提交。使用方法见[隔离验收入口](record-notification-setup.md#6-隔离-api-与推送验收入口)。普通 App 的生产登录/API 地址没有全局改动，验收必须明确使用专用入口。

- 独立 Hono fixture API 固定监听 `127.0.0.1:3339`，不加载正常 server、`.env`、PG、监控、邮件或推送发送器。随机配对令牌通过被忽略的 owner-only 文件交接，拒绝覆盖遗留文件；测试身份只有 A/B 两个临时用户，整轮一小时失效，绑定上限一台设备，设备凭据和 CID/token 不输出、不持久化。复用现有设备字段校验和四类通知 payload 契约。
- 独立 Vite 入口 `127.0.0.1:4175` / `dist-push-acceptance` 不加载生产 App、登录客户端、Keychain 或 WebSurface。浏览器模拟 native adapter，设备绑定仍使用真实 `RecordPushController`，冷/热通知监听和点击队列复用原实现；目标路径只显示，不导航线上。API origin 限私网/loopback IPv4，fetch 禁 cookie、重定向和生产回退，并核对响应标记；CSP 限定连接目标、禁止 iframe。
- 原生验收仅允许 Android Debug / iOS sandbox 和可信私网 HTTPS，未放宽正式明文/ATS 策略，HTTPS 转发及设备网络仍待准备。本轮没有同步验收资产或安装；正常两端资产已恢复并扫描。原生 SDK 注册仍可能联系系统/厂商服务，不把生产业务 API 隔离说成完全离线。
- 验收产物有独立 marker，Android wrapper/Gradle Release 任务和 iOS 发布脚本/App target Release 阶段均拒绝它。Android 实际 Gradle `--dry-run` 用临时 marker 验证拒绝，iOS 从当前 project 提取的原样 shell 在隔离目录验证 Release 拒绝、Debug 允许；临时文件已清理。生命周期与点击监听统一使用一个 RecordPush 插件代理，消除重复注册警告；账号流程 source review 保持覆盖，正常用户授权/绑定语义未变。
- 验证：API 4 项隔离/鉴权/设备/过期检查，Mobile 12 项 origin/请求边界/既有生命周期与点击检查通过；API 脚本、app-ui、Mobile 类型检查通过，账号流程守卫 89 项通过。真实 Chrome 通过配对、绑定、四类 payload、重复/延后点击、换号隔离和注销，16 次 API 请求均留在两个本地 origin，零页面错误；390px 无横向溢出。最终插件代理调整后浏览器启动无重复注册警告、无自动 API 请求。
- 专用验收 Web 构建及正常 Mobile Web build、Android/iOS sync、Android Debug APK、无签名 iOS Simulator 构建通过。最终正常 dist/两端 native Web 资产扫描未含 fixture 入口/标记。测试进程已停止、配对文件已删除，既有 3000 服务未动。
- 本期是注册/契约/点击队列的 **fixture 验收环境**，不是已部署的完整测试后端；没有执行真实 PG 订阅调度、系统通知发送或正式 Tools 页面验收。真机、厂商/APNs 送达及点击继续按用户要求跳过。无生产变更、迁移、部署或 push，总体继续 **NOT COMPLETE**。

### 2026-11-08：iOS APNs 本地配置检查与凭据清单（本地实现，未发布）

实现与配置说明已本地提交 `c40dd383aa`。本轮只补 API 服务端的离线工具，未向 iOS 构建注入私钥；既有 APNs 配置门禁抽为同包纯函数，由运行时与检查器共用，保持发送行为不变。

- 新增 `pnpm --filter @cuberoot/server apns:check`，支持 `--push-env-file` 显式读取 API `.env` 或被忽略的 `.env.apns.local`；只选取 APNs 五项，环境变量优先，不执行配置文件或启动 API/worker。默认未配置可报告 disabled/missing；`--require-enabled` 要求双开关和完整凭据，半组配置、无效开关、未知 APNs 字段、topic/环境或不合格私钥均失败。
- 私钥检查限于当前本地进程：文件可读、大小受限、Unix owner-only 权限、未加密 EC P-256 和本地签名/验签。不打印 Team ID、Key ID、路径、内容或签名，不生成 provider JWT、不请求 APNs。`--environment` 只声明期望环境；key 的 Apple 授权、是否撤销、团队/topic/环境范围、部署进程读取权限均不能由此证明。
- 本轮实际检查本机 API `.env` 与当前环境：`RECORD_PUSH_ENABLED`、`APNS_ENABLED`、`APNS_TEAM_ID`、`APNS_KEY_ID`、`APNS_PRIVATE_KEY_PATH` 五项均缺失，未读取任何真实 APNs 私钥；production 的 `--require-enabled` 正确失败。需要准备 APNs 授权 key 的 Team ID、Key ID、受保护 `.p8` 文件路径，联调具备隔离条件后再启用两个开关。完整[变量与使用清单](record-notification-setup.md#apns-本地离线检查与凭据清单)已补齐；本轮未重查服务器或 Apple 控制台，不推断它们已配置。
- 源码签名环境核对：Xcode Debug/Release 仍同为 `me.cuberoot.app`，`APNS_ENVIRONMENT` 分别为 development/production，写入 entitlement 与 Info.plist；Swift 映射到 sandbox/production。未重新签名、导出或验最终产物，不能把源码一致写成签名环境验收。
- 验证：新增离线检查 6 项与既有 APNs 传输 4 项共 10 项通过（临时合成私钥与本地传输 fixture）；API typecheck、检查脚本独立类型检查通过。实际 pnpm 文件参数入口、必需配置失败退出、私有配置 ignore 和 diff 检查通过；独立审阅确认无凭据输出或运行时门禁漂移。
- 用户要求继续跳过真机。本轮无安装、真实推送、生产配置/数据库变更、部署或 push；未重跑无变化的原生构建。Apple 授权、最终签名产物、真实送达和点击仍待验收，总体继续 **NOT COMPLETE**。

### 2026-11-08：Android 推送 CI 注入与本地配置检查（本地实现，未发布）

实现与配置说明已本地提交 `e1916722f4`；本节记录该批验证与剩余配置，不代表已推送或发布。

- `app_release.yml` 的 Android 产物构建步骤已接入正式包个推 App ID 和 OPPO/vivo/小米/魅族/荣耀客户端参数，供 direct APK / Play AAB 使用；签名、发布凭据仍在各自受保护 job，服务端 App Key / Master Secret 不注入客户端构建。未修改 GitHub 配置或触发 workflow。
- 新增 `android:push:check debug|release` 与被忽略的本地配置文件入口 `--push-env-file`；与 Debug/direct/Play 构建共用加载和校验，Gradle 与检查器共用厂商清单。报告只显示名称、状态和缺项；未启用可构建，半组参数、缺基础 App ID、必需通道缺项、控制变量拼错或文件含服务端/未知字段会失败。`ANDROID_PUSH_REQUIRED` / `ANDROID_PUSH_VENDORS` 声明实际构建要求，不能用检查通过推断控制台有效或真机送达。
- 当前缺项：再次只读检查确认仓库级 `GETUI_*` secrets 与 `ANDROID_PUSH_*` variables 名称清单为空；本机没有 `.env.android-push.local`，当前进程的正式/调试客户端参数也均缺失。需要补两套匹配包名的 `APP_ID`，以及所需厂商的 OPPO `APP_KEY/APP_SECRET`、vivo/小米/魅族 `APP_ID/APP_KEY`、荣耀 `APP_ID`（正式前缀 `GETUI_`，调试前缀 `GETUI_DEBUG_`）。完整变量名、存放位置和命令见[配置清单](record-notification-setup.md#ci-注入位置与凭据清单)。API 的个推 App Key / Master Secret 与 APNs 凭据仍按上一节配置审计待补，本轮没有重新检查服务器或厂商控制台。
- 验证：6 项配置/凭据输出/工作流边界定向检查通过，Mobile typecheck 通过；实际 pnpm Debug/Release 检查入口通过，必需配置缺失在 Gradle 前失败；JDK 21 下通过新的 pnpm Debug 入口完成 Vite build、Capacitor sync、Android APK 构建。该 APK 没有真实推送参数。独立审阅发现并修复了 Node 测试被 Vitest 误收集、pnpm 提前处理 `--env-file` 两个入口问题；最终 Vitest 文件列表不收集 `.node-test.ts`，专用 `--push-env-file` 已实跑。
- 工作流定向检查通过；本机 actionlint 1.7.12 对既有 `concurrency.queue` 报不认识，仅在临时副本去掉该既有字段后其余校验通过，未改动原工作流的并发设置。未声称 GitHub CI 已执行。
- 用户要求继续跳过真机验收。本轮无安装、无真实推送、无 API 部署/迁移、无 push；代码和文档分批本地提交，其他人的工作区修改保留。真实厂商构建、签名匹配、送达和点击验收仍待完成，总体继续 **NOT COMPLETE**。

### 2026-11-08：APNs / 安卓厂商配置核对（只读审计，真机验收跳过）

检查基准：本地 `3672ec49b4`；核对源码、现有构建产物、本机签名描述文件、GitHub 配置名称及服务器配置。未修改凭据、生产配置或数据库，未发送测试通知。用户确认暂无设备，明确跳过本轮真机送达和点击验收。

| 项目 | 本轮证据 | 尚需完成 |
| --- | --- | --- |
| iOS 签名 | 本机匹配 `me.cuberoot.app` 的开发和分发描述文件分别带 `aps-environment=development/production`，有效期至 2027-09-29；工程 Debug/Release 环境与之对应 | 后续签名产物仍须核对 entitlement、描述文件和实际 APNs key 的团队/topic 授权；描述文件不是发送凭据或送达证据 |
| APNs 服务端 | 本地 API `.env`、服务器 `/root/core-api/.env` 与 API Node 进程初始环境均未配置 `RECORD_PUSH_ENABLED`、`APNS_ENABLED`、`APNS_TEAM_ID`、`APNS_KEY_ID`、`APNS_PRIVATE_KEY_PATH` | 配置明确授权 APNs 的 key 与对应环境；本次没有核验 Apple 控制台中的 key，不把本机 ASC/IAP key 当作 APNs key |
| 个推服务端与 Android 构建 | 上述环境均未配置个推 App ID / App Key / Master Secret；本地生成的 BuildConfig 与 Debug 合并 manifest 中 `GETUI_APPID` 为空 | 对齐 Debug/Release 应用、包名、签名与个推配置，重新构建后核验产物；基础 SDK 编译成功不代表个推已启用 |
| 安卓厂商通道 | 未发现 OPPO/vivo/小米/魅族/荣耀构建参数；Gradle 仅在相应参数完整时引入厂商依赖，当前 Debug 合并 manifest 未见对应厂商配置；现有列表没有华为 HMS 通道 | 各厂商控制台应用、证书指纹和通道开通状态未核验，不能从环境缺项推断控制台应用不存在；华为另需实现其接入 |
| CI 配置 | GitHub 仓库及 `app-release` / `app-release-publish` 环境的 secret/variable 名称清单未见推送参数；`.github/workflows` 和 `core/scripts` 未见 APNs/Getui 参数注入，Android 构建步骤只有发布渠道参数 | 补齐 Android 构建阶段的配置注入；仅添加 secret 而不接入工作流不会使 APK 包含厂商配置。服务端 Master Secret / APNs 私钥不打入客户端 |
| API 配套版本 | 服务器有 `0255_ios_record_push.sql`，未见本轮 `0317_competition_notifications.sql` / `0318_competition_push.sql` 文件；这里只核验文件，未查询生产 schema。Mobile API 仍固定指向线上，新客户端注册必带 `pushVersion: 2`，旧 API 严格拒绝该字段 | 保持新版 API 与 App 配套；本地全链路验收先具备隔离 API 目标，不因本地客户端安装而隐式部署生产。线上实际代码版本尚未核验 |

- 后续顺序：补齐服务商及厂商配置 → 完善构建注入并核验签名产物 → 准备隔离 API/测试账号 → 设备可用后验证前台、后台、进程结束后的送达与冷启动点击，以及登出/换号、重复、过期场景。禁止为单设备验收开启生产全队列扫描。
- 新通知的点击链路校验收件 UID；兼容的历史纪录通知可能缺少 UID，不能宣称所有历史通知都做了账号归属校验。服务商接受、设备展示、点击落页和业务触发分别记录。
- 本轮只补充配置审计记录，没有重跑已通过的构建或将设备项标为完成；无安装、无真实推送、无生产变更、无 push。真机验收仍待后续安排，总体继续 **NOT COMPLETE**。

### 2026-11-08：Android / iOS 比赛系统通知与 App 内点击（本地实现，未发布）

- 复用既有通知投递队列与设备生命周期，增加四种允许类型：纪录、公示、报名开放、报名截止；旧设备默认 `push_version=1` 仍只接收纪录，兼容原浏览器点击。新版上报版本 2，升级/降级能力会更新绑定时间，避免追发旧消息。
- 比赛设置新增「同时发送手机系统通知」，默认关闭；旧 JSON 缺少该字段同样视为关闭，已有消息箱订阅不会被静默升级。发送前再次核对开关、关注、账号与设备归属；合并旧账号排除，注销沿用外键级联清理。
- 纪录/公示最多使用消息生成后一小时的剩余有效期；报名提醒每次尝试均重新读取官方时间，取消、时间变更、过期或退订停止投递，回源失败按队列退避。报名有效期不晚于原触发点后 10 分钟，提前提醒不晚于报名里程碑，开放提醒不晚于报名截止。Getui TTL 与 APNs expiration 使用剩余时间，重试不续期。
- API/共享契约第一批 `2557a3802e`：迁移 `0318_competition_push.sql` 已在本地 PG13 隔离 schema 执行；API 投递/权限/版本/筛选和两家服务商隔离传输测试通过。新开关复用 canonical 消息设置与双语保存/回滚；/dev/schema、/dev/api、账号流程文档同步。
- 第二批复用 Mobile 薄宿主和共享 Tools surface：Android 在线/厂商消息改为指定包名与 MainActivity 的 intent，iOS 接收四类通知并保留冷启动点击，取消打开系统浏览器。共享 decoder 只允许公开比赛路径，恢复账号后核对收件 UID，去重 listener/pending 回调；准备、观察、计时或对战中暂存跳转，不自动标已读。宿主只传通知目的地，不向 iframe 传长期凭据。
- Android SDK 隐私同意文案扩展为纪录和主动开启的比赛提醒；沿用既有权限、设备绑定、换号撤销及离线重试。默认不开启比赛系统通知；APNs/个推服务端凭据、厂商配置未更改，基础构建未启用真实个推配置。其他宿主无通知 adapter，本期未扩展。
- 本地证据：shared build；API、client、app-ui、Mobile 类型检查；API 5 文件 26 项（真实 PG13 隔离 migration/队列，模拟 Getui 与本地 HTTP/2 APNs）；Mobile 生命周期/冷启动桥 10 项；共享导航队列 3 项及真实 App 组件 1 项定向集成。消息设置中英文 Chrome fixture 验证系统推送开关保存、重新读取和失败回滚，390/1280px 无横向溢出。消息源、传输、组件均为隔离 fixture，不代表真实设备送达。
- Mobile Vite build + Android/iOS Capacitor sync 完成；Android Debug APK 与无签名 iOS Simulator 完整构建通过。修正既有 iOS 构建脚本的全局 `-sdk` 参数：原先使内嵌 Watch 目标在 iPhone 目录查找 `WatchJS.o`；由 destination 为各 target 选择 SDK 后，仓库 `ios:build` 入口验证通过。未安装到真机、未做 APNs/厂商前后台与杀进程矩阵，不把无签名构建写成签名或发布证据。
- 本期保留 WCA 比赛范围、既有邮件与 Bark 通道；不 push、不生产迁移、不部署，不群发测试消息。真实 APNs/厂商后台与杀进程送达尚未验收，总体继续 **NOT COMPLETE**。

### 2026-11-08：纪录、公示订阅和报名提醒接入消息箱（本地实现，未发布）

- 第一批后端提交 `af887e9bbc`：保留现有纪录判定、本人 PR 自动纳入、首次快照静默基线与订阅筛选；新增每分钟独立重试，不再只依赖比赛预热成功。纪录待处理超过 24 小时终止补发并保留去重键；合并后的旧账号不再生成通知。既有纪录邮件/系统推送行为没有在此扩展。
- WCA 新比赛公示复用 `announced_comps.ts` 的全球分页快照（含中国大陆 WCA 比赛），每 20 分钟刷新、覆盖最近 48 小时；新偏好按举办地区和项目筛选。公示事件与 Bark 分开持久化，取消/缺席当前有效快照的事件不从旧 payload 直接补发，分页窗口不完整时保留旧快照且不投递；晚于公示才开启或修改的订阅不追发该事件。本期不包含粗饼民间赛外链。
- 关注比赛的报名提醒复用 `comp_follows`，开放与截止各可选择关闭、准点、提前 10 分钟、1 小时或 1 天。扫描每分钟执行，每轮最多复核 30 场，按上次复核时间公平调度；平时 5 分钟复核一次，接近触发点提前安排下一次检查。每次投递前直接核对 WCA 官方详情，不把每日目录当实时依据；取消、日期缺失、回源失败、已取消关注或关闭提醒均不投递。失败一分钟后重试，补发宽限 10 分钟；提前提醒不会在对应里程碑过后迟发。绝对 UTC 时刻参与计算、展示明确标明 UTC，不承诺秒级送达。
- 新公示和报名开关默认关闭，开启前的历史不补发；只写站内消息箱（`email: false`），不因现有邮件总开关开启就自动发邮件，也不扩展原生推送队列。`comp_reg` 仍保留原“指定选手国外报名通知管理员”的语义。
- 第二批界面复用 canonical `/notifications`、`WcaEventMultiSelector`、`RegionPicker` 和现有设置弹窗；纪录与比赛设置共用保存串行化、失败回滚和卸载隔离逻辑。新增公示/开报/截止消息标签；只将本次显示的消息 ID 标为已读，空/非法 ID 列表不再误清全部未读；换号重新挂载消息与设置状态。
- 迁移 `0317_competition_notifications.sql`、schema 快照、`/dev/schema`、`/dev/api` 和账号注销文档已同步。偏好通过 `app_users` 外键级联删除，所有设置读写以当前会话定归属；事件及调度台账不保存私人收件人清单。
- 本地验证：shared build、API/client typecheck；API 的订阅规则、真实 PG13 隔离 schema、收件箱读取/已读、纪录重试及去重 5 个测试文件共 36 项通过，迁移实际执行；WCA 公共详情字段做了只读核对。Chrome 隔离 API fixture 验证四类消息、保存/回滚、设置持久读取，中英文和 390/1280px 无横向溢出、无页面异常；未使用真实账号发送消息。schema/API 账本、注销及账号流程检查通过；账号文档指纹另按第一批实际暂存源码（322 文件）验证，未将其他任务尚未提交的 i18n HMR 修改夹带进本次提交或指纹。
- 本轮只本地分批提交，不 push、不部署，不在生产应用迁移，也未安装或发布原生包。手机系统推送扩展、App 内点击、鸿蒙/桌面/小程序通知通道及各端真机送达仍待后续阶段，总体继续 **NOT COMPLETE**。

### 2026-11-07：比赛公示与报名通知接入审计（源码审计，待分期实现）

检查基准：`8a4fd45a28` 的当前 checkout。范围为比赛公示/公布、用户关注比赛后的报名提醒，以及 Web、五个安装端和微信/抖音小程序。保留工作区已有的公式样式、比赛详情和战队显示修改。本轮仅补充审计与实施顺序，没有修改通知行为、运行通知任务、发送消息或核验生产配置/已安装包；历史构建记录不代表当前设备送达。

**业务链路与断点**

| 业务 | 当前源码事实 | 缺口 |
| --- | --- | --- |
| 新比赛公示 | API `monitors/wca_comp.ts`（非 CN，5 分钟）和 `monitors/cubing_comp.ts`（CN，60 秒）只调用 `sendBark`；`monitors/bark.ts` 使用服务端单设备配置 | 没有用户级公示订阅、收件人匹配及站内通知；Bark 不等于 CubeRoot App 推送 |
| 公示列表 | `routes/announced_comps.ts` 独立抓取并返回页面快照，不受监控启用开关控制 | 页面能看到新比赛不能证明用户已收到通知 |
| 关注比赛的报名提醒 | `routes/comp_follows.ts` 保存关注；Web `components/CompFollow.tsx`、`RegistrationComps.tsx` 复用关注并置顶，展示开报/截止时间 | 没有读取关注表的报名提醒扫描任务；“盯一下”目前不产生开报/截止通知 |
| 已有 `comp_reg` | `monitors/watched_foreign_reg.ts` 固定监控两位选手的国外报名，向管理员发站内消息/邮件及 Bark | 是选手报名动态，不是普通用户开报提醒；应保留原语义，不能直接挪用 |
| 通知收件箱 | `utils/notify.ts` 写 `notifications`，支持 `dedupeKey`，邮件按验证邮箱及总开关旁路发送 | 邮件失败没有独立补发队列；公示/报名提醒尚未成为事件生产者 |
| 手机系统推送 | `utils/record_push.ts` 从站内消息建立设备投递队列，严格筛选 `wca_record` | 新增比赛站内消息不会自动触发手机推送；APNs payload 和 Swift 接收也限制纪录类型 |

上表 API 路径相对 `core/apps/api/src`，Web 路径相对 `core/packages/client`。既有纪录配置见 [record-notification-setup.md](record-notification-setup.md)。

**各端接入层级**

| 端 | 当前可复用实现 | 尚未接通/验证 |
| --- | --- | --- |
| Web | canonical `/notifications` 收件箱、未读、邮件开关及纪录订阅 | 无公示/报名偏好；未发现 Web Push 注册及投递实现 |
| Android | Mobile `native/record-push-controller.ts`、个推插件、隐私同意、权限、账号设备绑定/撤销 | 比赛事件、服务商/厂商实际配置与真机送达；当前通知点击打开网站 |
| iOS | 与 Android 共用控制器；`RecordPushPlugin.swift`、API APNs 通道、冷启动点击暂存 | 比赛事件、真实签名环境及 APNs 送达；当前通知点击打开系统浏览器 |
| HarmonyOS NEXT | 共享 App UI 的网站 Account/消息入口 | 无系统消息通知 adapter，不能用 Android 兼容包或 BLE notification 代替 |
| Windows / macOS | 同一 Tauri 宿主、共享 Account/消息入口 | 无系统消息通知 adapter；两种桌面系统须分别验证 |
| 微信 / 抖音小程序 | 原生账号与网站入口；后端账号体系可复用 | 当前 `src` 未发现订阅消息申请/投递契约，`app.json` 无原生消息页；网站入口不等于订阅消息。API `platform/wechat_notification.ts` 是支付验签，不能计入消息推送 |

安装端源码入口：`core/apps/mobile/src/hooks/use-mobile-auth.ts`、`core/apps/mobile/src/native/record-push-controller.ts`、`core/apps/mobile/android/`、`core/apps/mobile/ios/`；共享产品入口为 `core/packages/app-ui/src/App.tsx` 与 `core/packages/app-ui/src/platform.ts`。Web 消息设置目前只有邮件总开关和 `RecordPreferences`，没有本机通知权限/绑定状态展示。既有安全存储、串行绑定、退出/换号撤销和离线撤销重试应继续复用，不复制成每端一套业务逻辑。

**按依赖分期，以下均为待实现项**

1. [ ] **先闭合用户事件与站内消息。** 区分公示、开报、截止与既有选手报名动态；公示按用户选择的地区/项目订阅，报名提醒复用比赛关注并明确提醒开关/提前量。设置复用 canonical 消息页，不把已有关注静默升级为邮件或系统推送订阅。共用 API/客户端事件契约，不新增通知业务 package。
2. [ ] **补可靠的生产与调度。** 复用既有比赛源，持久化事件和去重，处理时区、报名时间变更、取消比赛、退订、重启和有限补发；临近提醒前核对数据新鲜度，不能把 `upcoming_comps_cache.ts` 的 1 小时缓存当作实时确认。公示用户通知与 Bark 各自记账：Bark 禁用时返回成功并吸收历史的状态不能代表用户通知已生成；WCA 当前只取最新 10 场，还需覆盖停机后分页追赶。
3. [ ] **扩展 Android / iOS 同一条投递链。** 同步扩展队列允许类型、APNs 内容/分组、Swift 展示/点击、Android 通知文案和受控目的地；保留旧版本兼容及账号隔离。过期的开报提醒不能沿用纪录的一小时有效期无条件迟发。原生开关/权限/绑定失败应能在统一设置入口查看，点击通过既有共享导航打开 App 内对应比赛。
4. [ ] **验收手机通道，再补其余宿主。** 单个测试账号分别验证 Android/iOS 允许/拒绝/撤权、前台/后台/杀进程、冷启动点击、断网恢复、换号、重复与过期。之后为 HarmonyOS NEXT、同一 Tauri 的 Windows/macOS、小程序分别增加必要 adapter；第二个真实宿主消费者落地时再提取中性生命周期，禁止复制 Mobile 私有代码。小程序模板/用户授权/平台资质按实际控制台与当时官方规则核对。
5. [ ] **记录运行证据。** 分别记录事件生成、入箱、排队、服务商接受、设备展示和点击结果；服务商接受不能标为用户已读或设备送达。邮件可靠重试、Web Push、Apple Watch 通知体验另行补齐，不能由站内消息或 iOS 通道存在推断完成。

优先交付第 1–2 项的单一业务闭环，再进入第 3–4 项。公开比赛页以外的目的地必须单独定义：现有 `record_push_link.ts` 只允许自有比赛链接，粗饼民间赛的外站回退不可直接塞入现有推送器。完成标准是订阅→事件→站内消息→各端投递→点击/已读的实际证据；总体继续 **NOT COMPLETE**。

### 2026-11-15：备案、主体迁移与 Google Play 交易者声明

本节同步本轮 11 月 14 日确认及操作结果，不表示 11 月 15 日已重新核验审核状态。

- 维护者确认公安备案主体变更、微信小程序主体变更均审核通过；微信后续备案仍须单独核对。iOS 管局审核预计剩余 11 个工作日，暂排 11 月 30 日；安卓继续等待 iOS 完成后新增接入。抖音备案审核预计还需十几天，具体阶段待核，暂排日期不是承诺。
- Google Play 新公司身份资料已验证通过，并已关联上海魔方根科技有限公司；控制台显示“组织详细信息已更新”，新公司名称已成为当前开发者主体。
- 维护者已完成账号级交易者承诺并保存，浏览器确认状态为“交易者”。CubeRoot 应用级选择“是，我的交易者身份适用于此应用”，已保存并提交唯一一项交易者声明更改；未找到现有独立服务条款页面，可选网址留空，未以隐私政策代替。
- 最后观察到发布概览为“正在审核中的更改”，自动快速检查仍在进行。尚无审核通过或正式生效证据；Google 提示通常 7 天内审核，也可能更久，排期的 11 月 21 日仅为暂估。本轮未提交新安装包或其他发布改动。
- 送审前提示账号删除页面 DNS 无法解析。实际核对既有 https://static.cuberoot.me/tools/play/account-deletion.html 返回 HTTP 200，Google 与 Cloudflare 公共 DNS 均解析成功，页面含中英注销步骤及数据处理说明；据此在控制台标记该问题当前已解决并继续提交。未改 DNS、页面或数据安全网址，也不将这次可访问检查视为全球持续可用保证。
- 商家资料仍为旧工作室的组织资料，现有收款银行户名及 W-8BEN 为个人；按维护者要求本轮不迁移、不改银行或税务资料。旧商家地址变更验证失败仍待处理，与新公司开发者主体及交易者声明分开跟踪。
- Workspace 排期通过接口更新到版本 9、46 项并回读确认：账号级声明标记完成，应用级声明保留待审核。完整跨平台状态见[备案与主体迁移进度](../core/docs/MINIPROGRAM.md#备案与主体迁移进度2026-11-15)。

### 2026-11-07：APP 备案进度

- 维护者确认网站 ICP 备案已完成；iOS APP 备案已提交，当前在管局审核。
- Android 证书及特征信息已准备，待 iOS 备案完成后再新增接入 APP 备案；尚未提交安卓新增接入，也不代表已取得商店上架资格。
- 工作台备案排期已同步，iOS 通过目标与安卓新增接入分开记录；后续目标日期待审核结果确认。跨平台状态及本次排期更新见[备案与主体迁移进度](../core/docs/MINIPROGRAM.md#备案与主体迁移进度2026-11-15)。

### 2026-10-31：自动复盘关闭手势与全屏顺序（本地，真机待验）

- Web 的 `AutoRecapDismissGesture` 移入 shared，原入口转发；App 自动打开的窄屏全屏详情在入场结束后识别同一面的相邻正反四分之一转，请求共享详情退出动画。手动历史详情不订阅手势，退出动画期间保持计时输入阻塞；跨宽屏断点后返回仍可关闭。
- 共享全屏详情在窄屏按步骤列表→魔方动画排列，桌面复盘侧栏使用相同顺序；桌面全屏详情保留左右两栏。
- App 真实组件/模拟蓝牙集成覆盖自动关闭、继续第二局、手动详情不误关及宽窄切换；Web 手势与复盘回归、提交钩子的四条真值及相关回归通过。浏览器 CSS 布局验证覆盖 390/768px 全屏、1200px 全屏及侧栏；shared build、类型检查、Mobile build/sync 和 Android Debug 本机构建已执行。无本轮 GAN 16 UI + Android 真机证据，未推送或发布。

### 2026-10-31：移动计时页布局对齐（本地，真机待验）

- 顶栏窄屏布局和排名 footer 使用显式状态属性，消除对 WebView 103 不支持的 `:has()` 的依赖；Web 私有的难度按钮透明样式移入共享 TimerChrome。排名 footer 修正窄屏两列覆盖三列的优先级。
- App 真题配置空容器取消垂直 padding，实际页面空行高度从 17px 降到 0；排名容器按可见阶段及启用范围挂载，与 Web 保持一致。
- timer-ui/app-ui/client 类型检查、App `mobile-viewport.test.ts`（7 项）、Mobile build 与 Capacitor Android sync 通过。隔离 Chrome 页面在 320/360/390/412/768px、单条成绩下检查无横向溢出，统计区底边距 App 导航上沿为 10px；删除 `:has()` 规则后的兼容性模拟同样通过，不等同于 WebView 103 实测。排名 fixture 验证 ≤480px 两列、宽屏三列及 fullscreen 隐藏。
- Android Debug 本机构建通过；ADB 无连接设备，OPPO 真机布局及 iOS/HarmonyOS/桌面完整验收仍待完成。按功能分批本地提交，未推送、未发布，不改变总体 NOT COMPLETE 状态。

### 2026-10-16：Watch 多型号智能魔方接入（本地，新增型号实物待验）

- Watch 已接 GAN v1/v2/v3/v4、MoYu32、QiYi；服务识别、MAC 输入缓存、按服务/特征路由通知及真实协议成绩标签已落地，直接连接魔方，无需 iPhone 中转。
- v1 共享 csTimer 协议适配，其他协议复用现有安装端驱动；v4 保留原恢复驱动。超历史窗口或状态无法对齐时中断计时，避免保存不完整录像。
- 定向回归、app-ui/mobile 类型检查、watchOS 签名构建与原生 QuickJS smoke 通过。新增型号真机 BLE、自动计时、断线与功耗未验；已有 GAN 16 UI 记录不外推到其他款。详细边界见 [手表文档](./apple-watch-timer.md#多协议直连2026-10-16)。


- 已本地提交 `2283eb9db2`，未推送；签名新包经 devicectl 重试后覆盖安装到 Series 8。安装前已取回 16 笔成绩完整备份。用户解锁后远程启动成功，并读回应用容器：原 16 笔成绩逐字段完全保留，当前共 17 笔，当前打乱存在且缓存队列为 3 条；BLE 引擎诊断为空闲、无错误，尚未连接实体魔方，因此各型号实拧验收仍待完成。

### 2026-10-16：Watch 本地三阶标准打乱（本地，已覆盖安装）

- 复用锁定版本 cubing.js 的原随机状态三阶生成器与 min2phase，构建时仅适配 Worker 传输；手表系统随机源、独立串行 QuickJS（32 MiB、30 秒单次 CPU 上限）常驻复用表，不改变 BLE/计时预算。空闲时自动补三条待用题，沿用最近手机分组/观察设置，首次无手机配置默认三阶手表分组。
- 本地题使用已有 shared tracker 和 WatchCubeScene 显示紧凑状态预览；队列与模板原子保存，新手机配置拒收在途旧生成结果，当前题不替换。其他项目仍需手机补充；1,000 笔未同步上限保持，失败可显式重试。
- Mobile 类型检查通过；新生成器回归连续生成 12 条通过；既有 Swift 契约/成绩导入 8 项通过。实际 C QuickJS 宿主连续生成三条通过，Mac 进程峰值约 12 MiB（不代表手表耗时或内存）。独立审阅修正构建输出依赖声明后，Watch 签名构建及深层签名校验通过。
- 已备份原始手表状态并覆盖安装到 Series 8；远程启动被系统 `Locked` 拒绝，已请求解锁以继续真机生成、续题和重启恢复核对。未提交、推送或商店发布。
- 用户解锁并打开后直接读回真机状态：从空题/空队列变为本地当前题＋三条本地缓存，期间新增四笔本地打乱的手动计时记录；原十笔成绩逐字段保持不变。诊断 `generating=false`、`failed=false`、`localCurrent=true`、`queued=3`，证明手机缺席时生成与消耗后续题成功。Watch 模拟器构建亦通过；本轮未完成真实 GAN 自动起停、长时功耗或真机重启恢复验收，不以手动短记录代替这些证据。

### 2026-10-16：UU 远程接入（Android 用户验收通过，iOS 真机待验）

- Android 真机用户反馈 UU 版本达标但点击绑定提示“未检测到”；该文案来自发起 Intent 前的 `canOpenUrl` 拦截，并不是启动失败结果。核对已发 APK 的 queries 与官方 Android 安装包的 `uuremote://external` 声明均存在。按 Android 官方 package-visibility use-cases 指引，Android 改为直接尝试 `ACTION_VIEW`、以 AppLauncher 的实际启动结果处理失败；iOS 保留 canOpenURL。此修复消除查询假阴性阻止启动的路径，未连接用户手机，不能声称已确认该机系统返回 false 的具体原因或真实跳转已通过。11 项定向检查、Mobile typecheck 与 Web build/sync 通过；新 APK 的真机重试单独验收。

- 修正版 Android Debug APK 构建及签名校验通过；用户安装测试后明确确认“验收完成”。据此记录本次 Android UU 远程接入验收通过，不推断未逐项反馈的异常场景或 iOS 真机已通过。

- 用户授权接入 CubeRoot App。共享「我的 → UU 远程」折叠入口支持绑定、更换电脑、全屏远控、PiP 小窗、停止等待和移除本机绑定；中英文及不支持平台提示共用一份 React UI。Android/iOS 宿主注入官方 `@capacitor/app-launcher@8.0.1`、现有 App 深链及 Keychain/Keystore，不新增账号、屏幕采集或远控 SDK。
- 设备标识与待处理请求一起保存在本机安全存储；绑定 nonce、小窗 callback request、严格回调地址/重复参数检查、串行处理、30 分钟过期及消费后去重覆盖热/冷启动。全屏只记已唤起，PiP 仅最终成功回调记成功；设备失效清除绑定，未知错误不冒充成功。有效回跳显示「我的」结果，活动计时仍受原导航保护。
- `pnpm --filter @cuberoot/app-ui typecheck`、Mobile typecheck、`vitest run src/uu-remote.test.ts src/uu-remote-panel.test.tsx`（10 项）、Mobile Vite build、Android/iOS `cap sync`、plist lint 和差异空白检查通过。Android 使用本机 OpenJDK 21 执行 `./gradlew :app:assembleDebug --max-workers=2` 成功；Debug 包仍用 `.debug` ID，回调 scheme 按实际 App ID 创建。
- iOS 原 `ios:build` helper 的通用模拟器命令因 WatchJS.o 路径失败；保持源工程不变，使用新的 derived-data 目录并让 destination 决定 SDK：`xcrun xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/cuberoot-uu-ios-derived-data CODE_SIGNING_ALLOWED=NO build`，包含 Watch 的联合模拟器构建成功。未更改签名或实际安装。
- 真机授权/绑定、Windows/macOS 真实连接、PiP 显示、离线设备/账号切换和系统版本差异仍待用户验收；本轮未安装手机、提交、推送或商店发布。官方协议仅支持 Android/iOS 调用（UU 4.42.0+），iOS PiP 需 iOS 18+；不据此标记其他三端或五端整体完成。维护说明见 `core/apps/mobile/README.md` 的 UU Remote 小节。

### 2026-10-15：Watch 复盘完整对照（验收未通过）

- 用户确认最终出现分段，但等待太久，且方法入口与整个报告未与现有平台一致。直接读取手表确认分析完成；不能据此称为完整复盘验收通过。
- 对同一把 13.983 秒/73 动作做 Web 实际界面与源码对照，并独立复核。确认摘要口径、默认回放轨迹、点击谱子、最终文字投影、分步表、缓存、案例数据及其他报告内容仍有差异。Web 实际输出 `OLL(CP)-285`，Watch 仅 `OLL(CP)`，验证离线公式集遗漏会影响真实结果。
- 当前其他平台默认 CFOP、记忆可选 Roux/ZZ，自动识别阶段与 ZBLS/ZBLL 案例；未发现跨完整方法自动分类。Watch 不应把方法选择变成主流程，也不能另造猜测算法冒充复用。完整证据、差异与修正验收顺序见 [Watch 复盘对照](apple-watch-replay-parity-audit.md)。本轮审计未改产品代码或重新安装，整体继续 NOT COMPLETE。

### 2026-10-15：Watch 分段谱子复用（本地已安装，界面验收待确认）

- 用户指出复盘仍展示一串原始动作。此前 Watch 只调用分步统计；现从同一个 `ReconstructReport` 提取 `prepareReconstruction`，Web/iOS 报告与 Watch 共用姿态归一化、原始物理流、阶段、F2L 槽与核心轨迹，再直接调用 `buildReconText`、`correctReconFromLibrary` 和 `simplifyF2lRotations`。Swift 只显示共享输出的分段谱子、标签、用时，点击分段按 `fromIdx` 跳到原始回放；不改写录制。
- 方法选项来自 shared `METHOD_ORDER/METHODS`（CFOP、Roux、ZZ）；ZBLS/ZBLL 沿用 CFOP 的现有识别标签，并非另造 ZB 检测器。构建时从同一公开 AlgFile API 生成 OLL/PLL/ZBLL 离线快照，留在 DerivedData 并打包，非手写公式/编号副本；其他公式集的精确库校正未随该快照提供，不能声明整个在线公式库已离线化。
- 复盘分析独立为延后加载的 `WatchReplay.js`，计时 BLE 引擎不加载它。宿主提供按后续 tick 执行的 timer；scene 引擎 32 MiB、每次最多 64 个 Promise jobs 后续继续，计时仍为独立 16 MiB、1024 jobs 必须清空。方法切换保持一个在途任务及最新待选方法，缓存命中仍继续推进在途任务。
- 真实 QuickJS 验证：ES2020 的私有字段转译版本在 64 MiB 仍失败；复盘包使用 QuickJS 支持的 ES2022 原生私有字段后，32 MiB 限额下同一真实 73 步记录的 CFOP/Roux/ZZ 均生成成功，本机进程峰值约 31 MB。另用同库 ZBLL U 1 完整阶段样本确认输出 `ZBLL-UR3`，不是泛 OLL 标签。这不替代手表上的性能验收。
- shared build、client/app-ui/mobile 类型检查、86 项共享谱子/方法/公式校正/加载回归及 2 项原有回放检查通过，独立源码复核无新增阻断。Watch 签名构建、签名校验、安装及启动成功，前后持久化状态完全一致（3 笔待同步记录，最近一把 73 步）。已请用户在手表打开现有复盘确认分段、点击跳转及方法切换，无需再做一把。
- 首次界面验收用户报告停在「分析中」。真机日志证实 `replayVisible=true/visible=true/awake=false` 时分析不再推进；把调度生命周期改为完整复盘页后仍被 Always On 刷新频率拖慢。现由同一 serial worker 以约 16 ms 软预算推进 QuickJS timer/jobs，片间让回主线程，不再等画面刷新；非活跃前台只暂停播放，背景/关闭报告停止续跑。仍保留单次 2 秒 CPU 保护，未启用假运动/后台保活。
- 同一真实记录、同一 JS 包在 Mac 原生 QuickJS 对照中，未优化 C 耗时 14.82 秒，`-O2` 为 2.93 秒；WatchJS Debug 因此也开启 C 优化，Swift 宿主仍可调试。沿用现有 `analysis.worker` 先发布原始分段、再补库校正的顺序，不复制分析器。本轮 app-ui/mobile 类型检查、2 项既有三维/回放检查、签名构建与校验、安装及启动通过，独立复核无新增阻断。更新后完整持久化状态与更新前一致。Mac 对照不是手表性能验收，需继续读取点亮手表后的完成结果。

### 2026-10-15：Watch 补收积压与完成后误起表（本轮真机起停通过，后台/同步待验）

- Mac 直接取回两次实体记录：第一把 76 步、19.062 秒，末手与成绩一致，但 66 步集中迟到；第二把 80 步同批补回。起表时间被原 machine 的 2 秒上限裁到 264127 ms，末手 261539 ms 早于该起点，停表被拒绝；不能以首把时间范围已一致宣称实时计时通过。
- 同一日志有 66 个历史回复，其中 65 个未输出动作；队首缺口仅约 8 步却请求 82 步，空历史回复又触发状态查询，形成重复请求。修复 shared `GanMoveSync` 的首缺口窗口、500 ms 同窗去重及历史回复的再查询循环；原 App GAN driver 合并排队恢复命令并在写入时跳过过期窗口，没有新增 Watch 协议实现。
- 手表直接复用 solo controller 的 `futureHistory` 保护和 machine 原有 2 秒回溯界限：短暂漏首手可补收；历史不能自建准备/起表，过期首手取消旧准备并提示重新打乱；已起表的长段补录保留。原生只增加提示及有界耗时诊断，并避免每个陀螺仪包都重复发布未改变的电量。
- 定向回归 47 项通过（14 项 App/Watch、23 项时钟/恢复、10 项序号/多动作帧），shared build、App 类型检查、Mobile build/sync 已通过。独立复核未发现新增阻断；签名构建、安装及新实体延迟结果继续分别记录，暂未验收完成。
- iOS/Watch 联合签名构建及深层签名验证通过，分别安装成功；手机首次启动被系统 Security 校验拒绝，签名/描述文件/设备登记匹配，再次覆盖安装后正常启动；手表启动成功并收到 10 条新打乱。本轮安装后手表容器读到初始空状态，更新前的完整记录与协议日志已取回 Mac 留存，不能把新队列当作旧数据仍在手表的证据。已请用户进行四次 U 和一把实体还原，实时延迟、完整记录及同步尚待本轮结果。
- 随后实体测试触发「动作接收延迟，本次未计时」：四次 U 实时收到，完整还原期间协议轨迹出现约 15.6 秒空段，再收到积压动作，保护未生成幽灵成绩。用户明确确认屏幕一直亮着，不能归因为熄屏；既有 JS 单次耗时也不足以证明阻塞原因。
- Watch 原生 BLE 改用独立串行接收队列，回调先复制数据，再按序交给主线程上同一 JS driver/共享计时逻辑；服务发现以主线程已处理的 pendingServices 确认完成，避免队列分离引入握手竞态。加入回调排队、tick 间隔和生命周期有界诊断；接收时间目前只用于诊断，不另建时钟算法。声明 bluetooth-central 后台能力，但不宣称可持续后台高频接收，也未申请假运动会话。
- Watch 单独签名构建、安装和启动成功，安装前后持久化状态完全一致。首轮快速 `U U U U R R R R` 八步均按序实时输出，无历史补收、积压或 timingLate；回调等待主线程最大 167.47 ms，tick 最大间隔 253.65 ms。该证据只覆盖短串，完整一把的自动起停、复盘时间与同步仍待验证。
- 随后用户连续完成三把并确认「这次都对了」。Mac 读取 12.392 秒/74 步、12.0693505 秒/77 步、13.983 秒/73 步，三笔均以原打乱及原动作通过 shared cubie 重放到还原态，末手时间分别等于成绩，最终无 interrupted。前两把取样未见历史补收或 timingLate，主线程回调等待最大约 604 ms，未再见此前数秒积压。此轮自动起停和记录验收通过；三笔仍在 Watch outbox，手机同步尚未确认，亦不外推为所有后台/无线条件均通过。

### 2026-10-15：Watch 复盘时间偏差（本地修正，实体复测待验）

- 从上一把 76 步真实协议轨迹确认 GAN 历史回复会分片并重复；共享 `GanMoveSync` 旧 FIFO 将每一页当作一次请求的回复，错耗时间锚点。独立最小复现显示无关页后有效动作失去时间，`MoveClock` 再以延迟到达时间重锚，使后续动作整体偏移；不是复盘 UI 格式化问题。
- 修正在同一个 shared 同步器/时钟：按动作序号保存首次请求窗口的时间估计，仅消费实际输出动作的锚点，分片结束按窗口位置插值；延迟且无时间的动作保留已有设备时钟。没有缩放原录像、改写旧成绩或另造 Watch 时间算法。历史动作仍只能估时，不能声明精确还原原始逐手时间。
- 恢复/时钟定向 22 项检查和 app-ui GAN/Watch 集成 12 项检查通过，shared 构建及 app-ui 类型检查通过；独立审阅无阻断。补充每次停表的有界动作时钟日志，安装与实体新成绩末手时间/停表时间核对继续独立记账。
- Mobile build/sync、iOS/Watch 联合签名构建与深层签名验证通过，修正版分别安装到 iPhone 15 Pro Max 与 Series 8，两个 App 启动成功。已请用户只完成一把并告知完成，日志由 Mac 直接取回，无需用户手动传输；本轮实体时间轴验收等待新记录。

### 2026-10-15：Watch 复盘仅两步的回归修正（本地，真机复测待验）

- 用户完整还原后仅见 `U' R`；真实容器记录为 15.65 秒、两步分别在 1.40/2.89 秒，连接共输出 34 步，当前打乱需 32 个四分之一转。确认保存源已缺失，非播放器截断。旧诊断没有恢复轨迹，不能断言这次具体丢包原因。
- 已在现有 Watch→iOS GAN driver→shared session/recording 路径复现：缺一帧后积压超过 16，原 driver 清空同步队列，以复原状态快照正常停表，只保存前两步。改用小程序既有保留队列的恢复方式；迟到历史补齐后，23 步与 2200 ms 完整保留。补收标记传入 shared MoveClock，避免将回复延迟误作设备时钟漂移；Watch/iOS 共用。
- 同一缺口无进展 15 秒或积压达到 128 步，走原协议错误及中断路径；显式硬件重置取消旧恢复期限。手表增加有界协议/计时轨迹以核对实体原因，不从打乱生成虚构动作。相关桥接/driver 12 项、MoveClock 10 项检查通过，shared 构建与 app-ui 类型检查通过；安装和实体复测继续单独记账。原缺失记录保留，无法从当前两步恢复此前真实手法。
- 修正版 Mobile build/sync、iOS/Watch 联合签名构建及深层签名校验通过；设备工具确认分别安装到 iPhone 15 Pro Max 与 Series 8，两个 App 均启动成功。尚需用户重新连接 GAN 16 UI 完整还原，读取真实动作/协议轨迹与最终复原状态确认，未将安装记为实体复盘验收通过。
- 随后通过 Mac 的 devicectl 再次直接取回实体日志：新成绩 31.15 秒，持久化 76 个动作；使用 shared tracker 从该成绩的原打乱逐手重放，最终确实还原，手表播放器诊断也读取到 replayCount=76。补收轨迹有超过 16 步积压并继续补齐，未清空动作。仍发现时间轴问题：末手相对时间 37.08 秒超过成绩 31.15 秒，且本次 outbox=1，时间准确性及手机同步仍未验收，不能标记复盘整体完成。Device Hub 当前实时视图报 unsupportedDeviceOS，未影响 devicectl 读取应用容器日志。

### 2026-10-15：Apple Watch 复用现有复盘（本地，真机待验）

- 用户已确认重置可用，要求复盘必须复用其他平台。手表此前仅保存时间，现直接接入 `SmartCubeAttemptProducer`，保存首手到末手的原始动作/相对时间、设备、v2 校准姿态（缺起始姿态时兼容 v1）；手机导入同一 `Solve`，通过原 `stageSegmentsFor` 补派生分段，直接使用已有完整 `ReconstructReport`。
- 手表最近一把提供复盘入口并在新录像保存后展开，使用原 `sliceReconstruction`、`computeStepMetrics` 和 `playbackIndexAt`；原 tracker/three.js NxN 引擎负责局面和动画。SwiftUI 仅适配播放、暂停、步进、倍速、共享分步指标和原始动作显示。手表不另写复盘算法，不声称完整 React 报告 UI 已搬到 watchOS；手机继续提供原文字谱子、参考等完整能力。
- 大录像沿已有 durable outbox/ACK 契约增加 WC 文件通道，最近一把不随 ACK 丢失。复盘期间禁止新起表，放腕幂等暂停；统一连续时钟，v1/v2 姿态坐标和 +2 显示已按独立审阅修正。未完成录像不保证进程终止后的恢复，仍按既有 DNF 机制处理。
- 4 项桥接/场景检查、7 项导入/Swift 契约检查通过，另补放腕重复暂停检查通过；shared 构建、app-ui/Mobile 类型检查、Mobile Web 构建/sync、iOS/Watch 签名构建与 watchOS 模拟器构建通过。真实 16 MiB QuickJS 完成 30 手录像回放并核对最终复原状态，模拟器截图可见成绩、HTM/TPS、三维打乱状态。共享 `stage_segments` 兼容入口改为直连原 producer，避免把无关浏览器 worker 拉进手表包；未改算法。
- 安装实际被设备连接阻塞：iPhone 15 Pro Max 显示 unavailable，安装报 CoreDevice 4016；手表安装报远程连接失败，未确认成功。本轮复盘包未宣称已装好，已请用户连接并解锁配对手机。补齐 `recordingVersion=1` 握手，旧版手机不能接收后丢弃录像字段再 ACK；新增真实 Swift DTO 录像往返、能力门禁和 +2 显示检查通过，最终签名构建通过。实体录像/回放/同步验收待继续，未提交、推送或发布商店。
- 用户连接并解锁手机后，设备工具确认复盘版已分别安装到 iPhone 15 Pro Max 与 Series 8，两端启动成功。实际容器读回：手机批次 sequence=8、`recordingVersion=1`，手表也已持久化 `recordingVersion=1`，队列 10 条、无待传/草稿/新录像。已请用户完成新一把并操作回放；此时尚无新真实动作流，不能记作真机复盘或同步验收通过。

### 2026-10-15：Apple Watch 复用 iOS 三维模型与动画（真机显示已确认）

- 用户明确授权复用 iOS three.js 模型/动画，只新增必要的手表绘制适配。`NativeCubeScene` 直接消费原 NxN Cube/Twister/InstancedRenderer/Tweener；SceneKit 只接受几何、颜色、矩阵。未重写转层、状态或计时算法；原 iOS 摄像机朝向函数提取为同一入口，原可选 WASM 初始化增加运行环境判断，已有 JS 运算路径不变。
- 原 GAN driver 的状态快照、实际转动及 gyro 已接到独立渲染队列，原 shared 姿态校准/平滑、节奏及中层跟随参数继续复用。乱态连接通过现有贴纸寻址采纳真实状态，后续原动画引擎转动；渲染上下文独立于计时，最多 30 Hz，放腕停画，恢复采纳最新状态，积压保留及时到达的最新一手动画。异常不关闭计时。
- 定向检查：任意乱态开始的六面动画及最终序列化、最新动作追帧、倒序渲染时钟、重新同步、陀螺仪矩阵与现有 BLE/计时集成共 2 项通过；app-ui 类型检查通过。实际 16 MiB QuickJS 加载三维 bundle/几何，完整打乱+还原 60 个转动逐手比对 shared tracker 状态通过。
- watchOS 27 模拟器显示原模型；录屏通过生产 SceneKit adapter 播放 8 手，诊断 `ready=true`、`failed=false`、`moves=8`、`settledMatches=true`。独立审阅发现的时钟倒退及快速连转丢动画问题已修正。模拟器和 iOS/Watch 联合签名构建、深层签名校验通过，手机与 Series 8 安装成功；真机远程启动被系统锁屏拒绝，已请用户解锁、连接 GAN 16 UI 并确认模型/转层/姿态。未将安装或模拟器证据记作真机显示、完整自动计时或长期耗电验收。
- 计时执行超时修正已随本包更新。未提交、推送或商店发布。详细复用及诊断边界见 [Apple Watch 计时器](./apple-watch-timer.md)。
- 后续用户解锁并连接后确认「可以了」。实机读回 `watch-scene-status.json`：`ready=true`、`failed=false`、6 次转动、813 个渲染帧，最终 `displayed` 与 `expected` 相同，`settledMatches=true`。此证据不扩展为完整自动计时或长期功耗验收。
- 按用户要求新增设备页「重置魔方」，直接复用 iOS GAN driver 的确认式硬件重置、shared session 与姿态校准；SwiftUI 仅承载入口和反馈。定向 10 项检查通过，另验证确认回调与转动同批到达时最终显示同步、等待期间无伪成绩、重复请求/运行中拒绝、超时与断线处理；类型检查、联合签名构建及深层签名校验通过。新版安装与用户点击确认单独记账。
- 重置版已分别安装到 Series 8 和配对 iPhone；远程启动被系统 `Locked` 拒绝，已请用户解锁后实际还原、白顶绿前握好并点击重置，硬件重置和朝向的本轮真机验收待回报。未自动向未确认实体状态的魔方发送重置指令。
- 用户反馈未见按钮并要求智能魔方模式禁用屏幕计时。实际容器诊断含 `reset=idle`、`phase=connected`，确认新逻辑已运行；原按钮仅在设备页。现将同一个 SwiftUI 控件同时放到计时页三维魔方下方和设备页顶部；连接时 Swift/JS 均拒绝触屏起停，继续复用实体转动自动计时，断开时保留手动。两项定向桥接检查覆盖 connected idle/ready/running 的点击隔离、实体自动成绩、断线 DNF 和断开后手动计时，均通过；类型检查、签名构建和深层签名校验通过，手机及手表安装成功。独立审阅通过，按钮可见性/点击与硬件重置仍待用户真机确认。

### 2026-10-15：Apple Watch 直连 GAN 16 UI（本地，连接与转动已验）

- 用户追加要求手表直接连接、离开手机使用，并明确 GAN 16 UI 为默认实体测试魔方，不再重复询问型号；已记入根 AGENTS 与 mobile skill。手表不提供「下一条打乱」「获取打乱」按钮。
- 新增仅负责 CoreBluetooth 的手表 transport，打包执行现有 iOS `GanV4CubeConnection` 与 shared session / MoveClock / solo timer / timer machine；手动点击起停也使用该 machine。为执行既有 TypeScript，嵌入未修改的官方 QuickJS core；没有复制 GAN 协议、AES、魔方状态或自动起停逻辑。
- app-ui 类型检查通过；共享 GAN fixture 定向集成检查通过（打乱预备、500 ms 自动成绩、重复帧去重、禁用状态不被快照覆盖、断线 DNF、手动观察 +2）；原有手表同步/Swift 契约 10 项通过。实际 QuickJS C 引擎执行最终 App 内 bundle，手动样例得到 500 ms、观察 16000 ms、+2。含手表的 iOS 签名联合构建通过，手机和 Series 8 分别安装并启动。
- 独立审阅发现并修复了睡眠时钟差异、诊断写盘影响运行、存储提交隐藏引擎故障的问题。计时源统一为 ContinuousClock；诊断不参与计时成败；运行时故障需重启后恢复。
- 真机用户确认扫描发现 GAN，但连接失败，四次 U 未接收。诊断定位为 `Cube MAC address required`，失败发生在打开 GATT 前：广播长 22 字节，厂商头为 `01 00`，Apple adapter 分离后留下 20 字节；原 app-ui MAC adapter 直接交给共享解析器而丢失格式信息。对照微信/抖音既有完整段处理，在唯一 app-ui adapter 补回厂商头再调用同一 shared parser；新增匿名 20 字节 fixture 在修复前重现同错，修复后新旧长度和 Watch 集成共 8 项检查通过。另修复 SDK 实证的 CBUUID 短/完整 uuidString 查找问题，改用系统等价键按服务隔离。连接/转动/自动计时及离线实体验收仍在进行，不标记完成。
- 当前离线范围为已有缓存打乱和手表本地成绩队列，缓存耗尽仍需手机补充；走偏修正 Worker、逐手复盘、其他品牌、长期后台和耗电尚未交付/验收。未提交、推送或商店发布。
- 地址适配修复后 Mobile Web build/sync、iOS/Watch 联合签名构建及深层签名校验通过；GAN 既有驱动另 6 项回归通过，修正版已安装到手表并重新启动。等待用户重新连接并做四次 U，未将安装成功记作连接成功。
- 用户随后确认「成功了」。Series 8 实际读回：`phase=connected`、`stateReady=true`，收到 296 帧及 15 个转动，最后一手 U；`badFrames=0`、`pendingMoves=0`。这证明手表 CoreBluetooth → 原 GAN driver → 共享状态链路已通；未从仅保存的 9.16 秒记录推断自动计时已验。完整自动起停及离线使用/恢复同步待真机验收；用户选择关闭配对手机的蓝牙，无需关机。
- 随后真机出现「计时引擎暂不可用」。补齐即时异常记录后抓到 `InternalError: interrupted`；原桥接用墙上流逝时间限制一次脚本，可能把系统挂起算入执行预算。本地真实 QuickJS 的执行中暂停 3 秒再恢复，旧版重现同错；改为线程 CPU 时间后正常返回，死循环仍按 2 秒预算中断，内存/栈/Promise job 上限保留。当前完整打乱与逆序还原的 60 个四分之一转动在 QuickJS 重放得到 ready → running → stopped、7250 ms；临时测试曾漏展开 `R2'` 等半圈，修正测试输入后通过。这不是完整自动计时的真机通过证据。
- 用户新增连接后显示 iOS 同款 three.js 实时动画的需求。已核查原 SimCubeView/NxN 引擎与 watchOS SDK：原 React/WebGL 组件无法直接挂载，候选为复用几何/转层/姿态逻辑、以 SceneKit 做绘制适配；尚未实现或安装动画，不宣称外观或流畅度已验。

### 2026-10-15：Apple Watch 真机安装、起停与打乱图（本地）

- 用户已授权在自己的 Series 8 GPS / watchOS 26.6 上安装并验收，配对手机为 iPhone 15 Pro Max。Mac 已实际识别该手表，设备工具读到 watchOS 26.6；设备标识仅保留在本机日志，不入库。
- 含 Watch App 的 iOS 开发签名构建通过，`codesign --verify --deep --strict` 通过；用户开启手表 Developer Mode 后，设备工具确认为 Enabled。`devicectl device install app` 分别确认手机和手表安装成功，手表 `process launch` 成功，保留既有 bundle ID 与数据。
- 用户确认两次长按松手起表/点击停表正常，准备时有震感，包含放下手腕约 10 秒后继续计时。手机历史实际读到默认分组新增 3.54（+2），以及「Watch 真机验证」分组 3.22；不据此宣称长时间后台/离线重连已验收。
- 用户要求打乱图必须复用现有 iOS 能力。新增共享渲染导出和手机 PNG 转换，手表只显示缓存图；10 项定向检查通过，新增最终 Swift JSON 大小边界 fixture 通过，Mobile Web 构建/sync 与签名联合原生构建通过，新版已分别安装到手机/手表并启动。
- 真机容器读回：手机生成 10 条三阶图，每张 Base64 3452–3604 字符；手表缓存 10 条的 ID、打乱与 PNG 均逐条一致。提取首张 PNG 确认有完整展开图，用户随后确认「已看到打乱图」。保存 0.55 秒草稿后手机显示测试分组 2/2、mean 1.89、best 0.55，手表 outbox 为零。Xcode Device Hub 对此 watchOS 26.6 报告屏幕共享不可用，屏幕显示结论来自用户确认。
- 后续用户指出缩图模糊、要求对齐 iOS 流程。现改用 iOS TwistyPlayer 二维视图同一 SVG 渲染器及 `hintFacelets: none`，保留 Canvas 原生 480 像素宽 PNG，以系统 `transferFile` 传高清批次，无自写图像编码器。全内容区点击起停，删除长按准备文字/罚时选择/确认保存，停表自动落盘、入队并换下一题，保留上一成绩显示。十项定向检查、类型检查、Web/sync 和签名原生构建通过，最终版本已安装启动。
- 高清传输真机证据：手机批次序号 6 的 10 张三阶图均由手表接收；当前题为 480×408 高清图，缓存 9 条的 ID、原打乱及 PNG 与手机逐项一致，单图 Base64 约 81–86 KB，draft/outbox 均空。用户对高清图、全屏起停、停表自动保存换题确认「对了」；手机测试组记录由 4/4 增至 11/11，mean 0.94、best 0.38，证明测试记录持续回传。随后按用户要求移除「下一条打乱」「获取打乱」，仅保留自动补充缓存。
- 离线重连、后台传输、观察 8/12 秒震感、VoiceOver 和电量仍待验。未上传 TestFlight / App Store、未提交或推送。

### 2026-10-14：Apple Watch 配套计时器第一版（本地，真机待验）

- 用户授权以现有 iOS 工程增加手表计时器，优先复用。新增 SwiftUI `CubeRootWatch` target，随 iOS App 嵌入；共享品牌图、手机端随机打乱生成器、唯一 `TimerRepository` 和原有统计/历史。明确的 watchOS 首版范围见 [apple-watch-timer.md](./apple-watch-timer.md)，不改变五端完整计时器 parity 合同。
- 首版为 12 个常规计时项目的普通随机打乱、本地长按松手起表/点击停表、观察与前台 8/12 秒震动、OK/+2/DNF、持久化草稿及离线队列。手机下发每批 10 条打乱，冻结原分组/项目；无手机时可使用缓存。中断尝试恢复为 DNF，不伪造正常用时。
- WatchConnectivity 原生 inbox/outbox 与原子文件保存；同一 IndexedDB 事务提交成绩和 receipt 后才 ACK，去重覆盖断线重投、已编辑/删除成绩和备份导入。已删除原分组用稳定恢复组，不改变当前选择。原生批次 source/sequence 水位阻止跨通道乱序回滚。
- 本地证据：app-ui/mobile 类型检查通过；Mobile production build + iOS sync 通过；iOS 和 watchOS 联合 unsigned device build、联合 Simulator build 通过，包内可见 `Watch/CubeRootWatch.app`。10 项定向风险检查通过，含真实 Swift 编译执行与 TS 观察罚时/显示格式、JSON DTO 和乱序游标对照；独立反例审查发现的停表存储门禁、手势清理、罚时导航、批次重试和 snapshot 恢复问题已修正。
- 模拟器实际验收：Xcode 27 / watchOS 27 的 Series 9 41mm 与 iOS 27 配对；手机既有生成器下发真实随机打乱，连续两次长按松手起表及点击停表通过，罚时选择器可进入并选择 +2。第一笔 4.207679292 秒加二后显示 6.20+，重开仍保留草稿和罚时；第二笔显示 19.99。确认保存后手机原有计时统计显示 2/2、mean 13.10、best 6.20，手表 outbox 与手机 inbox 均清空。第三次计时中终止进程，再开恢复为不可改 OK 的 DNF 草稿（timeMs=0、recovered=true）。41mm 上长内容通过滚动访问，未声称全部控件同屏。
- 用户提供目标设备为 Apple Watch Series 8 GPS，watchOS 26.6 (23U67)；deployment target 为 watchOS 10。当前 watchOS 27 模拟器不支持创建 Series 8，因此上面的证据不是该真机/系统版本验收。真机安装、震感、熄屏、离线重连、后台传输、VoiceOver 与耗电仍待验；模拟器前台通信成功不等于后台 transferUserInfo 送达保证。无签名发布、TestFlight、App Store、提交或推送。


### 2026-10-13：官网 Android 直链版支付渠道（本地实现，未发布）

- 单一源码和 Web bundle，原生 Gradle `mobileDistribution=play|direct`（默认 Play）决定支付能力。direct 产物在 `app/build/direct/`，不覆盖 Play；正式 APK scripts 强制既有发布签名，direct 不产 AAB。包名保持不变，跨渠道升级仍须核对 app-signing 证书和更高 versionCode，不能把 Play upload key 当成相同安装签名。
- direct 不注册或同步 Play Billing，复用网站订单、支付宝／微信官方 H5 收银台与服务端验单。宿主校验消息源、账号及收银 URL，经商户域名中转页在系统浏览器打开；返回／取消仅触发查单，支持轮询和手动查询。没有新增支付 SDK、账号体系或数据库结构；Android 现有 Billing 依赖仍打包但不启用。Play、Apple 能力保持原路径。补充原商店自动续费管理提示，网站／商店权益并存不叠加。
- 本地验证：shared build；client、app-ui、mobile、API 类型检查；16 项 mobile 渠道／支付 adapter 用例、30 项网站桥／支付弹窗／既有 Apple 认证桥用例、5 项 app-ui Web surface 用例、17 项 API 下单／结算用例通过（26 项数据库集成用例因未配置测试库跳过）。新增 checkout 路由后通过 `next typegen` 刷新路由声明再验 client 类型。Mobile Vite build + Capacitor Android sync 通过。JDK 17 下 direct `:app:generateDebugBuildConfig` 通过并确认为 `direct`；完整 assembleDebug 在 Capacitor Java 21 源码编译处失败。另有本机 JBR 25，但 Gradle 8.14.3 不支持其 class version 69，未变更系统 Java 配置。
- 未完成：JDK 21 下原生完整编译、正式签名 APK、真机支付宝／微信 H5 Referer 与钱包唤起／取消／返回、弱网与进程恢复、最终发布包隐私核对。四项 `MOBILE_UPLOAD_*` 当前均未配置；未生成或接入正式下载包，未部署或推送。CI 已增加 direct release 构建、签名和渠道检查，尚未运行。

### 2026-10-13：Google Play 已上架；中国大陆 Android 分发调研

- 所有者确认 CubeRoot 已在 Google Play 成功上架，当前发行状态由“已提交审核”更新为“已上架”。2026-10-13 是本次确认日期，不作为首次上架日期；本次未登录 Console 核验正式版本号、实际开放地区或放量比例，不将此前送审的 `0.1.0 (1003)` 自动认定为当前线上版本。
- 下方 2026-10-06 送审记录保留为历史证据；`mobile-store-submission.md` 的旧构建资料不再表示 Google Play 当前仍未送审。Google Play 上架不代表后续源码已进入商店包，也不代表 iOS、HarmonyOS NEXT、桌面端或五端整体验收完成。
- 中国大陆渠道的主体要求、APP 备案、版权材料、各商店提交流程及官网 APK 分发见 [中国大陆 Android 分发调研](./china-android-distribution.md)。当前仅调研，没有创建商店账号、提交审核、发布 APK 或调整支付方式。

### 2026-10-09：账号同步额度隔离（网站与 API 已部署，设备恢复待核实）

- 在旧版透明背景兼容修复之外，确认签票、兑换与关注比赛读取误用业务写操作的同一 IP 30 次／60 秒额度，一次同步至少占两次；共享网络与循环重载会放大误伤。保留 nginx 日志中 10 月 4–10 日的 1,407 次微信签票请求里，1,401 次为 200、5 次为 429、1 次为 502；IP 与 UA 的组合不是用户数，HTTP 200 也不能证明设备完成同步，不能将所有反馈归因于限流。
- 拆分签票、兑换、关注读取的额度；签票每个已验证账号 60 次／60 秒，签票与兑换每个 IP 各 600 次／60 秒；关注读取每账号 120 次、每 IP 600 次，写入保护保持原样。继续使用各 API 进程内的滑动窗口，429 返回真实剩余秒数，拒绝的请求不延长窗口。补充无凭据、无请求体的同步路由状态和耗时日志。
- 回归：恢复旧路由时新用例失败；修复后 76 项 API 定向检查、87 项认证文档检查与服务端类型检查通过，覆盖共享 IP 多账号、业务额度耗尽、账号跨 IP 计数、已签票兑换、独立 IP 上限与窗口恢复。一次性票据、身份校验和浏览器会话限制继续通过现有检查。无需更换小程序包；实际部署与用户设备恢复须单独记录。

- 发布：修复提交 `45e49ef48e`；Deploy Core 38026302618 与 Deploy Next 38026302605 均成功，Vercel 状态 success。线上 API release 路径和网站 `.deploy-sha` 均为该提交；网站服务 active，两条线路的账号同步页均为 200，保留协议 3 兼容分支。
- 线上验收：API health 为 200、数据库 connected；无凭据签票与无效票据兑换均为 401/no-store，且新增诊断记录到两条路由的状态与耗时。未用真实用户身份代测；自第一阶段上线后观察到的空请求窗口不能证明所有用户恢复，仍需受影响用户重开工具页复测。
- 通用 Test 38026302591 未全绿：Knip 的 vm_stat/sysctl/ps 未列入工具清单，以及 MonacoOpen2027 城市中文译名缺失，与本次改动无关；不将部署成功等同于全仓 CI 或真机验收通过。

### 2026-10-09：旧版微信工具页账号同步循环（网站兼容修复已部署）

- 网站修复提交 `e554ac8a86`：旧小程序偏好协议 2 不接受 `transparent` 时改用既有外观/语言消息，不再导航偏好中转页并循环重开工具、申请登录票据；新壳通过协议 3 声明透明背景支持。账号、凭据和票据校验保持不变。详见小程序 README 的故障证据。
- 本地：修复前源码复现回归失败；修复后 99 项网站定向检查、870 项小程序检查、网站类型检查及微信/抖音构建通过。当前开发目录已同步修复并刷新微信 dist。
- 线上：Deploy Next 38025264774 成功，服务器 `.deploy-sha` 与提交一致、服务 active；Vercel 提交状态 success。`cuberoot.me/auth/miniprogram` 与 `next.cuberoot.me/auth/miniprogram` 均 HTTP 200，页面均包含新协议分支。网站热修已生效；未上传、审核或发布新小程序包，用户设备复测仍待确认。
- Test 38025264811 未全绿：通用 Knip 检查仍报 alg-build 的 vm_stat/sysctl/ps 未列入工具清单，另一分片报 MonacoOpen2027 城市译名缺失；两者均不涉及本次改动。通过的定向检查与部署成功不替代真机验收。

### 2026-10-07：Capacitor 与宿主构建依赖安全升级（构建通过，安装包未发布）

- Android/iOS 的 Capacitor core、CLI 和两平台运行时统一从 8.5.0 升至 8.5.3，包含 GHSA-rvm3-566m-v7fv 的内部 HTTP 代理导航修复；Android Gradle 引用、iOS SPM 配置及解析锁同步到相同版本。
- Mobile/Desktop/Harmony 的 Vite 从 8.0.1 升至 8.0.16；Mobile/Desktop 的 Vitest 最低版本升至 4.1.11。保留既有宿主边界、插件、App 标识、版本号与 WebView 103 构建目标。
- 本机 Mobile Web build、Android/iOS Capacitor sync、JDK 21 Android debug APK 和 iOS unsigned Simulator build 通过。未安装到设备、未签名发布、未上传或提交应用商店；已经安装或审核中的旧包不会因 Git push 自动取得此修复，仍需后续发布新版客户端。此次依赖修复不代表五端整体验收完成。

### 2026-10-07：九个智能魔方专项与连续训练 P1（本地，设备待验）

- 共享目录新增 CLL/ELL/EOCP/2GLL/OLLCP/ZZLL/ZBLS/LSE/L10P，Web 与 App 共用随机/种子生成、固定朝向与专项停表；csTimer 兼容导出保留原专项供回导恢复。
- shared build、Web/App typecheck、专项生成/种子/完成条件/控制器/导入导出回归及四条 confirmed 复盘基准通过。真实 App 组件的九专项停表与连续训练共 10 项通过：从上一题未还原状态引导到下一目标，再预备、计时、保存；修正 Worker 传输在测试中替换。
- 既有来源矩阵两条源码断言及两个非训练 App 场景的 Worker 环境失败另记，不宣称全集通过。仅本地提交，未 push/部署、未重建原生包或 BLE 真机验收；五端整体仍为 NOT COMPLETE。详细规则与边界见 `docs/timer-smartcube-plan.md`。

### 2026-10-07：智能魔方专项停表 P0（本地，设备待验）

- Web/五端共享产品层现有 Solo 接线共同消费 shared 专项完成规则和控制器；Cross/F2L/OLL/COLL/CMLL 在固定训练朝向下按阶段停表，COLL/CMLL 允许 AUF，PLL/LL/ZBLL 仍需最终 AUF。末手先记录后保存，运行中项目/朝向变更不改本次目标，状态同步不制造停表。
- shared build、App typecheck、共享规则/控制器/打乱引导/记录回归及全部四条 confirmed 复盘基准通过；真实 App 组件测试覆盖五专项黄顶绿前打乱、自动预备、转动起停、250ms 成绩及两步完整持久化。独立源码审查无阻断问题。Web typecheck 被另一任务 `TimerSolverPanel.tsx` 的 `spinner`/`Spinner` 导入大小写冲突阻断，未改该文件。
- 未 push、未重建或发布原生安装包，未做五端 BLE 真机验收；新专项及完整连续训练验收留在 P1，整体 parity 仍为 NOT COMPLETE。详细边界见 `docs/timer-smartcube-plan.md` 同日记录。

### 2026-10-06：Google Play 1003 已提交审核

- 所有者明确确认“确定 送审吧”后，在发布概览提交全部 10 项更改并确认最终送审弹窗。Console 随后显示“正在审核中的更改”，包含 `0.1.0 (1003) - Initial release`、146 个国家/地区、商品详情与内容声明。
- 提交后 Google 又显示快速检查进行中（页面估计至多 9 分钟），通过后自动送审；这是提交受理证据，不是人工审核通过或已上架。自管式发布仍关闭，所有者已知悉审核批准后会自动发布。
- 本次没有新建构建、推送代码、调整价格或变更付款资料；审核截图 `/tmp/cuberoot-play-submitted-1003.png`。下方“待最终确认/尚未提交”的记录为此前阶段，现由本节覆盖。

### 2026-10-06：Google Play 首发送审收口（待最终确认）

- 正式版候选仍为已内测的 `0.1.0 (1003)`；Console 已保存正式发布草稿与 146 个非欧盟国家/地区，没有重新构建或夹带其他任务代码。发布概览列出 10 项待送审更改，自动预检完成并显示“您的更改现在可以送审”；自管式发布关闭，批准后会自动上线，尚未点击提交审核。
- 所有者确认使用两张 Android 真机「计时 / 工具」截图，已替换默认商品详情的 iPhone 截图并保存；工具图不含布局编辑控件或宠物遮挡。原图仍在资源库，可恢复。
- 审核账号 UID 70 经邮箱身份与 WCA ID 三重核对，使用现有 `memberships` 免费手工权益，独立查询确认 `effective_memberships` 有效至 `2027-10-06T09:09:11.307Z`。未创建订单、未收费、未修改 Google/Apple 订阅账本。后续 Google 到期/退款测试必须核对其独立账本，不能用该账号总会员状态作为验收证据。
- 购买页样式和 Android Stackmat 隐私说明按所有者授权从隔离工作区推送；最终 CSS 选择器修复 `33d61fbb48` 的 Test `37440179522`、Deploy Next `37440179583` 与 Vercel 状态均成功。没有新原生包或 API 发布。下方“未授权/未推送”是此前阶段记录，已被本节覆盖。
- 所有者确认 two-tool、SpeedCubeDB、Best 2x2 已具备 App 展示授权，未独立核验授权原件。月卡主流程已验收；年卡及取消到期/退款异常生命周期仍未实测。实时税务中心显示美国 W-8BEN“审核中”（2026-10-04 提交）；银行账号已作为主要电汇方式，当前页面未显示验证待办，也未明确显示银行已验证，不能宣称收款验证完成。审核访问英文说明已保存，包含一年期免费会员和浏览器回跳步骤。

### 2026-10-06：Google Play 首发资料复核（未送审）

- 对最终 1003 APK/AAB 核对广告 ID：Manifest 无 `AD_ID` 权限，推送插件禁用 advertising ID，当前 Getui 未配置启动；Console 已保存“不使用广告 ID”。这不代表不处理其他设备标识。应用内容页面显示 10 项已处理、没有需要注意的声明。
- Data safety 补充实际在线 Tools 能访问的论坛视频、云盘音乐/其他音频/文件、日历活动，均为用户可选、App 功能用途、非临时收集；用户主动发布/分享按对应豁免处理。删除链接从 GitHub 原始 HTML 改为已验证 HTTP 200 的 `https://static.cuberoot.me/tools/play/account-deletion.html`。Console 确认更改已保存，仍待送审。
- 正式轨道创建 `0.1.0 (1003) - Initial release` 草稿，从内容库复用已内测的 1003，保存英文首发说明；没有上传新包、正式发布或点击送审。
- Android Stackmat 本机音频处理的双语隐私说明已本地补充，client typecheck 通过；购买页样式与本次隐私说明尚未获得本轮发布确认，未推送。其他任务的计时器改动未纳入本轮发布。
- 仍需收口：正式发布地区、Android 代表性截图、审核账号在审核期间的付费内容访问、two-tool/SpeedCubeDB/Best 2x2 内容授权范围、商家税务/银行验证状态；年卡与取消到期/退款异常生命周期尚未实测。声明填写完成不是所有政策、素材和业务验收通过。

### 2026-10-06：Google Play 月订阅内测主流程通过

- 所有者在 Play 内测 1003 使用测试卡完成月订阅；服务端核对为测试订单、`SUBSCRIPTION_STATE_ACTIVE`、`ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED`，并授予同一 CubeRoot 账号会员权益。
- 自动续期通知到达受认证的 RTDN 端点并返回 200，到期日随续期更新；重新登录后的恢复请求 `verify` / `sync` 均返回 200。所有者随后再次重启并确认正常。
- 中途出现商品不可用与恢复失败，当时未观察到会员接口请求，重新登录后恢复；网络或会话原因没有实证定位，不记为已修复的登录缺陷。
- 验收范围限月卡购买、确认、权益、续期、恢复及所有者重启复测；年卡、取消后到期、退款/撤销及异常交易场景仍未实测。主流程通过不等于全部订阅生命周期或正式提审通过。
- 本轮购买页仅本地调整共享商店界面的标题、价格、主次按钮、触控尺寸和状态提示，支付桥、商品 ID、价格来源与验单逻辑不变；未推送部署、未新建或上传 Android 包。

### 2026-10-06：Google Play 内测 1003 已发布（真机待验）

- Play 内部轨道 `4701471578963469404` / release `3` 于 00:23 PDT 确认「有效」，最新版本 `0.1.0 (1003) - Login handoff fix`，已面向内部测试人员发布；未提交正式审核。1002 曾上传但未发布，因麦克风被隐式要求而减少 12 款设备，从草稿移出后以 1003 替换，制品库仍保留 1002。
- 构建来自隔离干净工作区 `271e7c4e64e87df7b2c7d58a1a2c605ce04e1154` 加可选麦克风声明修复 `b0241b9950db072fb60bed43fb4625a2a009e179`（主工作区对应 `43de58d4aa`）；没有带入其他任务未提交的计时器改动。包含下节登录修复及此前已提交的计时器/设备更新。Android 的 `RECORD_AUDIO` / `MODIFY_AUDIO_SETTINGS` 用于 Stackmat，麦克风硬件声明为可选。Play 最终预览确认相对 1001 无设备减少。
- shared/VisualCube build、Mobile Web build + Android sync、JDK 21 正式签名 AAB/APK 构建、APK 签名与 ZIP 16 KB 对齐、AAB JAR 验签通过；上传证书与 1001 相同。Manifest 兼容性改动通过登录文档指纹及 5 项文档检查，独立发布审计通过。控制台仅剩去混淆文件与原生调试符号两项提示。
- AAB SHA-256 `084d9183c7f3705fcf0190b358a6bc12cb39961752ab19fd9d26507e2bde3886`；APK `c6e20882d1e3fc05c356fa20cec3736bdce6acd38c1a11864f44c6e1a4ff6560`。产物和控制台截图存维护者桌面 `CubeRoot-Google-Play`，密钥不入库。
- 待用户从 Play 覆盖升级验证：保留本地记录、浏览器已有登录态回跳、账号 iframe 会话同步、重启恢复。未用上传证书 APK 覆盖 Play 签名安装，未卸载或清数据；未发布 iOS/其他端，未推送仓库或部署网站/API，未变更内购开关，不代表真实购买验收。

### 2026-10-06：Android/iOS 登录安全存储修复（本地，未发布）

- Play 内测 1001 真机失败证据：浏览器已有会话，确认打开 App 后仍显示登录表单；无线 ADB 确认系统将回调送达 MainActivity。实际 secure-storage 8.0.0 的 `set` 会 JSON 编码字符串，旧适配用 `getItem` 读取原始编码，导致 pending 登录信息解析后仍是字符串，无法发起换票。
- 适配改用配对的 `set/get`，保留旧存储格式、前缀、关闭 iCloud 同步和设备解锁保护，不清除或迁移计时数据。旧 pending 和 session 可直接读取；其他安全存储消费者继续获得原始字符串。桌面/鸿蒙存储适配未变。
- 缺失 pending 或 state 不匹配时拒绝换票并报告错误；账号页在系统浏览器打开完成之后仍报告回调失败。PKCE、state、有效期与服务端票据校验保持不变，长期凭据不进入 URL 或错误信息。
- 本地验证：真实存储库序列化 6 项、共享登录/Hook 11 项、登录流程文档 78 项通过；Mobile/app-ui 类型检查及 Mobile Web build、Android sync、JDK 21 `assembleDebug` 通过。Android/iOS 更新包的真实回跳、账号页会话同步和重启恢复仍待验收；未上传 Play，不代表内购测试已通过。

### 2026-10-05：智能魔方设备校准与旧型号接入（本地，实体设备待验）

- Web/安装端共用 shared 设备校准事务；GAN v2/v3/v4、MoYu32、QiYi 的“重置状态”真实写入设备并等待复原状态确认，写失败、超时或断连不得报成功。校准不触发正常复原停表；MoYu32 过滤旧计数帧，QiYi 保留校准期间的新转动，超时后排队写入不得迟发。
- Giiker（含小米名称）、GoCube / Rubik’s Connected、旧 MoYu 的协议会话提至 shared，Web 与 app-ui 均消费；扫描、订阅、转动、设备支持的状态/电量/姿态及断连清理接入 Mobile/Desktop。Gi 名称用实际 GATT 服务区分 GAN 与 Giiker。旧 MoYu 仅上报转动，没有绝对状态/设备校准/电量协议，沿用 Web 的软件复原基准，不宣称具备硬件回写。
- Harmony 源码补多前缀扫描、受限 GATT 服务发现及同一协议消费；本机 HAP 被既有工具链版本挡住（工程 modelVersion 6.0.2，已安装 Hvigor 只支持 6.0.1），没有降级工程配置。ArkTS 编译与实体设备仍未验收。
- 验证：安装端定向 50 项、Web 定向 26 项通过（另 5 项 upstream oracle 因本地 fixture 缺失跳过）；shared build，app-ui/client/Mobile/Harmony 类型检查，Mobile/Desktop/Harmony Web 构建和 Capacitor Android/iOS sync 通过。Android Debug APK、iOS Simulator 无签名构建及 macOS Debug 无签名 .app 通过；Windows 原生构建需 Windows 环境。全部新增型号及 macOS GAN16ui / WCU_MY32 真实转动、校准后继续计时、后台与断线恢复仍待实机验证；未安装、签名公证或发布。

### 2026-10-05：工具页验证码分区凭证（本地，未发布）

- 网站验证码页报告 iframe 环境，API 对嵌入页面签发 `SameSite=None; Partitioned`，普通浏览器保留 Lax；验证码、签名与 7 天期限不变。工具仍在 App 内打开，无系统浏览器跳转，也没有复制工具页或新增宿主代码。
- macOS 27 的 WKWebView 隔离探针在 `tauri://localhost` 内验证旧 Cookie 不回传、分区 Cookie 回传；API 的 10 项专项通过。此证据不等于线上 CubeRoot App 全流程验收。
- 待网站/API 发布及 macOS、iOS、Android、Windows、HarmonyOS 实机验收。旧 WebKit 不支持分区 Cookie，不能据此宣称已覆盖所有系统版本。详情见 `docs/traffic-defense.md` 的同日记录。


### 2026-10-05：macOS 原生真实 MAC 适配（本地）

- Desktop 保留 BLEC/CoreBluetooth 的 UUID 作为设备连接身份，新增 macOS 可选原生查询，把真实地址单独通过 `macAddress` 交给 GAN/MoYu32 共享密钥逻辑。Windows 的真实 MAC 路径不变，不新增协议或计时副本。
- 原生查询在 blocking worker/独立队列运行，检查 `retrieveAddressForPeripheral:` 是否存在、返回类型和六字节长度；接口异常/不可用返回空值，前端 4 秒总等待超时后使用既有广播/手填兜底。此未公开接口可能随系统更新失效；超时不会强制终止已进入系统调用的 worker。
- macOS 27.0 (26A428) 本机临时只读扫描实测：`GAN16ui_C2AF` 自动返回真实 MAC，末两字节为 C2AF；没有打印完整地址，也没有向设备写入。此次未扫描到 `WCU_MY32_5C3A`，MoYu 取址仍待实物验证。取址成功不等于协议解密、转动或自动计时验收。
- Desktop Web build、macOS `cargo build`、原生 2 项及 TS 定向 40 项测试通过，独立审查确认 UUID/MAC 分离及 Windows 路径。此次只交付本地开发构建，未打包安装、签名、公证或发布。

### 2026-10-05：macOS 智能魔方地址与握手修复（本地，实机待复测）

- 所有者报告 Windows 智能魔方主流程体验正常；macOS `WCU_MY32_5C3A` 显示连接/协议但无转动，`GAN16ui_C2AF` 显示泛化连接失败。这是失败实测，不记为 macOS BLE 验收通过。
- Apple BLE 设备 ID 为 UUID，不能当作密钥所需的 MAC。安装端移除 MY32 名称前缀猜址，Windows/Android 的真实 MAC 路径保持；GAN 保留广播/完整名称地址获取。缺少可靠地址时使用 Web/安装端共用的 MAC 表单，请求真实地址；成功地址仅在当前 hook 会话缓存，失败后移除。
- 安装端握手完成后还须收到有效状态帧才发布 connected；8 秒未收到状态会清理连接并给出核对 MAC 的提示。补齐输入取消、关闭弹层、异步 MAC 恢复后不得重开 GATT 的清理边界。没有新增自动重连或扩大型号支持。
- 地址、首状态超时、协议、取消清理以及 Web/安装端共享表单的定向自动检查已通过；App/Web 类型检查通过。macOS 两颗实体魔方的转动、自动计时、复盘与断线恢复仍须所有者复测，不把 Windows 体验或合成帧测试当作 macOS 成功证据。未发布。
