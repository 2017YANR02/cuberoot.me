# CubeRoot 微信 / 抖音小程序

微信与抖音共用平台适配、登录和 BLE 驱动。微信计时与工具页仍通过 `web-view` 复用网站运行界面；抖音因主功能页面原生要求，使用原生计时和查询页面，直接消费共享纯逻辑，不导入 Web/React 源码。`package.json`、`src/`、两个项目配置模板与 [`../../docs/MINIPROGRAM.md`](../../docs/MINIPROGRAM.md) 是局部事实源。

## 抖音原生主页面

- 我的页支持原生修改展示名及按需查看已绑定登录方式、密码设置状态；共用网站的展示名规则和登录方式名称。WCA 认证姓名保持只读；离页清空身份列表，过期请求不能覆盖新会话或展示其他账号的身份。
- 原生账号安全操作包括确认解绑、退出本机小程序，以及 `pages/account-delete` 注销页。注销需输入账号主标识、已有密码并二次确认，沿用服务端最后登录方式、组织和合约限制；退出保留本地计时数据。当前抖音可见入口均使用原生视图；这不代表已经覆盖网站的全部账号功能。
- `pages/account-settings` 原生绑定/换绑邮箱和手机号、设置/修改密码；发送验证码前确认用途，换绑使用专用接口，离页清除验证码和密码。短信使用手动输入，不使用抖音首次发版不支持的手机号授权。
- 抖音联系页与我的页统一提供平台反馈指引，通过右上角菜单提交、后台反馈中心处理；不展示站外社群目录。微信保留原联系功能。未配置的 IM 客服能力不展示为可用按钮。

- `pages/account-link` 可用原生邮箱验证码、邮箱密码或短信验证码验证已有账号，再签发一次性登录码；临时会话不写入小程序存储，返回「我的」后仍需输入、预览并确认目标账号。抖音端不再新增第三方网页授权，已有身份保留展示与解绑；账号安全及注销使用原生页面。
- 计时深链支持 `event` 和单条 `scramble`，通过 App 内存传给原生计时页，确认后才切换项目或替换手动队列；取消、页面离开或正在计时时不应用。未知参数、重复字段、FMC/多盲及锚点仍明确提示未支持，不丢弃参数，也不回退到网页计时。

- 协议与隐私入口使用 `pages/privacy` 原生离线页；全文由 `@cuberoot/shared/privacy` 与网站共同消费，修改政策时只维护共享数据。第三方政策及支持邮箱提供复制入口。
- 联系页使用无需登录的 `pages/contact`，与账号页共用 `native-contact` 数据、模板和样式；微信提供原联系目录，抖音提供平台反馈指引。旧抖音网页链接按实际路径映射到原生页，未支持的页面及参数明确提示，不再全部切到工具首页；抖音账号旧链接也转到原生账号安全页，微信保留网页流程。
- 抖音构建检查全部登记页面和包内所有 TTML（含组件与未引用模板），拒绝引入 `web-view`；旧 WCA 参数不再触发浏览器授权。这证明本地产物的渲染边界，不代表全部深链、真机和平台审核已验收；完整清单见[原生化审核核查](../../../docs/douyin-native-review-audit.md)。

- `native-timer.ts` 复用共享计时状态机、打乱、罚时、统计与智能魔方控制器；`timer-store.ts` 从早期微信原生计时器（`7cb3e75349`，当时位于 `core/packages/miniprogram`）恢复，沿用 `cuberoot:timer` 存储格式与 `TimerStoreSettings`。网站 WebView 的 localStorage 成绩不会自动迁入原生存储。
- `native-timer-page.ts` / `templates/native-timer.wxml` 适配小程序触摸、设置、成绩及生命周期。支持15个计时项目的本地打乱图、智能魔方实况图、观察计时、分组/成绩编辑、共享滚动统计、手动打乱、真题搜索与日期选择、单行排名、CSV/csTimer/Speedstacks导出及备份恢复；不包含FMC、多盲成绩录入或旧网页全部高级设置。接入与实际验收状态见[原生计时器跟踪](../../../docs/douyin-native-timer-tracker.md)。
- 顶部直接选择项目与打乱来源；设置按共享契约分为计时、智能魔方、打乱、外观和数据，已接紧凑打乱、字号及运行中隐藏界面。统计支持日期范围、汇总、滚动均值和共享分箱的原生成绩分布；详情显示原始时间、罚时、来源、设备及已有分段，修改罚时/备注后保留详情上下文。未提供的声音、3D/姿态、跨组图表等仍按跟踪表记为缺口。
- `native-tools-page.ts` 通过现有公共 API 原生展示近期公示比赛、近期纪录与 WCA ID 个人成绩/排名。教程、课程与专项训练继续下线。
- 蓝牙由 `getSmartCubeSession()` 保存在 App 实例，避免每个独立页面 bundle 创建不同连接；原生模式不需要网页中继 WebSocket。旧微信网页中继路径保留。
- 抖音构建直接选择原生 TTML 主页面；旧网页主功能深链重定向到原生 tab，隐私和账号辅助页也使用原生视图；构建递归验证全部登记页面无 WebView。
- 构建/模拟器检查不替代 iOS、Android 的 GAN 16 UI 真机连接与自动计时回归，也不表示已经上传、提审或上线。

### 跨平台复用复盘（2026-10-19）

| 职责 | 已有实现与本次处理 |
| --- | --- |
| 原生页面 | 微信早期 MVP 有 WXML 计时器；当前微信已改为 WebView。抖音使用同一小程序工程的原生模板，不能直接引用 React DOM。模板和 `setData` 生命周期是必要宿主适配，不作为新业务引擎。 |
| 计时、罚时和显示 | 继续直接调用 `timer/machine`、`timer/timing-display`、`timer/stats`，不重写算法。保存共享状态机返回的 `inspectionMs`。 |
| 设置 | 删除原生独立默认值和持久化写入，直接使用 `TimerStoreSettings`、`settings-contract` 及其字段范围/文案；原生预览包旧设置只做一次迁入，成功保存后移除旧键。按住时间回到共享默认 550 ms，打乱触摸不再跳过按住阈值，保留 start/none/next/copy。 |
| 打乱 | 将现有 `seeded/generate.ts` 的基础 WCA 分派提取至 `seeded/wca.ts`，原 seeded worker 与小程序共同调用。项目算法及 seeded 随机数顺序保持原实现；不把整套专项训练依赖带入小程序。 |
| 成绩与分组 | 恢复微信历史 `timer-store`，使用共享数据校验、`activeTimerSolves`、`selectTimerEventSession` 和 CSV 导出，不引入另一套成绩 schema。 |
| 智能魔方 | 删除原生手写首转/还原判定，直接使用 Web/安装客户端/Watch 已有的 `SmartCubeSessionController`、`SmartCubeSoloTimerController`、`SmartCubeAttemptProducer`；设备时钟、转动记录及阶段字段由共享实现产生。BLE/GATT 继续使用小程序现有驱动。 |
| 查询 | 复用 `/comp/announced`、`/wca/recent-records`、`/wca/person-page` 和共享姓名、日期、成绩格式化；原生页面只转换展示行、处理请求与生命周期，没有另造查询后端。 |

这些改动不代表与Web完全等价：交互3D、自动双向同步、校正求解、陀螺仪姿态接入等仍未移植；已有的账户备份采用显式上传/恢复，不等同于自动同步。不能因已复用底层就标记功能全部验收。每项后续移植先找现有公共入口，不能在原生页面另建业务规则。

## 开发

从 `core/` 运行：

```sh
pnpm --filter @cuberoot/miniprogram dev
pnpm --filter @cuberoot/miniprogram dev:douyin
pnpm --filter @cuberoot/miniprogram check:all
pnpm --filter @cuberoot/miniprogram audit:douyin
```

微信开发者工具导入本目录并读取 `dist/`；抖音开发者工具直接导入 `dist-douyin/`。`check:all` 只跑一次类型检查和测试，再构建两个目标；单独检查抖音时运行 `check:douyin`。
`audit:douyin` 在构建后只读核对正式 AppID、域名校验、产物指纹与原生页面，不上传或提审。微信和抖音构建证据分别保存；源码或产物变更后需重建。后台主体、类目、内容安全、隐私、域名配置和真机证据仍需独立核对。
抖音构建后可打开 `.tmp/wx-to-tt-log/__wxToTT/report/index.html` 查看官方转换器的逐文件报告；它包含本机路径并且每次可重建，因此不提交生成页。
`dev` 监听微信，`dev:douyin` 复用同一套监听、合并连续变更和串行重建机制；分别在需要时运行，不要对同一个目标同时启动多个构建进程。
构建会先验证本机项目配置和全部源码 JSON，并在 `.tmp` 生成完整候选产物；配置、编译或转换失败时保留上一份可用产物和小程序身份。微信仍整体替换 `dist/`；抖音在原 `dist-douyin/` 内更新变动文件、清理过期产物，不再重命名开发工具打开的项目根目录，未变文件不重写。普通构建和监听构建均适用，无需因项目根目录占用而关闭工具。
抖音逐文件同步不是多文件原子事务，开发工具若在更新期间编译可在完成后重新编译；个别文件被独占或磁盘错误仍会明确报错并保留候选目录，排除错误后重新构建。监听进程继续等待下次修改，不会把失败报告成成功。
跨包源码依赖由 esbuild 的实际解析图统一驱动构建指纹和开发监听；新增 `@cuberoot/shared` 子路径后不需要维护额外文件清单。

首次构建可分别用 `WECHAT_MINI_APP_ID` 和 `DOUYIN_MINI_APP_ID` 生成并保留被忽略的本机项目配置。微信 `release:check` 只接受 CubeRoot 官方身份；抖音尚未做上传闸门，`check:douyin` 只证明工程产物可生成。
抖音导入正式项目后，也要将正式 AppID 写入被忽略的 `project.douyin.config.json`；仅在开发工具修改 `dist-douyin/project.config.json` 会被下次构建覆盖。
抖音底栏图标由 `scripts/build-tab-icons.mjs` 复用 Lucide 静态图标和现有主题色，生成本地 PNG 与许可证，微信底栏配置不变；不要手改生成图。平台 API 使用宿主直接注入的 `tt` / `wx`，不假设小程序提供浏览器 `globalThis`。
抖音读取不存在的存储键会抛错（[官方 getStorageSync 文档](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/api/data-caching/tt-get-storage-sync)）；会话读取先确认键是否存在，只有明确不存在才按游客处理，真实存储故障仍阻止网页账号同步。

## 单一来源

- 网站入口：`src/lib/web-routes.ts`
- API 和网站域名：`src/lib/runtime-config.ts`
- 网页加载状态：`src/lib/web-view-page.ts`
- 登录与会话：`src/lib/auth.ts`
- 平台 API、登录端点和网页标记：`src/lib/platform.ts`
- 必须原生化的跨端纯逻辑：先提取到 `@cuberoot/shared`，确认有调用方后再添加依赖

不要按平台复制业务算法。平台审核要求、平台 API、离线能力或明确性能需求需要原生页面时，UI 与生命周期留在小程序，纯逻辑复用共享实现。

## 语言与外观同步

已确认的语言、明暗、配色、柔和度和两种明暗各自的背景保存在 Web 存储与小程序原生存储。新版壳通过 `mpPreferences` 把原生快照交给每个新 WebView，在首屏主题脚本中恢复；同一文档刷新不会重放旧快照覆盖刚修改的偏好。分享会移除该内部参数。

WebView 的 `postMessage` 不保证即时送达。新版页面确认设置后，通过 `pages/preferences/index` 立即保存、更新原生导航及底栏，再自动返回原页面。后台 WebView 在显示时比较持久偏好，发生变化就重新加载并重新申请会话票据；不重放已消费的登录票据。未接收新版快照的旧壳继续使用旧消息协议，因此网页与小程序都需要发布后才能使用即时同步。

所有原生页面使用同一背景模板与主题变量；系统模式保存明暗两套颜色和背景，原生页在系统切换时立即重新应用。构建和模拟回归不等于 iOS/Android 微信真机验收。

## 安全和发布

后端按目标需要 `WECHAT_MINI_APP_ID` / `WECHAT_MINI_APP_SECRET` 或 `DOUYIN_MINI_APP_ID` / `DOUYIN_MINI_APP_SECRET`。密钥只放服务端环境变量，不写入本目录、构建产物、URL 或文档。

两个平台后台都必须配置网络、业务域名和真实隐私声明。抖音登录会在用户手动同意用户协议与隐私政策后调用 `tt.login({ force: true })`，本机退出只清除本机小程序会话。抖音资质审核期间可以继续开发；正式 AppID、后台能力与域名配置、开发者工具和真机回归、平台审核全部完成前不得宣称上线。

上传前必须在开发者工具确认稳定基础库，再运行：

```powershell
$env:WECHAT_MINI_LIB_VERSION='<已确认的稳定版本>'
$env:WECHAT_MINI_BASIC_INFO_APPROVED='1'
$env:WECHAT_MINI_FILING_COMPLETED='1'
$env:WECHAT_MINI_PRIVACY_REVIEWED='1'
$env:WECHAT_MINI_PHONE_AUTHORIZATION_REVIEWED='1' # 实时手机号权限/额度/隐私声明及真机流程实际核验后设置
$env:WECHAT_MINI_IOS_REAL_DEVICE_TESTED='1'
$env:WECHAT_MINI_ANDROID_REAL_DEVICE_TESTED='1'
$env:WECHAT_MINI_GAN16UI_TESTED='1' # Android 真机完成 GAN 16 ui 全链路回归后设置
$env:WECHAT_MINI_GOCUBE_TESTED='1'
$env:WECHAT_MINI_GIIKER_TESTED='1'
$env:WECHAT_MINI_MOYU_TESTED='1'
pnpm --filter @cuberoot/miniprogram build
pnpm --filter @cuberoot/miniprogram release:check
```

`release:check` 会自动运行类型检查和全部小程序回归测试，再检查正式身份、基础库、人工发布确认、凭据扫描、源码与上传产物指纹等发布条件。

非 watch 构建复用 esbuild 标识符压缩（不改属性名）；原生 Page 方法、WXML 事件和网络字段仍保留。开发 watch 保留可读变量名；上传前重新运行 `build`，仍遵守原 512 KiB 总包/128 KiB 单文件预算。

检查器会阻止未确认基础信息、备案、后台隐私指引或双平台真机回归的发布，也会在源码或上传包发现 AppSecret、私钥、新的隐私敏感 API、错误发布身份或异常包体积时直接失败。当前项目预算为总包 512 KiB、单文件 128 KiB，用于尽早发现误打包网站资源，不代表平台极限。确认变量只是防遗忘闸门，不能代替真实操作；每次只在对应事项真实完成后设置。

### 微信手机号实时授权（2026-09-12，本地接入）

- 已绑定 UnionID 仍直接登录。未绑定用户可主动点击 `getRealtimePhoneNumber`；后端用独立 `phoneCode` 与本次 `wx.login` 换得的 OpenID 校验归属，不接受客户端传入的手机号。
- 已有手机号账号先显示账号并确认；未匹配则明确创建，或复用网站的一次性小程序登录码验证旧号。手机号与微信同一事务绑定，冲突不覆盖、不合并。手机号契约暂为中国大陆；其他号码、拒绝或无能力时保留原有旧号登录入口。
- 只使用[微信官方实时验证组件](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getRealtimePhoneNumber.html)，不回退普通快速验证。平台资质/可用额度需在微信公众平台「接口设置 → 手机号」及「付费管理」核对（以实际后台为准）；不会自动购买额度。
- 隐私政策已补充主动授权、用途、短期认证资料和删除边界。发布前须在「设置 → 服务内容声明 → 用户隐私保护指引」声明手机号用于登录/账号绑定，并实测 iOS、Android 授权成功、拒绝、匹配旧号确认和冲突恢复。
- `release:check` 仅为原生账号页放行实时组件，其余页面及普通 `getPhoneNumber` 仍阻断；新增独立 `WECHAT_MINI_PHONE_AUTHORIZATION_REVIEWED` 确认门禁，不能沿用上次无手机号版本的隐私确认。源码实现/构建通过不代表已上传或发布。

## 外接计时器桥接

WebView 的外接蓝牙入口打开原生页，可连接 GAN 或奇艺计时器／适配器；Stackmat 入口使用微信 RecorderManager 的单声道 44.1kHz PCM 分帧。协议、CRC、奇艺加解密与分包、Stackmat 音频解码均来自 shared/timer/external，Web 驱动复用同一实现。中继沿用 /v1/smart-cube/relay，timer 事件和 move 事件共用有序重放与去重序号，因此必须先发布更新后的 API 和 Web，再发布小程序。

音频仅本机解码，不上传。只支持微信的 PCM 采集，抖音入口明确提示未适配；满 10 分钟、录音中断或原生连接断开后需要重连。WebView 恢复连接时按序回放事件；不能恢复的缺口断开，不推测成绩。

源码/模拟测试不等于真机通过。上传前需在平台后台新增麦克风用途声明，并实测 iOS/Android 的外接音频路由、PCM 格式与采样率、授权拒绝、页面返回、后台中断、同时间连续成绩及蓝牙断线。实际通过后才可设置 WECHAT_MINI_EXTERNAL_TIMER_REVIEWED=1；不要沿用旧版验收结果。

### 工具页账号同步循环兼容修复（2026-10-09）

- 线上日志在 `2026-10-10 04:29 UTC` 显示旧微信壳连续打开工具首页、重新申请并核销网页票据，随后票据接口返回 429。该壳传入的偏好持续为 `null`，没有新版导航标记。旧版偏好解码器不接受网站新增的 `transparent`，而旧工具页在尚无偏好时隐藏会销毁 WebView：网页主动打开偏好页、保存被拒、返回重载、再次同步形成循环。
- 网站在协议 2 遇到任一明暗背景为 `transparent` 时，复用已有语言/外观 `postMessage`，不导航到偏好页、不改写背景值、不降低登录票据校验。其他可识别偏好保持即时同步。新壳显式声明协议 3，网站才即时发送透明背景偏好；未上传的新壳不能作为线上已支持协议 3 的证据。
- 回归用例用修复前源码复现透明背景仍触发导航，修复后验证旧协议不导航、兼容值即时保存、新协议无损传递透明背景，以及认证跳转前后的协议保留。网站部署状态与小程序上传/审核/发布、用户真机复测分别记录。
