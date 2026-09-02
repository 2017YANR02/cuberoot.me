# CubeRoot 五端 App 完整路线图

> Android、iOS、HarmonyOS NEXT、Windows 和 macOS 已由仓库所有者于 2026-08-31 确认为同一个完整产品目标。五端一次设计，但绝不维护五套业务代码；宿主、共享层、能力接口和总体完成口径以 [cross-platform-app-contract.md](./cross-platform-app-contract.md) 为最高优先级合同，当前状态只在本路线图记录。网站继续作为第六个在线 surface 与内容事实源。

> 顶层产品结构已由仓库所有者于 2026-08-30 明确为“计时 / 工具 / 我的”三栏，且五端共用 `@cuberoot/app-ui` 的同一 React 实现；网站首页、子页面和未改写的 `/account` 必须直接复用，不在 App 复制。页面或按钮可见不等于完成；所有当前已配置登录方式、子页交互与会话状态都要按平台端到端验收。唯一合同与成本回退规则见 [mobile-three-tab-contract.md](./mobile-three-tab-contract.md)。
>
> 计时器产品面的 Web/五端完整 UI/UX 一致性已由仓库所有者于 2026-08-30 提升为明确合同，逐项状态与验收证据统一记录在 [mobile-timer-parity-tracker.md](./mobile-timer-parity-tracker.md)。本路线图继续负责 App 总体范围与发布门槛，不再用“首版不覆盖网站 100%”解释 `/timer` 内的假控件或交互缺失。

> 状态：执行中
>
> 更新日期：2026-09-01
>
> 目标：以最低长期维护成本，把同一个 CubeRoot 产品发布到 Android、iOS、HarmonyOS NEXT、Windows 和 macOS，并逐步覆盖对应商店和安装渠道。
>
> 原则：网站继续是完整产品和内容源；五端共享业务、React UI、账号、数据和协议，只由薄宿主提供系统能力，不复制整站或平台专用业务实现。

## 0. 执行进度（唯一事实源）

本节是移动端工作的进度账本。只有完成实现并取得对应验证证据后才打勾；只完成代码但缺少真机、账号或商店证据的项目保持未勾选，并注明依赖条件。

### 阶段 0：身份、账号和合规底座

- [x] 发布者采用组织路线；现有公司和营业执照可用于后续组织验证。
- [x] 华为开发者联盟企业开发者实名认证已完成。（2026-09-01，所有者提供控制台“已认证 / 企业”截图；这不等于应用注册、调试签名或上架完成）
- [x] 产品名暂定 `CubeRoot`，正式标识暂定 `me.cuberoot.app`，首发语言为英文和简体中文。
- [x] 公开支持邮箱暂定 `yrmfxc@gmail.com`，App 内已提供邮件入口；隐私政策 URL 定为 `/privacy` 和 `/zh/privacy`。
- [ ] 确定公开开发者名称、地址和联系电话。（需要所有者确认公开资料）
- [ ] 注册并完成 Google Play Console 组织账号验证。（需要所有者操作账号、付款和身份验证）
- [x] Google Play 组织核验所需的 D-U-N-S 已由邓白氏门户核验通过。（所有者提供门户结果）
- [ ] 核对 Apple Developer Program 个人会员已激活，并在 Xcode 选择付费 Team。（个人独资企业当前走 Apple 个人路线，不把 Google 的 D-U-N-S 当作 Apple 组织验证）
- [ ] 建立 Android 真机和测试者名单。（组织账号不预设个人账号的 12 人/14 天门槛；质量测试仍建议 15 到 20 人）
- [ ] 建立发布账号 2FA、恢复方式、密码管理和签名密钥备份规则。（需要账号所有者参与）
- [x] 完成当前构建的数据与 SDK 清单：本地计时数据、可选账号、网络状态、Browser/Network/Haptics/Secure Storage/BLE；无广告、分析或用户画像 SDK。
- [x] 完成双语移动端隐私政策源码、App 内隐私入口、支持邮箱和版本信息。
- [ ] 在提交商店前，把最终组织法定名称及公开地址、电话补进隐私政策，并与商店开发者资料逐字核对。（需要所有者确认公开资料）
- [x] 当前可选登录与 BLE 已补齐数据声明、账号删除入口、权限/SDK 清单和商店问卷草稿；未来加入同步、分析、崩溃上报或付费时重新复核。

### 阶段 1：技术验证

- [x] Windows 上的 Android SDK、JDK、adb 和 Gradle 构建链可用。
- [x] 已建立 `core/apps/mobile` React + Vite + Capacitor workspace，Web 资源从本地 `dist` 打包。
- [x] Debug 使用独立 application ID `me.cuberoot.app.debug`，Release 保留 `me.cuberoot.app`。
- [x] 已构建并在 MuMu 模拟器安装 Debug APK，验证启动、横屏布局和 Android 返回键。
- [x] 已验证 HTTPS 网络访问；计时仍是打包进 App 的本地核心体验，工具/我的是三栏合同明确的在线网站 surface，不是过渡入口。
- [x] 已用本地计时、记录和设置替换“启动即跳整站”的过渡界面；工具/我的在同一 React 底栏中直接显示网站 canonical 页面，不复制卡片、子路由或账号 UI。
- [ ] 在实体 Android 设备完成启动、触摸、键盘、安全区、旋转、后台恢复和 adb 日志的完整矩阵。当前 OPPO Reno7 Pro 5G 已完成安装、冷启动、基本触摸计时、手动打乱 IME、点击打乱三动作与 GAN 16 UI 主链实测；旋转、后台/系统中断、大字与全弹层安全区仍未关闭。
- [x] 用实体 Android 设备和智能魔方完成 BLE 扫描、连接、读写和通知 spike。（OPPO Reno7 Pro 5G + GAN 16 UI）
- [x] 输出 BLE 插件能力报告和“现成插件或自有桥”架构决定。

当前证据：

- 基础工程提交：`b2328f45f3`。
- Debug/Release application ID 隔离提交：`73ca6bb116`。
- MuMu 过渡网络壳验证提交：`0c6cb4d55c`。
- 早期移动端提交已经过 rebase，不再用会失效的旧短 SHA 作路线图证据；以下可重跑命令、产物和设备记录为准。
- MuMu 实测完成一次 `6.93` 计时，修改为 `+2` 后显示 `8.93`，添加备注后杀进程重启，记录数和最佳成绩均保留。
- MuMu 已实测桌面启动图标；Android 12 系统启动页已完成原生主题迁移并通过构建。录屏只能确认背景和交接过程，未把系统图标层作为已验证证据。
- Debug APK：`core/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`。
- 2026-08-30 真机已接入：OPPO Reno7 Pro 5G `PFDM00`，Android 13 / ColorOS 13.1，1080×2400、arm64；Debug APK 安装成功，冷启动约 0.9 秒，无崩溃或 ANR，登录 deep link 由系统正确解析。触摸计时由所有者实测可用。
- 首个 BLE 验证组合已跑通：上述 Reno7 Pro + GAN 16 UI。Android 13“附近设备”授权、扫描、选择、GATT 连接、FFF5 写入、FFF6 notify、GAN v4 解密和真实 `L` / `L'` 转动解析均有 adb 证据。

### 阶段 2：共享核心边界

- [x] 完成计时器、打乱、统计、存储、训练、BLE、API 和设置的依赖盘点。
- [x] 提取计时记录模型、校验、统计和序列化，网站与 App 使用同一实现。
  - [x] 计时记录模型、观察罚时规则和统计函数已迁入 `@cuberoot/shared/timer`，网站原路径保留兼容导出。
  - [x] 输入校验和版本化序列化已共享；App 的 IndexedDB 仓储只接受通过统一 schema 校验的数据。
- [x] 提取无框架依赖的三阶打乱生成核心，网站与 App 使用同一实现。
- [x] 定义 BLE transport，并让 Web/Native transport 共用协议、设备时钟和状态跟踪层。
- [x] 共享层回归测试和移动端 adapter contract tests 全部通过。
  - [x] 既有共享包构建、网站 typecheck、93 个计时/统计测试和 4 个复盘真值 fixture 已通过；本轮 47 个计时、迁移、元数据和品牌资源定向测试再次通过。
  - [x] 移动端仓储 adapter 的 contract tests 已通过，覆盖初始化、并发写、修改/删除、跨网站/App 导入导出、逐版本迁移、损坏数据、导入预览和单次撤销。

当前证据：

- 共享计时模型、统计和观察规则提交：`6fec2c94c3`。
- 共享计时状态机提交：`fba563fc35`。
- 版本化 schema、IndexedDB 仓储和 adapter contract tests 提交：`ac5a88bf39`。
- 共享三阶打乱生成器和边界回归测试提交：`968d330692`。
- 2026-08-30 BLE 复用边界：Mobile 只保留 Capacitor `BleTransport`；GAN v4、补帧、`MoveClock` 和 `SmartCubeStateTracker` 位于 `@cuberoot/shared`，网站旧路径只作兼容导出。移动端 28 项与网站智能魔方/时钟定向 30 项测试通过。
- 2026-09-01 智能魔方逐步提示、匹配、偏离修正 requester、Solo 生命周期 controller 与模式 capability 已收敛到 shared；Kociemba cubie 逆运算只保留在 puzzle-solvers，Web 与五端产品层共用 `TimerScrambleStrip`，各宿主只保留 facelets/Worker/BLE 适配。最新 debug APK 已覆盖安装到 OPPO，但安装时手机锁屏，因此新版提示、故意偏离、修正完成和首个 Worker 冷启动延迟仍须解锁后用 GAN 16 UI 实测，不能沿用旧版自动计时证据冒充。
- 2026-09-01 成绩历史的 8 类自动标签、PB/ao/MBLD 计算、OR 筛选、徽标和响应式折叠已由 Web 与五端共用 shared/timer-ui 实现。随后智能魔方动作收集、相对时钟、cube state、CFOP 检测/识别、HTM、朝向归一化和 `stageSegmentsFor` 也收敛到 runtime-neutral shared；Web Solo、Web 本地/联机与五端 App 共用同一 recorder/producer，App 新成绩会把 `moves/device/stageSegments` 一起写入，可自产跳O/跳P。写入先由仓储稳定 ID 幂等重试，持续失败则保留带原 session 的待保存成绩并给出常驻重试入口；切换或删除原 session 不会把成绩误写进当前 session。最终 8,788,904-byte Debug APK SHA-256 为 `65ea300af612de852f515fec72d29b16fb416e1a3ffd51ab867a92b28b1bb31a`，已覆盖安装并从 OPPO 回读一致；手机锁屏，所以 GAN 16 UI 实拧、标签点击和 TalkBack 仍未记为通过。
- 2026-09-01 历史 rolling 列继续收敛：值与 strict PB 投影由 shared 一次计算，Web 与五端共用列头、picker、日期分组、逐行值/PB 和窄屏第二行布局；FMC/MBLD 与筛选后不重算语义由同一实现保证，旧 App 每行重复日期和 Web 私有 rolling 循环均已移除。Client 60 项、App 全集 232 项回归、四包 typecheck、Mobile/Next/Harmony production build、Android/iOS sync、Android APK、Xcode iOS Simulator、Harmony unsigned HAP 与 macOS Tauri bundle 均通过，三名独立 agent 最终 GO。最终 8,789,280-byte APK SHA-256 为 `a062067af322d8d71a2386896c44d8093c89c94a8603b00baf347d72e7a9d123`，已覆盖安装到 OPPO 且与设备内 `base.apk` 一致，进程 24998 无 crash/ANR；系统 Chrome 的 320/360、normal/compare、长成绩、多标签、200% 字号和 AX 审计通过。手机仍锁屏，因此真实触摸、TalkBack 与横竖屏实测仍是验收边界。
- 2026-09-01 分组能力继续单源化：shared 统一 create+activate、项目↔分组联动、删除 selection 与默认名称，timer-ui 统一文案、44px 触点、portal/Tab trap、busy/rename/delete 焦点；Web 首次空库会持久化一个稳定 snapshot，并和五端共用同一受控弹层，旧 App 文案文件已删除。Client 9 files / 74 tests、App 全集 34 files / 233 tests、四包 typecheck、Mobile/Next/Harmony production build、Android/iOS sync、Android 304-task APK、Xcode iOS Simulator、Harmony 33-task unsigned HAP 与 macOS Tauri bundle 均通过。最终 APK 为 8,789,280 bytes / `c07470eddb3507ba956fb9e3ae7be235473880ea38a9859c9d71939190dc0cfd`，已覆盖安装到 OPPO 并从设备回读一致，进程 27880 且无 crash/ANR；真机已验证弹层、IME 不遮挡、第一次 Back 只收键盘/第二次关弹层、新建、重命名及焦点、删除取消/确认/活动回退、清空取消，临时分组删除后原“默认”7 条成绩完整。TalkBack、横屏/大字及其他平台实体设备仍待验。Harmony HAP 为 9,530,319 bytes / `4cda90930301bdc351e04e009ecfbe0aa1607599d01dfd98decf4b1303f55a78`；macOS x64 DMG 为 6,448,538 bytes / `f2b38037ad6e555f8487c5849cf6f682a5b5954885535be949c45e3b608d4bd8` 且 `hdiutil verify` 有效。

### 阶段 2A：五端一次到位架构

- [x] 仓库所有者确认 Android、iOS、HarmonyOS NEXT、Windows、macOS 均为正式客户端目标；PWA 不替代 Windows/macOS 客户端完成口径。
- [x] 建立 [五端 App 单一来源合同](./cross-platform-app-contract.md)，锁定 Capacitor Mobile、Harmony ArkWeb、Tauri Desktop 与共享层的依赖方向。
- [ ] 完成现有 Web/五端计时器迁移，使 `@cuberoot/timer-ui` 覆盖网站 `/timer` 的完整可达功能，不留宿主私有业务副本。
- [x] 已从 Mobile 提取有真实多宿主消费者的 `@cuberoot/app-ui`；Mobile、Desktop 和 Harmony 只通过公开入口消费，无 app→app 源码或 `dist` 依赖。
- [x] 已建立 `core/apps/desktop`，Windows 和 macOS 共用同一 Tauri 工程。
- [ ] Desktop 两平台构建、安装、实体机功能、签名与发布验收完成。macOS 本机已有可启动 `.app` 和经 `hdiutil verify` 的未签名 DMG；Windows 只有 CI 定义，尚无实际 run 证据。
- [ ] `core/apps/harmony` 完成设备安装、ArkWeb/bridge 交互、BLE、签名与发布验收。ArkWeb 本地 bundle、ArkTS bridge 和 unsigned HAP 已本地构建成功，但当前 `hdc` 无设备，不能记为鸿蒙适配完成。
- [ ] BLE、安全存储、认证、文件、分享、打印、保亮和生命周期 capability contracts 与宿主 adapters 逐项完成。Desktop BLEC 与 Harmony ConnectivityKit adapter 均接入共享 GAN 连接逻辑，但两端都没有实机 BLE 证据。
- [ ] 建立五端 build/安装/真机或实体电脑/签名/发布矩阵；五端全部通过前总体状态保持 `NOT COMPLETE`。

当前证据：

- `@cuberoot/app-ui` 已是五端唯一 React 产品层；`@cuberoot/app-ui` typecheck 与自动化测试已本地通过。
- Desktop 源码已共用 Tauri 宿主、系统 keyring、深链、外链和 BLEC transport，BLEC 复用 `@cuberoot/app-ui` 中的同一 GAN connection 逻辑。2026-09-01 当前源码的 macOS `CubeRoot.app` 已启动；`CubeRoot_0.1.0_x64.dmg` 为 6,297,645 bytes，`hdiutil verify` 通过，SHA-256 为 `94af17fe41d3dade835ebe929a83858d6d2ea0ff2acfc386c5fea29bf3d61fea`。该包未签名、未公证，也没有实机 BLE 证据。Windows CI 矩阵只是已定义的待运行检查；本机交叉 `cargo check` 缺 Windows `llvm-rc`，不能当作 Windows 构建/安装证据。
- Harmony 的本地 Web bundle、ArkWeb/ArkTS bridge、ConnectivityKit BLE bridge、安全存储与 unsigned HAP 已通过官方 Hvigor 构建。2026-09-01 在当前 Intel `x86_64` Mac 上使用 DevEco Studio `26.0.0.821` 的官方 SDK 再次执行 `assembleHap`，日志为 `BUILD SUCCESSFUL`，产物是 `entry-default-unsigned.hap`。当前 `hdc list targets` 为 `[Empty]`，所以安装、ArkWeb 运行、系统交互、真实 GAN 16 UI BLE、签名和发布仍未验收，`HARMONY-01` 保持进行中。
- Harmony 首次 BLE 现由 `UIAbilityContext` 显式请求 `ACCESS_BLUETOOTH`，Asset Store 机密限定为 `DEVICE_UNLOCKED`，系统备份关闭，native 版本由 build guard 对齐 `package.json`；BLE connect 以 generation + GATT identity 拒绝超时连接的迟到回调，避免同设备快速重连被旧请求断开。ArkTS/HAP 目前只能在已安装的官方 CLT 上本地编译；GitHub CI 尚无官方 Harmony SDK runner，不能把 Vite build 当成 native 回归。所有者已完成华为企业开发者认证；自动调试签名现因未连接 HarmonyOS NEXT 设备而无法生成 profile，`build-profile.json5` 的 `signingConfigs` 仍为空，Hvigor 明确跳过签名。模拟器不需要签名，真机才需要把设备写入调试 profile；不得为绕过设备门槛手填、生成或提交 `.p12`、密码或本机 profile。
- Desktop BLE 扫描已按插件真实异步回调等待并在 8 秒后 `stopScan`；但 `tauri-plugin-blec 0.12.0` 的通知队列容量为 1，快速转动时的上游 `try_send(...).expect(...)` 仍须用 GAN 16 UI 做压力测试，复现后优先升级或最小 patch upstream，不能用 mock test 宣布稳定。
- Android 对不支持安全 main-frame message listener 的旧 WebView 启动即 fail closed，并锁定 release manifest 的 10 项权限及 legacy 权限 `maxSdkVersion=30`/扫描 `neverForLocation`。Capacitor 内部仍注册 Cookies/Http/SystemBars 辅助 JS interface；通用 plugin dispatcher 已主 frame 隔离，但远端 iframe 的 cookie 边界仍是发布前 P2 审核项，文档不得声称“所有原生接口均仅主 frame”。
- `@cuberoot/app-ui` 已接真实 2/3/4 人 `LocalBattleMode` 与 `NetBattleMode`，三个宿主均注入同一联机 client/session contract；本地模式已有原子轮次、胜场/次数/最佳、按键冲突交换、共享一颗智能魔方轮换与打乱失败的 12 秒超时/原位重试；联机已有 WCA 身份、邀请二维码、房主转让/踢人、历史打乱及 single/ao5/mean。Web 仍有另一套 Battle/Net React 视图，完整设置/视频/每人独立 BLE/高级历史展示、staged API 部署、真实双设备和五平台交互仍未完成。
- API CORS 与网站 embed bridge 已在本地源码加入 Tauri origins，但本轮未 push/部署；不能把本地代码写成生产 Desktop Tools/Account/登录已通。

#### 三栏验收进度

稳定 ID 和验收含义定义在 [mobile-three-tab-contract.md](./mobile-three-tab-contract.md)；状态和证据只在本表更新。

| ID | 状态 | 当前证据/缺口 |
| --- | --- | --- |
| NAV-01 | 进行中 | 五端源码均消费 `@cuberoot/app-ui`；OPPO 三栏点击通过，其余四端交互验收未齐 |
| NAV-02 | 进行中 | 两个 iframe 持久挂载并复用同一生命周期；本地 bridge 重试/可信 ACK 与返回协议已接线，但生产站 bridge 尚未部署，OPPO 子页系统返回仍会直接回计时；待部署后五端回归 |
| WEB-01 | 进行中 | OPPO 已加载生产 `/zh`，62 个真实链接/卡片可枚举，360 CSS px 无横向溢出；其余四端尚无同状态实证 |
| WEB-02 | 进行中 | OPPO 已实点“模拟”进入 `/zh/sim?puzzle=3&img_dist=6`；全卡片及页内功能矩阵未完成 |
| WEB-03 | 进行中 | shared 导航/外链协议与宿主 back/openExternal 已在本地源码实现；生产 bridge 尚未部署，下载/分享/文件/全屏和五端实机待验 |
| WEB-04 | 未开始 | 待建立受限页面清单、Browser 回退和明确提示 |
| ACC-01 | 进行中 | OPPO 已实证未改写的 `/zh/account`，邮箱/密码/手机/WCA/Google/微信/支付宝全部可见且 360 CSS px 无横向溢出；其余四端尚无同状态确认 |
| ACC-02 | 进行中 | canonical LoginForm 交互已委托系统浏览器；待生产部署、五端各 provider 真实账号与绑定/解绑验收 |
| ACC-03 | 进行中 | Browser PKCE→secure session→带 requestId 的 web ticket→iframe 及双向 logout clear 已接线；协议兼容、并发启动和未完成 PKCE 重开复用已有单测，10 秒票据超时已实现但迟到结果/真实 provider 仍待生产 E2E |
| IOS-01 | 进行中 | Android/iOS 共用 `@cuberoot/app-ui` 和同一 Capacitor 宿主；待 iOS 完整互动验收 |
| IOS-LOGIN-01 | BLOCKED | 网站唯一 LoginForm/后端尚无已验证的 Apple 4.8 等价登录 |
| QA-01 | 进行中 | OPPO 已实测 Wi-Fi/移动数据同时关闭时 Tools 保留 iframe 上下文并显示“离线”，遮罩期间 iframe 退出无障碍焦点且系统返回直接回计时；恢复网络后自动回到生产 `/zh`，全程 360/360；弱网、网站 5xx 与 frame 拒绝仍待可观测 bridge 或通用宿主能力后注入 |
| QA-02 | 进行中 | OPPO Tools/Account 主内容为 360/360，但生产首页 DeskPet 固定层右缘仍约溢出 30 CSS px；五端全弹层/键盘/安全区/动态字号仍未关闭 |
| XPLAT-01 | 已完成 | `@cuberoot/app-ui` 已有 Mobile、Desktop 和 Harmony 真实消费者，无 app→app import |
| DESKTOP-01 | 进行中 | 同一 Tauri 工程与 BLEC adapter 已落地；macOS `.app` 已启动、未签名 DMG 已校验，Windows CI 定义未实际跑；签名/公证、Windows 构建安装和两端 BLE 证据未齐 |
| HARMONY-01 | 进行中 | ArkWeb 本地 bundle、ArkTS/系统 bridge 与 unsigned HAP 已构建；当前 Intel Mac 不支持 DevEco 本地模拟器且无 `hdc` 设备。待 Apple silicon Mac mini 到货后创建模拟器，安装、运行、BLE、签名和发布证据仍待验 |

### 阶段 3：PWA 补强和网站兜底

- [ ] 完成 manifest、图标、启动 URL 和 standalone 行为复核。
  - [x] `manifest.json`、`start_url`、`display: standalone`、192/512/maskable 图标和 iOS touch icon 已有静态测试覆盖。
  - [ ] Android/iPhone 添加到主屏后的独立窗口、语言入口和启动恢复仍需实体设备验证。
- [ ] 实现明确边界的离线缓存、升级、回滚和清理策略。
  - [x] 已确认当前 Next 站点不注册新 Service Worker，`/sw.js` 只负责清退旧 Vite 缓存，避免把整站误标成离线可用。
  - [ ] 若以后启用 PWA 离线，仅缓存明确列出的静态壳和数据版本，不缓存登录/API 写请求。
- [ ] 验证断网刷新、账号隔离及 COOP/COEP 特殊路由。

### 阶段 4：Android 基础 MVP

- [ ] 固定“计时 / 工具 / 我的”三栏按 [mobile-three-tab-contract.md](./mobile-three-tab-contract.md) 全部验收；基础三栏和分组主路径已落地，子页、全局返回/异常、TalkBack 与双平台真机矩阵未完成。
- [x] 触摸计时、检查时间、`+2`、DNF、删除和备注闭环。
- [ ] WCA 打乱、项目、session、PB、平均和基础趋势闭环。
  - [x] 三阶 WCA 风格打乱、记录数、最佳、ao5 和 ao12 已完成。
  - [ ] 多项目、session、PB 里程碑和趋势图尚未完成。
- [x] 本地数据库、schema 迁移、进程重启恢复和数据导出闭环。
  - [x] IndexedDB 仓储、版本字段、输入校验、串行写入、进程重启恢复、JSON 导入和导出已完成。
  - [x] 网站 v1/v2/v3 与 App envelope 共用一条校验/迁移链，双向备份 fixture、10 MB 上限、导入预览、原子恢复点和单次撤销已覆盖。
- [ ] 公式集拉取、离线缓存和训练闭环。
- [ ] 英文/简体中文、深浅主题、保亮、震动、分享和深链闭环。
  - [x] 英文、简体中文、系统/浅色/深色主题和 JSON 文件导入导出已完成。
  - [x] 观察和计时阶段已接入标准屏幕保亮，停止后立即释放；ready/stop 已接入官方 Capacitor Haptics，并有状态策略测试与 Android 构建证据。
  - [x] 计时器打印已由 Web/Android/iOS 共用同一 React 报告 DOM 和生命周期；Android/iOS 只保留薄系统打印桥，中文/英文 A4 PDF 已完成自动化与逐页渲染验收。
  - [x] OPPO Reno7 Pro 5G 已从 App 共用 More 菜单打开 ColorOS 系统打印预览；中文报告可见，取消后返回 App 且打印 portal/body class 清理完成。
  - [ ] iOS 原生打印面板、取消/完成回调，以及 Android/iOS 真实保存/纸张输出仍须分别实测；当前只有 Xcode 26.6 / iOS 26.5 Simulator SDK 编译与 iPhone 17 模拟器安装启动证据。
  - [ ] 系统文件分享、保亮和震动仍需 Android 真机实测；深链尚未完成。
- [ ] API client 的超时、认证、错误和版本头统一。
- [ ] TalkBack、动态字号、对比度和触摸目标基础检查通过。
- [ ] 生成并验证 Android 内部测试 AAB。
  - [x] 本机已用临时上传密钥生成并验证签名 Release APK/AAB；CI 也使用临时密钥强制验证 release 签名、版本和完整权限白名单。
  - [ ] Play App Signing 的真实上传密钥、internal track 安装/升级和回滚尚未验证；需要已通过验证的发布账号。
- [x] 完成当时 Android MVP 范围的代码正确性、复用维护性和发布合规三路 agent 审计；当时范围无新增阻断，iOS Apple 4.8 等后续 P0 仍保持未完成。

当前阶段 4 证据：

- 本地 MVP 以本节可重跑测试、构建产物和设备记录为证据；不保留 rebase 前的失效短 SHA。
- 移动端仓储 10 项测试、网站计时/迁移/元数据/品牌资源 47 项定向测试、共享包构建、网站与移动端 typecheck 全部通过。
- `cap:sync`、`assembleDebug`、`assembleRelease` 和 `bundleRelease` 已通过；本地签名 AAB 经 `jarsigner` 验证。
- JDK 21、Android API 36、Gradle 8.14.3 与硬件加速模拟器已在 macOS 命令行复核；保亮/震动增量通过移动端测试、typecheck、Capacitor Android sync 与 Debug APK 构建。Pixel API 36 模拟器实测运行时持有 App 的 `SCREEN_BRIGHT_WAKE_LOCK`，停表后释放；`dumpsys vibrator_manager` 记录到 `me.cuberoot.app.debug` 的 ready/stop 触觉事件。
- Release 元数据实测为 `versionName 0.1.0`、`versionCode 1000`、`targetSdk 36`；当前 Debug APK 合并 manifest 已复核网络、震动、Android 12+ 附近设备，以及仅限 API 30 以下的旧版 Bluetooth/定位兼容权限。没有相机、麦克风、存储或通知权限，BLE 硬件 `required=false`。
- MuMu 冷启动约 1.25 秒；杀进程后的记录、语言和主题仍保留，设置页可见隐私、支持和版本入口。
- 品牌资源由网站现有图标生成，CI 会重新生成并检查差异，避免维护第二套手工图片。

### 阶段 5：原生智能魔方

- [ ] Android BLE 权限、可选硬件声明和权限拒绝恢复完成。
- [ ] Native BLE transport 的扫描、连接、读写、通知、MTU 和断线事件完成。
- [x] 至少一个真实型号端到端跑通，并建立首条设备/系统矩阵记录。（OPPO Reno7 Pro 5G + GAN 16 UI）
- [ ] 掉通知、后台、蓝牙关闭、距离中断和最终一步恢复验证通过。
- [ ] 脱敏诊断导出和无需实体魔方的审核 demo 模式完成。

当前决策与目标设备：

- 首测手机：OPPO Reno7 Pro 5G `PFDM00`（Android 13 / ColorOS 13.1）；首测魔方：GAN 16 UI（GAN v4）。
- 原生 transport 采用 `@capacitor-community/bluetooth-le` 8.x 的薄 adapter；选择依据是 Capacitor 8 同主版本、Android/iOS central BLE、manufacturer data、读写、通知、断线和 MTU 能力齐全。GAN 协议继续复用 `@cuberoot/shared/smart-cube/gan-v4`；网站保留 Web Bluetooth adapter，不复制协议、不从 client deep import。
- Capawesome BLE 因本项目不需要其付费的 peripheral/headless/foreground 扩展而不选；Capgo Web Bluetooth shim 因设备选择语义受限且会把 Mobile 重新耦合到浏览器 GATT 对象而不选。只有社区插件真机 spike 暴露无法补齐的硬阻断时，才重开插件或自有原生桥决策。
- 真机证据已覆盖 Android 13 附近设备授权、扫描、选择、连接、服务发现、写命令、通知、GAN v4 解密、状态帧与真实转动解析。2026-08-30 进一步实测打乱匹配后自动预备、第一手起表、复原自动停表并保存 `5.20`，统计从 `3/3` 更新为 `4/4` 后自动切换下一条比赛打乱。权限拒绝恢复、后台、蓝牙关闭、距离中断和反复重连仍是独立未完成门槛。
- 2026-09-01 的 shared 指引/修正与 Solo lifecycle controller 已通过 Web/App 延迟 requester、同 target coalesce、新 target 续跑、协议错拒绝晚帧、同批帧、连接/切题后 authoritative state 重放、一次性完成 edge 与 43 项能力矩阵回归；Android APK 为 8,788,904 bytes、SHA-256 `5cc6b17112332c4c1e814b7495852365f761e951f0ee6b6fc8d046b3b7935ce7`，已安装到同一 OPPO 且与设备内 `base.apk` 字节一致。实体 GAN 新路径未在解锁屏幕上复验，故本阶段仍不完成。
- 2026-09-01 的成绩对比已由 Web/五端共用 shared model 与 timer-ui modal；selection 携带 session+event context 并在 render 阶段 fail closed。四包 typecheck、32+5 定向回归、Mobile production build、Capacitor Android sync 与 `assembleDebug` 通过。最新 Debug APK SHA-256 为 `9aed714e5107dfdd424556391d0bdc8348ad2aa2aa9440eaf28818795ed258a0`，已覆盖安装到 OPPO；设备仍锁屏，故该条不作为成绩对比视觉/交互或 GAN 实拧证据。
- 2026-09-01 的 CFOP 分段与 BLD memo 已从 Web 私有 hooks 收敛为 shared `TimerAttemptSplitRecorder`、canonical `stageSegmentsFor` 与 timer-ui status/settings。Web/五端共用键盘、44px 触摸、设置、停表落盘和 legacy migration；BLD 项目禁止智能魔方首手自动起表，避免漏掉记忆时间。当前只有类型检查与自动化证据，Android 新包及解锁后的 OPPO 分段/BLD/GAN 实测仍待本轮后续记录。
- 2026-09-01 的基础成绩详情已收敛为 shared 派生规则与 `@cuberoot/timer-ui/TimerSolveDetailModal`；Web 和五端共用原始/生效成绩、日期、4 罚时、打乱、CFOP/BLD/MBLD、备注、移组、删除、焦点和关闭 DOM。Web 只动态注入既有重型复盘，App 只注入宿主预览；Android Back 会先触发备注失焦保存，详情按 session+event context fail closed，字段级更新和异步关闭 identity gate 防止丢更新/误关新详情。Client 3 files / 8 tests、App 3 files / 43 tests、四包 typecheck、Mobile build/sync 与 304-task `assembleDebug` 通过；两名独立 agent 最终 GO。8,788,904-byte Debug APK SHA-256 为 `34996ebbcac28b655b4ad163793e522dc29ad1af7c3cd79ad2a35f9270c32c03`，已覆盖安装到 OPPO 且设备内 `base.apk` hash 一致，进程启动无 crash/ANR。手机前台仍是 `NotificationShade`，所以详情视觉/点击没有冒充通过；该时点的非 NxN 预览缺口已由下一条关闭，完整复盘仍未共享。
- 2026-09-01 的网站/五端打乱预览已收敛到 `@cuberoot/timer-ui/TimerCubePreview`/`TimerScramblePreview`；NxN、Clock、Pyraminx、Skewb、FTO 复用 cubing.js，SQ1/Megaminx renderer 迁入既有 `puzzle-render-core`，Web 旧路径只兼容 re-export，App 私有 `ScrambleCube` 与多余 `visualcube` 依赖删除。坏手动题 fail closed 且下一条可恢复，宿主外层继续控制 152×114/120×90/矮横屏隐藏；极端 MBLD 在 320/360px Chromium 实测无裁切或横向溢出。共享预览 5/5、App 230/230、相关 typecheck、Mobile/Desktop/Harmony production build、Android sync 与 304-task `assembleDebug` 通过，独立 agent 最终 GO。8,789,280-byte Debug APK SHA-256 `b10ac740a2de615131ec3a5700443d68d4dee7a814d94fcf45340e90cf903c61` 已覆盖安装到 OPPO 且设备回读一致；设备仍在 `NotificationShade`，所以逐项目真机视觉/交互仍待解锁后验收。
- 2026-09-01 的基础复盘指标已收敛到 `@cuberoot/shared/timer/reconstruct/solve-metrics` 与 `@cuberoot/timer-ui/TimerReconstructMetrics`：Web 和五端共用 QTM/QTPS、首动延迟、最长停顿/次数算法与三张卡片，旧 Web 路径仅 identity re-export；Web 复用既有计算，compact 详情只在有动作时计算一次，full/report 不重复。3 files / 6 定向测试、5 files / 41 架构复用守卫、App 230/230、四包 typecheck、Mobile/Desktop/Harmony production build、Android sync 与 304-task `assembleDebug` 通过。8,789,280-byte Debug APK SHA-256 `1b465438efc0c885020641c11fdd0aa7e851a06c16417f73cc43dd08f37526fe` 已覆盖安装到 OPPO 且设备回读一致，进程 19717 无 crash/ANR。最新 iOS Simulator app 已由完整 Xcode build、安装并在 iPhone 17 启动；Harmony 34-task `assembleHap` 产出 9,522,434-byte unsigned HAP（SHA-256 `5750fc207b540085267616aacec7caa41ba06087406c9854a35beb30ae37738b`）；macOS Tauri 产出并启动 `.app`，6,446,677-byte x64 DMG（SHA-256 `2c72ab75d82621cab4ebd4a9b1cd506110536a9180f02ca7f871c73445f34d32`）通过 `hdiutil verify`。Android 仍在 `NotificationShade`，iOS 只验到计时页启动，Harmony 无设备，macOS 未进入有 moves 的详情，Windows 仍需原生机器；所以新指标卡视觉/点击与 GAN 实拧继续待设备验收，完整动作谱/时间线/回放/反馈仍未共享。
- 2026-09-01 的打乱图显示和 2D/3D 设置已收敛到 shared schema/default/normalizer、timer-ui 设置行与唯一 `TimerCubePreview`；App 单人/联网都从独立 `TimingSurface.cornerSlot` 渲染并以 `data-no-timer` 隔离拖动，不再嵌进可点击打乱条。对抗审查进一步锁定跨目标、跨 pointer 松手反例，联网计时面现仅接受自己捕获的 pointer 完成或取消，三名独立 agent 最终 GO。App 34 files / 232 tests、Client 13 files / 91 tests、四包 typecheck、skill validator、五端共享 Web build 和当前 Mac 可运行的四类原生构建通过。最终 Debug APK 为 8,789,280 bytes、SHA-256 `8d086683393d2cc203ac6aa7c0d764eb73fb5662cd78da4983e31e465a52fc00`，已覆盖安装到 OPPO 且设备回读一致；Harmony unsigned HAP 为 9,524,322 bytes / `7dc1abfb2bd2fd0c2e37a14f53a2f2e76d70313250d42c58c219c77eccc574a6`，macOS x64 DMG 为 6,446,983 bytes / `e24c0d4ab815e3c6671f0d41afd1deb89f4ff3862b14be8f83d6db46d38234c7` 并通过 `hdiutil verify`，iOS Simulator Xcode build 成功。Android 进程 23966 仍在锁屏通知层，exit-info 未见 crash/ANR，但本次锁屏启动仍有 safe-area/Capacitor bridge 初始化错误待解锁复跑，故新增开关、3D 拖动、无遮挡和启动完全正常均未记为真机通过；Windows 仍需 Windows 原生构建。

### 阶段 6：账号、同步和合规闭环

- [x] 原生安全会话交接固定为系统浏览器复用网站唯一 `LoginForm`；Account iframe 的邮箱/手机/密码和全部 SSO 交互都委托该 Browser PKCE 流。provider-null 交接只显示第一方凭据，provider-tagged 交接显示 canonical SSO 列表，不另建 Mobile 表单。
- [ ] 底栏“我的”使用未改写的 `/account` 并完整显示网站当前 provider 集；源码已移除 `auth=mobile`，待 Android 重装、iOS 和全 provider 真实账号验证。
- [ ] Account iframe、系统浏览器与 Keychain/Keystore 安全会话的登录、退出和注销双向同步完成。源码已接 Browser PKCE→secure session→90 秒 web ticket→iframe、iframe logout/delete→native clear、App logout→iframe clear；不传长期 JWT，不建第二套表单。待部署与 Android/iOS 全 provider E2E；iframe-only 旧会话和外部 Browser 独立 logout 仍未自动衔接。
- [ ] iOS 第三方主账号登录的 Apple 4.8 等价方式与发布证据完成。当前是 P0 `BLOCKED`；优先在网站唯一 `LoginForm`/后端同源实现 Sign in with Apple，不隐藏 provider 冒充 parity。
- [ ] 原生安全存储、token 刷新、匿名数据合并和多设备同步全部完成。
  - [x] Android/iOS 共用 PKCE + 一次性票据登录客户端，JWT 进入 Keychain/Keystore 保护的安全存储，并实现刷新、`/auth/me` 校验、离线保留和 401 清理。
  - [ ] 登录前本地记录合并、outbox、冲突和多设备同步尚未实现；App 已明确提示计时记录仍只在本机。
- [ ] outbox、幂等重试、冲突策略和旧版 API 兼容测试通过。
- [ ] App 内账号注销和网页删除入口端到端验证通过。（App 已提供退出、网站账号管理和网站注销入口；待部署与真实账号端到端验收）
- [ ] 三栏与完整 Account provider 数据流下的双语隐私政策、支持入口、本地数据删除、账号删除和 SDK/provider 清单重新核对完成。旧“只有邮箱/手机系统浏览器登录”草稿不再是最终构建事实。
- [ ] 当前本地 MVP 的隐私政策补入最终组织身份并线上发布。（当前未 push，线上 URL 尚不可作为证据）
- [ ] 服务条款、最终发布主体、服务端数据保留规则和数据请求流程完成发布验收。
- [ ] 重新核对 `0.1.0` 的 Google Data safety、Google Play 内容表和 Apple App Privacy 草稿。`docs/mobile-store-submission.md` 已更新为三栏 Web surface、完整 provider 和冷离线失败的当前事实，但仍明确标为 `NOT SUBMISSION READY`，最终包/账号/控制台尚未复核。

### 阶段 7：Google Play 封闭测试

- [ ] Play internal track 的签名 AAB、升级和回滚验证通过。
- [ ] 根据组织账号 Play Console 显示的实际要求完成测试；若账号被明确要求 closed test，再按控制台给出的测试人数和时长执行。
- [ ] 离线、同步、BLE、后台、升级、注销和设备矩阵反馈闭环。
- [ ] Production access 获批，商店说明、截图、图标、内容评级和隐私资料完成。
  - [ ] 双语商店说明、版本说明、审核备注、Data safety、内容表和提交前复核清单已有草稿，但须按最终 provider、权限、archive 隐私报告和真机证据复核后才能完成。
  - [ ] feature graphic、Android 真机截图、公开组织资料、目标受众及控制台实际问卷尚待完成。

### 阶段 8：Android 正式发布

- [ ] 已测试的同一构建分阶段放量，监控崩溃、ANR、登录、同步、BLE 和 API。
- [ ] 100% 放量且无已知 P0/P1，记录版本号、commit、AAB digest 和商店状态。
- [ ] 上传密钥、恢复资料、上一版兼容和暂停发布能力验证完成。

### 阶段 9：iOS 移植与 TestFlight

- [x] 已准备 Mac、Xcode 26.6 正式版和 iPhone 真机。（本机实测 Xcode 26.6 build 17F113、iOS SDK 26.5；设备由所有者确认，尚未作为真机构建/签名证据）
- [ ] 确认 Apple Developer Program 付费个人会员已激活，且 Xcode 显示可用于发布的付费 Team。
- [ ] iOS 工程、签名、Core Bluetooth、Keychain、Universal Links 和分享完成。
- [x] 已在同一个 React + Vite + Capacitor 8 App 中加入并维护 iOS 工程；`@capacitor/ios` 与 Core/CLI/Android 同为 `8.5.0`，App ID 为 `me.cuberoot.app`，未另写 iOS 业务 UI。
- [x] 已完成 mobile 测试、typecheck、production build、`cap sync ios`、无签名 iOS Simulator 编译、安装和启动验证；iOS 26.5 的 iPhone 模拟器可见并运行 CubeRoot。
- [x] iOS App Icon 与深浅启动图复用网站 canonical SVG，经 `assets:ios` 机械生成并纳入 CI 漂移检查；Xcode asset catalog 编译通过。模拟器因系统启动快照缓存尚未留下“启动 logo 可见”的截图证据，因此这里只记录生成与编译事实。
- [x] React 主应用保持异步加载，HTML 与 `Suspense` 两层均复用同一个 `loading-screen` 品牌壳；最终 Simulator 安装后的时间点截图显示约 1 秒仍为 iOS 缓存的原生启动快照、约 3 秒出现 `CubeRoot` 品牌壳、约 5 秒进入共用计时器，且由启动壳回归测试锁定。
- [x] iOS 模拟器已验证真实比赛打乱在线获取、共享项目图标、共享七段计时界面和共享展开魔方图。
- [x] 真实比赛打乱采用 50 条、固定抓取时间起算 7 天的有界缓存；缓存过期、去重以及错误项目/记号过滤由移动端测试覆盖，不把 130 万条比赛打乱打进安装包。已映射项目冷离线无缓存时明确失败，不用随机题冒充比赛真题；无映射项目才按网站契约使用同项目本地 provider。
- [ ] 在 iOS 模拟器实际执行一次无缓存断网冷启动并保存取证。（当前只有在线模拟器画面和自动化测试证据）
- [x] Xcode 工程当前保持 Automatic Signing，Debug/Release Bundle ID 均为 `me.cuberoot.app`；付费 Team 尚未选择，不能作为签名成功证据。
- [ ] iOS GAN v4 transport 已能在原生 picker 返回 UUID 后，通过 manufacturer advertisement 提取协议所需 MAC，并有握手单测；仍需 Apple 账号恢复后用 iPhone + GAN 16 UI 验证扫描、连接、解密、转动、自动起停与断线恢复。
- [x] 同一移动端 Web 构建已重新同步 Android，并在本机用 JDK 21 完成既有 `assembleRelease`/`bundleRelease` 与本轮 `assembleDebug`；当前 Debug APK 为 8,788,813 bytes（SHA-256 `04553497db3a00d8b2d702d9ade9566212e263b0f9b2030cb2b4b9c6857f0fb9`），已重装到 OPPO Reno7 Pro 5G；真实 3×3 打乱、Capacitor Clipboard、Tools 断网恢复、断网时系统返回回计时和完整 Account 首屏均通过真机回归。
- [ ] iOS 权限、后台、系统中断、安全区、动态字体和 VoiceOver 验证通过。
- [ ] 网站唯一 `LoginForm`/后端提供满足 Apple 4.8 的等价登录（优先 Sign in with Apple），且完成全 provider、会话衔接、TestFlight 和 App Store 审核取证。（当前 P0 `BLOCKED`）
- [ ] App Store 审核通过，且业务逻辑未复制为 iOS 专属实现。

当前 iOS 证据与阻塞：

- `xcodebuild` 使用 Xcode 26.6、iOS Simulator SDK 26.5 完成 Debug 构建；`simctl install` 和 `simctl launch` 对 `me.cuberoot.app` 成功。
- iOS 原生工程只承载 Capacitor 壳，计时 UI、项目图标和魔方展开图分别复用 `@cuberoot/timer-ui`、`@cuberoot/event-icon` 和 `@cuberoot/visualcube`；架构边界守卫与相关定向测试通过。
- 小程序的计时页已确认只是指向网站 `/zh/timer` 的 WebView；移动 App 以该真实网站界面为产品事实源，但不跨 app 导入小程序源码。计时器状态正按 `docs/mobile-timer-parity-tracker.md` 与零遗漏审计迁到 shared/timer-ui；迁移未完成，未接真实行为的控件不能用占位、外跳或隐藏冒充完成。当前仍是 `ACTIVE — NOT COMPLETE`。
- Android/iOS 原生安全会话交接共用一个 React/Capacitor 客户端和网站唯一 `LoginForm`；服务端使用 90 秒单次 ticket、PKCE S256 与原子核销，原生会话进入 Keychain/Keystore 保护的安全存储。底栏 Account 是未改写的网站 `/account` surface并显示全部当前 provider；源码已把其所有登录入口交给 Browser，并用另一张 90 秒 web ticket 回灌 iframe，也同步 iframe/App logout。协议、错误和账号响应继续复用 shared 契约，不建第二套账号系统；生产部署、真实 OAuth 回跳、异常恢复、绑定/解绑、退出和注销仍需双平台端到端验收。
- Apple Developer 账号当前登录异常，所有者计划联系 Apple；因此会员 Active、付费 Team、真机签名、Archive 和 TestFlight 均保持未勾选。

### 阶段 10：全球发布和长期维护

- [x] 建立仓库内 `cuberoot-mobile` Codex skill，统一单代码库、双机交接、iOS 发版与签名安全流程。（结构校验、成对 eval 和独立审计通过）
- [x] 将 skill 和路线图升级为五端单一来源合同；未来 AI 不得为 HarmonyOS、Windows 或 macOS 新建业务 UI 分叉。
- [ ] 五端宿主、按真实消费者提取的 capability contracts、跨端 CI 和完整验收矩阵全部落地。
- [ ] 按地区和质量指标逐步扩大可用范围。
- [ ] 发布 runbook、版本支持矩阵、政策/证书日历和质量看板完成。
- [ ] 建立每月发版、季度兼容测试、半年隐私复核和年度账号维护节奏。

## 1. 先说结论

CubeRoot 最适合的路线不是把 App 启动运行时整体改成远程网站 WebView，也不是为五个平台各写一遍，而是：一个共享 React 产品层负责完整三栏体验，网站继续提供 canonical Tools/Account 页面，每个平台只有薄宿主和系统能力 adapter。

1. 网站继续负责完整内容、SEO、后台、长文和重型工具。
2. Android/iOS 继续使用同一个 React + Vite + Capacitor 宿主；不迁移或重写已经成立的移动端工程。
3. HarmonyOS NEXT 使用 ArkTS + ArkWeb 薄宿主，Windows/macOS 使用同一个 Tauri 桌面宿主；三者消费同一 React App 和共享包。
4. 从现有网站提取计时、训练、公式、同步和智能魔方协议中的纯逻辑，网站和五端共用。
5. 五个平台只分别实现必须原生化的能力：BLE、权限、安全存储、通知、震动、保亮、深链、分享、文件和生命周期。
6. 公式、统计、比赛、公告等内容继续由现有 API/静态数据提供；这些内容更新后无需重新上架。
7. 只有打包进 App 的界面、宿主或原生代码发生变化时，才构建对应平台新版本并经过其发布流程。

推荐首发范围：

- 本地优先的计时器、打乱和训练记录。
- 原生智能魔方连接。
- 公式训练和离线缓存。
- 登录、同步、语言、主题、深链和分享。
- 少量真正适合手机的 WCA/比赛提醒。

首发暂不原生重写（仍可从“工具”进入网站唯一页面）：

- 管理后台和内容编辑器。
- 大型统计图表和低频 WCA 数据页。
- 数学、百科、规则等长文全集。
- 重型视频复盘、超大 WASM 求解器和小众工具全集。
- 任何只为“App 看起来功能多”而复制的网页。

## 2. 项目目标和非目标

### 2.1 目标

- 从现在起按 Android、iOS、HarmonyOS NEXT、Windows、macOS 五端一次设计和追踪，不把后三端留作模糊的远期可能性。
- Android/iOS 共用 Capacitor Mobile；Windows/macOS 共用 Tauri Desktop；HarmonyOS 只增加 ArkWeb 薄宿主。
- 五端共用同一业务、React 产品层、账号、数据、对战和智能魔方协议，不从任一 app 复制到另一 app。
- 网站内容更新时，App 尽量自动读取新内容，不要求同步改两份。
- App 离线时仍能计时、查看已缓存公式、训练和保存记录。
- iOS 用户能直接连接智能魔方，不再依赖 Bluefy。
- 支持英文和简体中文，并允许在商店支持的国家和地区尽量广泛分发。
- 发布、签名、测试、上传和商店资料逐步自动化。
- 保持 API 向后兼容，允许旧版 App 在用户未及时升级时继续工作。

### 2.2 非目标

- 不用“先做一个删减版，以后再补”降低已纳入合同的三栏或 `/timer` 完整度。
- 不维护 React Web、Android、iOS、HarmonyOS、Windows、macOS 六套业务 UI。
- 不把远程网站 URL 当成 App 的主要运行代码。
- 不在没有实体设备验证的情况下承诺支持某个智能魔方型号。
- 不把“中国大陆 Android 全渠道分发”误认为勾选一个国家即可完成。
- 不以绕过审核为目的伪报应用类别、数据用途或账号类型。

## 3. CubeRoot 现状审计

### 3.1 已经可以复用的基础

当前仓库已经具备：

- Next.js 网站和统一的中英文语言边界。
- `manifest.json`、192/512 图标、maskable 图标和 standalone 显示模式。
- 移动端安全区和窄屏适配基础。
- 现有 Hono API、账号系统、WCA OAuth、内容数据库和静态统计数据。
- 计时器、打乱、训练、模拟器以及大量智能魔方协议实现。
- GAN、Giiker、GoCube、MoYu、QiYi 等设备协议和合成测试基础。
- 完整的账号注销后端清理清单。
- GitHub Actions、Next 部署和后端迁移管道，可继续扩展移动端构建。

### 3.2 不能直接当作移动 App 的部分

- 当前 `sw.js` 是清除旧 Service Worker 的 kill-switch，不是真正离线缓存实现。
- 当前智能魔方入口直接依赖 `navigator.bluetooth`；iOS Safari 不提供 Web Bluetooth，因此网站需要 Bluefy。
- 当前 Next.js App Router 包含服务端路由、动态页面、代理和构建期行为，不能直接假设能导出成一个完整静态目录给 Capacitor。
- 部分求解器依赖 COOP/COEP、Worker、WASM 和大资源，不能直接全量搬入移动壳。
- 页面组件中可能含 Next 路由、服务端组件、浏览器 API 和网站布局依赖，需要先区分“纯逻辑”和“网站专属 UI”。

### 3.3 对架构的直接影响

因此移动端应新建独立入口，而不是修改现有 Next 配置强行静态导出整站。复用应发生在以下层级：

- 数据结构、校验、算法和状态机。
- 计时器核心、训练调度和智能魔方协议解析。
- API client、认证模型和同步规则。
- 不依赖 Next 的轻量 React 组件。
- 设计 token、图标和双语文案资源。

以下内容保留平台实现：

- Next 路由、SEO 和服务端渲染属于网站。
- Capacitor 导航、原生桥、权限和离线数据库属于 App。
- BLE 扫描连接由 Android/iOS 原生层负责；协议解析尽量共用 TypeScript。

## 4. 同行通常怎么做

成熟产品通常不是把网站完整复刻到手机，而是共享账号、数据和后端，再为移动场景挑选高频工作流、离线能力和系统能力。

本节是 App 总体信息架构的行业背景，不得覆盖仓库所有者后来明确提出的 `/timer` 完整一致合同：计时器的数据与 UI/UX parity 同为硬门槛，不能再用“移动端聚焦”删减网站已有计时功能。工具和“我的”继续通过网站唯一 surface 避免复制。

| 产品 | 移动端重点 | 对 CubeRoot 的启发 | 官方资料 |
|---|---|---|---|
| GitHub | 通知、收件箱、评审和移动工作流与网站同步 | App 聚焦随手处理，不必搬完整开发后台 | [GitHub 通知设置](https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications) |
| Notion | 共享同一工作区和数据，但移动端承认部分桌面能力有限；按页面提供离线使用 | 共享数据源，明确哪些页面适合离线，不假装移动端与桌面完全相同 | [Notion 移动端](https://www.notion.com/help/notion-for-mobile)、[离线页面](https://www.notion.com/help/use-pages-offline) |
| Linear | 手机端聚焦查看、更新、创建和通知，复杂管理仍更适合桌面 | CubeRoot App 应优先计时、训练、连接和提醒 | [Linear 移动端](https://linear.app/docs/get-the-app) |
| Steam | 手机端强化登录确认、商店、聊天和通知等原生场景 | App 可以承担系统通知和认证辅助，而非复刻全部 PC 能力 | [Steam Mobile](https://store.steampowered.com/mobile/?l=english&show=steamapp) |
| ChatGPT | 在手机上强化语音、相机、屏幕分享等设备能力 | 原生 App 的价值应来自 BLE、相机、震动和系统集成 | [ChatGPT 语音模式](https://help.openai.com/en/articles/20001274) |
| Spotify | 账号和内容云端共享，移动端对下载内容提供离线播放 | 训练素材和公式可选择性下载，不能把所有数据无条件缓存 | [Spotify 离线使用](https://support.spotify.com/us/article/listen-offline/) |

可复用的行业规律：

1. 一个账号和一个后端，而不是网站账号与 App 账号分裂。
2. 默认产品面先共享账号和数据；已明确列入 parity 合同的 `/timer` 则必须同时达到完整功能与 UI/UX 一致。
3. 手机端围绕高频动作和硬件能力设计。
4. 离线是明确选择和状态，不是“缓存应该碰巧能用”。
5. 管理、长文和重型操作可以留在网站。
6. App 能链接回网站，但核心体验不能只是一个网站浏览器。

## 5. 技术路线选择

### 5.1 方案比较

| 方案 | 现有代码复用 | 原生 BLE | iOS | 长期维护 | 审核风险 | 结论 |
|---|---:|---:|---:|---:|---:|---|
| 纯 PWA | 高 | Android 部分可用，iOS 不可用 | 无商店级原生能力 | 最低 | 无 App Store 产品 | 保留为网站增强，不是最终 App |
| 纯 WebView / 启动即远程 URL 整站套壳 | 很高 | 需要额外桥接 | 可做 | 表面低、实际易碎 | Apple 4.2 风险高 | 不作为正式路线；不否定三栏内受控的工具/Account 在线 surface |
| Android TWA | 很高 | 仍受 Web 能力限制 | 不支持 | 低 | Android 可行但价值有限 | 不选 |
| React Native / Expo | 中低 | 可用 | 可用 | 中 | 低 | 会重写较多 DOM/CSS 组件 |
| Flutter | 低 | 可用 | 可用 | 高 | 低 | 对本项目复用率太低 |
| 原生 Kotlin + Swift | 最低 | 最强 | 最强 | 最高 | 低 | 团队规模不合适 |
| React + Vite + Capacitor | 高 | 通过插件或自有桥可用 | 可用 | 较低 | 低到中 | Android/iOS 既定宿主 |
| 共享 React + Tauri Desktop | 高 | 通过插件或自有桥可用 | 不用于本项目 iOS | 较低 | 低到中 | Windows/macOS 共用宿主 |
| ArkTS + ArkWeb 薄宿主 | 高 | 通过鸿蒙 adapter | 不适用 | 中 | 待鸿蒙实测 | HarmonyOS NEXT 既定宿主，禁止 ArkUI 重写业务 UI |

### 5.2 为什么 Android/iOS 继续使用 Capacitor

- 继续使用 TypeScript、React、CSS 和现有前端知识。
- Android 可完全在 Windows 上开发和构建。
- 业务逻辑可与网站共享，不必为 iOS 重写一次。
- 能调用 Android BLE 和 Apple Core Bluetooth。
- 能接入通知、震动、保亮、分享、深链和本地存储。
- 最后仍生成真实 Android/iOS 工程，能进入官方商店。

需要接受的边界：

- 不能把现有 Next 运行目录直接等同于 Capacitor 的静态资源目录。
- 必须为移动端建立一个可输出 `index.html` 和静态资源的 Vite 应用。
- Capacitor 每次发布仍需把 Web bundle 复制到原生工程并重新构建。
- 原生插件、权限或打包代码变化仍需经过商店审核。

### 5.3 为什么不是一个原生框架强行覆盖五端

- 当前 Capacitor Android/iOS 已有真实构建和设备证据，迁移只会重做宿主，不会减少业务代码。
- Windows 和 macOS 需要的是一个共享桌面宿主；Tauri 可以复用同一 Web 前端，同时保留桌面窗口和系统 API 边界。
- HarmonyOS NEXT 需要 ArkTS/ArkWeb 与鸿蒙系统能力；不假定 Capacitor 或 Tauri 提供未经验证的一方正式支持。
- 真正的单一来源位于 `@cuberoot/shared`、`@cuberoot/timer-ui` 和已有多宿主消费者的 `@cuberoot/app-ui`，而不是要求所有平台使用同一个原生打包工具。

## 6. 推荐架构

```mermaid
flowchart TD
  DB[(PostgreSQL / 静态数据)] --> API[现有 Hono API]
  API --> WEB[Next.js 网站]
  API --> APP[共享 React App]
  CORE[共享 TypeScript 核心] --> WEB
  CORE --> APP
  UI[@cuberoot/timer-ui / app-ui] --> WEB
  UI --> APP
  APP --> MOBILE[Capacitor Mobile]
  APP --> HARMONY[ArkWeb Harmony]
  APP --> DESKTOP[Tauri Desktop]
  MOBILE --> ANDROID[Android adapters]
  MOBILE --> IOS[iOS adapters]
  HARMONY --> HOS[HarmonyOS adapters]
  DESKTOP --> WINDOWS[Windows adapters]
  DESKTOP --> MACOS[macOS adapters]
  APP --> LOCAL[(本地数据库 / outbox)]
  LOCAL <--> API
```

### 6.1 建议的代码边界

当前代码边界：

```text
core/
  apps/
    mobile/             # 现有 React + Vite + Capacitor，Android/iOS 宿主
    harmony/            # ArkTS + ArkWeb 宿主；unsigned HAP 已构建，设备待验
    desktop/            # 一个 Tauri 工程产出 Windows/macOS；macOS 本机构建已验
  packages/
    client/             # 现有 Next 网站
    shared/             # 已有共享类型和轻量纯函数
    timer-ui/           # 迁移中：目标为 Web/五端唯一计时 React UI
    app-ui/             # 五端唯一的三栏 React 产品组合
```

不要再为已有多消费者的共享能力另造包或宿主私有副本。后续提取新共享能力的顺序是：

1. 移动端要复用一个已有模块。
2. 先确认它不依赖 Next、DOM 或 Web Bluetooth。
3. 用 `git mv`/最小改动提取到共享位置。
4. 网站改为 import 共享模块并跑原有回归测试。
5. 移动端再 import 同一个模块。

### 6.2 BLE 分层

智能魔方代码应拆为两层：

当前真实已安装客户端 BLE transport 契约以 `@cuberoot/app-ui` 的 `BleTransport` 为准；Capacitor、Tauri BLEC 和 Harmony ConnectivityKit 只各自实现该薄 transport，路线图不复制一份会漂移的 TypeScript 接口。Harmony transport 已通过 ArkTS/HAP 编译，但尚无设备与 GAN 16 UI 实测。

- Web adapter：包装现有 `navigator.bluetooth`，网站继续使用。
- Native adapter：包装 Android/iOS Capacitor BLE、Windows/macOS Tauri BLEC 与 Harmony ConnectivityKit BLE；每个平台仍分别取得设备证据。
- Protocol layer：GAN、MoYu、QiYi 等解密、校验、时钟拟合、掉步恢复和状态机。
- UI layer：设备选择、连接状态、错误提示和权限引导。

协议与平台 transport 保持分层；新宿主出现时从真实调用面逐项提取共享 contract，不在路线图或共享包中预造接口。

### 6.3 数据和同步规则

不同数据不能用同一种冲突策略：

| 数据 | 离线行为 | 建议同步规则 |
|---|---|---|
| 计时记录 | 必须离线创建 | 客户端 UUID；append-only；删除用 tombstone |
| 训练进度 | 必须离线更新 | 按练习项合并次数、最后时间和复习状态 |
| 设置 | 本地立即生效 | 字段级 last-write-wins，记录更新时间 |
| 公式内容 | 可离线读取 | 服务器权威；按版本或 ETag 增量刷新 |
| WCA/比赛/统计 | 缓存只读 | 服务器权威；TTL + 手动刷新 |
| 用户资料 | 短期离线展示 | 服务器权威；写入失败进 outbox |
| 会员/权限 | 可缓存但不能永久信任 | 服务端校验；给短期 grace period |

同步必须具备：

- 本地 schema version 和迁移。
- outbox 重试，不因断网丢用户操作。
- 幂等写入键，防止重试产生重复记录。
- 明确的 `createdAt`、`updatedAt`、`deletedAt` 或 revision。
- 登录前匿名数据与登录后账号数据的合并规则。
- 退出登录时是否保留本地记录的明确选择。
- 同一账号多设备修改时的冲突日志。
- API 版本兼容和最低支持 App 版本。

### 6.4 远程内容与远程代码的边界

可以远程更新而不重新审核：

- 公式、教程正文、比赛、统计、公告。
- 功能开关、实验参数、最低版本提示。
- 服务器返回的 JSON 配置和已审核 UI 能渲染的数据。

不应把以下内容当成免审核热更新：

- 下载一段新 JavaScript，改变 App 的主要功能。
- 从服务器下发未经审核的新可执行模块。
- 用远程网页悄悄替换已审核的核心 App。

Apple 的自包含和远程代码规则会使这种“全量热更新”方案有风险。CubeRoot 应做服务器驱动内容，不做服务器驱动可执行代码。

## 7. 网站更新后，App 到底要不要改

这是长期省心的关键。按变更类型判断：

| 变更 | 网站是否立即更新 | App 是否立即更新 | 是否需要商店审核 |
|---|---:|---:|---:|
| 数据库里的公式、名称、教程内容 | 是 | 下次同步后是 | 否 |
| 静态统计 JSON / 比赛数据 | 是 | 刷新缓存后是 | 否 |
| 后端修复且响应兼容旧版 | 是 | 自动受益 | 否 |
| 网站 SEO、长文布局、管理后台 | 是 | 不相关 | 否 |
| 共享核心逻辑修复 | 是 | 需要构建新版 | 是 |
| App 内打包的 UI / 文案 | 网站视改动而定 | 需要构建新版 | 是 |
| BLE 插件、权限、原生代码 | 否或部分 | 需要构建新版 | 是 |
| 图标、启动图、商店截图 | 否 | 需要更新资料或版本 | 通常需要审核 |
| 隐私用途、数据收集或付费模型 | 可能 | 必须同步更新声明和实现 | 通常需要审核 |

结论：大部分内容更新不用改 App；真正打包在 App 里的代码变化才发版。这与主流产品的维护方式一致。

## 8. 成本预算

以下金额以 2026-08-12 的官方美元标价为准，税费和汇率按注册地区另算。

### 8.1 必须支付的商店账号费用

| 项目 | 费用 | 周期 | 备注 |
|---|---:|---|---|
| Google Play Console | 25 美元 | 一次性 | 开发者账号注册费 |
| Apple Developer Program | 99 美元 | 每年 | 维持上架、签名和发布能力 |
| 两个平台首年合计 | 124 美元 | 首年 | 不含税 |
| 第二年起最低固定费用 | 99 美元/年 | 每年 | Google 不重复收注册费 |

官方依据：[Google Play 开发者账号](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)、[Apple 会员对比](https://developer.apple.com/support/compare-memberships/)。

### 8.2 很容易漏掉的实际成本

| 类别 | 最省方案 | 稳妥方案 | 是否首发必需 |
|---|---|---|---:|
| Android 设备 | 用现有真机和测试者设备 | 至少覆盖低端、主流、高刷/大屏设备 | 是，至少 1 台真机 |
| iPhone/iPad | 后期借用真机 | 至少 1 台当前受支持 iPhone | iOS 阶段必需 |
| Mac | 后期短租云 Mac / CI runner | 自有受支持 Mac | iOS 构建签名必需 |
| 智能魔方 | 只支持已有实测设备 | 建立型号和固件矩阵 | BLE 功能必需 |
| 截图和视频 | 自己制作 | 设计和本地化外包 | 是 |
| 隐私政策和条款 | 自己整理事实 | 法律专业复核 | 是，专业复核视风险 |
| 崩溃监控 | 自建日志或免费额度 | 托管服务 | 强烈建议 |
| CI 构建 | GitHub 免费额度内 | 付费 macOS/Android 分钟 | 可后置 |
| 客服 | 现有支持邮箱 | 工单系统和 SLA | 是，至少邮箱 |
| 翻译 | 英文 + 简中自有 | 增加重点市场语言 | 全球可用不等于全语言 |

### 8.3 开发时间成本

对熟悉现有仓库的单人开发，粗略规划值：

- PWA 基础补强：1 到 2 周。
- Android 技术验证壳：1 到 2 周。
- 可用 Android v1：4 到 8 周；BLE 型号多、离线同步复杂时按 6 到 10 周准备。
- Android + iOS 双平台首版：6 到 12 周，不含账号审核和外部等待。
- 后续常规维护：每月集中一个小版本，紧急崩溃或协议修复例外。

这些是范围估算，不是承诺工期。最大的变量不是页面数量，而是 BLE 真机矩阵、离线同步、登录合规和首次审核整改。

### 8.4 外包参考区间

仅作为预算量级，不是报价：

- 简单混合壳和基础账号：约人民币 3 万到 10 万。
- 含可靠 BLE、离线同步和双平台的正式产品：约人民币 10 万到 30 万以上。
- 设备适配、长期维护、设计、合规和服务器工作通常另计。

CubeRoot 已有大量核心代码和后端，自研的现金成本较低，但测试时间不能省。

### 8.5 如果以后收费

数字功能、订阅、会员和内容购买会触发 Apple/Google 的支付政策、佣金、税务和地区差异。2026 年各地区支付规则仍在变化，不能先假定网站付款链接一定允许直接放进 App。

第一版最省心做法：

- 不在 App 内新增购买入口。
- 允许已有账号登录并使用其合法权益前，逐条核对对应商店政策。
- 真正准备做移动端付费时单独设计商品、恢复购买、退款、家庭共享、服务端收据校验和地区规则。

## 9. 审核与总时间

### 9.1 Google Play

如果是 2023-11-13 之后创建且被该政策覆盖的个人开发者账号，申请正式发布前通常需要：

1. 建立 closed test。
2. 至少 12 名测试者持续选择加入 14 天。
3. 在 Play Console 申请 production access。
4. Google 表示该申请通常会在 7 天内完成，但可能更久。
5. 单次应用变更审核应预留最多 7 天，特殊情况可能更长。

官方说明：[个人账号测试要求](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)、[审核处理时间](https://support.google.com/googleplay/android-developer/answer/9859751?hl=en)。

这项 12 人/14 天要求不能自动套到组织账号。CubeRoot 已决定走组织路线，应以账号验证完成后 Play Console 对该账号显示的实际门槛为准。无论是否有硬性人数要求，都应做 internal/closed 测试；若控制台要求上述个人账号流程，代码可测试以后到第一次公开发布应额外预留至少 3 到 4 周，计划按 4 到 6 周更稳妥。

注意：14 天从测试版本可用且测试者真正 opt-in 后开始，不是从注册账号那天开始。

### 9.2 Apple App Store

Apple 公布的数据是 90% 的提交在 24 小时内完成审核，但这不是保证。第一次发布仍建议留出 1 到 2 周缓冲，用于：

- 账号或组织验证。
- 隐私、年龄评级和出口合规问卷。
- 登录、账号删除、BLE 审核说明和演示账号。
- 4.2 最低功能、4.8 登录、2.5.2 远程代码或付费规则整改。
- 被拒后修复、重新构建和再次审核。

官方说明：[App Review](https://developer.apple.com/app-store/review/)、[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)。

### 9.3 账号验证也会占时间

- Apple 组织账号需要真实法律实体和 D-U-N-S Number。
- 个人账号通常更快，但 App Store 会展示个人法定姓名。
- Google 个人和组织账号都要完成身份、联系方式和可能的设备验证。
- 账号资料、收款/税务和公开开发者信息应从第一天保持一致。

不要在临近发布时才注册账号。组织验证，以及账号控制台实际要求的任何测试流程，都是最长的外部等待，应与开发并行启动。

## 10. 全球上架策略

### 10.1 “全球上架”要拆成四件事

1. 商店可用地区：能否在当地 App Store/Google Play 分发。
2. 法律与合规：当地是否要求额外许可证、备案、隐私代表或交易者信息。
3. 产品可用：登录、地图、通知、外链和第三方 API 在当地是否可达。
4. 支持能力：语言、客服、退款和故障处理能否覆盖当地用户。

在控制台勾选全部国家不等于这四项都完成。

### 10.2 推荐的首发地区策略

- Apple：在符合当地法律、账号材料完整的前提下，开启 Apple 支持的国家和地区；Apple 当前支持在 175 个国家和地区提供 App，并可选择自动加入未来新增地区。见[可用性管理](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-for-your-app-on-the-app-store)。
- Google Play：开启 Play Console 支持且产品依赖可正常工作的国家和地区，并逐步放量。见[国家/地区分发要求](https://support.google.com/googleplay/android-developer/answer/6223646?hl=en)。
- 首发语言：英文为默认商店语言，简体中文为第二语言；App 内继续只支持现有的英文和简体中文。
- 发布方式：先 5% 或小范围 staged rollout，观察崩溃和登录，再逐步到 100%。
- 自动选择未来新增地区前，确认隐私、内容和服务依赖能满足未知地区要求。

### 10.3 中国大陆

中国大陆需要单独看待：

- Apple App Store 中国大陆可能要求有效的 ICP 备案信息；游戏等类别还可能需要额外版号/许可证。见[App 信息要求](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)。
- 应用类别必须按真实主要用途选择。CubeRoot 可评估“工具”或“体育”等实际匹配类别，不能为了规避要求把游戏类产品虚假分类，反之亦然。
- Google Play 不能当作中国大陆 Android 的完整分发渠道。
- 中国大陆 Android 往往需要多个本地商店、不同签名/资料/SDK、备案和持续适配，是独立项目，不符合“最低维护成本”。

建议：第一阶段先覆盖全球官方商店可直接支持的地区；等中国大陆 Android 用户量和需求有证据后，再单独立项。Apple 中国大陆是否开启，在备案和类别确认后决定。

### 10.4 欧盟和其他地区材料

- App Store Connect 需要根据欧盟 DSA 声明 trader / non-trader，并在适用时验证公开联系方式。见[Apple DSA 说明](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/)。
- 隐私政策不能只写笼统模板，要对应实际 SDK、日志、账号、BLE 标识、推送 token 和分析数据。
- 若使用加密通信或自有密码学，Apple 会询问出口合规；如实回答并保存判断依据。
- 若产品明确面向儿童，会触发更严格的数据、广告和家庭政策。不要为了年龄评级好看而错误声明目标人群。

## 11. CubeRoot App 功能范围

### 11.1 Android v1 必须有

#### A. 计时器

- 触摸起停、检查时间、DNF/+2、删除和备注。
- WCA 打乱生成和项目选择。
- session、个人最佳、平均和基础趋势。
- 屏幕保亮、震动和音效开关。
- 完整离线工作，重启后记录不丢。
- 数据导入/导出或账号同步至少有一种可靠恢复路径。

#### B. 智能魔方

- 扫描、选择、连接、断开和重连。
- 清晰的权限解释，只有用户点击连接时请求权限。
- 支持型号必须来自真机验证矩阵。
- 展示电量、连接状态、最后动作和异常原因。
- 掉通知、后台切换、蓝牙关闭、距离中断后的恢复。
- 保留现有 fake cube / fixture 能力，提供审核和自动测试 demo 模式。

#### C. 公式训练

- 选择训练集和 case。
- 查看公式、图形和训练进度。
- 常用训练集可下载离线。
- 训练记录在断网时写入本地，联网后同步。
- 内容版本变化时增量更新，不要求 App 发版。

#### D. 账号与同步

- 登录、退出、token 刷新和会话过期提示。
- 匿名计时数据升级到账号时的合并确认。
- 账号注销入口和可访问的网页删除入口。
- 隐私政策、服务条款、支持邮箱和版本信息。
- 多设备同步的冲突和失败状态可见。

#### E. App 基础能力

- 英文、简体中文、深色和浅色主题。
- `cuberoot.me` Universal Link / App Link 深链。
- 系统分享入口。
- 离线、同步中、失败和已同步状态。
- 崩溃恢复和最低版本提示。
- 无 BLE 设备仍可安装和使用普通计时器。

### 11.2 Android v1 可选

- 比赛收藏和开赛提醒。
- 个人 WCA 资料和最近成绩。
- 简单的 3D 模拟器/公式预览。
- 主屏幕快捷方式。
- 小组件。

这些功能不能阻塞计时、BLE、离线和同步的可靠性。

### 11.3 只保留网站唯一实现

- `/dev`、管理后台和运维页面。
- 完整 `/wca` 数据探索、大地图和复杂图表。
- `/math`、`/regulation`、百科长文和全部教程。
- 大型视频复盘与编辑。
- 需要大表、COOP/COEP 或高内存的求解器。
- fork 工具和只适合桌面的页面。

App 的“工具”可用真实链接进入这些网站页面，保留站内导航与需要时的系统浏览器回退，不在壳内伪装成本地页面，也不复制它们的 UI/路由。

### 11.4 iOS v1

iOS v1 原则上与已稳定的 Android v1 同功能，不在移植阶段额外扩产品范围。主要工作是：

- Core Bluetooth adapter。
- iOS 权限文案、后台行为和设备测试。
- Sign in with Apple / 现有登录方式的合规处理。
- Universal Links、APNs、Keychain、分享和隐私清单。
- iPhone 安全区、键盘、旋转、动态字体和 VoiceOver。
- TestFlight、截图、审核资料和 App Store 提交。

## 12. 分阶段实施计划

阶段状态、勾选项与证据只维护在本文第 0 节。实施时按第 0 节当前未完成项推进，并使用第 6 节架构、第 11 节范围、第 14 节测试和第 15 节发布规则；不得在这里再建立第二套阶段清单。

## 13. 商店审核注意事项

### 13.1 Apple 最低功能

Apple 4.2 要求 App 有足够实用性。风险最大的形态是：启动后只有一个网页、几个外链，离线空白，原生能力很少。

CubeRoot 应以这些证据证明不是简单套壳：

- 本地离线计时和记录。
- 原生 BLE 智能魔方。
- 本地通知、震动、保亮、分享和深链。
- 离线训练内容和同步状态。
- 针对手机的导航和交互。

### 13.2 登录

- iOS Account tab 会展示网站现有 Google、微信等第三方主账号登录，明确进入 Apple 4.8 等价登录审核边界；当前 iOS App Store 发布为 P0 `BLOCKED`。
- 网站唯一 `LoginForm`/后端必须提供满足当时 4.8 隐私条件的等价方式，实施优先考虑 Sign in with Apple；现有邮箱/手机方式尚无满足“可隐藏邮箱”的完整证据。
- WCA 不得凭名称假定为公民电子身份或特定服务账号例外；隐藏网站已有 provider 也不是同时满足产品 parity 与合规的解法。
- 审核账号不能依赖短信、人工批准或仅开发者能完成的步骤。
- OAuth callback、Universal Link 和隐私页必须在审核环境可达。

### 13.3 账号删除

- App 内必须能找到注销入口，不能只让用户发邮件。
- Google 还要求提供网页删除链接。
- 注销必须覆盖站内账号和私有数据；WCA 官方公开数据与站内账号资产要在政策里解释清楚。
- 删除后的法定保留数据、匿名化公共内容和恢复窗口要如实说明。

### 13.4 隐私和 SDK

- Analytics、crash、push、登录、广告和支付 SDK 都要纳入清单。
- “SDK 默认收集但我没主动调用”仍可能需要声明。
- BLE 设备名称、MAC/标识、诊断日志可能属于设备或使用数据，必须评估。
- 不需要的 SDK 不要装；每多一个 SDK 都增加体积、隐私和供应链成本。
- 用户拒绝非核心追踪后，计时和训练仍应可用。

### 13.5 权限

- 权限在用户触发功能时请求，不在首次启动连环弹窗。
- 先用页面解释用途，再弹系统权限。
- 拒绝后提供设置入口和不依赖该权限的替代体验。
- Android manifest 和 iOS usage description 只声明真实使用能力。
- 不把 BLE 标为硬件必需，否则无 BLE/不满足特性的设备可能无法安装普通计时器。

### 13.6 内容和分类

- 公式、用户内容、评论或论坛若在 App 展示，需要举报、屏蔽、管理和联系方式。
- 年龄评级按真实内容填写。
- 应用分类按主要用途选择，不能为了许可证或曝光虚报。
- 如果以后加入用户生成内容、聊天或公开资料，重新做安全与审核评估。

### 13.7 支付

- 数字会员或功能解锁先做专项政策评估。
- 不直接把网站购买按钮嵌进 App 再期待审核通过。
- 需要恢复购买、服务端收据校验和退款后的权限回收。
- 各地区允许的支付方式可能不同，发布前核对最新政策。

### 13.8 审核说明

每次提交都准备：

- 可用测试账号。
- 不需要实体魔方的 demo 路径。
- 智能魔方连接步骤、支持型号和权限原因。
- 需要特殊操作的测试视频。
- 后台、通知、蓝牙和账号删除说明。
- 与上版相比发生了什么变化。
- 服务端依赖状态和可用测试数据。

## 14. 测试计划

### 14.1 设备矩阵

最低矩阵：

- Android：低端/主流各一台，至少覆盖 Android 12 前后权限差异。
- Android：一台高刷新率或大屏设备，检查计时触摸和布局。
- iOS：一台当前主流 iPhone；条件允许再覆盖较小屏幕。
- HarmonyOS NEXT：一台真实 HarmonyOS NEXT 设备；Android 兼容模式不计。
- Windows：一台实体 Windows 11 电脑，验证 WebView2、安装/升级、协议唤起、凭据库和 BLE。
- macOS：一台实体 Mac，验证 WKWebView、app/dmg 安装、URL scheme、Keychain、BLE、签名和公证。
- 每个 BLE 型号记录魔方型号、硬件版本、固件和加密版本。
- 测试者设备补充品牌定制系统、电池优化和后台限制。

### 14.2 关键场景

#### 计时

- 快速触摸、长按、误触、多指、系统手势。
- 来电/通知、锁屏、切后台、旋转、低电量。
- 计时过程中进程被杀。
- +2、DNF、删除、撤销和 session 切换。
- 系统时间改变、时区改变和夏令时。

#### BLE

- 首次授权、拒绝、永久拒绝和从设置恢复。
- 蓝牙关闭、开启和飞行模式。
- 魔方休眠、超距、被另一台设备占用。
- 高频转动、最后一步、通知乱序/缺失和重复。
- App 后台、系统回收和屏幕锁定。
- 多个同名设备和旧配对记录。

#### 离线与同步

- 首次启动完全离线。
- 登录前创建记录，登录后合并。
- 两台设备同时修改。
- 上传成功但客户端超时后重试。
- 服务器 401、409、429、500 和超时。
- App 从旧 schema 逐版本升级到当前 schema。
- 注销、重装和恢复备份。

#### 商店和升级

- internal → closed → production 的同签名升级。
- 上一正式版升级后本地数据保留。
- 最低版本强制更新和可选更新。
- 深链在未安装、已安装、未登录和离线时的行为。
- 隐私/删除/支持链接从商店和 App 内都可访问。

### 14.3 自动化层次

- 单元测试：协议解码、计时状态机、同步合并和迁移。
- fixture 测试：每个设备的真实/脱敏数据帧。
- contract 测试：Web BLE 和 Native BLE adapter 行为一致。
- 集成测试：本地数据库、outbox、API 重试和登录刷新。
- UI 测试：核心计时、训练、注销和权限引导。
- 真机手测：BLE、后台、通知、震动、键盘和系统中断。

自动化不能替代 BLE 实物验证；实物验证也不能替代协议边界回归测试。

## 15. 构建、签名和发布自动化

### 15.1 版本规则

- 用户可见版本：语义化版本，如 `1.2.0`。
- Android versionCode：由版本号确定且 CI 校验当前构建；每次提交商店前再与 Play Console 已用最大值比较，不能复用。
- iOS build number：未来接入 iOS 发布后由 CI 单调递增。
- 每个商店构建记录 commit SHA、构建时间和 API compatibility version。
- 数据库 schema 和本地 schema 独立版本化。

### 15.2 Android CI

推荐流程：

1. PR/commit 跑共享核心、mobile typecheck 和测试。
2. 合并后生成 debug/internal AAB。
3. release tag 触发正式签名 AAB。
4. 上传 Play internal track。
5. 人工检查 release notes、隐私变化和 rollout 比例。
6. 推广到 closed/production，避免重新构建不同二进制。

签名注意：

- 使用 Play App Signing。
- 上传密钥和恢复信息离线备份。
- CI secret 只给最小权限。
- 不把 keystore、密码或 service account JSON 提交到仓库。

### 15.3 iOS CI

- 使用受支持的 macOS runner。
- 证书和 provisioning 尽量自动管理，但保留所有者恢复能力。
- TestFlight 先行，App Store release 人工确认。
- 可用 fastlane 或商店官方 API 自动上传构建、截图和 metadata。
- 自动化不能代替隐私、付费和审核说明的人工复核。

### 15.4 Desktop 与 Harmony CI

- `test.yml` 已定义 Windows/macOS Tauri 矩阵，但在对应 run 实际成功前只能记为 CI 定义，不是双平台构建证据。
- Desktop CI 的 `tauri build --no-bundle` 只验证原生编译；不替代 installer、签名、公证、安装、升级或实机 BLE。
- Harmony 已用当前官方工具链生成 unsigned HAP；下一门槛是在模拟器/真机安装并验证 ArkWeb 本地 bundle、bridge 与 BLE。unsigned HAP 仍不等于签名或发布完成。

### 15.5 发布频率

- 网站和 API 可以持续发布。
- App 不跟随每次网站 commit 发版。
- 常规 App 变更按月集中。
- 数据丢失、崩溃、登录失效、严重 BLE 回归和强制 SDK 要求走紧急版本。
- 内容修正优先由服务端数据解决，无需商店版就不要发商店版。

## 16. 长期维护清单

### 每次服务端发布

- 保持旧版 App 使用的字段和语义。
- 新字段先可选，旧字段至少保留一个支持窗口。
- 错误响应可被旧版安全处理。
- 不强制所有用户当天升级。

### 每次 App 发布

- 升级迁移测试。
- 权限、SDK、隐私标签差异检查。
- 账号删除回归。
- 登录和深链回归。
- 离线和重试回归。
- BLE 真机 smoke test。
- release notes 双语。
- 审核说明和 demo 账号复核。

### 每月

- 查看 crashes、ANR、启动、同步和 BLE 错误。
- 处理商店评论中可复现的问题。
- 检查测试设备的系统升级影响。
- 清理不必要 SDK 和权限。

### 每季度

- 在仍受支持的最旧 App 上验证当前 API。
- 检查 target SDK、Xcode、证书和商店政策日期。
- 复核隐私政策、数据保留和第三方处理者。
- 恢复演练：签名密钥、账号、CI 和数据库备份。

## 17. 最常见的坑，以及如何避免

### 坑 1：把 App 整个启动运行时改成远程整站套壳

后果：Apple 4.2 风险、离线差、导航怪、BLE 仍难用。

避免：核心计时/训练做成本地 bundle 和本地数据；工具/Account 在受控三栏中显示网站唯一实现，但不把 App 启动地址指向远程整站，不复制网站 UI/路由。

### 坑 2：为了“共用代码”强行共用所有 UI

后果：Next、DOM、原生权限和导航互相污染，最后更难维护。

避免：优先共享业务逻辑、数据和无平台依赖组件；平台壳允许不同。

### 坑 3：每次网站更新都发 App

后果：审核频繁、用户更新疲劳、发布风险放大。

避免：内容/API 服务器驱动，App 每月集中发版。

### 坑 4：把热更新变成远程执行新功能

后果：Apple 2.5.2 风险，审核版本与线上行为不一致。

避免：远程只下发数据和配置，核心可执行代码随商店版本。

### 坑 5：最后一周才注册商店账号

后果：身份验证、D-U-N-S，以及账号控制台实际要求的测试流程卡住。

避免：阶段 0 立即开户和招测试者，与开发并行。

### 坑 6：个人/组织身份选错

后果：公开姓名不符合品牌预期，迁移账号和 Bundle 所有权很麻烦。

避免：有真实法律实体且希望展示 CubeRoot 品牌就选组织；没有实体不要伪造组织。

### 坑 7：Android 只测模拟器

后果：BLE、厂商后台限制、触摸和性能问题上线才出现。

避免：第一周就真机 BLE spike，封闭测试覆盖不同品牌。

### 坑 8：宣称支持没实测的魔方

后果：固件、广播、加密和丢步差异导致差评或数据错误。

避免：商店和 App 内只列入验证矩阵的型号。

### 坑 9：权限一次性全要

后果：拒绝率高、审核解释困难、用户不信任。

避免：点击相关功能时再请求，拒绝后普通计时仍可用。

### 坑 10：只做云同步，不做 outbox

后果：弱网下记录丢失或重复。

避免：本地先提交，后台幂等同步，用户能看到状态。

### 坑 11：API 只考虑最新版 App

后果：一次后端改动让大量未升级用户崩溃。

避免：版本化、向后兼容、最低版本策略和旧版监控。

### 坑 12：注销只清本机登录

后果：违反商店账号删除要求。

避免：调用服务端真实删除流程并提供网页入口，端到端验证。

### 坑 13：隐私表只按自己写的代码填

后果：第三方 SDK 实际收集与声明不符。

避免：逐 SDK 查看行为，用抓包和后台数据验证。

### 坑 14：把数字会员网页付款直接放进 App

后果：付费政策驳回或后续下架风险。

避免：首版不放购买入口；移动付费单独立项。

### 坑 15：一次开启全球 100% 放量

后果：地区依赖、崩溃和客服问题同时爆发。

避免：全球可选区不等于立即全量，先 staged rollout。

### 坑 16：没有密钥和账号恢复方案

后果：人员或设备变化后无法更新 App。

避免：账号 2FA、恢复码、上传密钥、证书和 CI 权限都纳入运维备份。

## 18. 当前下一步

早期“从零开始”的注册、建壳和 Windows 准备清单已经完成或失效，不再作为执行计划保留。当前动作、外部账号阻塞和设备证据只按第 0 节推进；Android/iOS 日常命令见 `core/apps/mobile/README.md`，五端宿主顺序见第 22 节。

## 19. 开发环境

现有 Mobile、Desktop 和 Harmony 工程已经成立。开发者必须现场读取 Node、pnpm、Rust/Tauri、DevEco/Harmony SDK、JDK、Android SDK、Xcode 和设备状态，不得按早期计划重新创建技术壳或重复验证已完成的 OPPO + GAN 16 UI BLE spike；也不得把 macOS/Harmony 本机构建证据扩大成其他平台、签名或设备证据。

### 19.1 HarmonyOS 开发主机门槛（先检查，禁止重复踩坑）

开始安装 DevEco 或模拟器前先运行 `uname -m`，只按实际架构选择工具：

| 主机 | DevEco 安装包 | 本地 HarmonyOS 模拟器 | 可作为的证据 |
| --- | --- | --- | --- |
| Intel Mac，`x86_64` | Mac X86 | **不支持**；Device Manager 会明确提示只支持 Mac ARM 和 Windows，不得继续下载镜像或反复调整代理/签名 | ArkTS/HAP 编译和 unsigned HAP |
| Apple silicon Mac，`arm64` | Mac ARM | 支持；从 Device Manager 创建官方手机模拟器 | 模拟器安装、启动、ArkWeb 与 bridge 交互；不替代真机 BLE |
| Windows 10/11 x64 | Windows 64-bit | 支持 | 与 Mac ARM 相同，仍须独立保存实际运行证据 |
| HarmonyOS NEXT 真机 | 与开发主机架构无关 | 不适用 | 安装、系统能力、BLE 和真机签名证据 |

当前事实（2026-09-01）：

- 现用 Intel Mac 已安装并验证 DevEco Studio X86、Harmony SDK 和官方 Hvigor；工程可生成 unsigned HAP，但不能在本机创建 HarmonyOS 模拟器。
- 华为企业开发者实名认证已完成。自动签名提示“缺少设备”是正常的真机 profile 门槛，不是网络、翻墙或账号认证故障；当前 Android OPPO 不能充当 HarmonyOS NEXT 设备。
- 仓库所有者预计 2026-09-22 收到 Apple silicon Mac mini。到货后的唯一流程是：现场确认 `uname -m` 为 `arm64` → 安装 DevEco Studio Mac ARM 版 → 登录同一企业开发者账号 → 打开现有 `core/apps/harmony` → Device Manager 创建模拟器 → 安装运行同一 HAP。不得复制 Intel 版 DevEco，也不得新建 Harmony 业务工程。
- 模拟器验证不需要配置签名；需要真机验证时，先连接 HarmonyOS NEXT 设备并确认 `hdc list targets` 可见，再让 DevEco 自动生成调试 profile。证书、密码和本机签名材料不得进入 Git。

## 20. 决策检查表

在每个大阶段开始前重新确认：

| 决策 | 当前推荐 | 何时可改变 |
|---|---|---|
| 五端总体目标 | Android/iOS/HarmonyOS NEXT/Windows/macOS 一次到位 | 仅所有者明确修改产品范围时改变 |
| Android/iOS 宿主 | React + Vite + Capacitor | 出现不可修复的官方平台阻断才重评 |
| HarmonyOS 宿主 | ArkTS + ArkWeb 薄壳 | 官方能力实测出现硬阻断才重评，禁止先重写 UI |
| Windows/macOS 宿主 | 同一个 Tauri Desktop | 桌面原生能力实测出现硬阻断才重评，禁止两套工程 |
| 共享 React 产品层 | 已落地的 `@cuberoot/app-ui` 为五端唯一实现 | 不允许 app→app import 或复制源码 |
| 网站地位 | 完整内容和 SEO 主站 | 不改变 |
| App 地位 | 高频、离线、原生能力 | 按真实使用数据扩展 |
| 业务逻辑 | 共享 TypeScript 核心 | 不复制三套 |
| 内容更新 | API/数据驱动 | 保持 |
| 代码更新 | 商店构建和审核 | 保持 |
| 首发付费 | 免费，无 App 内购买入口 | 支付专项完成后再变 |
| 首发语言 | 英文 + 简体中文 | 有用户和支持能力后增加 |
| 中国大陆 Android | 后置独立项目 | 有明确用户量和合规预算后启动 |
| 发布节奏 | staged rollout + 月度版本 | 严重故障走紧急版 |

## 21. 官方资料索引

商店账号、审核和分发：

- [Apple Developer Program 会员对比](https://developer.apple.com/support/compare-memberships/)
- [Apple App Review](https://developer.apple.com/app-store/review/)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple App Store 可用地区管理](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-for-your-app-on-the-app-store)
- [Apple App 信息和中国大陆材料](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)
- [Google Play 开发者账号](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)
- [Google 新个人账号测试要求](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Google 审核处理时间](https://support.google.com/googleplay/android-developer/answer/9859751?hl=en)
- [Google 国家/地区分发要求](https://support.google.com/googleplay/android-developer/answer/6223646?hl=en)

隐私、账号和地区合规：

- [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)
- [Apple App 内账号删除](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Apple 欧盟 DSA trader 要求](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/)
- [Google Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
- [Google 账号删除要求](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)

技术：

- [Capacitor Getting Started](https://capacitorjs.com/docs/getting-started)
- [DevEco Studio 与当前系统要求](https://developer.huawei.com/consumer/cn/deveco-studio/)
- [HarmonyOS 开发入门：模拟器无需签名，真机需要签名](https://developer.huawei.com/consumer/cn/develop-novice-guide/)
- [Android Studio 安装](https://developer.android.com/studio/install)
- [Android Bluetooth permissions](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions)
- [Apple Core Bluetooth](https://developer.apple.com/documentation/corebluetooth)
- [Xcode 系统要求](https://developer.apple.com/xcode/system-requirements/)
- [Apple 2026 提交 SDK 要求](https://developer.apple.com/news/upcoming-requirements/?id=02032026a)
- [Google target API 要求](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)

## 22. 最终执行顺序

```text
现在
  1. 完成网站/五端计时器零遗漏迁移，关闭共享层中的已知重复和缺口
  2. 保持现有 Android/iOS 同一 Capacitor 宿主，完成双平台真机与发布门槛
  3. 继续保持 @cuberoot/app-ui 为五端唯一 React 产品层，只补真实 capability adapters
  4. 用同一 core/apps/desktop 完成 Windows/macOS 构建、安装、BLE、签名/公证与发布证据
  5. 在现有 unsigned HAP 基线上完成 core/apps/harmony 的设备安装、ArkWeb/bridge/BLE、签名与发布证据
  6. 五端接入同一账号、同步、多人、智能魔方和三栏完整功能
  7. 建立五端 CI、安装产物、依赖方向和生成物漂移守卫
  8. 完成五端输入/窗口/离线/生命周期/辅助功能/BLE/升级矩阵
  9. 各平台按商店或安装渠道独立分阶段发布，但五端总体全部通过前保持 NOT COMPLETE

长期
 11. 内容继续走网站/API 即时更新
 12. 客户端代码按兼容发布节奏集中发布
 13. 旧版兼容、隐私、SDK、证书和五端系统版本定期复核
```

最省心不是永远不更新 App，而是把“每天会变的内容”和“必须审核的客户端代码”分开。只要这个边界从第一天守住，CubeRoot 网站继续快速迭代，App 不需要跟着每次手工改一遍。
