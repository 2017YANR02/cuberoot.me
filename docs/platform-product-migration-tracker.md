# Platform 主站完整迁移跟踪

最后更新：2026-09-02

状态：`二维码卡片迁移已重新打开；原 P6/P7/P8 的 QR 完成声明撤回，旧站临时恢复为验收对照，正式产品入口仍是主站 /platform；其余历史验收结论不因本次复核自动失效`

## 0. 当前结论

旧 Platform 的功能必须完整进入 CubeRoot 主站。产品架构不恢复独立 Platform 前端、独立部署、SQLite 运行时或第二套账号系统；`platform.cuberoot.me` 的临时恢复只用于逐项验收对照，不改变此边界。

- 主入口：`/platform`；中文入口：`/zh/platform`。
- 全部 Platform 用户路径位于 `/platform/*`，使用主站 shell、账号、权限、主题与双语体系。
- 首页新增 `Platform` 卡片，作为这些能力的唯一聚合入口。
- `/platform` 首页已改为角色与任务驱动入口：公共导航收敛为发现、课程、社区、讲师、机构，登录后按真实课程、进度、讲师、机构与管理员权限显示一个对应工作台入口；旧编号目录、完整路由表和后台 CRUD 清单已移除。P9 提交 `d715a79d6a` 已进入 `main`；陈旧 source-string 守卫已由 `ebf0240cb0` 修复，Test 与两个部署 workflow 已全绿，真实登录角色态仍待线上复验。
- `platform.cuberoot.me` 已临时恢复旧页面用于验收对照，nginx 反代 `127.0.0.1:3004`；它不是正式产品入口，也不能接替主站 `/platform/*`。
- 主站已有能力必须共享组件、API 与数据源；`/platform/*` 可以提供同壳深链，但不得复制 teacher、forum、alg、timer、notifications、org、learn。
- 已有主站完整页面通过 Next 内部 rewrite 直接服务 `/platform/*` 别名：浏览器保留 Platform URL，但执行的是同一份页面、组件与数据链，不允许用跳转卡片代替功能。
- 旧 seed/demo 不导入生产库；旧 timer 历史明确不迁移。没有历史数据只意味着空状态开始，不意味着取消功能。
- 新写入只进入主站 PostgreSQL 与主站媒体存储，禁止恢复 SQLite 或双写。
- 旧源码、旧 GitHub 仓库和主仓内 Platform 历史归档的删除只由仓库所有者执行；AI 不得删除或改写这些仓库资产。

### 0.1 二维码迁移重新打开（2026-09-02）

用户以旧站“二维码卡片”页面复核后确认：主站 `/platform/admin/qr/cards` 只有通用模板 JSON 表单，没有旧站的选码、真实卡面预览、A4 打印和印刷 SVG 下载工作流。因此，先前“QR 批量、复制、启停、软删除、模板恢复/排序、卡面、统计已完整迁移”的结论属于覆盖不足导致的误判，现正式撤回。路由存在、API 返回、manifest 标记 `implemented/reviewed` 或静态字符串测试通过，都不能恢复该完成声明。

本轮 QR 只有在下表的能力和证据同时具备后才能重新标记完成：

| 能力 | 必须保留的产品契约 | 最低验收证据 | 当前状态 |
| --- | --- | --- | --- |
| 二维码管理 | 列表、筛选、单个/批量创建、详情、复制、启停、软删除和修订历史 | 真实 `/platform/admin/qr` 与详情路由；API 状态机、非法输入和管理员权限测试 | `待重新验收` |
| 完整内容编辑 | `label`、`type`、`target`、`title`、`intro`、`links`、`term`、`quote`、`brand`、`frontArt`、`backArt`、`frontArtPrompt`、`alg`、`layout`、`textStyles`、`customTexts` 可读写并回显 | PostgreSQL/DTO/API/client 使用同一字段契约；保存后重新读取逐字段比对 | `待实现与验收` |
| 卡片工作区 | `/platform/admin/qr/cards` 支持 `?codes=a,b` 选码、可操作空状态、真实正反面卡片预览；不得退化为模板 JSON CRUD | 路由级静态契约测试；有数据与无数据各一份浏览器证据 | `待实现与验收` |
| 浏览器打印 | 可从卡片工作区直接打印；A4、`8mm` 页边距、打印色彩保留、隐藏非打印控件，实物尺寸为折叠前 `40×40mm`（正面 `20×40mm` + 背面 `20×40mm`） | 自动测试固定 print CSS 和尺寸常量；打印预览人工复验 | `待实现与验收` |
| SVG 印刷母版 | 自包含 SVG，mm 物理单位，正反面、折线、默认 `3mm` 出血与裁切线；下载响应为 `image/svg+xml` 并用 attachment 文件名，不以页面内“查看”代替下载 | 响应头与 SVG 结构测试；实际下载文件可离线打开并检查尺寸/裁切 | `待实现与验收` |
| 公共二维码 | `/platform/qr/:code` 的落地/跳转、禁用、scheme allowlist、扫描去重和统计不回归 | API 集成测试覆盖 active/disabled/content/internal/external 与 UV 去重 | `基础能力已有，待与新字段回归` |
| 权限与体验 | 管理入口和写入均要求管理员；中英文、空/非空、错误/加载、键盘和 390/430px 触控布局完整 | 服务端 401/403、双语断言、桌面/移动浏览器矩阵，无横向溢出 | `待补证据` |

验收不得循环自证：capability manifest 只能做盘点，不能同时作为功能实现和通过依据。自动化测试必须读取真实路由、真实请求字段、打印 CSS、SVG 生成及下载响应；浏览器验收必须使用真实空状态和至少一条可打印记录。剩余项是完成上述主站实现、跑聚焦单测/typecheck、补桌面与移动端浏览器证据、检查实际 SVG 下载文件，然后再由独立 reviewer 逐项关闭。

本次迁移按两套来源的并集守恒：

| Surface | 退役前权威副本 | 主仓归档 | 并集目标 | 未归属 |
| --- | ---: | ---: | ---: | ---: |
| 页面 | 83 | 95 | 95 | 0 |
| Route Handler | 13 | 13 | 13 | 0 |
| Server Action 文件 | 33 | 32 | 34 | 0 |
| Metadata route | 4 | 4 | 4 | 0 |

差异是归档独有 12 个 `/org/*` 页面和 `org/actions.ts`，退役前副本独有 timer Action 与算法管理 Action。逐项去向见 [Platform 产品 surface 账本](./platform-product-surface-ledger.md)。历史数据的逐行处置仍以 [Platform 数据处置账本](./platform-data-disposition-ledger.md) 为准；数据账本不能决定产品功能是否保留。

## 1. 完成定义

“完整迁移”同时满足以下六层，缺一层都不能标记完成：

1. 产品守恒：95 个页面、13 个 Handler、34 个 Action 文件、4 个 metadata route 均有目标入口、行为、权限、空状态与测试。
2. 产品体验：不同身份进入首页即可看见当前最重要的任务、真实状态与下一步；公共导航、个人工作台和管理台不混排，不以完整路由清单代替产品入口。
3. 复用守恒：身份、教师、论坛、算法、计时、通知、组织教学只有一份权威组件/API/数据源。
4. 数据守恒：正式业务表使用 PostgreSQL；seed/demo、敏感瞬态数据与旧 timer 历史不导入；真实非空数据按数据账本逐行守恒。
5. 交易守恒：商品、课程、活动均通过统一订单、支付、退款、优惠、权益、库存/名额、对账与结算账本闭环。
6. 发布守恒：中英双语、桌面与窄屏、metadata、权限、安全、定向测试、typecheck、build、CI、部署和线上 smoke 全部通过。

页面能打开、API 能返回 200、测试单独通过、没有横向溢出或旧数据为零，都不能替代上述完成定义。

## 2. 产品与 URL 架构

### 2.1 Platform 首页与共享导航

`/platform` 不是第二个站点，也不是面向开发者的路由目录，而是主站里的学习与教学产品入口。公共信息架构只保留用户能理解的核心领域：发现、课程、社区、讲师、机构；“我的”只在登录后出现，“讲师工作台”“机构工作台”“管理”按角色收进账户菜单或对应工作台。

首页按身份呈现，不把全部能力同时铺给所有人：

| 身份 | 首屏主要任务 | 后续入口 | 不应出现 |
| --- | --- | --- | --- |
| 游客 | 浏览课程、寻找讲师、登录 | 活动、社区、机构与 Platform 说明 | 私人账户目录、讲师后台、管理链接 |
| 学员 | 继续学习、查看下一课与进度 | 消息、笔记、收藏、订单与证书 | 讲师和管理员操作 |
| 讲师 | 今日教学任务、课程与学员 | 收入、内容编辑、讲师资料 | 无权限的机构和财务管理 |
| 机构成员 | 机构内当前任务 | 班级、学生、课次、考勤与课包 | 其他机构数据和平台级管理 |
| 管理员 | 进入独立管理台 | 分领域管理、审计与对账 | 在公共首页平铺全部管理路由 |

首页结构必须满足：

- 首屏用真实状态和明确行动回答“我现在可以做什么”，不只放宣传口号。
- 全局主导航只出现一次；删除重复的右侧 01–08 目录和按领域再次平铺的完整路由表。
- 次要能力放入搜索、账户、工作台或上下文页面；公共首页不承担 sitemap 职责。
- 课程为空时给出可执行的真实空状态；禁止用 seed/demo 填充视觉，也不能只留空白区域。
- 桌面端保持紧凑清晰；430px 与 390px 下不横向溢出，核心行动可触摸，导航不依赖精确命中窄小文字。
- 使用主站既有组件、数据、主题和交互契约；重做首页不复制课程、教师、论坛、组织或管理组件。

Platform 原生页面使用统一 `PlatformShell`；canonical rewrite 别名直接渲染目标主站页面及其原有 shell，不再额外套一层 Platform shell。两类页面共同遵守：

- 当前领域导航与面包屑；
- 主站语言、账号、主题和返回首页入口；
- 登录、管理员、讲师、机构角色的条件入口；
- 窄屏下可触摸、可横向滚动或折叠的导航；
- 真正的 `AppLink`，支持中键与 Ctrl 点击；
- 不复制目标页面主体组件，不用 redirect-only 冒充复用。

### 2.2 公开与个人路径

| 领域 | 最终路径 | 实现原则 |
| --- | --- | --- |
| 首页/说明/进度 | `/platform`、`/platform/about`、`/platform/progress` | 新聚合页；进度汇总课程、测验、签到、证书，并引用主站训练数据 |
| 登录/账户/离线 | `/platform/login`、`/platform/account`、`/platform/offline` | 复用主站 auth/session/PWA，不恢复旧 OTP/session |
| 账户子域 | `/platform/account/{courses,membership,badges,favorites,notes,wishlist,invites}` | 主站用户身份下的真实空状态与读写链 |
| 通知 | `/platform/notifications` | 共享主站通知组件和数据源 |
| 计时/榜单 | `/platform/timer`、`/platform/leaderboard` | 共享主站 timer；旧历史不迁，榜单只用新数据或现有主站数据 |
| 公式 | `/platform/algorithms`、`/platform/algorithms/[id]` | 复用 `/alg/3x3` 数据、播放器和训练入口；旧详情页会读取自动 seed 生成的随机 ID，但这些 ID 不是稳定产品标识，迁移后统一进入主站公式库检索 |
| 课程 | `/platform/courses`、`/platform/courses/[courseId]`、`/platform/courses/[courseId]/learn/[lessonId]` | 完整目录、详情、购买、权益、课时与学习闭环 |
| 学习路径 | `/platform/paths`、`/platform/paths/[pathId]` | 有序引用同一课程/课时 ID |
| 教师 | `/platform/teachers`、`/platform/teachers/[id]`、`/platform/teachers/apply` | 共享教师目录、图片、联系方式；补正式申请与审核状态 |
| 教师控制台 | `/platform/instructor`、`/platform/instructor/{courses,students,earnings}`、`/platform/instructor/courses/[id]` | 课程 owner、付费购买者、收入和结算；不冒充 `/org` 正式学员 |
| 社区 | `/platform/community`、`/platform/community/circles/[id]`、`/platform/community/posts/[id]`、`/platform/community/posts/new` | 共享 forum 帖子、回复、反应、举报和管理；圈子映射为论坛分类/群组 |
| 活动 | `/platform/events`、`/platform/events/[id]` | 商业教学活动与报名，不映射 WCA 赛事 |
| 资讯 | `/platform/news`、`/platform/news/[id]` | 可管理、可搜索的双语资讯 |
| 商城 | `/platform/shop`、`/platform/shop/[id]` | 实体/数字商品、库存、会员价和购买链 |
| 订单 | `/platform/orders`、`/platform/orders/[id]` | 统一订单详情、支付、取消、退款、履约与权益联动 |
| QR/证书 | `/platform/qr/[code]`、`/platform/cert/[code]` | 跳转/落地、禁用、扫描统计；证书验证和图片 |
| 搜索 | `/platform/search?q=` | 扩展主站唯一搜索契约，增加 Platform 实体 provider |
| 课程会员 | `/platform/membership`、`/platform/account/membership` | Platform 课程权益会员；与主站支持型 `/membership` 分开 |

### 2.3 机构教学路径

归档独有的 12 个 `/org/*` 页面保留 `/platform/org/*` 深链，并共享现有 `/org`、`/learn`、`/training` 数据和组件：

- `/platform/org`
- `/platform/org/[orgSlug]`
- `/platform/org/[orgSlug]/{campuses,classes,members,packages,schedule,students}`
- `/platform/org/[orgSlug]/classes/[groupId]`
- `/platform/org/[orgSlug]/sessions/[sessionId]`
- `/platform/org/[orgSlug]/students/[studentId]/{credits,responsibilities}`

这些路径只能作为 Platform 壳内的共享体验，不得新建组织、学生、课包、课次或考勤表。

### 2.4 管理路径

`/platform/admin` 复用主站账号和 admin guard，不恢复 `/admin/login` 的独立密码。管理面包括：

- `algorithms`
- `teacher-applications`
- `coupons`
- `courses`、课程课时与测验、`paths`
- `events`
- `analytics`、`logs`
- `payouts`
- `teachers`
- `invites`
- `news`
- `community`
- `orders`、`reconcile`
- `products`
- `qr`、`qr/[code]`、`qr/cards`、`qr/prompts`、`qr/stats`

同领域的新建、详情和编辑采用一个可复用 editor，以路由参数控制模式，不复制三份页面实现。

## 3. 复用边界

| 能力 | 唯一权威来源 | Platform 适配方式 |
| --- | --- | --- |
| 账号与登录 | `AuthPanel`、auth store、主站 auth routes | 共享登录面板、session 与 owner key |
| 内部链接 | `AppLink` | 自动处理英文裸路径与 `/zh` |
| 教师目录 | `/teachers`、`teacher-directory-api`、`teacher_directory.ts` | 抽取共享目录 view/editor，再由两个路由 import |
| 社区 | `/forum`、forum API | 共享帖子、回复、反应、举报、moderation |
| 算法 | `/alg`、PG alg sets/cases、`AlgPlayer` | 共享详情与播放契约，不建 Platform 算法表 |
| 计时 | `/timer` | 共享引擎与新数据；不迁旧 timer history |
| 通知 | `/notifications`、notification routes | Platform 业务写入同一通知源和 outbox |
| 组织教学 | `/org`、`/learn`、`/training`、teaching SaaS API | 抽共享视图或显式 gateway，不 import server internals |
| 媒体 | 主站图片上传与所有权校验 | 课程、商品、资讯、教师、QR 共用授权存储 |
| 搜索 | `LandingSearch` / site-search contract | 增加 Platform provider，不建第二索引 |
| 支付 provider | 现有 Alipay/WeChat/Xunhupay 适配器 | 只复用 provider 和签名；订单/权益模型独立 |
| 支持型会员 | `/membership` | 保持独立，不授予 Platform 课程权益 |

跨页复用先抽到 `components/platform` 或中性共享组件，再由原页和 `/platform/*` 同时 import；禁止从一个 page 目录直接 import 另一个 page 的私有组件。

## 4. 新领域模块

Platform 不进入已经 11,486 行的 `teaching_saas.ts`。后端按业务切片建立独立 route：

- `platform_catalog.ts`：课程、课时、路径、教师申请与 owner 关系。
- `platform_content.ts`：活动、资讯、商品和公共检索。
- `platform_learning.ts`：权益、进度、笔记、收藏、测验、评价、证书、签到、积分、成就。
- `platform_commerce.ts`：订单、订单项、优惠、支付、退款、履约、结算、对账。
- `platform_qr.ts`：二维码、修订、卡面、模板、扫描统计。

共享契约按同样边界放在 `@cuberoot/shared`，不得复制 auth/forum/notification/teacher/teaching 类型。

## 5. PostgreSQL 目标模型

### 5.1 直接复用

- 用户、身份、登录：`app_users`、`auth_identities` 与现有认证表。
- 社区：forum tables。
- 通知：notifications，并增加可重试 outbox 与 dedupe key。
- 算法：`alg_sets`、`alg_cases`。
- 教师公开资料：teacher directory；Platform 只关联 teacher entry 与申请/角色。
- 机构教学：现有 teaching organizations、members、students、guardians、campuses、groups、packages、credits、sessions、attendance、training、reports、conversations、audit。
- 观测：现有日志/指标体系；不恢复旧原始行为回放。

### 5.2 新增

- Catalog：courses、course revisions、lessons、lesson revisions、media、paths、path items。
- Learning：course entitlements、progress、notes、favorites/wishlist、quizzes、questions、attempts、reviews、certificates、check-ins、point ledger、achievements。
- Commerce：orders、order items、sellable snapshots、payment attempts、provider events、refunds、fulfilment ledger、coupons、coupon redemptions。
- Content：events、event registrations、news、products、inventory ledger、shipping addresses/fulfilment。
- Instructor：applications、course ownership、revenue shares、payout ledger。
- Growth：Platform invite codes/redemptions；不得混用 `/org` 成员邀请。
- QR：codes、revisions、scans、templates、card jobs。
- Privacy：consent、最小化 analytics events、aggregates 与 retention jobs。

所有表使用主站用户键、PG FK/CHECK/partial unique、必要的 tenant composite FK；金额以整数 minor unit 加 currency 存储。删除行为优先 soft delete/revision，审计和财务账本不得物理覆盖。

## 6. 安全与交易硬契约

- 所有重要写操作接收 `Idempotency-Key`，保存 request hash 与响应；同 key 不同 payload 拒绝。
- 用户只能读取本人的订单、权益和学习数据。
- 讲师只能管理自有课程，并读取该课程的购买/获权学员；隐藏不必要联系方式。
- 机构权限继续使用 org role 和 assignment scope；内容创建权不等于财务、退款或结算权。
- 跨租户读取采用 concealed 404 或明确 403，并写 denied audit。
- 课程媒体必须验证 entitlement，返回短时签名 URL 或受控流，不得公共缓存。
- 支付 webhook 必须先验签，再核 merchant/app、provider、订单、金额和币种。
- provider event id 与 provider transaction id 唯一；订单翻转、权益/积分/库存/名额和通知 outbox 在同一事务内完成。
- 退款、拒付和取消使用独立幂等状态机，精确逆向原 ledger，不误伤其他续费或购买。
- 最后一件库存、最后一个名额和优惠额度采用行锁/原子条件更新，禁止超售。
- QR 目标只允许批准的 http/https 或站内路径，拒绝 `javascript:`、`data:`；打印码不可硬删，扫描 UV 全局去重。
- 生产环境禁止 mock payment；管理员手动入账必须记录渠道凭据、操作者、原因与审计。

现有会员支付实现只能作为 provider 接入参考，不直接复用其订单状态机。Platform commerce 上线前必须通过金额/币种/merchant 校验、原子履约和重复回调测试。

## 7. 实施阶段

### P0 跟踪、范围与契约冻结 — `已完成`

- [x] 重新确认“功能完整迁移，seed/demo 与 timer 历史不迁”。
- [x] 盘点权威副本与归档并集：95 / 13 / 34 / 4。
- [x] 重写本跟踪与 surface 账本，不再以零数据取消功能。
- [x] 建立机器可校验的 capability manifest，逐项关联 source、target、reuse、API、permission、test。
- [x] 三路 agent 对 tracker 与 manifest 独立复核，未归属为 0。

退出条件：文档、manifest、测试中的数量和目标一致；无“取消功能”的旧结论残留。

### P1 共享契约、PG schema 与骨架 — `已完成`

- [x] shared catalog/content/learning/commerce/QR DTO 与校验。
- [x] 新编号 migration、`schema.pg.sql`、迁移 README、`/dev/schema` 同步。
- [x] 五个独立 server route slice、统一 auth/permission/idempotency/outbox helper。
- [x] `/platform` shell、导航、空/错/载入状态、首页卡片、metadata 基线。
- [x] `/dev/api`、CORS/cache header、client API helpers 同步。

退出条件：本地 migration 可重复应用；schema/API drift tests、server typecheck、client typecheck 通过。

### P2 公共目录与内容 — `已完成`

- [x] Platform 首页、about、search、offline。
- [x] courses、course detail、lesson entitlement gate、paths。
- [x] teachers/apply/detail，共享教师目录。
- [x] events、news、shop。
- [x] algorithms、community、timer、notifications 共享适配。
- [x] 公开路由 metadata、sitemap、canonical；私有/搜索/admin noindex。

退出条件：公开深链刷新、空状态、搜索、中英、SEO 与桌面/390px 均通过。

### P3 Commerce 与 entitlement — `已完成`

- [x] 订单草稿、价格/分成/商品快照、优惠预览与并发保留。
- [x] 支付启动、状态轮询、provider webhook、幂等履约。
- [x] 取消、退款、拒付、库存/活动名额、课程权益精确逆向。
- [x] orders、order detail、shop/event/course 购买链、课程会员。
- [x] 对账差异与人工处置审计。

退出条件：重复/乱序 webhook 100 次只履约一次；所有 crash 点可重放收敛；错金额/币种/merchant 必拒。

### P4 学员完整学习闭环 — `已完成`

- [x] account courses/favorites/wishlist/notes/badges/invites/membership。
- [x] lesson player、进度、时间戳笔记、测验 attempt、评价。
- [x] 签到、积分、成就、证书签发/验证/图片。
- [x] progress 汇总主站训练与 Platform 学习。

退出条件：未获权不能看受限内容；已购可学习；退款只撤对应权益；证书可验证且不可伪造。

### P5 教师业务 — `已完成`

- [x] 申请、审核、教师角色与 teacher directory 关联。
- [x] instructor dashboard、自有课程/课时/测验管理。
- [x] students 只显示课程购买/获权者，不写入 org student profiles。
- [x] earnings、revenue share、payout ledger 与 paid audit。

退出条件：owner/讲师/财务/管理员边界通过越权矩阵；结算可从订单 ledger 重算。

### P6 社区、运营、QR 与机构深链 — `QR 重新打开，其余项沿用历史验收`

- [x] forum 圈子/帖子/新建/详情共享体验。
- [x] admin 全领域 CRUD、moderation、analytics、logs、orders、reconcile。
- [ ] QR 批量、复制、启停、软删除、修订、卡片工作区、打印、SVG 下载和统计按 0.1 节重新验收；原完成勾选已撤回。
- [x] `/platform/org/*` 12 条归档路径共享现有组织教学组件。
- [x] 通知 outbox、邀请、最小化 analytics、数据保留/删除策略。

退出条件：管理写操作、导出、打印、权限与审计逐项对齐旧能力；QR 安全与 UV 测试通过。

### P7 守恒、交互技术基线与安全终验 — `QR 补充终验待完成`

- [x] capability manifest 守恒测试：95 / 13 / 34 / 4，未归属 0。
- [x] client/server/shared typecheck 与定向单测。
- [x] auth、owner、instructor、finance、org、admin、跨租户权限矩阵的合同与状态机测试。
- [x] payment、refund、entitlement、inventory、event capacity、certificate 的幂等与边界测试。
- [ ] QR 的字段守恒、打印、SVG 下载、权限、双语、空/非空和移动端证据按 0.1 节补齐。
- [x] Chrome 精确矩阵：1280px 中文 Platform 首页；390px 中文首页与账户会员权限态；430px 中文主站入口与课程深链。三档均无横向溢出，console 无 JS error；英文视觉未单独实测，双语 metadata 由自动测试覆盖。
- [x] independent product/data/code agent review；首轮终审结论在补充审计后被重新打开，canonical link-only、账号注销完整性与 CI 缺口均已修复并完成本地回归，最终三路复审均为 PASS，Blocker/Major/Minor 均为 0。

真实登录角色、支付状态机与生产 API 的发布验证属于 P8；生产目录为空时不得为了 smoke 导入 seed/demo 或制造真实订单，交易边界由 PostgreSQL/服务端状态机回归验证，线上只验证真实可用的公开与鉴权边界。

退出条件：三路 reviewer 结论均为 PASS，或每条 finding 都有修复与复验记录。

### P8 发布、观察与旧仓决策 — `历史发布已完成；QR 修复发布待重新验收`

- [x] Platform 发布提交只包含本任务文件；用户明确要求后已 push，最终代码提交为 `73bea4e8e4`，上游比赛数据配套收尾为 `ab54b397ac`。
- [x] 最终提交的 Test `32600584942`、Deploy Next `32600584945`、Deploy Core `32600584944` 均为 `completed/success`。
- [x] 2026-08-22 线上 `/platform` 及 timer、algorithms、teachers、courses、org、admin/community 代表路径均为 200；公开页 canonical/alternate、私有页 `noindex, nofollow`、公开 API 200、未登录私有 API 401 均符合当时契约；当时 `platform.cuberoot.me` 的 HTTP 与 HTTPS 均直接返回 410。
- [ ] QR 补全提交尚未完成发布与线上验收；`platform.cuberoot.me` 现为临时对照站，不能继续沿用旧域 410 作为当前 release 断言。
- [x] 生产 courses 与 membership plans 均为空，符合不导入 seed/demo 的决策；因此未伪造可交易标的或制造生产订单，支付/退款/幂等/权限状态机由最终 Test workflow 的真实 PostgreSQL 与服务端回归放行。
- [x] PostgreSQL 账号注销实库夹具已进入 Test workflow，固定 57 个直接外键、48 张表、12 张不可变证据表、旧 outbox 去标识与伪造上下文拒绝行为；本地与发布 CI 的 PostgreSQL 13 fresh snapshot、0167→0168 升级路径均已通过。
- [x] 全量上线后已于 2026-08-22 启动至少 30 天观察窗口。
- [x] 2026-08-25 仓库所有者明确豁免原定 2026-09-21 观察等待并授权当天完成 RET-04；此决定不冒充已经完成 30 天观察。
- [x] 两份临时明文 SQLite 及其 WAL/SHM 共 6 个文件在来源/恢复 SHA-256 与既有加密归档验证证明复核后移入 Windows 回收站；加密权威归档、manifest 和无敏感值 sidecar 继续保留。
- [x] `D:\cube\cube-platform`、远端旧 Platform 仓库、主仓内 `core/packages/platform` 及其中媒体均未删除或改写，交由仓库所有者自行处置；RET-03 已停止旧 runtime、workflow 和 service，没有需要 AI 单独轮换或撤销的身份 bridge 凭据或运行配置对象。

2026-08-22 的发布与 RET-04 退出条件曾满足。QR 重新打开后，不追溯否定其他领域的历史发布证据，但 QR 自身必须重新走实现、测试、浏览器与发布验收。回收站内的 6 个明文数据库相关文件在回收站清空前可恢复；仓库删除不在 AI 执行范围内，加密权威数据归档不随源码删除。

### P9 产品入口与角色体验重做 — `代码与发布已验收；线上角色态待验收`

- [x] 盘点 `PlatformShell`、首页、导航、账户菜单和各角色工作台的现有组件，复用现有认证、权限、API、路由与 `AppLink`。
- [x] 删除首页三重信息架构：移除右侧编号目录、底部完整路由表和后台 CRUD 清单，同一层级只保留一套导航。
- [x] 将公共主导航收敛为发现、课程、社区、讲师、机构；账户与角色工作台入口按登录态和真实权限显示。
- [x] 为游客、学员、讲师、机构成员、管理员定义首屏主要任务、真实状态、空状态和下一步行动。
- [x] 学员首页接入继续学习、进度与下一步；无课程时引导浏览课程，不制造演示数据。
- [x] 讲师、机构和管理员使用各自工作台；公共首页每种身份只给一个条件入口，不平铺后台路由。
- [x] 重做视觉层级、文案、间距、焦点态和窄屏布局，移动端导航无横向滚动，账户入口最小触控高度 44px。
- [x] 保留 AppLink、中键/Ctrl 打开、键盘导航、reduced motion、双语、主题、metadata 与服务端权限契约。
- [x] 增加角色资源、权限可见性、关键链接、载入状态、桌面和窄屏结构的定向回归测试。
- [x] 完成本地游客态 1280px、1024px、430px、390px 中文矩阵及 390px 英文复验，页面和导航均无横向溢出。
- [ ] 发布后使用真实学员、讲师、机构成员、管理员账号补齐代表截图与线上权限态复验；不为截图制造假账号或演示数据。
- [x] 由产品信息架构、无障碍/响应式、代码复用三路 reviewer 独立审核；修复两个权限/切号时序 finding 与移动端触控 finding 后，最终 Blocker/Major 为 0。

P9 退出条件：

1. 1280px 首屏无需滚动即可看见身份相关的主要任务和至少一个明确行动；1280px 与 1024px 顶部导航无横向滚动条。
2. 任一身份的前三项高频任务均能在两次交互内到达；无权限入口不展示，直接深链仍由服务端鉴权。
3. 同一层级只保留一套导航；公共首页不再出现完整管理清单或路由清单。
4. 390px、430px、1024px、1280px 无页面横向溢出、遮挡和不可触摸入口；键盘焦点顺序与屏幕阅读标签通过检查。
5. 真实空数据、错误、加载和登录过期状态都能指导下一步，不使用假课程或假订单装饰页面。
6. 自动测试、typecheck、CI、部署与线上 smoke 全绿，三路 reviewer 的 blocker/major 为 0，并在本文件记录截图与复验依据。

## 8. 测试矩阵

| 层 | 最低证据 |
| --- | --- |
| Contract | manifest 数量与 source tree 自动比对；DTO validator 边界测试 |
| DB | fresh migration、重复 migration、FK/CHECK/unique、RLS/permission helper、rollback/restore 演练 |
| Catalog | draft/publish/unpublish、排序、slug/ID、空目录、不可见内容 |
| Learning | entitlement、progress 上下界、note CRUD、quiz 重答规则、review eligibility、certificate uniqueness |
| Commerce | 幂等下单、价格快照、优惠并发、库存/名额、回调验签/乱序/重复、退款/拒付、对账 |
| Instructor | application state machine、ownership、buyer visibility、earnings/payout 重算 |
| QR | 完整内容字段写入/回读、scheme allowlist、disable、revision、duplicate、scan dedupe、选码、空/非空、A4 print、40×40mm 折叠尺寸、自包含 SVG、attachment 下载、soft delete/restore、admin 401/403、en/zh、390/430px |
| Shared domains | teacher/forum/alg/timer/notifications/org 无第二数据源，原 canonical route 不回归 |
| UI | en/zh、游客/学员/讲师/机构/管理员、1280/1024/430/390、首屏主要任务、权限可见性、keyboard/touch/middle-click、deep link、refresh、empty/error/loading |
| SEO | page metadata coverage、public sitemap、canonical、private/admin/search noindex |
| Release | CI/deploy green、live API/route smoke；临时旧站只作对照，正式产品仍由 `/platform` 提供 |

## 9. 审核记录

| 日期 | 审核 | 结论 | 处理 |
| --- | --- | --- | --- |
| 2026-08-22 | 产品 surface agent 第一轮 | FAIL：旧 tracker 取消了必须恢复的产品能力 | 已重开 P0-P8，按 95/13/34/4 并集守恒 |
| 2026-08-22 | 数据/交易 agent 第一轮 | FAIL：缺 catalog、learning、commerce、QR 正式模型与支付硬契约 | 已写入目标模型、权限和交易验收 |
| 2026-08-22 | 代码复用 agent 第一轮 | FAIL：当前 `/courses` 非商业课程系统，且不得继续膨胀 `teaching_saas.ts` | 已锁定五个 route slice 与 canonical reuse 边界 |
| 2026-08-22 | 产品 surface agent 初次终审 | PASS 后被补充审计重新打开 | 当时补充审计发现的 19 个共享 canonical 页面仍是 link-only；当前路由表共有 22 条 canonical rewrite，旧结论不再作为最终放行证据 |
| 2026-08-22 | 数据/交易 agent 初次终审 | PASS 后被补充审计重新打开 | 后续发现账号注销仅盘点外键、未处理全部不可变账本与隐私快照，旧结论不再作为最终放行证据 |
| 2026-08-22 | 代码/安全 agent 初次终审 | PASS 后被补充审计重新打开 | 后续发现 Test sparse checkout、CSS guard 与注销测试存在覆盖缺口，旧结论不再作为最终放行证据 |
| 2026-08-22 | Root 初次集成验收 | PASS 后被发布 CI 否决 | Test workflow 失败，已按真实失败重新打开并修复，不能沿用初次 PASS |
| 2026-08-22 | 三路补充审计 | FAIL：canonical link-only、账号注销、CI/测试覆盖仍有 blocker | 19 个共享页改为内部 rewrite；0168 增加原子清理/匿名化、12 表深度守卫与 PostgreSQL 夹具；workflow 补齐 docs sparse checkout 和 PG13 service |
| 2026-08-22 | Root 修复后本地回归 | PASS | client 494 files/6,315 tests（另 3 files/5 tests skipped）、Platform 定向 4 files/67 tests、server 33 files/272 tests、shared/server/client typecheck；PG13 fresh snapshot 与 0167→0168 升级路径、真实删号及 12/12 不可变证据断言通过；6 条代表性 `/zh/platform/*` 深链返回 200 |
| 2026-08-22 | 产品 surface agent 最终复审 | PASS：Blocker/Major/Minor 0 | 42/42 capability、95/13/34/4 surface 守恒；49/49 定向测试；公开 canonical、私有 noindex、主页入口、旧域 410、timer 排除与文档状态通过 |
| 2026-08-22 | 数据/交易 agent 最终复审 | PASS：Blocker/Major/Minor 0 | PostgreSQL 13 fresh snapshot 与 0167→0168 升级路径通过；48 表、57 FK、12/12 不可变证据及 4 个无原始 userId outbox payload 通过 |
| 2026-08-22 | 代码/安全 agent 最终复审 | PASS：Blocker/Major/Minor 0 | 最终 schema 与升级库 1,635 项语义差异为 0；CI 的 PG 快照启用 `-X -v ON_ERROR_STOP=1`，阻止 SQL 中途错误假绿；3 files/26 tests、typecheck、diff-check 通过 |
| 2026-08-22 | Root 最终发布验收 | PASS：发布完成，观察窗口启动 | `ab54b397ac` 的 Test `32600584942`、Deploy Next `32600584945`、Deploy Core `32600584944` 全绿；线上代表路由/SEO/API/鉴权通过，旧子域 HTTP/HTTPS 均为 410；空生产目录与不导入 seed/demo 决策一致 |
| 2026-08-23 | 用户截图与产品体验复审 | FAIL：技术迁移完成，但首页仍是路由目录，不是角色化产品入口 | 新开 P9；删除重复导航和后台清单，按游客、学员、讲师、机构、管理员重做首屏任务与工作台入口 |
| 2026-08-23 | P9 三路独立复审 | PASS：产品信息架构、无障碍/响应式、代码复用均为 Blocker/Major 0 | 修复深链无权限时仍显示写操作、切换账号短暂残留旧角色入口、移动端账户入口触控高度及加载状态播报；定向测试与游客截图矩阵复验通过 |
| 2026-08-23 | P9 守卫修复后的 workflow | PASS：Test `32668704812`、Deploy Next `32668704815`、Deploy Core `32668704776` 全绿 | `ebf0240cb0` 修复 `alg-player-placement.test.ts` 的陈旧 source-string 断言；主站、`/zh/platform` 与 API `/v1/health` 线上 smoke 通过；真实登录角色态仍单独待验收 |
| 2026-09-02 | 用户以旧二维码卡片页复核 | FAIL：主站卡片页只剩通用模板 JSON，缺少旧站完整编辑、选码预览、打印与印刷 SVG 下载 | 撤回 QR 完成声明，临时恢复旧站供逐项对照，按 0.1 节重新实现和验收；其他领域不凭此 finding 自动重开 |

浏览器证据明细：P8 的 1280/430/390 矩阵只证明 `/zh/platform`、首页卡片、会员权限态和课程深链在技术上可达、无横向溢出且没有应用 JS error；它没有证明信息架构、角色任务体验或二维码卡片工作流合格。补充修复后，本地 SSR 对 `/zh/platform`、`timer`、`algorithms`、`org`、`admin/community`、`teachers` 六条代表性深链均返回 200；当时的线上复验确认 timer/algorithms 的 HTTP canonical 指向主站实现，teachers 的 HTML canonical 指向 `/teachers`，私有/管理入口 noindex，生产空目录与不导入 seed/demo 决策一致，旧域名 HTTP/HTTPS 当时均为 410。2026-08-23 的 P9 本地复验中，目标视口 1280×900、1024×760、430×900、390×844 的页面 `scrollWidth` 均等于 `clientWidth`，顶部五项导航的 `scrollWidth` 也均等于 `clientWidth`；390px 英文导航同样无溢出。旧编号目录和底部完整路由表计数均为 0。P9 已推送且后续 Test 与两个部署 workflow 全绿；仍不提前宣称角色体验完成，因为真实登录角色截图尚缺。2026-09-02 起旧域名改作临时验收对照，当前契约以 nginx `:3004` 反代和正式产品 `/platform` 入口为准；QR 浏览器与下载证据仍待新增。

后续每个阶段结束必须增加：提交、验证命令、浏览器证据、reviewer、finding、修复和复验结果。不得用口头“看起来完整”替代账本。

## 10. 与其他任务的协调

- [architecture-modernization-tracker.md](./architecture-modernization-tracker.md) 的 Batch 1 已完成，Batch 2 已获准执行依赖基线、候选清单与新增违规守卫；后续源码批次仍按该 tracker 独立刷新基线、审核和授权。
- `teaching_saas.ts` 的渐进拆分可先补 characterization tests，但 Platform 不 import 它的内部 repository；只通过稳定 API 与 client helper 复用。
- `server/src/index.ts`、shared exports、migration ledger、`page-meta.ts`、sitemap 与首页卡片是串行集成热点，保持单一 owner。
