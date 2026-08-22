# Platform 产品能力与数据迁移跟踪

最后更新：2026-08-22

状态：`方案已通过三路复审，实施未授权`

当前结论：源码归档、Git 历史接入、新机构教学前端切换和独立前端退役已经完成；旧 Platform 的公开内容、商业能力、写操作和业务数据尚未完成逐项迁移验收。因此，不得再把整体 Platform 迁移标为完成，也不得据此删除旧仓、SQLite 或静态资产。

## 1. 文档职责

本文是旧 Platform 产品能力与业务数据迁入主站的唯一执行跟踪入口，负责回答：

1. 旧站每个页面、Route Handler、Server Action、业务表和媒体引用最终去哪里。
2. 哪些直接复用主站，哪些扩展主站，哪些转换导入，哪些必须经仓库所有者明确批准后归档或销毁。
3. 每一阶段开始、完成、回滚和停止的条件是什么。
4. 何时才允许删除旧本地源码目录和旧 GitHub 仓库，以及哪些受控数据归档必须继续保留。

相关文档的边界：

- [platform-migration.md](./platform-migration.md)只记录源码、Git 历史和 monorepo 接入历史，不再代表产品与数据已经迁完。
- [platform-unification-plan.md](./platform-unification-plan.md)只记录机构教学前端切换；已进入主站的 `/org`、`/learn` 能力不在本文重复实现，其未闭环的生产验收仍由原计划跟踪。
- [architecture-modernization-tracker.md](./architecture-modernization-tracker.md)在本文完成前暂停源码重构实施，只允许只读调查，避免在错误的 Platform 完成前提上固化新边界。
- [architecture-audit-2026-08.md](./architecture-audit-2026-08.md)是 2026-08-21 的静态审计快照；其中“Platform 产品迁移已完成”的结论已被 2026-08-22 的数据与路由证据推翻。

## 2. 状态规则

| 状态 | 含义 |
| --- | --- |
| `待盘点` | 只知道能力或数据存在，尚未完成来源、语义和目标核验 |
| `待决策` | 证据齐全，等待仓库所有者确定迁移、复用、归档或销毁 |
| `待实施` | 目标契约与验收已确定，并已获得该切片实施授权 |
| `进行中` | 当前切片有唯一 owner，正在按已登记范围实施 |
| `阻塞` | 有具体、可验证且无法在当前范围内消除的阻塞 |
| `待验收` | 实现已完成，等待数据、功能、部署或观察窗口验收 |
| `完成` | 代码、数据、入口、权限、回滚和线上证据全部齐全 |
| `明确归档` | 仓库所有者明确决定不迁，来源、保留期限和恢复方式已记录 |
| `安全销毁` | 按批准的保留策略安全销毁敏感或过期运行数据，并留存不可逆证明 |
| `取消` | 明确决定不再保留某项能力，记录决定人、日期和原因 |

以下证据不能互相替代：

- 源码存在不等于数据已迁移。
- 数据行数相等不等于字段语义、来源和媒体完整。
- seed、demo、营销展示计数不等于真实用户或交易事实。
- typecheck、单测或 CI 成功不等于线上功能可用。
- 页面能打开不等于登录、权限、支付、回调和写入链路正确。
- SQLite 文件被复制不等于快照一致，也不等于主站已经脱离旧运行时。
- HTTP 410 不等于后台、脚本、任务或本地管理入口已经停止写入。

## 3. 已锁定的产品决定

1. 不恢复独立 Platform 前端，也不建立 `apps/platform-web`。
2. `platform.cuberoot.me` 保持 HTTP 410，不展示页面，也不跳转。
3. 最终用户入口全部位于 `cuberoot.me`；英文裸路径，中文增加 `/zh`。
4. 不建立 `/platform` 总入口。公开功能进入对应主站领域，个人功能进入 `/account`，机构功能进入 `/org`，学员和监护人功能进入 `/learn`。
5. 主站已有等价能力时必须复用，不复制 timer、公式库、论坛、通知、账号、媒体上传、支付基础设施或教学组件。
6. 旧 `timer_solves` 及其派生排行榜和徽章按仓库所有者决定不迁移；`study_checkins=0` 只记录零行证据，不把它误写成用户已经批准丢弃的历史。
7. 除前一条外，非空源记录必须逐行分类和守恒；实现者不得静默丢弃。seed/demo、敏感瞬态数据和运行日志不等于应导入产品库，须走各自处置策略。
8. 新线上写入只进入主站 PostgreSQL 和主站媒体存储；不恢复 SQLite 双写。
9. 旧目录、旧 GitHub 仓库、SQLite、WAL/SHM、备份、静态资产、外部上传和回调在各自删除门槛满足前不得删除。
10. 旧课程购买者、旧课程通行证和机构教学域里的正式师生关系是三种不同语义，禁止互相冒充。
11. 旧课程通行证不直接转换为主站支持型会员；最多复用支付和页面基础设施，权益模型必须分开。
12. 动态详情路径在 P2 完成唯一性、SEO、恢复映射和现有契约审计后锁定；本文不把候选路径伪装成已上线事实。

## 4. 当前证据基线

### 4.1 源码来源与路由面

2026-08-22 只读核验：

| 来源 | 页面 | Route Handler | Server Action 文件 | Metadata route | 说明 |
| --- | ---: | ---: | ---: | ---: | --- |
| `D:\cube\cube-platform\app` | 83 | 13 | 18 | 4 | 退役前产品面的当前本地证据 |
| `core/packages/platform/app` | 95 | 待生成差分 | 待生成差分 | 待生成差分 | 主仓归档源码；页面比旧本地源多 12 个 `/org` 页面 |
| `core/packages/client/app/[lang]` | 307 | 不适用 | 不适用 | 不适用 | 主站现状；任何新增前必须查重 |

归档源码多出的 12 个页面全部位于 `/org`：

- `org/page.tsx`
- `org/[orgSlug]/page.tsx`
- `org/[orgSlug]/campuses/page.tsx`
- `org/[orgSlug]/classes/page.tsx`
- `org/[orgSlug]/classes/[groupId]/page.tsx`
- `org/[orgSlug]/members/page.tsx`
- `org/[orgSlug]/packages/page.tsx`
- `org/[orgSlug]/schedule/page.tsx`
- `org/[orgSlug]/sessions/[sessionId]/page.tsx`
- `org/[orgSlug]/students/page.tsx`
- `org/[orgSlug]/students/[studentId]/credits/page.tsx`
- `org/[orgSlug]/students/[studentId]/responsibilities/page.tsx`

这些页面已由主站教学前端取代，不是仍需复制的旧产品页。P1 仍须对两个 source root 做完整文件和 Git commit 差分，不能仅凭页面数量推断责任守恒。

旧站 13 个 Route Handler：

- `api/auth/send-otp`、`api/auth/verify-otp`、`api/auth/logout`
- `api/upload`、`api/track`
- `api/orders/[id]/status`、`api/payments/[provider]/callback`
- `api/lessons/[id]/video`
- `api/qr/[code]/svg`、`api/qr/[code]/card`
- `cert/[code]/image`、`icons/[size]`、`og`

18 个 `actions.ts` 文件覆盖：管理员登录、讲师申请、讲师课程、邀请码、申请审核、活动、公式、优惠券、讲师、讲师结算、二维码、学习路径、商品、社区帖子、课程、新闻、二维码提示模板和订单。

Metadata surface 包括 `icon.tsx`、`apple-icon.tsx`、`robots.ts`、`sitemap.ts`。P1 必须登记每个导出动作、鉴权、来源表、外部副作用和最终去向，不能只盘点页面。

### 4.2 本地 SQLite 观察值

| 观察时间 | 文件 | 大小 | SHA-256 | 当前结论 |
| --- | --- | ---: | --- | --- |
| 2026-08-22 首次盘点 | `D:\cube\cube-platform\data.db` | 1,298,432 bytes | `6469D418BDFCB6DA6E9A095FE7666BEF67BBBE3C813BD04D1B95D5A284BBDC24` | 非一致性快照，仅保留为漂移证据 |
| 2026-08-22T11:47:05Z 复核 | `D:\cube\cube-platform\data.db` | 1,298,432 bytes | `CA8D4F57CA291DC3FBDDC2E4109995724B0039C2AB65259FF28714E520D5F8EE` | 文件大小未变但哈希已变；`LastWriteTimeUtc=2026-08-22T11:02:30.7667522Z` |
| 2026-08-22T11:47:05Z 复核 | `D:\cube\cube-platform\data.db-wal` | 0 bytes | `E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855` | WAL 存在，不能只复制 DB 文件 |
| 2026-08-22T11:47:05Z 复核 | `D:\cube\cube-platform\data.db-shm` | 32,768 bytes | `FD4C9FDA9CD3F9AE7C962B0DDF37232294D55580E1AA165AA06129B8549389EB` | SHM 存在，说明仍需查明所有 SQLite 使用者 |
| 2026-08-22 首次盘点 | `core/packages/platform/data.db` | 696,320 bytes | `2787EB7366F59FBBAFB7D0D0399D02610C3B05DE07D87725C1849DABA483A49E` | 结构存在，但已抽查业务表为空；不能充当旧数据备份 |

旧库首次盘点得到 `integrity_check=ok`，但 `journal_mode=wal`；同日复核已经实证文件哈希漂移并出现 WAL/SHM。以上都只是只读观察值，不是权威来源或一致性快照。原因未解释前，P1 的任何后续盘点都处于阻塞状态；必须先冻结并证明全部写入者停止，再按 7.1 制作新快照，重跑完整性、schema、逐表行数、主键/时间范围、内容哈希和隔离恢复核验。

已知内容仍只能暂定为来源混合：包含 seed/demo、待核实用户、mock 交易、运行日志和敏感瞬态记录，不能概括为全是真实业务数据。实施前还必须找到生产数据库、备份、外部对象存储和上传目录的最终权威来源。

实际 SQLite 有 39 张非 FTS 业务表；归档 `schema.ts` 还定义了实库不存在的 `otp_rate_limits`。P1 必须输出“实际数据库 schema 与归档源码 schema”的 drift，不能只信任何一侧。

### 4.3 数据行数与来源风险

SQLite FTS 内部表不直接迁移，目标系统按主站搜索能力重建索引。

| 领域 | 源表与当前行数 | 已知来源风险 | 当前处置 |
| --- | --- | --- | --- |
| 用户与认证 | `users=7`、`otp_codes=4` | 5 个 `u_test_*` 是 seed；2 个用户待核实；OTP 已过期且含原始验证码 | 逐行分类；OTP 永不导入，按敏感数据策略销毁 |
| 邀请增长 | `invite_codes=1` | 不能拿 `/org` 成员邀请替代营销邀请码 | 核实来源、奖励与是否仍有业务价值 |
| 课程目录 | `courses=7` | 来源包含静态 seed；当前主站 `/courses` 是受限的静态教学方案，不是既有商业课程模型 | 字段审计后建立唯一目标聚合模型 |
| 课程内容 | `lessons=5`、`quizzes=5` | 均来自 `starter-3x3` 演示课程 | 默认不当成用户内容；先做 seed hash 分类 |
| 学习路径 | `collections=3`、`collection_items=9` | 这是有序跨课程学习路径，不是个人收藏 | 归入课程路径，禁止重复迁移 |
| 学习状态 | `learning_progress=0`、`quiz_attempts=0`、`lesson_notes=0`、`course_reviews=0`、`study_checkins=0` | 零行表 | 记录表级零行证据，不造数据 |
| 公式 | `algorithms=39` | 来源与主站重复度未知 | 按 puzzle、set、case、公式内容去重 |
| 商品与订单 | `products=6`、`orders=2` | 商品来自 seed 候选；2 单均为 `paid + mock_wechat`，无 provider 证据 | 不作为真实结算或授予权益证据 |
| 会员与交易辅助 | `memberships=1`、`coupons=0`、`payment_logs=0`、`point_ledger=0` | 唯一会员虽写 active，但已于 2026-07-08 到期 | 保留源状态；不得导成当前有效权益 |
| 业务活动 | `events=5` | 来源含 seed；展示报名数与订单关系不一致 | 与 WCA 项目、比赛日历分开命名和建模 |
| 埋点 | `events_track=789` | 含 user/anon/url/referer/payload，可能含个人信息 | 单独做隐私、聚合价值与保留期限决策 |
| 新闻 | `news=5` | 来源含静态 seed | 核实后迁移、合并或批准归档 |
| 社区 | `posts=5`、`comments=8`、`post_likes=10`、`circle_members=0` | 非空记录全部来自 seed；展示点赞数与关系表不一致 | 不直接污染主站论坛；先做 seed 分类 |
| 个人收藏 | `favorites=0` | 与 `collections` 无关 | 零行证据 |
| 讲师 | `instructors=5`、`instructor_applications=0`、`instructor_payouts=0` | 讲师资料来自 seed 候选，缺主站 owner 与双语字段 | 核实后映射教师目录或批准归档 |
| 二维码 | `qr_codes=4` | 目标可能依赖尚未锁定的课程、商品和活动 URL | 延后到目标 URL 稳定后处理 |
| QR 提示模板 | `prompt_templates=91` | 89 条共享固定迁移时间，2 条后续操作，至少 1 条软删除 | 独立做 seed hash；由 owner 决定保留产品能力还是归档 |
| 证书与成就 | `certificates=0`、`user_achievements=0` | 零行表 | 不制造历史证书或成就 |
| 通知 | `notifications=0` | 零行表 | 复用主站通知，不迁空壳 |
| 计时 | `timer_solves=0` | 仓库所有者已明确不迁历史 | `明确归档` |
| 运维 | `error_logs=92`、`request_logs=0` | 不属于产品内容，可能含敏感上下文 | 按日志保留策略处理，不导入产品库 |

表级分类和行级处置必须分开：

- 表级：`zero-row`、`seed/demo-only`、`mixed provenance`。
- 行级守恒：`imported + merged + owner-approved archive + retained-under-policy + securely-discarded/expired-operational + rejected-with-reason + blocked = source rows`。

`empty` 不是逐行结果，不能放进源行数加法。每种处置必须有决定人、日期、原因和可查询证据。

### 4.4 派生计数不可信

旧库缺少数据库外键，`foreign_keys=0`，schema 和 migration 未建立关系约束。`PRAGMA foreign_key_check` 成功不能证明应用关系完整。已发现：

- `posts.likes` 合计 55，`post_likes` 只有 10 行。
- `courses.lessons` 合计 114，真实 `lessons` 只有 5 行。
- `courses.students_enrolled` 合计 4438，已付课程订单数量为 0。
- `events.registered` 合计 985，已付活动订单数量仅 1。
- 讲师 `students_taught` 没有正式学生关系来源。

每个派生字段必须被标成 `legacy display snapshot`、按可信关系重算、重置或经批准归档。未经核实的营销数字不得迁成真实产品数据。

### 4.5 上传与媒体

两个 `public/uploads` 除 `.gitkeep` 外均为 0 个文件，但这不能证明媒体不存在。已确认还有：

- 旧仓 `public/demo/lesson-1.mp4` 至 `lesson-5.mp4`，共 5 个演示视频。
- `public/card/front-city.webp`，5,617,948 bytes，SHA-256 `533799C8EAB9DD77E7E1D91BBE868B29006A6E42B55B3EDDF593D683DEADDCE5`。
- `public/card/front-ink.webp`，3,406,902 bytes，SHA-256 `5C926FD7FFBB7283942A74E3B057D05B815E5AFD040DBD66F9560ED06F722BC8`。
- 数据库中有课程视频指向外部样例或第三方 URL；外链不能当耐久备份。
- 归档 `core/packages/platform/public` 也持有部分静态副本；删除两个旧源码树仍可能同时丢失唯一资产。

P1 必须扫描所有 DB 字符串引用、根相对路径、`public/**`、部署包、生产磁盘、对象存储和外链。清单至少记录源路径、内容哈希、MIME、图片尺寸或视频时长/编码、授权、所有权、目标路径和引用关系。

## 5. 主站命名空间与候选 URL

已锁定的是“所有用户能力都在主站真实领域中，不存在 `/platform`”。下表中的动态详情路径和标有“候选”的命名必须在 P2 锁定后才可实施。

| 旧能力 | 主站归属与候选入口 | 复用或转换边界 | 状态 |
| --- | --- | --- | --- |
| Platform 首页 | 主站首页 | 不保留 Platform 产品壳；只增加已验收领域的真链接 | `待实施` |
| `/about` | 主站 `/about` 或历史页 | 团队、商业使命、路线图、讲师招募逐项核实后合并、归档或取消，不能静默吞掉 | `待决策` |
| `/progress` | 候选 `/achievements` 或 `/dev/architecture/history` | 这是建设成果汇报，不是个人课程进度；历史营销声明必须先核实 | `待决策` |
| `/login` | `/account` 与现有登录流程 | 复用主站手机号身份；不迁 OTP、cookie、session | `待盘点` |
| `/courses*` | `/courses`；候选 `/courses/[courseSlug]` 与 lesson 子路由 | 保留唯一课程体验，复用现有 UI、媒体、认证和教学组件；不能强塞进现有静态 outline 类型 | `待盘点` |
| `/paths*` | 候选 `/courses/paths/[pathSlug]` | `collections` 是有序课程路径 | `待盘点` |
| `/me/courses` | 候选 `/account/courses` | 只迁真实购买或学习权益，不迁 `/progress` 成果页 | `待盘点` |
| `/instructors*` | `/teachers`；候选 `/teachers/[teacherSlug]` | 复用教师目录和编辑器，补 owner、来源、缺失字段策略 | `待盘点` |
| 讲师申请与审核 | 候选 `/teachers/apply` 与领域管理入口 | 与现有“编辑者直接控制公开状态”不是同一流程；必须重建或明确取消 | `待决策` |
| `/instructor/courses*` | 课程领域管理入口 | 复用目标课程模型，不搬旧 dashboard | `待盘点` |
| `/instructor/students` | 课程购买与权益视图 | 不映射到 `/org/*/students` | `待盘点` |
| `/instructor/earnings` | 商业结算领域，仅在有可靠源数据和持续需求时建立 | 空 payout 表不能证明结算能力需要重建 | `待决策` |
| `/algorithms*` | `/alg` | 复用公式库、播放器、训练与权限契约 | `待盘点` |
| `/timer`、`/leaderboard` | `/timer` | 复用主站计时器；旧历史和派生排行不迁 | `明确归档` |
| `/community*` | `/forum` | 旧 post 转 thread + first post，comments 转 ordered posts，likes 转 reactions，circle 转 forum 范畴 | `待盘点` |
| `/events*` | 候选 `/activities`，P2 与 `/events` 二选一 | 面向可报名商业活动；不得与 WCA 项目、`/calendar`、`/contests` 混淆 | `待决策` |
| `/news*` | `/news` 与候选详情路由 | 先判断是否复用现有长文或公告能力 | `待盘点` |
| `/shop*` | `/shop` 与候选 `/shop/[productSlug]` | 复用支付、媒体和账户基础设施；建立唯一商业商品模型 | `待盘点` |
| `/orders*` | `/account/orders` 与候选详情路由 | 只允许本人和授权管理员读取 | `待盘点` |
| 旧课程会员 | `/account/courses` 下的 course entitlement | 不映射成主站支持型会员 | `待盘点` |
| 主站支持型会员 | 保持 `/membership`、`/account/membership` | 可复用支付基础设施，但与旧课程通行证分开 | `不在迁移范围` |
| `/me/favorites`、`/me/wishlist`、`/me/notes`、`/me/badges` | `/account/*` 或领域内个人状态 | 仅为非空且有真实价值的数据建入口；`collections` 不属于此处 | `待盘点` |
| `/me/invite` 与邀请后台 | 候选 `/account/invites` 与增长管理入口 | 营销邀请码不能被机构成员邀请替代 | `待决策` |
| `/notifications` | `/notifications` | 复用主站通知系统 | `待盘点` |
| `/cert/[code]` | `/cert/[code]` | 当前 0 行；保留能力前先确认是否仍需要生成和图片输出 | `待决策` |
| `/qr/[code]` 与 QR 后台 | `/qr/[code]`；候选 QR 管理入口 | 目标 URL 稳定后处理查看、编辑、批量、启停、聚合、SVG/card、打印、扫描统计和提示模板 | `待盘点` |
| `/search` | 候选 `/search?q=` 或扩展首页 `LandingSearch` | 主站当前没有等价的可分享全局搜索页；必须锁定一种入口并复用统一索引 | `待决策` |
| `/offline` | 主站 PWA 离线行为 | 复用 PWA 策略，不搬旧页面壳 | `待盘点` |
| `/me` | `/account` | 统一个人入口，补登录、未登录、空态和深链回跳 | `待盘点` |
| 埋点分析 | 候选商业分析管理入口或只保留聚合 | 原始事件先做隐私与保留策略，不与业务活动混合 | `待决策` |
| 支付对账 | 候选商业对账管理入口 | 若继续电商则必须保留支付、退款、净额和渠道对账能力 | `待决策` |
| `/admin/*` | 主站按课程、内容、商业、增长、QR 等领域分开的管理入口 | 不复制旧总后台；逐域确认权限、审计和必要性 | `待盘点` |
| `/org/*` | 保持 `/org/[orgSlug]/*` | 教学前端切换已完成，本文不重复实施；不代表该业务域所有生产验收都完成 | `已切换` |
| 学员与监护人 | 保持 `/learn/[orgSlug]/students/[studentId]/*` | 学习门户切换已完成，剩余生产验收由教学计划跟踪 | `已切换` |

中文路由使用 `/zh` 前缀。单语旧内容不得复制到另一语言假装翻译：只有真实翻译才互设 hreflang；缺失语言页使用 `noindex, follow`，sitemap 只收录真实存在的语言。

## 6. 非页面责任矩阵

### 6.1 Route Handler

| 旧 Handler | 最终责任 | 决策门槛 |
| --- | --- | --- |
| auth send/verify OTP、logout | 淘汰旧认证，复用主站手机号登录和 session | 不迁 OTP；证明旧回调和 session 已不可用 |
| upload | 复用主站媒体上传、所有权和授权校验 | 完成 MIME、大小、归属、扫描和目标 URL 契约 |
| track | 聚合迁移或按政策保留/销毁 | 先审 user/anon/url/referer/payload 与保留期限 |
| order status | 商业订单本人查询接口 | 目标订单模型、身份和所有权已锁定 |
| payment callback | 仅在商业能力获批后重建主站 provider 回调 | 幂等、签名、状态机、退款和对账测试齐全；永不重放旧回调 |
| lesson video | 主站媒体授权读取 | 课程、购买权益和媒体来源已锁定 |
| QR svg/card | 主站 QR 输出能力或批准取消 | 所有目标 URL 和模板责任已稳定 |
| certificate image | 主站证书图片输出或批准取消 | 证书模型有真实需求；当前源表为 0 |
| icons、OG | 复用主站 metadata 与本地静态资产 | 不迁旧 Platform 品牌壳 |

### 6.2 Server Action 文件

| 旧写能力组 | 涵盖的 Action 文件 | 最终责任 |
| --- | --- | --- |
| 管理员认证 | `admin/actions.ts` | 淘汰旧管理员登录，复用主站管理员权限 |
| 课程与路径 | `instructor/courses`、`admin/courses`、`admin/paths` | 目标课程领域写接口与领域权限 |
| 教师与申请 | `instructors/apply`、`admin/applications`、`admin/instructors` | 教师资料 owner、申请审核或明确取消 |
| 内容 | `admin/algorithms`、`admin/events`、`admin/news`、`admin/posts` | 各自领域管理写接口，不建万能后台 |
| 商业 | `admin/products`、`admin/orders`、`admin/coupons`、`admin/instructor-payouts` | 商品、订单、优惠、退款/结算与审计 |
| 增长 | `admin/invites` | 营销邀请码与奖励，或明确取消 |
| QR | `admin/qr`、`admin/qr/prompts` | 创建、批量、复制、启停、编辑、模板生命周期与审计 |

### 6.3 Metadata route

`icon.tsx`、`apple-icon.tsx`、`robots.ts` 和 `sitemap.ts` 不逐文件复制。每个最终公开领域按主站 metadata、sitemap、canonical、hreflang 与 `noindex` 契约重建；旧 Platform 品牌 metadata 归档。

## 7. 迁移契约

### 7.1 权威来源与一致性快照

1. 冻结并证明所有 SQLite 写入者停止：进程、后台任务、脚本、管理入口、定时任务和回调逐项记录。
2. 记录冻结时间、操作者、旧域 410 状态和端口/进程证据。
3. 使用 SQLite online backup API，或停写后 checkpoint，再制作 DB 一致性快照；不能只复制正在 WAL 模式运行的 `data.db`。
4. 记录 DB、WAL/SHM 状态、schema 与 migration 版本、page size、page count、大小和 SHA-256。
5. 对快照执行 `integrity_check`、实际 schema 导出、逐表行数、主键范围、时间范围和内容哈希。
6. 从副本在隔离环境恢复，再重复完整性、行数、schema 与内容哈希核验。
7. 生产库、最后备份和本地库出现差异时逐项解释，不默认选择行数最多或时间最新者。
8. 为数据库和媒体各保存一份加密、访问受控、不可变的权威归档；原件不原地修改。

### 7.2 来源分类

每条记录先分类为 `seed/demo`、`user-created`、`operator-created`、`transactional`、`runtime-log` 或 `sensitive-transient`，再决定行级处置。分类至少依据：

- seed/migration 源码与固定主键、固定时间、固定内容哈希。
- 创建时间、更新时间、软删除和操作者。
- 与真实身份、订单 provider、支付凭据、外部回调或内容媒体的关联。
- 与主站现有内容的精确和近似重复。

seed/demo 不是自动删除许可；它可以被复用、明确归档或安全销毁，但必须留下 owner 决定。

### 7.3 身份映射

- 旧 `users` 的身份字段是唯一手机号，不是假设中的邮箱或密码。
- 复用主站手机号身份和 `teaching_platform_identities(platform_subject, user_id)`；`platform_subject` 使用旧 `users.id`，手机号按主站 E.164 契约规范化后匹配。
- 导入前审计目标库已有 bridge 行、手机号重复、共享手机号、无效号码和已绑定冲突。
- 安全且唯一的手机号才允许自动映射；冲突进入人工裁决，禁止“取第一条”。
- 5 个已确认 seed test 用户不得创建主站账号。
- 无法映射但持有订单、内容或作者关系的主体使用带来源标识的历史主体或可认领流程，不能冒认当前用户。
- OTP、cookie、session 和认证瞬态数据永不导入。
- bridge 使用级联删除，不能作为永久迁移证据；另建追加式来源 ledger。
- 订单、评论、点赞、课程权益和讲师资料必须引用同一份已确认映射。

身份基线、冲突表和历史主体策略是任何作者、订单或权益导入的前置 gate。

### 7.4 显式关系与派生字段

由于源库没有数据库外键，P1 必须建立关系目录并逐对验证：

- 订单到用户、商品和活动。
- 会员到用户、订单与课程权益。
- 课程到章节、测验和学习路径条目。
- 帖子到作者、评论、点赞和圈子关系。
- QR 到目标 URL、模板和事件。
- 复合主键的唯一性、枚举、时间、金额和 JSON shape。

每个派生计数字段必须记录其权威来源和处置；展示快照不能覆盖真实关系，也不能为了“看起来完整”制造关系行。

### 7.5 幂等、原子性与中断恢复

每个导入对象至少记录：

- `source_system + source_table + canonical_source_pk` 稳定唯一键。
- 来源快照版本和内容哈希。
- 导入批次、目标类型与目标主键。
- `imported`、`merged`、`owner-approved archive`、`retained-under-policy`、`securely-discarded`、`rejected` 或 `blocked` 结果。
- 冲突原因、人工决定、决定人和时间。

复合源主键必须确定性序列化。目标写入与 ledger 写入必须在同一数据库事务内，导入任务必须持有并发锁。验证至少覆盖：

- 目标写成功但 ledger 写失败。
- 事务中途崩溃和重启。
- 相同快照、相同批次和不同批次重复执行。
- 第二次执行为 0 新目标、0 新副作用、0 重复对象，目标哈希不变。
- 回滚前检测目标对象是否已有新系统引用；有引用时只能补偿，不机械删除。

### 7.6 交易、支付与权益

- 依赖顺序固定为：产品和价格快照 → 订单 → 支付证据 → 课程 entitlement 或活动库存 → 退款撤权 → 对账。
- 2 个 `mock_wechat` paid 订单没有 provider 证据，默认不得当成真实结算或授予权益的证据。
- 源订单无币种列；只有可靠 provider 证据能决定币种，无法证明时写 `unknown`，禁止猜测。
- 同时保留源状态和“当前有效权益”两种语义；已过期会员不得导成当前有效。
- 旧课程通行证进入独立 course entitlement，不并入主站支持型会员。
- 历史订单导入不得触发报名、积分、通知、会员开通或其他履约副作用。
- 商品快照缺失字段显式为未知，不能用当前商品覆盖历史事实。
- 不重放支付回调，不重新扣款，不补发无法证明的支付成功状态。
- 电商上线验收必须覆盖：创建订单、幂等回调、状态轮询、本人所有权、权益发放、活动库存、防超卖、退款撤权、支付返回页和渠道对账。

### 7.7 领域字段转换

| 领域 | 必须先锁定的转换 |
| --- | --- |
| Forum | post → thread + first post；comments → ordered posts；likes → reactions；circle → forum；seed 内容不得直接公开 |
| Alg | `333` → 主站 `3x3` 规范；category → set slug；无法可靠形成 case 的记录进入人工复核 |
| Teacher | 来源主体、owner、公开状态、双语简介、联系方式和缺失字段；申请审核与编辑公开分开 |
| Courses | 课程、章节、测验、路径、价格、可见性、购买权益和现有教学方案的边界 |
| Commerce | 先商品，再订单，再 entitlement；源状态、provider、币种和历史商品快照分开 |
| QR | code、目标类型、目标 URL、启停、模板、输出资产和 scan event；必须等目标 URL 稳定 |

### 7.8 内容、媒体与 SEO

- 保留标题、正文、作者、发布时间、更新历史、可见性、排序和关联关系。
- 富文本执行允许标签、链接、嵌入和脚本清理，不直接信任旧 HTML。
- 所有正文、封面、头像、二维码、视频和下载链接生成引用清单。
- 媒体完成字节哈希、MIME、图片尺寸或视频时长/编码、授权、所有权、目标 URL 和 HTTP/权限验证。
- 缺失媒体不得用无来源占位图冒充完成；对应记录保持未完成。
- 单语内容记录 source language 和 translation status；不把机翻或原文复制伪装成已审核双语。
- 新公开路由遵守主站 metadata、canonical、sitemap 和 hreflang 规则。

### 7.9 保留、归档与删除

源码删除和数据销毁分开验收：

- 旧本地源码目录和旧 GitHub 仓库：P7 完成后可由仓库所有者逐项批准删除。
- 权威数据库和媒体归档：按金融、身份、内容和恢复策略保留，不因源码删除自动销毁。
- 手机号和身份映射：受限访问，按账号与审计策略保留。
- OTP：不迁移，不进入普通长期明文归档；按批准期限安全销毁。
- 请求日志、错误日志和埋点：完成隐私、取证价值和保留期判断后，聚合、受控保留或安全销毁。
- 凭据、provider 配置和外部回调：迁移后轮换或停用，单独留存验证。

最终删除清单必须逐项列出：本地目录、GitHub 仓库、每份 DB/备份、WAL/SHM、上传、静态媒体、对象存储、部署包、凭据、回调、任务和运行服务。仓库所有者逐项决定，禁止“删仓库”带过全部数据责任。

## 8. 实施阶段

### P0：纠正状态并冻结破坏性动作

状态：`完成`

- [x] 确认整体产品与数据迁移未完成。
- [x] 确认旧本地数据库包含混合来源的非空记录。
- [x] 明确不迁移旧计时历史。
- [x] 将旧迁移文档改为历史记录并指向本文。
- [x] 暂停架构源码改造，避免并行冲突。
- [x] 禁止删除旧目录、旧仓、SQLite、备份和资产。
- [x] 记录 SQLite 同日哈希漂移和 WAL/SHM 证据；P1 不得在写入者未冻结时继续盘点。
- [x] 修正所有活动架构文档中“Platform 产品迁移已完成”的矛盾表述。
- [x] 三路独立复审无 blocker。

完成门槛：仓库中的所有活动文档一致；三路 reviewer 对本方案给出 PASS。P0 完成只允许进入 P1 只读盘点，不授权数据写入。

### P1：权威来源、完整 surface 与逐行分类

状态：`未授权`

- [ ] 冻结并证明全部旧 SQLite 写入者停止。
- [ ] 制作一致性数据库快照和加密不可变归档，并完成隔离恢复。
- [ ] 对生产、备份、本地和主仓 DB 输出 schema、行数、哈希与 drift。
- [ ] 建立 83 个旧页面、13 个 Route Handler、18 个 Server Action 文件、4 个 metadata route 的逐项 ledger。
- [ ] 比较本地旧源与主仓归档，解释 12 个 `/org` 页面及其他差异。
- [ ] 为 39 张业务表逐行标记来源类别和行级处置候选。
- [ ] 建立无外键情况下的显式关系目录、孤儿报告和派生字段报告。
- [ ] 定位所有 DB 媒体引用、`public/**`、生产磁盘、对象存储和外链。
- [ ] 建立敏感字段、凭据、外部回调、任务和运行日志清单。

完成门槛：每个旧 surface、源业务行和媒体引用有唯一责任项；权威来源没有未解释分叉；恢复演练通过。

### P2：主站复用、身份基线与目标契约

状态：`未授权`

- [ ] 审计 `/courses`、`/teachers`、`/forum`、`/membership`、`/notifications`、`/account`、`/alg`、`/timer`、支付、媒体和搜索的现有契约。
- [ ] 将每项旧能力确定为直接复用、扩展主站、转换导入、明确归档、安全销毁或取消之一。
- [ ] 锁定课程、教师、活动、新闻、商城、订单、QR、搜索和管理入口的 URL、权限、SEO 与双语策略。
- [ ] 完成手机号身份 bridge、冲突表、历史主体和可认领策略。
- [ ] 设计追加式来源 ledger、数据库级唯一键、事务、并发锁和中断恢复。
- [ ] 完成课程、商业、QR 和论坛字段级转换表。
- [ ] 对需要新增的领域做最小 schema/API/UI 设计，不提前建万能 package。

完成门槛：第 5、6、7 节全部从候选变成已批准契约；身份基线已可验证；不得存在含糊的“以后再说”。P2 完成前禁止正式数据写入。

### P3：公开只读内容

状态：`未授权`

按依赖从小到大分批：

1. 公式去重并接入 `/alg`。
2. 核实后的讲师资料接入 `/teachers`。
3. 课程、章节、测验和学习路径接入唯一 `/courses` 体验。
4. 新闻与商业活动。
5. 经 seed 分类后仍需保留的社区内容接入 `/forum`。
6. `/about` 和建设成果内容按批准决定合并或归档。

每批同时完成数据、详情页、主入口、单语/双语 SEO、权限、桌面、窄屏和回滚验证。不能只导数据或只搭空页面。

### P4：商品、订单、课程权益与个人状态

状态：`未授权`

1. 先迁产品和历史商品快照。
2. 导入经核实的订单历史，不触发任何履约副作用。
3. 建立课程 entitlement，明确当前有效性；不并入主站支持型会员。
4. 如继续商业能力，完成支付状态机、库存、退款撤权和对账。
5. 迁移经核实的个人课程状态、收藏、点赞等；零行能力不造空产品壳。
6. 验证匿名、本人、其他用户、领域管理员和站点管理员权限。

完成门槛：所有非空交易记录均已逐行处置；金额、币种、状态、provider、权益和对账无未解释差异。

### P5：作者、教师与领域管理写能力

状态：`未授权`

- [ ] 公开读取稳定后，再开放课程、商品、活动、新闻和社区的创建、编辑、上下架与审核。
- [ ] 明确教师申请审核保留还是取消；不能用目录编辑器冒充审核流。
- [ ] 商业写能力覆盖订单、优惠、退款、结算和审计；无真实需求的空能力经 owner 批准取消。
- [ ] 营销邀请、QR 提示模板和运营分析分别决定保留、重建或归档。
- [ ] 所有管理写入有 CSRF、输入、上传、越权和审计测试。

### P6：QR、搜索、入口与线上闭环

状态：`未授权`

- [ ] 所有目标 URL 稳定后迁移 QR code，并决定管理、批量、启停、聚合、SVG/card、打印、统计和提示模板。
- [ ] 建立唯一全局搜索体验：`/search?q=` 或扩展 `LandingSearch`，不维护两套索引。
- [ ] 主站首页提供已验收的课程、教师、商业活动、新闻和商城真链接。
- [ ] `/account` 提供订单、课程权益和个人内容入口；支持登录、未登录、空态和深链回跳。
- [ ] `/org` 与 `/learn` 保持现有教学入口，不与商城购买者语义混合。
- [ ] 英文、中文、metadata、sitemap、canonical、hreflang 与 `noindex` 正确。
- [ ] 390px 和 430px 验证课程浏览/购买、支付返回、课时/测验、QR 管理/打印预览、搜索键盘交互、长表格和无横向溢出。
- [ ] 公开详情、登录态、权限、API、上传、支付、退款、对账和搜索完成线上 smoke。
- [ ] `platform.cuberoot.me` 继续直接返回 410，主站不存在 `/platform` 产品壳。

### P7：最终对账、观察与删除授权

状态：`未授权`

- [ ] 表级零行/seed 分类和逐行守恒公式均为 0 差值。
- [ ] 所有关系、派生字段和媒体引用均有已验收结果或 owner 批准处置。
- [ ] 路由、Handler、Action 和 metadata ledger 不存在未归属项。
- [ ] 导入脚本重复执行为 0 新目标、0 新副作用、0 重复，目标哈希不变。
- [ ] 权威数据库和媒体归档在隔离环境恢复成功。
- [ ] 本地测试、相关 CI、部署和线上 smoke 全绿。
- [ ] 至少两轮独立审核无 blocker 或未关闭 major。
- [ ] 最少 30 天观察窗口完成；记录起止时间，期间旧应用 0 次读写、无未解释对账差异、权限事故或回滚触发。
- [ ] 源码与数据的逐项删除/保留清单由仓库所有者批准。

只有 P7 全部完成，仓库所有者才可以删除批准项中的旧本地源码目录和旧 GitHub 仓库。权威数据归档、媒体、身份和金融记录继续按各自保留策略处理，不能随源码仓库一起删除。

## 9. 每批验收矩阵

| 类别 | 必需证据 |
| --- | --- |
| 来源 | 权威快照时间、冻结证据、DB/WAL 状态、大小、SHA-256、schema 和恢复结果 |
| 分类 | seed/demo、用户、运营、交易、日志、敏感瞬态的逐行依据 |
| 映射 | 源表/主键到目标表/主键的追加式 ledger |
| 守恒 | 行级处置总数等于源行数，差值为 0；零行是表级证据 |
| 关系 | 显式关系目录无孤儿；JSON、枚举、时间、金额和复合主键有效 |
| 去重 | 与主站现有数据的精确和近似重复报告，人工决定可追踪 |
| 派生 | 每个展示计数有保留快照、重算、重置或归档决定 |
| 媒体 | 引用、定位、哈希、MIME、尺寸/时长、编码、授权、权限和 HTTP 验证 |
| 身份 | 手机号规范化、bridge 冲突、seed 用户、历史主体和可认领结果 |
| 权限 | 匿名、本人、其他用户、领域管理员、站点管理员的允许与拒绝矩阵 |
| 页面 | 英文、中文、390px、430px、桌面、空态、错误态和深链接 |
| 入口 | 首页、账号或领域页存在真链接；不依赖记忆 URL |
| 写入 | 唯一键、事务、并发锁、崩溃恢复、重复提交、审计和补偿回滚 |
| 商业 | 创建订单、回调、状态、库存、权益、退款撤权、返回页和对账 |
| 部署 | 实际 workflow、生产 migration、健康检查和关键路由 smoke |
| 回滚 | 代码、数据库、媒体和外部回调分别有恢复点与实测 |

## 10. 多 AI 并行规则

- 每批只有一个 parent owner，先在本文登记批次 ID、精确文件清单和来源快照哈希。
- 只有 parent owner 修改本文状态和来源 ledger；reviewer 只读并回传结论。
- 数据导入 ledger 只有一个写者；其他 agent 只能读快照或在隔离副本试算。
- 开始前和交接时记录 `planned → active → review → handed-off → complete`。
- 热点文件不可并行修改：Server 路由入口、migration ledger、shared export、page metadata、首页/导航/account、package.json 和 lockfile。
- 文件范围重叠、快照变化或目标 schema 变化时立即停下，重新登记范围。
- agent 完成实现后必须由另一 agent 独立审查；parent 负责复核证据和最终提交。

## 11. 与架构现代化工作的协调

在 P7 完成前：

- 旧架构审计中基于“Platform 产品迁移已完成”的决定视为过期前提。
- 另一个 AI 可以继续只读依赖调查和记录候选问题，但不实施源码重构、目录移动、契约拆分、部署触发调整或旧 Platform 责任删除。
- 禁止开始 BND-02/03/05/06、CTR、PKG、LYT 和 Platform RET-03/04。
- DOC/PS1 等无热点批次也默认不放行；若以后需要并行，先在两份 tracker 中登记显式冲突矩阵和精确文件范围。
- 已有未提交改动保留现场，不继续扩大；Platform 每批开始前逐文件检查重叠。
- Platform 完成后先刷新真实依赖基线和架构跟踪文档，再重新授权架构批次。

## 12. 停止条件

出现以下任一情况，当前切片停止扩大范围并保留可恢复状态：

- 无法确定生产数据库或媒体的权威来源。
- 无法证明全部 SQLite 写入者已经停止。
- 目标表已有同名、同 slug、同订单号、同手机号或同来源主键，但无法可靠合并。
- 需要重放支付、猜测币种/支付状态、授予 mock 订单权益或复制旧认证凭据。
- 行级守恒有非零差值，或显式关系存在无法解释的孤儿。
- 媒体引用存在但源文件、授权或所有权未定位。
- 当前目标文件与另一个 AI 或用户的未提交改动重叠。
- 目标写入与 ledger 不能处于同一事务，或无法证明崩溃后幂等恢复。
- 需要同时改变 URL、API、schema 和部署才能保持可运行，无法拆成可回滚切片。
- 测试只能证明 build 成功，不能证明真实导入、权限和线上读取成立。

## 13. 每批交付记录模板

- 批次 ID、唯一 owner、范围和明确排除项。
- 修改文件的字面清单和热点冲突检查。
- 来源快照、schema drift、目标 migration 和 ledger 版本。
- seed/demo、用户、运营、交易、日志和敏感瞬态分类数量。
- 导入、合并、批准归档、策略保留、安全销毁、拒绝和阻塞数量。
- 去重、关系、派生字段、身份、权限和媒体证据。
- 英文、中文、桌面、390px 与 430px 证据。
- 本地测试、CI、部署、线上 smoke 和观察窗口。
- 代码、数据库、媒体、凭据和外部回调的回滚方式。
- 独立审核结论、修复项和复审结论。
- 提交 SHA；默认只 commit，不 push，除非仓库所有者明确要求或部署规则要求上线验证。

## 14. 审核记录

| 日期 | 审核方向 | Reviewer | 轮次 | 结论 | 关键问题 |
| --- | --- | --- | ---: | --- | --- |
| 2026-08-22 | 产品能力与 URL 守恒 | `platform_product_review` | 1 | `不通过` | 漏 Route Handler/Action/metadata；progress、collections、会员语义错误；搜索、QR、邀请、分析、对账与支付闭环不足 |
| 2026-08-22 | 数据、身份、交易与恢复 | `platform_data_review` | 1 | `不通过` | 来源误判；一致性快照、身份 bridge、mock 订单、派生计数、幂等、媒体和删除门槛不足 |
| 2026-08-22 | 主站复用、架构冲突与可实施性 | `platform_arch_review` | 1 | `不通过` | 活动文档矛盾；身份阶段过晚；守恒口径不安全；QR/API 依赖和并行规则不足 |
| 2026-08-22 | 产品能力与 URL 守恒 | `platform_product_review` | 2 | `通过` | 旧 surface、产品语义、支付/身份/媒体/SEO/入口和五份文档边界已闭环 |
| 2026-08-22 | 数据、身份、交易与恢复 | `platform_data_review` | 2 | `不通过` | 复核时发现 SQLite 哈希漂移及 WAL/SHM；文档必须记录漂移并把冻结、权威快照和隔离恢复留作 P1 前置 gate |
| 2026-08-22 | 主站复用、架构冲突与可实施性 | `platform_arch_review` | 2 | `不通过` | 旧仓删除、架构恢复和写入停止的旧表述仍可绕过 P1/P7 门槛 |
| 2026-08-22 | 数据、身份、交易与恢复 | `platform_data_review` | 3 | `通过` | 两次观察、DB/WAL/SHM 漂移和 P1 冻结、权威快照、完整核验 gate 已准确记录 |
| 2026-08-22 | 主站复用、架构冲突与可实施性 | `platform_arch_review` | 3 | `通过` | P1 writer 取证、P7 删除授权和架构恢复四重门槛已在五份文档中统一 |

审核通过只代表方案可供下一次明确授权后进入 P1 只读盘点，不代表任何产品切片、数据写入、部署或删除已经获授权或完成。

## 15. 变更记录

| 日期 | 变更 | 证据 |
| --- | --- | --- |
| 2026-08-22 | 重新打开 Platform 产品能力与数据迁移；纠正“源码和教学前端完成等于整体迁移完成”的错误 | 旧源码 surface、两份 SQLite 哈希与业务表只读行数、主站现有路由 |
| 2026-08-22 | 根据三路首轮独立审核补齐写能力、来源分类、身份、交易、媒体、幂等、删除和并行执行门槛 | 三位只读 reviewer 的 blocker/major/minor 报告 |
| 2026-08-22 | 记录 SQLite 同日哈希漂移，收紧 writer 冻结、旧仓删除和架构恢复门槛；三路独立复审全部通过 | 产品第 2 轮、数据与架构第 3 轮 PASS |
