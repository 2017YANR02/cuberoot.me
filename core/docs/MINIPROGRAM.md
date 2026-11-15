# CubeRoot 微信 / 抖音小程序跟踪

> 最后更新：2026-11-15（同步 11 月 14 日备案、主体关联与交易者声明操作结果）。本文是小程序的架构约定、当前状态、上线清单和迭代记录。后续开发先更新这里，不再另建互相冲突的计划。

## 备案与主体迁移进度（2026-11-15）

备案状态由维护者于 11 月 14 日确认；Google Play 状态来自本轮浏览器操作与保存结果。本节记录当次核验，不表示 11 月 15 日已重新检查审核结果。

| 事项 | 当前状态 | 下一步 |
| --- | --- | --- |
| 网站 ICP 备案 | 已完成（11 月 7 日确认） | 不再作为后续提交的待办阻塞 |
| 公安备案 | 主体变更审核通过 | 核对网站展示信息；审核通过不等于展示信息已核验 |
| iOS APP 备案 | 管局审核中，11 月 14 日预计剩余 11 个工作日 | 暂估 11 月 30 日，等待实际审核结果 |
| Android APP 备案 | 证书及特征信息已准备，尚未提交新增接入 | 等 iOS 备案完成后，再新增接入 APP 备案 |
| 微信小程序 | 商户解绑已完成；主体变更审核通过 | 核对原备案处理状态，再按平台流程办理；不等于小程序备案已完成 |
| 抖音小程序 | 联系信息调整后重新提交，仍在审核，预计还需十几天 | 具体审核阶段待核，11 月 30 日仅暂排；未确认备案通过或版本提审 |
| Google Play 开发者主体 | 新公司资料验证通过，已关联上海魔方根科技有限公司；控制台显示组织详细信息已更新 | 主体关联已完成，不再等待身份资料审核 |
| Google Play 交易者声明 | 账号级已保存为交易者；CubeRoot 应用级已保存并提交，页面显示正在审核中的更改，快速检查仍在进行 | 等待 Google 审核及生效；11 月 21 日仅暂估，不表示已通过 |
| Google Play 商家收款 | 保留旧工作室组织资料、现有个人银行账户及个人 W-8BEN；本轮未修改 | 按维护者要求暂不迁移；旧商家地址变更验证失败仍待处理 |

工作台[新公司备案与上架（目标排期）](https://cuberoot.me/zh/admin/team?section=schedule&schedule=bb5a92ca-79f6-4b19-a548-9af52de60225)已通过接口更新并回读确认：版本 9，共 46 项。此前 11 月 7 日版本 6 为 42 项；本轮补充商家资料暂不迁移、地址验证待办、账号级交易者声明及应用级送审事项。排期保存在数据库，本段保留对应的核验记录。

审核中的进度不估算百分比，100% 仅用于已完成事项。11 月 30 日的安卓新增接入仍是随 iOS 预计完成日放置的占位，不是安卓备案通过日期；微信后续备案及安卓商店上架须按实际前置结果重排。同名小程序备案串行依赖保留。未确认的商店上线、版本发布和审核结果不补记为完成。

Google Play 开发者身份资料与商家收款资料分开维护；旧资料类型是“组织”，不能因银行户名为个人就记成个人商家账号。暂不迁移是本轮操作决定，不代表已确认新公司可长期使用旧主体收款。应用级声明送审及检查说明见[移动端进度](../../docs/mobile-app-roadmap.md#2026-11-15备案主体迁移与-google-play-交易者声明)。

## 1. 产品路线

小程序采用“原生外壳 + 网站能力”的混合架构。

- 网站继续负责计时器、公式库、比赛、百科和课程等成熟功能。
- 小程序原生层只负责平台登录、一级导航、加载失败恢复、智能魔方 BLE，以及未来的平台专属能力。
- 网站功能默认通过 `web-view` 复用；只有 `web-view` 做不到、体验明显不合格，或必须调用平台 API 时，才考虑原生实现。
- 原生实现需要算法或数据逻辑时，先从网站提取到 `@cuberoot/shared`，再由两端共同引用；不复制页面组件和业务规则。

这条路线的目标不是把网站再写一遍，而是让网站保持唯一业务来源，小程序提供不同平台入口和平台增量能力。

## 2. 维护边界

| 改动 | 唯一入口 | 约束 |
|---|---|---|
| 网站首页公开入口、标题、说明、顺序 | `@cuberoot/shared/site-directory` | 网站补视觉素材，小程序补平台动作；两端不得另写第二份目录 |
| 工具 tab、账号管理网页、网页白名单和分享路径 | `apps/miniprogram/src/lib/web-routes.ts` | 工具 tab 固定打开网站 `/zh`；“我的”是原生分享页，登录后仅在用户主动操作时通过账号键打开 `/zh/account`；其他公开路由共享目录派生，另追加隐私和退出私有入口 |
| 网站和 API 域名 | `apps/miniprogram/src/lib/runtime-config.ts` | 只使用已在小程序后台配置的 HTTPS 域名 |
| `web-view` 加载、换票超时、失败和重试 | `apps/miniprogram/src/lib/web-view-page.ts` | 计时、工具和通用网页共用，不各自补丁 |
| `web-view` 加载与错误界面 | `apps/miniprogram/src/templates/web-route-view.wxml` + `app.wxss` | 页面只传状态，不复制 WXML 或页面级样式 |
| 平台 API、登录端点和网页标记 | `apps/miniprogram/src/lib/platform.ts` | 微信与抖音只在适配层分流，页面不得直接复制平台判断 |
| 登录、会话和错误文案 | `apps/miniprogram/src/lib/auth.ts` | AppSecret 永远只在服务端 |
| 跨端登录与退出落地 | 网站 `lib/auth-store.ts` + `app/auth/miniprogram/page.tsx` | 小程序只发起受控跳转，不复制网页存储键和清理规则 |
| 用户协议与隐私政策 | `packages/client/app/[lang]/privacy/page.tsx` | App、小程序和网页共用一份真实声明 |
| 构建与上传前自动检查 | `apps/miniprogram/scripts/build-state.mjs` + `release-check.mjs` + `release-check-lib.mjs` | 只允许上传当前源码生成且内容未变的完整 `dist`；新增隐私敏感能力时先阻断上传 |
| 跨端计时数据类型和纯逻辑 | `@cuberoot/shared/timer` | 不复制网站计时器 UI |
| GAN v2/v3/v4 协议、解密与魔方状态解码 | `@cuberoot/shared/smart-cube/gan-v2` + `gan-v3` + `gan-v4` + `gan-crypto` + `gan-move-sync` + `cubie` | 网站 Web Bluetooth 和小程序平台 BLE 共用同一解析与状态逻辑 |
| GoCube/Rubik's Connected 协议字节解析 | `@cuberoot/shared/smart-cube/gocube` | 两端只维护各自传输适配器，不复制帧解析、转动映射或命令常量 |
| Giiker/米家协议状态与转动解析 | `@cuberoot/shared/smart-cube/giiker` | 网站与小程序复用同一解析器，传输层分别使用 Web Bluetooth 与平台 BLE |
| MoYu AI MHC 旧协议转动解析 | `@cuberoot/shared/smart-cube/moyu` | 网站与小程序复用同一 UUID、设备名匹配和转动累积解析，传输层各自维护平台生命周期 |
| MoYu32 加密协议解析 | `@cuberoot/shared/smart-cube/moyu32` | 复用 AES、WCU_MY32 设备识别、初始状态、转动、电量与姿态解析；小程序使用独立微信 BLE 传输适配器 |
| QiYi / Tornado V4 协议解析 | `@cuberoot/shared/smart-cube/qiyi` | 复用 AES-ECB、CRC、设备状态、历史转动、电量与姿态解析；小程序兼容 FFF6 通知和 FFF5 写入特征 |
| 智能魔方短时中继协议 | `@cuberoot/shared/smart-cube/relay` | 原生 BLE 只作为数据源，网站计时器只作为数据接收方；不把会话数据写入数据库 |
| 小程序智能魔方连接生命周期 | `apps/miniprogram/src/lib/smart-cube/session.ts` | 页面只展示状态和发起操作，不直接管理 socket、BLE 连接或竞态 |
| 全局视觉变量和通用按钮 | `apps/miniprogram/src/app.wxss` | 页面只写自身布局 |
| 账号落库 | 服务端 `account_auth.ts` + `wechat_miniprogram.ts` / `douyin_miniprogram.ts` | 微信只用 UnionID；抖音优先用 UnionID，暂时取不到时保留 code2session OpenID 兼容，并在后续拿到 UnionID 时原位升级旧身份 |

新增或调整网站首页入口时，只改共享目录并补测试；网站和小程序会同时消费。新增原生功能前，先在本文件写清楚为什么不能继续复用网站。

路由测试会直接核对 `packages/client/app/[lang]` 中的真实页面或 `next.config.ts` 中的明确跳转。网站若移动入口，小程序测试必须同时失败，避免发布后才发现 `web-view` 指向失效地址。

当前小程序没有原生计时数据层。原生页只连接 BLE，并通过短时内存中继把事件交给网站现有计时器；计时 UI、成绩、统计和设置仍以网站为唯一来源。以后增加协议也必须先提取共享纯逻辑，不能复制网站计时器 UI 或另建备用实现。

## 3. 当前状态

### 微信平台配置

- [x] 企业主体小程序已注册并完成微信认证。
- [x] 小程序已绑定到网站应用所在的同一微信开放平台账号。
- [x] request 合法域名已配置为 `https://api.cuberoot.me`。
- [x] socket 合法域名已配置为 `wss://api.cuberoot.me`。
- [x] 业务域名已配置为 `https://cuberoot.me`，校验文件已部署。
- [ ] 博客最终会跳到 `https://blog.cuberoot.me`；该子域名仍需在微信后台补充为业务域名。代码先统一从主域规范路径进入，不绕过微信域名校验。
- [x] 服务类目 `工具 > 信息查询` 已通过并设为主类目。
- [x] 小程序基础信息已完成。
- [x] 小程序备案已完成。
- [ ] 上传前把基础库从 `trial` 选择为当时的稳定版本，并在真机复测。
- [ ] 在后台按本文的实际数据清单完成“用户隐私保护指引”，不勾选未使用的权限。
- [x] 用户明确决定保留当前 AppSecret；该剩余风险已接受，不再阻塞发布。源码和上传产物仍禁止包含 AppSecret。

### 抖音平台配置

#### 新公司备案迁移（2026-10-27）

本节始于 2026-10-27，备案状态已更新至 2026-11-15；跨平台进度见[备案与主体迁移进度](#备案与主体迁移进度2026-11-15)。下方旧 AppID、备案和域名配置记录仅证明旧应用状态，不自动适用于新公司小程序。旧个人主体时期的原生化实现继续保留，工程现状与审核缺口见 [抖音原生化审核核查](../../docs/douyin-native-review-audit.md)。

| 事项 | 当前状态 | 依据 |
|---|---|---|
| 旧小程序名称释放 | 已完成 | 维护者于 2026-10-27 确认；具体释放时刻未记录 |
| 新公司企业入驻、平台审核和对公验证 | 已通过 | 维护者截图：上海魔方根科技有限公司；对公验证通过时间为 2026-10-27 12:15:45，页面有效期至 2027-10-27 12:15:45（北京时间） |
| 新小程序名称 | 魔方根，名称审核通过 | 维护者于 2026-10-27 提供基础信息页面截图 |
| 新小程序 AppID | `tt550923b4cb7781f301` | 维护者于 2026-10-27 提供；仅记录应用标识，本次未切换工程或生产配置 |
| 图标、简介 | 已提交，审核中 | 截图分别显示“审核中”；简介为“魔方计时、成绩统计、公式与赛事信息查询” |
| 服务类目 | 待核对 | 本次截图未展示类目及其审核结果 |
| 新主体小程序备案 | 已重新提交，审核中，具体阶段待核 | 11 月 7 日调整联系信息后重新提交；11 月 14 日确认仍在审核，预计还需十几天，未确认通过 |
| 阿里云 ICP 主体变更 | 已完成 | 维护者于 2026-11-07 确认 ICP 备案完成 |

下一步按以下顺序推进：

1. 等待图标、简介审核结果，并核对匹配实际功能的服务类目。新小程序名称“魔方根”已通过，AppID 已取得，无需重复创建。截图提示发布前名称可保留 30 天，需及时发布版本或完成小程序备案；具体保留截止时间以后台为准，不将本次基础信息提审视为备案或版本提审。
2. 企业小程序备案材料已提交，11 月 14 日确认仍在审核，具体阶段待核；收到补正要求时按实际情况修改并继续跟踪审核。网站 ICP 已完成，不再停留在等待首次主体入库阶段。
3. **跨平台同名小程序需串行备案**：官方 FAQ 还要求同主体、同名称的小程序不要同时在多个平台发起备案，先等一个平台出结果，再去另一个平台办理；另一平台可能走新增接入。这一限制独立于新主体首次备案限制，修正此前将微信与抖音备案一概并行的排期假设。
4. 等待备案期间可并行核对新 AppID 对应的请求/socket 域名、隐私声明、开发成员和服务端登录配置。新 AppID 写入被忽略的 `apps/miniprogram/project.douyin.config.json`；`DOUYIN_MINI_APP_SECRET` 仅由服务端安全配置，不写文档或提交代码。不因企业认证通过就直接切换旧应用的生产凭据。
5. 名称及备案就绪后，完成新应用登录、隐私和功能真机检查，处理原生化审核清单中的未闭环项，再上传版本、提审并发布。企业认证通过不能证明新应用已备案或可上线。

官方依据（2026-10-27 核对）：[开发准备](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/introduction/develop-process/prepare)、[小程序 ICP 备案指引](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/operation/miniapp-creation/ICPFiling/ICPintroduce)、[备案 FAQ：首次备案与跨平台同名限制](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/operation/miniapp-creation/ICPFiling/guide)。

#### 既有应用与工程记录（新主体需重新核对）

- [x] 资质审核期间继续复用现有小程序源码开发，不等待审核结果。
- [x] 同一 `src/` 可构建微信 `dist/` 和抖音 `dist-douyin/`，不复制页面、路由、BLE 协议或网站业务。
- [x] 已取得抖音小程序 AppID，用户已提供备案成功截图；本机开发者工具已导入正式应用，平台身份配置不入库。
- [x] request 合法域名已配置为 `https://api.cuberoot.me`，用户于 2026-09-21 确认添加成功。
- [ ] socket 合法域名仍需确认配置为 `wss://api.cuberoot.me`；智能魔方原生 BLE 向网站计时器转发事件时需要它。
- [x] `web-view` 合法域名已配置为 `https://cuberoot.me`，域名校验文件已部署并由用户于 2026-09-21 确认添加成功。
- [x] 分享菜单复用 `src/lib/share.ts` 适配：抖音显示/隐藏使用 `share`，微信保留 `shareAppMessage`/`shareTimeline`；不把微信参数传给抖音 API。
- [ ] 抖音后台的隐私政策预览已写入“蓝牙用于连接智能魔方”，但真机仍返回 10202“未声明蓝牙用途”。需上传含 `usePrivacyCheck: true` 的新包，并复核后台声明是否覆盖实际蓝牙 API 类目；通过前不能把政策文字预览当作能力已生效。BLE 以基础库 3.87.0、抖音 36.1+ 为最低验收基线，并在 iOS、Android 真机验收。
- [ ] 网站“抖音登录”还需单独申请并审核抖音网站应用，在服务端配置 `DOUYIN_LOGIN_CLIENT_KEY` 和 `DOUYIN_LOGIN_CLIENT_SECRET`。它与小程序 AppID/AppSecret 不是同一组凭据；未配置时网站不显示该入口。
- [ ] 上传体验版、处理平台扫描结果并完成平台审核；完成前只称“可开发产物”，不称“已上线”。

### 工程能力

- [x] 微信开发者工具可导入 `apps/miniprogram/`，产物目录为 `dist/`。
- [x] 抖音构建复用微信源码，经官方转换器输出 `dist-douyin/`；构建会拦截残留微信模板、API、登录端点、网页标记和不兼容应用配置。
- [x] 计时器通过 `web-view` 复用网站，并已在真机正常打开。
- [x] 网站首页 56 个静态公开入口全部来自 `@cuberoot/shared/site-directory`；小程序工具 tab 直接用 `web-view` 打开中文首页，完整复用卡片、搜索、动态内容、权限状态和响应式样式。
- [x] “我的” tab 是可分享的原生账号入口：未登录时提供当前平台登录，抖音首登要求手动同意用户协议与隐私政策；已登录时显示轻量账号摘要和本机退出，账号管理继续通过 `web-view` 复用网站 `/zh/account`。
- [x] 原生微信登录已接入后端 `/v1/auth/wechat/miniprogram`。
- [x] 原生抖音登录已接入后端 `/v1/auth/douyin/miniprogram`，登录前要求手动同意用户协议与隐私政策，使用 `tt.login({ force: true })`。
- [x] 微信登录只接受 UnionID；抖音优先使用 UnionID，code2session 暂未返回 UnionID 时兼容 OpenID，并在后续拿到 UnionID 时安全升级同一条身份，不新建第二个账号。
- [x] 微信开发者工具的旧 Chromium 兼容边界固定为 Chrome 91，并有网站回归测试保护。
- [x] 小程序构建目标固定为 Chrome 91，避免产物使用模拟器不支持的语法。
- [x] `web-view` 统一处理非法地址、加载失败和重试。
- [x] 开发监听覆盖 TS、WXML、WXSS 和 JSON，不再要求手动重启构建。
- [ ] 网站扫码登录和小程序登录落到同一个 `uid` 的线上验收尚未完成。
- [x] 登录后的原生会话与 `web-view` 网站会话已通过短时单次换票打通；部署后的真机联调尚未完成。
- [x] 换票 migration 已在本地 PostgreSQL 验证表结构、外键、过期索引和单次核销；生产部署尚未执行。
- [x] 账号资料、登录方式、退出和隐私入口统一由网站账号页提供，小程序不再复制第二套账号操作界面。
- [x] 上传前脚本会拦截游客 AppID、未明确确认的基础库、关闭合法域名校验、旧或不完整的 `dist`，以及未经复核的敏感 API。
- [x] 上传前脚本会扫描源码和上传产物，发现 AppSecret 或私钥即阻止发布。
- [x] 正式版下载到新版本后允许用户选择立即重启或稍后更新，下载失败不会阻断当前使用。
- [x] 确认退出后立即清除小程序会话，再尝试打开不创建新票据的受控网页退出路由；网站不可达不会阻止本地退出。
- [x] 智能魔方采用“原生 BLE 数据源 + 网站计时器接收方”，没有复制计时器 UI、成绩或统计逻辑。
- [x] GAN v2/v3/v4、GoCube、Giiker/米家、MoYu AI MHC 旧协议、MoYu32 与 QiYi/Tornado V4 已接入原生连接页；开发者工具使用同一中继的模拟数据，不再无限显示连接中。
- [x] 中继只保存在服务端内存，限制帧大小、频率和通道数量，不记录会话令牌或魔方实时数据。
- [x] 初始魔方状态、连接中取消、旧连接迟到回调和计时页恢复均有竞态回归测试。
- [ ] GAN 16 ui 的真实硬件连接、转动、状态、电量、断开和重连尚待 Android 设备验收。

### 网站首页入口覆盖（2026-08-30）

事实源为 `packages/shared/src/site_directory.ts`。工具 tab 不再把目录转换成第二套原生列表，而是直接打开 `https://cuberoot.me/zh`；卡片尺寸、图标、搜索、动态模块、权限状态、顺序和响应式样式都以网站首页为唯一实现。

| 完成 | 分组 | 目录 ID | 网站入口 | 小程序动作 |
|---|---|---|---|---|
| [x] | 常用 | `timer` | `/timer` | 原生底栏计时页 |
| [x] | 常用 | `algdb` | `/alg` | 网页白名单键 `alg` |
| [x] | 常用 | `sim` | `/sim` | 网页白名单 |
| [x] | 常用 | `recon` | `/recon` | 网页白名单 |
| [x] | 常用 | `scramble` | `/scramble` | 网页白名单 |
| [x] | WCA | `competitions` | `/wca/comp` | 网页白名单 |
| [x] | WCA | `wca-results` | `/wca/results` | 网页白名单 |
| [x] | WCA | `wca-stats` | `/wca` | 网页白名单 |
| [x] | 训练 | `memo` | `/memo/colpi` | 网页白名单 |
| [x] | 训练 | `predict` | `/predict` | 网页白名单 |
| [x] | 训练 | `color-test` | `/color-test` | 网页白名单 |
| [x] | 训练 | `blddb` | `/blddb` | 网页白名单 |
| [x] | 训练 | `trainer` | `/alg-trainers` | 网页白名单 |
| [x] | 训练 | `cstimer` | `/cstimer` | 网页白名单 |
| [x] | 工具 | `contests` | `/contests` | 网页白名单 |
| [x] | 工具 | `online-competitions` | `/platform/events/online` | 网页白名单，报名复用平台订单 |
| [x] | 工具 | `comp-sim` | `/comp-sim` | 网页白名单 |
| [x] | 工具 | `frame-count` | `/frame-count` | 网页白名单 |
| [x] | 工具 | `solver` | `/solver` | 网页白名单 |
| [x] | 工具 | `mosaic` | `/mosaic` | 网页白名单 |
| [x] | 工具 | `lettering` | `/lettering` | 网页白名单，复用网站拼字页面 |
| [x] | 工具 | `space` | `/space` | 网页白名单 |
| [x] | 工具 | `paper-odyssey` | `/dev/architecture/log?mode=play` | 网页白名单，保留游戏模式参数 |
| [x] | 工具 | `paint` | `/paint` | 网页白名单 |
| [x] | 工具 | `icon` | `/icon` | 网页白名单 |
| [x] | 工具 | `timezone` | `/timezone` | 网页白名单 |
| [x] | 工具 | `calendar` | `/calendar` | 网页白名单 |
| [x] | 学习 | `platform` | `/platform` | 网页白名单 |
| [x] | 学习 | `teaching-management` | `/org` | 网页白名单 |
| [x] | 学习 | `learning-center` | `/learn` | 网页白名单 |
| [x] | 学习 | `teaching` | `/courses` | 网页白名单 |
| [x] | 学习 | `teachers` | `/teachers` | 网页白名单 |
| [x] | 学习 | `live-scripts` | `/teachers/scripts` | 网页白名单 |
| [x] | 学习 | `meet` | `/meet` | 网页白名单 |
| [x] | 学习 | `partnership` | `/partnership` | 小程序禁用，仅网站管理员入口 |
| [x] | 学习 | `interview` | `/interview` | 小程序禁用，仅网站管理员入口 |
| [x] | 学习 | `documents` | `/docs` | 协作文档统一展示文档与表格，网页白名单 |
| [x] | 学习 | `alg` | `/tutorial` | 保留网站“管理员维护中”，禁用跳转 |
| [x] | 学习 | `quiz` | `/quiz` | 网页白名单 |
| [x] | 学习 | `wiki` | `/wiki` | 网页白名单 |
| [x] | 学习 | `cube-history` | `/cube-history` | 网页白名单 |
| [x] | 学习 | `regulation` | `/regulation` | 网页白名单 |
| [x] | 学习 | `notation` | `/notation` | 网页白名单 |
| [x] | 学习 | `math-hub` | `/math` | 网页白名单 |
| [x] | 学习 | `why-cube` | `/why-cube` | 网页白名单 |
| [x] | 其他 | `forum` | `/forum` | 网页白名单 |
| [x] | 其他 | `gallery` | `/gallery` | 网页白名单 |
| [x] | 其他 | `music` | `/music` | 网页白名单 |
| [x] | 其他 | `drive` | `/drive` | 网页白名单 |
| [x] | 其他 | `contact` | `/contact` | 网页白名单 |
| [x] | 其他 | `feedback` | `/feedback` | 网页白名单 |
| [x] | 其他 | `dev` | `/dev` | 网页白名单 |
| [x] | 其他 | `blog` | `/blog/` | 从主域 `/zh/blog` 进入规范跳转，不申请登录换票 |
| [x] | 其他 | `site` | `/site` | 网页白名单 |
| [x] | 其他 | `wb` | `/wb` | 网页白名单 |
| [x] | 其他 | `achievements` | `/achievements` | 网页白名单 |
| [x] | 其他 | `creator` | `/about/ruimin` | 网页白名单 |
| [x] | 关于 | `about` | `/about` | 网页白名单 |
| [x] | 关于 | `support` | `/support` | 网页白名单，与“我的”页复用同一路由 |
| [x] | 关于 | `github` | 外部仓库 | 复制链接，不把任意外域交给 `web-view` |

共 60 项：网站首页直接渲染它们，工具 tab 通过一个固定白名单路由复用整个首页。单项受控网页路由仍供计时、账号和小程序深链复用；测试继续锁定七组目录、60 个唯一 ID、白名单真实页面和首页 tab 分享路径。协作文档统一收纳文档与表格；合作提案仅计入目录，不新增小程序公开网页入口。

`wca-records` 保留为旧分享链接的兼容入口，转到 `/wca/results?tab=records`；首页只展示合并后的 `wca-results`，搜索“纪录 / Records”仍可找到它。

### 线上比赛报名支付

- [x] 网站订单页在微信小程序中仅将赛事订单交给原生 `pages/payment/index`，只传订单 ID；原生页复用当前账号会话、微信登录与服务端支付栈。
- [x] 服务端校验订单归属，以微信 code 换取 OpenID 并核对 UnionID 对应的 CubeRoot 账号；JSAPI 下单和 `requestPayment` 使用真实 RSA 签名，付款回调复用现有验签、核销和报名履约。
- [x] 原生支付结果不直接作为付款成功凭据；原生页与网页订单均刷新服务端订单状态，支持取消后重试、返回订单和通知延迟。
- [x] 抖音、虚拟课程订单和未配置的微信商户能力给出明确不可用提示。微信赛事原生收款还需服务端 `WECHAT_MINI_APP_ID`、同一商户绑定以及显式 `WECHAT_MINI_PAY_ENABLED=true`，默认关闭。
- [ ] 完成微信开发者工具关闭项目后重开编译、iOS/Android 真机真实报名付款、异步通知、返回订单和退款验收。代码回归不能替代商户配置与真实支付证据。

网站首页的“最近打乱”“今日复盘”“进行中比赛”“论坛动态”、登录头像、管理入口和首页公告现在也由同一个网页实时提供，小程序包不复制它们的 UI、请求或状态。

## 4. 账号方案

网站微信扫码登录和微信小程序登录都以同一开放平台返回的 UnionID 作为：

```text
provider = wechat
provider_uid = unionid
```

禁止在 UnionID 缺失时回退到 OpenID。两者命名空间不同，回退会把一个用户拆成两个账号。

抖音小程序登录优先使用服务端 code2session 返回的 UnionID：

```text
provider = douyin
provider_uid = unionid（优先）或 openid（平台未返回 UnionID 时兼容）
```

已有 OpenID 身份在同一账号后续拿到 UnionID 时原位升级；若该 UnionID 已归属其他账号则拒绝覆盖。抖音身份与现有微信、邮箱或 WCA 身份之间没有可验证的自动对应关系：已知身份直接登录，未知身份需明确创建，或在网站原账号页生成六位数字登录码后由小程序核对并绑定；不猜测合并。六位码全局唯一、短时有效、最多尝试五次，只是一次性绑定凭证，不是第二套账号密码。

网站“抖音登录”复用现有第三方登录与账号合并链路：电脑端显示抖音官方扫码授权，移动端由抖音官方授权页拉起 App 或继续网页登录。它要求单独审核的网站应用 ClientKey/Secret，不能拿小程序 AppID/AppSecret 代替。

微信手机号实时授权增量（2026-09-12，本地实现，未据此确认发布）：未绑定 UnionID 可通过 `getRealtimePhoneNumber` 获取独立一次性 `phoneCode`；后端同时验证本次登录 OpenID、手机号凭证和 AppID 水印。手机号已有账号先预览并确认，未匹配则明确创建或复用上述绑定码；两个身份在既有 pending 事务中原子绑定，不能静默合并/覆盖。拒绝授权或不支持时继续提供原账号验证；已绑定微信不重复要求手机号。目前复用中国大陆号码契约，不把其他区号转换为 +86。实现与发布前检查见 [小程序 README](../apps/miniprogram/README.md#微信手机号实时授权2026-09-12本地接入)。

原生小程序的 JWT 存在小程序本地存储中，网站登录态由现有 `applySession()` 写入网页 `localStorage`，两者不会自动共享。现在统一走服务端一次性换票：小程序用 Bearer JWT 申请 90 秒单次 ticket，把 ticket 放在 URL fragment 中交给网页；网页原子核销后获得新 JWT 和当前账号资料，再调用网站已有的 `applySession()`。长期 JWT 不进入 URL，服务端只保存 ticket 的 SHA-256。

“我的” tab 只保留可分享的原生登录门、轻量账号摘要和本机退出，不复制网站账号资料或设置界面。没有小程序会话时调用当前平台 `login` 交换入口；抖音登录前由用户手动同意共用的用户协议与隐私政策。获得会话后仍停留在原生页，只有用户主动点“打开账号管理”才走一次性换票进入网站账号页。设备存储不可读、登录失败或票据失败时分别留在可重试状态，不以游客身份绕过登录门。

## 5. 开发和验收

在 `core/` 运行：

```sh
pnpm --filter @cuberoot/miniprogram dev
pnpm --filter @cuberoot/miniprogram check
pnpm --filter @cuberoot/miniprogram check:douyin
```

微信开发者工具导入 `core/apps/miniprogram` 并读取 `dist/`；抖音开发者工具直接导入 `core/apps/miniprogram/dist-douyin`。`check:douyin` 只做类型、回归、转换和产物兼容检查，不代替正式 AppID、后台配置、真机或平台审核。
抖音构建会在 `apps/miniprogram/.tmp/wx-to-tt-log/__wxToTT/report/index.html` 留下官方转换器的最新逐文件报告。报告含本机绝对路径且可重复生成，只保留本机副本，不提交仓库。

上传前先在微信开发者工具确认当时的稳定基础库，再显式传入同一版本执行闸门：

```powershell
$env:WECHAT_MINI_LIB_VERSION='<开发者工具显示的稳定版本>'
$env:WECHAT_MINI_SOCKET_DOMAIN_CONFIGURED='1' # 仅在后台配置 wss://api.cuberoot.me 后设置
$env:WECHAT_MINI_BASIC_INFO_APPROVED='1'
$env:WECHAT_MINI_FILING_COMPLETED='1'
$env:WECHAT_MINI_PRIVACY_REVIEWED='1'
$env:WECHAT_MINI_PHONE_AUTHORIZATION_REVIEWED='1' # 核验实时手机号能力、额度、隐私声明和真机确认后设置
$env:WECHAT_MINI_IOS_REAL_DEVICE_TESTED='1'
$env:WECHAT_MINI_ANDROID_REAL_DEVICE_TESTED='1'
$env:WECHAT_MINI_GAN16UI_TESTED='1' # Android 真机完成 GAN 16 ui 全链路回归后设置
$env:WECHAT_MINI_GOCUBE_TESTED='1'
$env:WECHAT_MINI_GIIKER_TESTED='1'
$env:WECHAT_MINI_MOYU_TESTED='1'
pnpm --filter @cuberoot/miniprogram build
pnpm --filter @cuberoot/miniprogram release:check
```

`build` 会保留已有正式 AppID 和明确的数字基础库；不会把已选好的本地版本重置回 `trial`。构建成功后会在被忽略的 `.tmp/` 写入源码和产物指纹，不进入上传包。`release:check` 会先运行类型检查和全部小程序回归测试，再拒绝缺页、源码变化后的旧 `dist`、构建后被改动的 `dist`，扫描源码和上传产物中的服务端凭据，并要求每次上传显式确认稳定版本、socket 合法域名、基础信息审核、备案、后台隐私指引、双平台真机和已支持设备的全链路回归。环境变量只是防遗忘闸门，不能代替真实操作。

构建会保留 `project.config.json` 或 `project.douyin.config.json` 中已解析的本机 AppID；它们和 `project.private.config.json` 都不提交，也不包含密钥。

每轮完成定义：

1. 先搜索网站和 `@cuberoot/shared` 是否已有逻辑、数据或组件契约。
2. 修改唯一来源，不在页面层复制路由、状态或文案。
3. `pnpm --filter @cuberoot/miniprogram check` 全绿。
4. 微信开发者工具模拟器检查无持续 Loading、无脚本错误。
5. 智能魔方在模拟器执行“连接模拟器”，确认网站计时器收到连接、状态、转动、电量和断开事件。
6. 至少一台真机检查首页、返回、登录、失败重试和窄屏文字；涉及 BLE 时另做兼容设备连接、转动、状态、电量、断开和重连。
7. 更新本文件的状态、风险和迭代记录。
8. 检查提交内容，不包含 AppSecret、临时校验文件或其他 AI 的改动。

模拟器持续显示 Loading、但真机网页正常时，先确认 WXML 中实际存在 `web-view`，再检查网站产物有没有高于 Chrome 91 的语法。这个现象此前的根因是开发者工具内核过旧，不是业务域名；网站浏览器目标和小程序编译目标中的 Chrome 91 约束都不能随意删除。

## 6. 上线阻塞清单

### 微信

按顺序处理：

1. 真机执行一次“网站扫码登录 + 小程序微信登录”，确认两端为同一 `uid`。
2. 按实际收集的信息填写用户隐私保护指引，不声明未使用的权限。
3. 选择稳定基础库，运行 `release:check`，上传体验版，管理员和体验成员完成回归。
4. 上传正式版本，填写版本说明，提交微信审核。
5. 审核通过后发布；发布后再次检查登录、`web-view`、返回路径和错误恢复。

备案和平台审核可以与代码开发并行，但未完成前不能宣布已经上线。

### 抖音

1. 确认服务端小程序密钥已部署；如需网站抖音扫码/App 登录，另行申请网站应用并配置对应 ClientKey/Secret。
2. 确认 request、socket、`web-view` 三类域名分别生效；2026-10-14 已在正式应用后台核对三类配置，实际业务链路仍分别真机验收。
3. 按实际使用的登录、网络和蓝牙能力填写隐私说明，不扩大声明范围；后台文字预览不是 10202 已消失的证据。
4. 上传含 `usePrivacyCheck: true` 的体验版，在抖音开发者工具验收普通流程，并用基础库 3.87.0、抖音 36.1+ 的 iOS、Android 真机验收登录、`web-view`、返回路径、错误恢复和 BLE；官方沙盒不支持 BLE，模拟器结果不能替代真机。
5. 处理平台扫描结果，再提交审核和发布。

## 7. 近期迭代队列

### P0：首版上线

- [ ] 完成同账号验收。
- [ ] 完成模拟器与 iOS、Android 真机回归。
- [x] 补齐代码侧隐私政策、隐私入口、基础库保留与上传闸门。
- [ ] 在小程序后台填写隐私保护指引，并确认当时的稳定基础库。
- [ ] 上传体验版并处理代码质量扫描中的真实问题。

### P1：减少登录割裂

- [x] 实现原生登录到网站现有登录态的一次性换票，不复制第二套网页会话机制。
- [x] “我的” tab 未登录时走原生微信登录，已有或新建的小程序会话停留在原生摘要页；用户主动打开账号管理时再通过一次性换票进入网站账号页，不复制账号状态、绑定或资料界面。
- [x] 为换票接口补格式、过期条件、原子核销、重放、并发和退出竞态测试。
- [x] 退出复用网站现有 `logout()`，不在小程序复制 `localStorage` 键或另建第二套登出协议。
- [x] 换票超时、断网或服务端临时故障时留在可重试状态，不静默打开未登录网页；只有会话已失效或已被用户替换时才进入公开页面。
- [ ] 部署后补同账号、跨账号和 iOS、Android 真机端到端验收。

### P2：微信专属增量

- [x] 完成 GAN v2/v3/v4、GoCube/Rubik's Connected、Giiker/米家与 MoYu AI MHC 旧协议的代码级 BLE 接入：共享协议解析、微信 BLE 传输、短时中继、网站桥接和开发者工具模拟器均有回归测试。
- [x] GAN v2/v3/v4 设备统一走协议能力识别，不按型号复制驱动；GAN 16 ui 是首要真机验收型号，其他型号在实测前只视为协议兼容尝试。
- [x] 网站既有 GAN v2/v3 纯协议已提取到共享包；小程序按实际 GATT 服务选择 v2、v3 或 v4，继续复用同一连接生命周期和计时器中继。
- [ ] 用真实 GAN 16 ui 完成 Android 连接、转动、完整状态、电量、断开和重连验证；通过前只声明“代码兼容”，不宣称“硬件验证通过”。
- [ ] 用真实 GoCube/Rubik's Connected 完成至少一台支持微信 BLE 的手机验收。
- [ ] 用真实 Giiker/米家设备完成至少一台支持微信 BLE 的手机验收。
- [ ] 用真实 MoYu AI MHC 旧协议设备完成至少一台支持微信 BLE 的手机验收。
- [ ] 继续复用网站现有协议驱动覆盖 MoYu32、QiYi 等协议族；每一族先共享纯协议，再写微信 BLE 传输适配器。
- [ ] 验证后台计时、息屏、断连重连和 iOS 平台限制；不为此原生重写计时器。
- [ ] 仅在用户主动订阅后接入比赛或课程提醒。

暂不原生迁移复杂 Three.js、地图、视频通话、ffmpeg.wasm 和大型分析器。它们继续由网站承载，除非出现明确的平台需求和收益。

## 8. 已知风险

- 纯 `web-view` 页面会受网站发布影响，因此网站的 Chrome 91 回归测试不能删除。
- 模拟器正常不等于真机正常，尤其是登录、业务域名、网页存储和蓝牙能力。
- `web-view` 与原生层是两个存储环境，不能假设 localStorage、Cookie 或 JWT 自动互通。
- 小程序包体、基础库和审核规则会变化；涉及发布规则时以当时后台和官方文档为准。
- 主体、类目、名称和隐私声明必须与实际产品一致，不能为了审核临时写一套与产品不符的描述。

### 后台隐私指引的实际数据清单

| 数据或能力 | 当前是否使用 | 用途 |
|---|---|---|
| 微信一次性登录凭证、UnionID | 用户主动登录时使用 | 识别与网站相同的 CubeRoot 账号 |
| 抖音一次性登录凭证、OpenID、UnionID | 用户主动登录时使用 | 识别抖音身份；优先用 UnionID，缺失时兼容 OpenID，并支持用户明确绑定网站原账号 |
| CubeRoot 会话凭证、显示名、WCA ID | 登录后使用 | 保持登录状态和显示账号信息 |
| 短时单次网页换票 | 登录后打开网页时使用 | 让 `web-view` 复用同一账号，不在 URL 暴露长期会话 |
| 附近蓝牙设备、智能魔方转动、状态、电量与姿态 | 用户主动点击计时器蓝牙入口后使用 | 连接兼容魔方并把实时事件交给网站计时器；不写入数据库 |
| IP、浏览器或设备类型等标准请求信息 | 网络请求时可能处理 | 提供服务、安全防护和故障诊断 |
| 微信昵称、头像 | 不使用 | 后台不应声明收集 |
| 微信手机号（用户主动实时验证授权） | 登录查找原账号、确认后绑定；待确认记录 15 分钟过期，成功后留在原账号身份表 | 后台须声明手机号用于登录及账号绑定；拒绝授权不阻断公开工具，不把本地实现写成后台已完成 |
| 定位、摄像头、麦克风、相册、通讯录 | 不使用 | 后台不应声明收集 |

## 9. 迭代记录索引

过程日志已完整迁往[历史记录](MINIPROGRAM-history.md)，保留决策、提交和验收限制。下列小节保留原锚点供旧链接定位。

### 2026-10-14：抖音上架前复核（未发布）

见[历史记录](MINIPROGRAM-history.md#2026-10-14抖音上架前复核未发布)。

### 2026-09-21：六位登录码、网站抖音登录与蓝牙隐私跟踪

见[历史记录](MINIPROGRAM-history.md#2026-09-21六位登录码网站抖音登录与蓝牙隐私跟踪)。

### 2026-08-30：原生“我的”朋友圈登录入口

见[历史记录](MINIPROGRAM-history.md#2026-08-30原生我的朋友圈登录入口)。

### 2026-08-30：“我的” tab 网站账号页方案（已替代）

见[历史记录](MINIPROGRAM-history.md#2026-08-30我的-tab-网站账号页方案已替代)。

### 2026-08-30：工具 tab 完整复用网站首页

见[历史记录](MINIPROGRAM-history.md#2026-08-30工具-tab-完整复用网站首页)。

### 2026-08-30：网站首页 53 个入口单源同步

见[历史记录](MINIPROGRAM-history.md#2026-08-30网站首页-53-个入口单源同步)。

### 2026-08-16：原生 BLE 与网站计时器短时中继

见[历史记录](MINIPROGRAM-history.md#2026-08-16原生-ble-与网站计时器短时中继)。

### 2026-08-16：权威账号回写失败不得显示就绪

见[历史记录](MINIPROGRAM-history.md#2026-08-16权威账号回写失败不得显示就绪)。

### 2026-08-16：跨端账号 UID 契约

见[历史记录](MINIPROGRAM-history.md#2026-08-16跨端账号-uid-契约)。

### 2026-08-16：隔离延迟重试生命周期

见[历史记录](MINIPROGRAM-history.md#2026-08-16隔离延迟重试生命周期)。

### 2026-08-16：账号状态可恢复反馈

见[历史记录](MINIPROGRAM-history.md#2026-08-16账号状态可恢复反馈)。

### 2026-08-16：上传包主题与凭据硬门禁

见[历史记录](MINIPROGRAM-history.md#2026-08-16上传包主题与凭据硬门禁)。

### 2026-08-16：微信搜索收录边界

见[历史记录](MINIPROGRAM-history.md#2026-08-16微信搜索收录边界)。

### 2026-08-16：跨端退出一致性

见[历史记录](MINIPROGRAM-history.md#2026-08-16跨端退出一致性)。

### 2026-08-16：退出登录本地优先

见[历史记录](MINIPROGRAM-history.md#2026-08-16退出登录本地优先)。

### 2026-08-16：网页重试退出竞态

见[历史记录](MINIPROGRAM-history.md#2026-08-16网页重试退出竞态)。

### 2026-08-16：正式版更新体验

见[历史记录](MINIPROGRAM-history.md#2026-08-16正式版更新体验)。

### 2026-08-16：网页容器生命周期收口

见[历史记录](MINIPROGRAM-history.md#2026-08-16网页容器生命周期收口)。

### 2026-08-16：账号状态反馈一致性

见[历史记录](MINIPROGRAM-history.md#2026-08-16账号状态反馈一致性)。

### 2026-08-16：上传产物新鲜度与完整性

见[历史记录](MINIPROGRAM-history.md#2026-08-16上传产物新鲜度与完整性)。

### 2026-08-16：本地会话与账号响应边界

见[历史记录](MINIPROGRAM-history.md#2026-08-16本地会话与账号响应边界)。

### 2026-08-16：账号页异步生命周期

见[历史记录](MINIPROGRAM-history.md#2026-08-16账号页异步生命周期)。

### 2026-08-16：网页状态界面唯一来源

见[历史记录](MINIPROGRAM-history.md#2026-08-16网页状态界面唯一来源)。

### 2026-08-16：发布闸门与网站路由防漂移

见[历史记录](MINIPROGRAM-history.md#2026-08-16发布闸门与网站路由防漂移)。

### 2026-08-16：网页页适配器收敛与复用守卫

见[历史记录](MINIPROGRAM-history.md#2026-08-16网页页适配器收敛与复用守卫)。

### 2026-08-16：模拟器永久加载根因保护

见[历史记录](MINIPROGRAM-history.md#2026-08-16模拟器永久加载根因保护)。

### 2026-08-16：认证请求统一截止

见[历史记录](MINIPROGRAM-history.md#2026-08-16认证请求统一截止)。

### 2026-08-16：隐私唯一来源与上传闸门

见[历史记录](MINIPROGRAM-history.md#2026-08-16隐私唯一来源与上传闸门)。

### 2026-08-16：“我的”页跨端账号入口

见[历史记录](MINIPROGRAM-history.md#2026-08-16我的页跨端账号入口)。

### 2026-08-16：原生与网站会话衔接

见[历史记录](MINIPROGRAM-history.md#2026-08-16原生与网站会话衔接)。

### 2026-08-16：维护性收口

见[历史记录](MINIPROGRAM-history.md#2026-08-16维护性收口)。

### 2026-08-16：开发者工具兼容修复

见[历史记录](MINIPROGRAM-history.md#2026-08-16开发者工具兼容修复)。

### 2026-08-16：深色模式完整适配

见[历史记录](MINIPROGRAM-history.md#2026-08-16深色模式完整适配)。

### 2026-08-16：原生点击反馈统一

见[历史记录](MINIPROGRAM-history.md#2026-08-16原生点击反馈统一)。

### 2026-08-16：原生触控尺寸收口

见[历史记录](MINIPROGRAM-history.md#2026-08-16原生触控尺寸收口)。

### 2026-08-16：网页入口导航收口

见[历史记录](MINIPROGRAM-history.md#2026-08-16网页入口导航收口)。

### 2026-08-16：开发产物与上传包分离

见[历史记录](MINIPROGRAM-history.md#2026-08-16开发产物与上传包分离)。

### 2026-08-16：工具页窄屏文案保护

见[历史记录](MINIPROGRAM-history.md#2026-08-16工具页窄屏文案保护)。

### 2026-08-16：网页换票退出竞态保护

见[历史记录](MINIPROGRAM-history.md#2026-08-16网页换票退出竞态保护)。

### 2026-08-16：登录跨页面生命周期恢复

见[历史记录](MINIPROGRAM-history.md#2026-08-16登录跨页面生命周期恢复)。

### 2026-08-16：AppSecret 轮换门禁（后于 2026-08-27 取消）

见[历史记录](MINIPROGRAM-history.md#2026-08-16appsecret-轮换门禁后于-2026-08-27-取消)。

### 2026-08-16：网页登录交接硬截止

见[历史记录](MINIPROGRAM-history.md#2026-08-16网页登录交接硬截止)。

### 2026-08-16：正式发布身份锁定

见[历史记录](MINIPROGRAM-history.md#2026-08-16正式发布身份锁定)。

### 2026-08-16：上传包体积预算

见[历史记录](MINIPROGRAM-history.md#2026-08-16上传包体积预算)。

### 2026-08-16：账号头像字符安全

见[历史记录](MINIPROGRAM-history.md#2026-08-16账号头像字符安全)。

### 2026-08-16：统一导航失败语义

见[历史记录](MINIPROGRAM-history.md#2026-08-16统一导航失败语义)。

### 2026-08-16：原生读屏语义

见[历史记录](MINIPROGRAM-history.md#2026-08-16原生读屏语义)。

### 2026-08-16：旧换票不得清除新账号

见[历史记录](MINIPROGRAM-history.md#2026-08-16旧换票不得清除新账号)。

### 2026-08-16：未登录与损坏存储分流

见[历史记录](MINIPROGRAM-history.md#2026-08-16未登录与损坏存储分流)。

### 2026-08-16：正式项目类型锁定

见[历史记录](MINIPROGRAM-history.md#2026-08-16正式项目类型锁定)。

### 2026-08-16：发布命令自带质量验证

见[历史记录](MINIPROGRAM-history.md#2026-08-16发布命令自带质量验证)。

### 2026-08-16：页面标题失败不阻断内容

见[历史记录](MINIPROGRAM-history.md#2026-08-16页面标题失败不阻断内容)。

### 2026-08-16：账号存储异常不伪造成功

见[历史记录](MINIPROGRAM-history.md#2026-08-16账号存储异常不伪造成功)。

### 2026-08-16：非关键平台 API 失败隔离

见[历史记录](MINIPROGRAM-history.md#2026-08-16非关键平台-api-失败隔离)。

### 2026-08-16：网页重试调度降级

见[历史记录](MINIPROGRAM-history.md#2026-08-16网页重试调度降级)。

### 2026-08-16：请求超时必须收口

见[历史记录](MINIPROGRAM-history.md#2026-08-16请求超时必须收口)。

### 2026-08-16：上传内容双边界审计

见[历史记录](MINIPROGRAM-history.md#2026-08-16上传内容双边界审计)。

### 2026-08-16：导航锁异常回收

见[历史记录](MINIPROGRAM-history.md#2026-08-16导航锁异常回收)。

### 2026-08-16：退出确认防重复触发

见[历史记录](MINIPROGRAM-history.md#2026-08-16退出确认防重复触发)。

### 2026-08-16：销毁页面拒绝重新打开

见[历史记录](MINIPROGRAM-history.md#2026-08-16销毁页面拒绝重新打开)。

### 2026-08-16：退出确认回调隔离

见[历史记录](MINIPROGRAM-history.md#2026-08-16退出确认回调隔离)。

### 2026-08-16：会话请求头字符约束

见[历史记录](MINIPROGRAM-history.md#2026-08-16会话请求头字符约束)。

### 2026-08-16：账号页平台弹窗统一互斥

见[历史记录](MINIPROGRAM-history.md#2026-08-16账号页平台弹窗统一互斥)。

### 2026-08-16：版本更新提示幂等

见[历史记录](MINIPROGRAM-history.md#2026-08-16版本更新提示幂等)。

### 2026-08-16：版本更新回调隔离

见[历史记录](MINIPROGRAM-history.md#2026-08-16版本更新回调隔离)。

### 2026-08-16：账号显示名入口约束

见[历史记录](MINIPROGRAM-history.md#2026-08-16账号显示名入口约束)。

### 2026-08-16：底栏信息架构直述

见[历史记录](MINIPROGRAM-history.md#2026-08-16底栏信息架构直述)。

### 2026-08-16：账号文本字段入口约束

见[历史记录](MINIPROGRAM-history.md#2026-08-16账号文本字段入口约束)。

### 2026-08-16：账号视图只渲染会话契约

见[历史记录](MINIPROGRAM-history.md#2026-08-16账号视图只渲染会话契约)。

### 2026-08-16：网页重试调度硬兜底

见[历史记录](MINIPROGRAM-history.md#2026-08-16网页重试调度硬兜底)。

### 2026-08-16：导航锁按尝试隔离

见[历史记录](MINIPROGRAM-history.md#2026-08-16导航锁按尝试隔离)。

### 2026-08-16：隐私协议入口异常恢复

见[历史记录](MINIPROGRAM-history.md#2026-08-16隐私协议入口异常恢复)。

### 2026-08-16：网页页面复用结构锁

见[历史记录](MINIPROGRAM-history.md#2026-08-16网页页面复用结构锁)。

### 2026-08-16：工具入口单一登记源

见[历史记录](MINIPROGRAM-history.md#2026-08-16工具入口单一登记源)。

### 2026-08-16：发布页面与导航边界

见[历史记录](MINIPROGRAM-history.md#2026-08-16发布页面与导航边界)。

### 2026-08-16：网页加载代际隔离

见[历史记录](MINIPROGRAM-history.md#2026-08-16网页加载代际隔离)。

### 2026-08-16：搜索策略发布绑定

见[历史记录](MINIPROGRAM-history.md#2026-08-16搜索策略发布绑定)。

### 2026-08-16：上传内容分类审计

见[历史记录](MINIPROGRAM-history.md#2026-08-16上传内容分类审计)。

### 2026-08-16：更新失败提示去重

见[历史记录](MINIPROGRAM-history.md#2026-08-16更新失败提示去重)。

### 2026-08-16：网页失败文案随路由登记

见[历史记录](MINIPROGRAM-history.md#2026-08-16网页失败文案随路由登记)。

### 2026-08-16：账号刷新单一入口

见[历史记录](MINIPROGRAM-history.md#2026-08-16账号刷新单一入口)。

### 2026-08-16：网页交接目标路径边界

见[历史记录](MINIPROGRAM-history.md#2026-08-16网页交接目标路径边界)。

### 2026-08-16：平台交互守卫复用

见[历史记录](MINIPROGRAM-history.md#2026-08-16平台交互守卫复用)。

### 2026-08-16：网站导航复用平台交互守卫

见[历史记录](MINIPROGRAM-history.md#2026-08-16网站导航复用平台交互守卫)。

### 2026-08-16：网页会话交接契约单一入口

见[历史记录](MINIPROGRAM-history.md#2026-08-16网页会话交接契约单一入口)。

### 2026-08-16：网页错误事件严格归属

见[历史记录](MINIPROGRAM-history.md#2026-08-16网页错误事件严格归属)。

### 2026-08-16：网站导航随页面离场收口

见[历史记录](MINIPROGRAM-history.md#2026-08-16网站导航随页面离场收口)。

### 2026-08-16：网页重试计时器异常降级

见[历史记录](MINIPROGRAM-history.md#2026-08-16网页重试计时器异常降级)。

### 2026-08-16：账号请求计时器安全收口

见[历史记录](MINIPROGRAM-history.md#2026-08-16账号请求计时器安全收口)。

### 2026-08-16：运行时定时器单一入口

见[历史记录](MINIPROGRAM-history.md#2026-08-16运行时定时器单一入口)。

### 2026-08-16：人工发布条件变为硬门槛

见[历史记录](MINIPROGRAM-history.md#2026-08-16人工发布条件变为硬门槛)。

### 2026-08-16：账号下拉刷新

见[历史记录](MINIPROGRAM-history.md#2026-08-16账号下拉刷新)。

### 2026-08-16：网页断网恢复

见[历史记录](MINIPROGRAM-history.md#2026-08-16网页断网恢复)。

### 2026-08-16：公开网页分享路由

见[历史记录](MINIPROGRAM-history.md#2026-08-16公开网页分享路由)。

### 2026-08-16：账号存储故障不再伪装成退出

见[历史记录](MINIPROGRAM-history.md#2026-08-16账号存储故障不再伪装成退出)。

### 2026-08-16：分享卡片不截取计时成绩

见[历史记录](MINIPROGRAM-history.md#2026-08-16分享卡片不截取计时成绩)。

### 2026-08-16：弱网恢复跟随页面可见状态

见[历史记录](MINIPROGRAM-history.md#2026-08-16弱网恢复跟随页面可见状态)。

### 2026-08-16：工具首页固定分享入口

见[历史记录](MINIPROGRAM-history.md#2026-08-16工具首页固定分享入口)。

### 2026-08-16：隐藏期间暂停重试可恢复

见[历史记录](MINIPROGRAM-history.md#2026-08-16隐藏期间暂停重试可恢复)。

### 2026-08-16：平台交互失败不再静默

见[历史记录](MINIPROGRAM-history.md#2026-08-16平台交互失败不再静默)。

### 2026-08-16：损坏会话清理失败不再伪装成退出

见[历史记录](MINIPROGRAM-history.md#2026-08-16损坏会话清理失败不再伪装成退出)。

### 2026-08-16：微信登录错误保持原始语义

见[历史记录](MINIPROGRAM-history.md#2026-08-16微信登录错误保持原始语义)。

### 2026-08-16：平台交互锁按动作类型分层

见[历史记录](MINIPROGRAM-history.md#2026-08-16平台交互锁按动作类型分层)。

### 2026-08-16：微信大字与窄屏排版边界

见[历史记录](MINIPROGRAM-history.md#2026-08-16微信大字与窄屏排版边界)。

### 2026-08-16：账号状态与操作反馈分层

见[历史记录](MINIPROGRAM-history.md#2026-08-16账号状态与操作反馈分层)。

### 2026-08-16：隐藏期间暂停待完成网页

见[历史记录](MINIPROGRAM-history.md#2026-08-16隐藏期间暂停待完成网页)。

### 2026-08-16：网页状态支持读屏

见[历史记录](MINIPROGRAM-history.md#2026-08-16网页状态支持读屏)。

### 2026-08-16：账号状态支持读屏

见[历史记录](MINIPROGRAM-history.md#2026-08-16账号状态支持读屏)。

### 2026-08-16：网站入口失败反馈可持续

见[历史记录](MINIPROGRAM-history.md#2026-08-16网站入口失败反馈可持续)。

### 2026-08-16：隐私声明与文字对比度进入发布闸门

见[历史记录](MINIPROGRAM-history.md#2026-08-16隐私声明与文字对比度进入发布闸门)。

### 2026-08-16：本机项目身份不再被损坏配置覆盖

见[历史记录](MINIPROGRAM-history.md#2026-08-16本机项目身份不再被损坏配置覆盖)。

### 2026-08-16：源码 JSON 在覆盖产物前统一预检

见[历史记录](MINIPROGRAM-history.md#2026-08-16源码-json-在覆盖产物前统一预检)。

### 2026-08-16：构建产物候选完成后再替换

见[历史记录](MINIPROGRAM-history.md#2026-08-16构建产物候选完成后再替换)。

### 2026-08-16：账号恢复操作按故障语义区分

见[历史记录](MINIPROGRAM-history.md#2026-08-16账号恢复操作按故障语义区分)。

### 2026-08-16：上传代码压缩成为项目基线

见[历史记录](MINIPROGRAM-history.md#2026-08-16上传代码压缩成为项目基线)。

### 2026-08-16：网站会话原子落地与原位重试

见[历史记录](MINIPROGRAM-history.md#2026-08-16网站会话原子落地与原位重试)。

### 2026-08-16：换票临时故障不再降级为游客

见[历史记录](MINIPROGRAM-history.md#2026-08-16换票临时故障不再降级为游客)。

### 2026-08-16：BLE 协议单源与微信适配器技术验证

见[历史记录](MINIPROGRAM-history.md#2026-08-16ble-协议单源与微信适配器技术验证)。

### 2026-08-16：发布包敏感能力别名扫描

见[历史记录](MINIPROGRAM-history.md#2026-08-16发布包敏感能力别名扫描)。

### 2026-08-16：智能魔方第二轮独立复审修复

见[历史记录](MINIPROGRAM-history.md#2026-08-16智能魔方第二轮独立复审修复)。

### 2026-08-17：智能魔方整体验证基线

见[历史记录](MINIPROGRAM-history.md#2026-08-17智能魔方整体验证基线)。

### 2026-08-17：BLE 写入与断连统一隔离

见[历史记录](MINIPROGRAM-history.md#2026-08-17ble-写入与断连统一隔离)。

### 2026-08-17：Giiker 与米家原生 BLE 接入

见[历史记录](MINIPROGRAM-history.md#2026-08-17giiker-与米家原生-ble-接入)。

### 2026-08-17：MoYu AI MHC 旧协议原生 BLE 接入

见[历史记录](MINIPROGRAM-history.md#2026-08-17moyu-ai-mhc-旧协议原生-ble-接入)。

### 2026-08-17：正式包体积收口

见[历史记录](MINIPROGRAM-history.md#2026-08-17正式包体积收口)。

### 2026-08-17：中继发布链路与资源边界

见[历史记录](MINIPROGRAM-history.md#2026-08-17中继发布链路与资源边界)。

### 2026-08-17：web-view 主动加载微信 JS-SDK

见[历史记录](MINIPROGRAM-history.md#2026-08-17web-view-主动加载微信-js-sdk)。

### 2026-08-17：iOS web-view 环境确认

见[历史记录](MINIPROGRAM-history.md#2026-08-17ios-web-view-环境确认)。

### 2026-08-17：GAN16 ui iOS 广播地址兼容

见[历史记录](MINIPROGRAM-history.md#2026-08-17gan16-ui-ios-广播地址兼容)。

### 2026-08-17：蓝牙入口一次点击自动连接

见[历史记录](MINIPROGRAM-history.md#2026-08-17蓝牙入口一次点击自动连接)。

### 2026-08-17：GAN16 ui 长广播、密钥修复与原位重试

见[历史记录](MINIPROGRAM-history.md#2026-08-17gan16-ui-长广播密钥修复与原位重试)。

### 2026-08-27：取消 AppSecret 轮换门禁

见[历史记录](MINIPROGRAM-history.md#2026-08-27取消-appsecret-轮换门禁)。

### 2026-09-01：抖音复用基线

见[历史记录](MINIPROGRAM-history.md#2026-09-01抖音复用基线)。

### 首版工程

见[历史记录](MINIPROGRAM-history.md#首版工程)。

## 10. 官方入口

- [UnionID 机制](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/union-id.html)
- [小程序登录](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html)
- [服务端 code2Session](https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/login/auth.code2Session.html)
- [网络与服务器域名](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)
- [web-view](https://developers.weixin.qq.com/miniprogram/dev/component/web-view.html)
- [小程序备案指引](https://developers.weixin.qq.com/miniprogram/product/record/guidelines.html)
- [抖音小程序一键搬家](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/dev-tools/developer-instrument/development-assistance/one-key-move)
- [抖音小程序登录](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/api/open-interface/log-in/tt-login)
- [抖音账号登录规范](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/operation/management/specification/account-login-standard)
- [抖音服务端 code2session](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/server/basic-abilities/log-in/code-2-session)
- [抖音蓝牙 API](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/api/device/bluetooth)
- [抖音 web-view](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/component/open-capacity/web-view)
- [抖音隐私授权](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/tutorial/security-requirements/privacy-authorize)
- [抖音发布流程](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/introduction/develop-process/publish)

### 2026-10-27：佣金微信提现开发包上传

负责人授权三仓库全量提交推送、配套生产配置/迁移/部署和两个微信小程序上传。CubeRoot0.1.0官方CLI已成功上传678548字节，新增「我的 → 佣金提现」，支持本人微信绑定、申请和官方收款确认；网站/API及0296迁移已部署，详见`docs/wechat-automatic-payout-tracker.md`。本次只上传开发版，没有提审、公开发布或真实转账。完整发布检查的人工/真机确认和包预算缺口保留，不以CLI成功代替正式发布验收。商户IP/资金待负责人确认。

### 抽奖（2026-11-15，本地实现）

| ID | 路径 | 能力 |
| --- | --- | --- |
| `draw` | `/draw` / `pages/draw/index` | 网页与原生抽奖、比赛报名导入、联想词训练；待发布与真机验收 |
