# CubeRoot 微信 / 抖音小程序跟踪

> 最后更新：2026-11-20（复核抖音新公司账号和备案阶段）。本文是小程序的架构约定、当前状态、上线清单和迭代记录。后续开发先更新这里，不再另建互相冲突的计划。

备案、主体变更、开发者身份与收款边界统一见[备案与公司主体迁移](../../../../docs/compliance/filing-and-identity.md)。

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

本节始于 2026-10-27，备案状态已更新至 2026-11-20。跨平台进度见[备案与主体迁移进度](../../../../docs/compliance/filing-and-identity.md#备案与主体迁移进度2026-11-15)。下方旧应用的配置属于历史记录。原生实现和审核缺口见[抖音原生化审核核查](douyin-native-review-audit.md)。

新公司应用的超级管理员登录说明保存在本机仓库根目录的 `.password.md`，标题为「抖音开放平台 · 魔方根新公司应用」。处理抖音上传、提审或账号交接时先查该条记录，再分别核对网页控制台和开发者工具中的目标 AppID。

| 事项 | 当前状态 | 依据 |
|---|---|---|
| 旧小程序名称释放 | 已完成 | 维护者于 2026-10-27 确认；具体释放时刻未记录 |
| 新公司企业入驻、平台审核和对公验证 | 已通过 | 维护者截图：上海魔方根科技有限公司；对公验证通过时间为 2026-10-27 12:15:45，页面有效期至 2027-10-27 12:15:45（北京时间） |
| 新小程序名称 | 魔方根，名称审核通过 | 维护者于 2026-10-27 提供基础信息页面截图 |
| 新小程序 AppID | `tt550923b4cb7781f301` | 2026-11-20 登录控制台，确认上海魔方根科技有限公司名下的「魔方根」及超级管理员权限 |
| 图标、简介 | 已提交，审核中 | 截图分别显示“审核中”；简介为“魔方计时、成绩统计、公式与赛事信息查询” |
| 服务类目 | 待核对 | 本次截图未展示类目及其审核结果 |
| 新主体小程序备案 | 平台审核完成，管局审核中 | 2026-11-20 核对[新应用备案页](https://developer.open-douyin.com/microapp/tt550923b4cb7781f301/setting/base/registration) |
| 新应用代码版本 | 已上传测试版 `1.0.0`，暂无审核或线上版本 | 2026-11-20 在[新应用版本页](https://developer.open-douyin.com/microapp/tt550923b4cb7781f301/publish)核对。提交审核预检提示该应用尚未配置隐私协议 |
| 阿里云 ICP 主体变更 | 已完成 | 维护者于 2026-11-07 确认 ICP 备案完成 |

下一步按以下顺序推进：

1. 等待图标、简介审核结果，并核对匹配实际功能的服务类目。新小程序名称“魔方根”已通过，AppID 已取得，无需重复创建。截图提示发布前名称可保留 30 天，需及时发布版本或完成小程序备案；具体保留截止时间以后台为准，不将本次基础信息提审视为备案或版本提审。
2. 等待企业小程序备案的管局审核结果。收到补正要求时，以后台通知为准。
3. **跨平台同名小程序需串行备案**：官方 FAQ 还要求同主体、同名称的小程序不要同时在多个平台发起备案，先等一个平台出结果，再去另一个平台办理；另一平台可能走新增接入。这一限制独立于新主体首次备案限制，修正此前将微信与抖音备案一概并行的排期假设。
4. 等待备案期间可并行核对新 AppID 对应的请求/socket 域名、隐私声明、开发成员和服务端登录配置。新 AppID 写入被忽略的 `apps/miniprogram/project.douyin.config.json`；`DOUYIN_MINI_APP_SECRET` 仅由服务端安全配置，不写文档或提交代码。不因企业认证通过就直接切换旧应用的生产凭据。
5. 先按实际用到的能力配置新应用的隐私协议，并用已上传的测试版检查登录和原生计时功能。提审并发布前，核对名称、备案及原生化审核清单的实际状态。

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

微信手机号实时授权增量（2026-09-12，本地实现，未据此确认发布）：未绑定 UnionID 可通过 `getRealtimePhoneNumber` 获取独立一次性 `phoneCode`；后端同时验证本次登录 OpenID、手机号凭证和 AppID 水印。手机号已有账号先预览并确认，未匹配则明确创建或复用上述绑定码；两个身份在既有 pending 事务中原子绑定，不能静默合并/覆盖。拒绝授权或不支持时继续提供原账号验证；已绑定微信不重复要求手机号。目前复用中国大陆号码契约，不把其他区号转换为 +86。实现与发布前检查见 [小程序 README](../README.md#微信手机号实时授权2026-09-12本地接入)。

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

过程日志已完整迁往[历史记录](history/iterations.md)，保留决策、提交和验收限制。

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

负责人授权三仓库全量提交推送、配套生产配置/迁移/部署和两个微信小程序上传。CubeRoot0.1.0官方CLI已成功上传678548字节，新增「我的 → 佣金提现」，支持本人微信绑定、申请和官方收款确认；网站/API及0296迁移已部署，详见`docs/product/payments/wechat-automatic-payout-tracker.md`。本次只上传开发版，没有提审、公开发布或真实转账。完整发布检查的人工/真机确认和包预算缺口保留，不以CLI成功代替正式发布验收。商户IP/资金待负责人确认。

### 抽奖（2026-11-15，本地实现）

| ID | 路径 | 能力 |
| --- | --- | --- |
| `draw` | `/lucky-draw` | 工具页 WebView 内直接打开同一网站页面；无独立原生抽奖页或原生入口。抽奖、比赛搜索与盲拧训练统一维护。 |
