# Platform 产品 surface 守恒账本

基线日期：2026-08-22

权威来源：退役前只读副本 `D:\cube\cube-platform\app` 与主仓归档 `core/packages/platform/app` 的并集。

目标：完整恢复产品能力到主站 `/platform/*`；不恢复独立前端、旧 auth/admin、SQLite、seed/demo、原始遥测回放或旧 timer 历史。

## 1. 守恒总表

| Surface | 权威副本 | 主仓归档 | 并集目标 | 已映射 | 未映射 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 页面 | 83 | 95 | 95 | 95 | 0 |
| Route Handler | 13 | 13 | 13 | 13 | 0 |
| Server Action 文件 | 33 | 32 | 34 | 34 | 0 |
| Metadata route | 4 | 4 | 4 | 4 | 0 |

当前 95 / 13 / 34 / 4 全部映射已由 capability manifest 标记为 `implemented`、`reviewed` 并通过守恒测试；发布状态仍以主 tracker 的 P8 为准。

## 2. 权威副本 83 个页面

| 来源页面 | 数量 | 最终 URL | 能力与复用边界 |
| --- | ---: | --- | --- |
| `/`、`/about`、`/progress` | 3 | `/platform`、`/platform/about`、`/platform/progress` | 新聚合与进度页；引用主站训练成果 |
| `/login`、`/me`、`/offline` | 3 | `/platform/login`、`/platform/account`、`/platform/offline` | 主站 auth/session/PWA |
| `/me/badges`、`/me/favorites`、`/me/notes`、`/me/wishlist`、`/me/invite` | 5 | `/platform/account/{badges,favorites,notes,wishlist,invites}` | 新个人数据域；空数据也保留入口和写链 |
| `/me/courses`、`/me/membership`、`/membership` | 3 | `/platform/account/courses`、`/platform/account/membership`、`/platform/membership` | 课程权益会员，和主站支持型会员分开 |
| `/notifications` | 1 | `/platform/notifications` | 共享主站通知组件/API/表 |
| `/timer`、`/leaderboard` | 2 | `/platform/timer`、`/platform/leaderboard` | 共享主站 timer；旧历史不迁 |
| `/algorithms`、`/algorithms/[id]` | 2 | `/platform/algorithms`、`/platform/algorithms/[id]` | 复用 `/alg` 数据、播放器与训练；旧详情页本就不读取旧 ID，新路由保持该兼容入口语义 |
| `/courses`、`/courses/[id]`、`/courses/[id]/learn/[lessonId]` | 3 | 同路径加 `/platform` 前缀 | 目录、详情、购买、权益、课时、学习 |
| `/paths`、`/paths/[id]` | 2 | `/platform/paths`、`/platform/paths/[id]` | 有序课程/课时路径 |
| `/instructors`、`/instructors/[id]`、`/instructors/apply` | 3 | `/platform/teachers`、`/platform/teachers/[id]`、`/platform/teachers/apply` | 共享教师目录；新增申请审核 |
| `/instructor`、`/instructor/courses`、`/instructor/courses/[id]`、`/instructor/students`、`/instructor/earnings` | 5 | `/platform/instructor` 与同名子路由 | 课程 owner、购买者、收入与结算；非 org 正式学员 |
| `/community`、`/community/circle/[id]`、`/community/posts/[id]`、`/community/posts/new` | 4 | `/platform/community`、`circles/[id]`、`posts/[id]`、`posts/new` | 共享 forum；圈子映射 forum 分类/群组 |
| `/events`、`/events/[id]` | 2 | `/platform/events`、`/platform/events/[id]` | 新商业教学活动与报名，非 WCA 赛事 |
| `/news`、`/news/[id]` | 2 | `/platform/news`、`/platform/news/[id]` | 可管理双语资讯 |
| `/shop`、`/shop/[id]` | 2 | `/platform/shop`、`/platform/shop/[id]` | 商品、库存、价格与购买 |
| `/orders`、`/orders/[id]` | 2 | `/platform/orders`、`/platform/orders/[id]` | 支付、取消、退款、履约、权益联动 |
| `/qr/[code]` | 1 | `/platform/qr/[code]` | 跳转/落地、禁用、修订、扫描统计 |
| `/cert/[code]` | 1 | `/platform/cert/[code]` | 证书验证与图片 |
| `/search` | 1 | `/platform/search?q=` | 扩展主站唯一搜索契约 |
| `/admin/login`、`/admin/(authed)` | 2 | `/platform/admin` | 主站 auth/admin guard，无独立认证 |
| 管理算法列表/详情/新建 | 3 | `/platform/admin/algorithms`、`/[id]`、`/new` | 共享 canonical 算法管理 |
| 管理讲师申请列表/详情 | 2 | `/platform/admin/teacher-applications`、`/[id]` | 新申请审核状态机 |
| 管理优惠券 | 1 | `/platform/admin/coupons` | 新课程/商品/活动优惠服务 |
| 管理课程列表/详情/新建、路径 | 4 | `/platform/admin/courses...`、`/platform/admin/paths` | 课程、课时、测验与路径管理 |
| 管理活动列表/详情/新建 | 3 | `/platform/admin/events`、`/[id]`、`/new` | 活动与名额管理 |
| `events-track`、`logs` | 2 | `/platform/admin/analytics`、`/platform/admin/logs` | 最小化 analytics 与审计，不恢复原始回放 |
| payout、讲师列表/详情/新建 | 4 | `/platform/admin/payouts`、`/platform/admin/teachers...` | 目录共享，补角色、分成与结算 |
| 管理邀请 | 1 | `/platform/admin/invites` | Platform 营销邀请，非 org 邀请 |
| 管理新闻列表/详情/新建、帖子 | 4 | `/platform/admin/news...`、`/platform/admin/community` | 资讯管理与 forum moderation |
| 管理订单、对账 | 2 | `/platform/admin/orders`、`/platform/admin/reconcile` | 支付/退款/差异审计 |
| 管理商品列表/详情/新建 | 3 | `/platform/admin/products`、`/[id]`、`/new` | 商品、价格和库存管理 |
| 管理 QR 列表/详情/卡面/模板/统计 | 5 | `/platform/admin/qr`、`/[code]`、`/cards`、`/prompts`、`/stats` | 批量、复制、启停、软删、恢复、排序、打印、统计 |

合计：83。

## 3. 主仓归档独有 12 个页面

| 来源页面 | 最终 URL | 复用边界 |
| --- | --- | --- |
| `/org`、`/org/[orgSlug]` | `/platform/org`、`/platform/org/[orgSlug]` | 共享现有 org overview |
| `/org/[orgSlug]/campuses` | `/platform/org/[orgSlug]/campuses` | 共享 campuses |
| `/org/[orgSlug]/classes`、`classes/[groupId]` | `/platform/org/[orgSlug]/classes...` | 共享 groups/classes |
| `/org/[orgSlug]/members` | `/platform/org/[orgSlug]/members` | 共享成员与角色 |
| `/org/[orgSlug]/packages` | `/platform/org/[orgSlug]/packages` | 共享 lesson packages |
| `/org/[orgSlug]/schedule` | `/platform/org/[orgSlug]/schedule` | 共享 sessions 日程 |
| `/org/[orgSlug]/sessions/[sessionId]` | `/platform/org/[orgSlug]/sessions/[sessionId]` | 共享课次/考勤 |
| `/org/[orgSlug]/students` | `/platform/org/[orgSlug]/students` | 共享正式学员 |
| `/org/[orgSlug]/students/[studentId]/credits` | `/platform/org/[orgSlug]/students/[studentId]/credits` | 共享课包与 credit ledger |
| `/org/[orgSlug]/students/[studentId]/responsibilities` | `/platform/org/[orgSlug]/students/[studentId]/responsibilities` | 共享成员、班级和教师指派 |

## 4. 13 个 Route Handler

| 来源 Handler | 最终能力 |
| --- | --- |
| `api/auth/send-otp`、`verify-otp`、`logout` | 主站 auth/session；旧 OTP 与 session 不迁 |
| `api/upload` | 主站媒体上传、所有权与管理员授权 |
| `api/track` | 隐私最小化 analytics、consent、retention 与 aggregates |
| `api/orders/[id]/status` | `/v1/platform/orders/:id` owner/admin 状态查询 |
| `api/payments/[provider]/callback` | `/v1/platform/payments/:provider/notify` 验签、幂等、原子履约 |
| `api/lessons/[id]/video` | `/v1/platform/lessons/:id/media` entitlement gate 与短时访问 |
| `api/qr/[code]/svg`、`card` | `/v1/platform/qr/:code/{svg,card}` |
| `cert/[code]/image` | `/v1/platform/certificates/:code/image` |
| `icons/[size]`、`og` | 主站 icon/metadata/OG 系统 |

## 5. 34 个 Server Action 文件

| 来源 Action | 最终服务 |
| --- | --- |
| `actions/cert.ts` | certificate issue/verify |
| `actions/checkin.ts` | learning check-in + point ledger |
| `actions/circle.ts` | forum group/category membership |
| `actions/community.ts` | forum thread/reply/reaction |
| `actions/favorites.ts` | Platform favorites/wishlist |
| `actions/notes.ts` | timestamped lesson note CRUD |
| `actions/notifications.ts` | shared notification read/all-read |
| `actions/order.ts` | quote/place/start/status/cancel；mock 仅测试 |
| `actions/progress.ts` | lesson/course progress |
| `actions/quiz.ts` | quiz attempts and grading |
| `actions/refund.ts` | refund state machine + reverse ledgers |
| `actions/reviews.ts` | verified course reviews |
| `actions/timer.ts` | shared main timer writes；旧历史不迁 |
| `admin/actions.ts` | 主站 auth/admin guard |
| `admin/(authed)/algorithms/actions.ts` | canonical alg admin API/editor |
| `admin/(authed)/applications/actions.ts` | teacher application approve/reject |
| `admin/(authed)/coupons/actions.ts` | coupon CRUD |
| `admin/(authed)/courses/actions.ts` | course CRUD/publish |
| `admin/(authed)/courses/lessons-actions.ts` | lesson CRUD/reorder/media |
| `admin/(authed)/courses/quiz-actions.ts` | quiz CRUD |
| `admin/(authed)/events/actions.ts` | event CRUD/capacity |
| `admin/(authed)/instructor-payouts/actions.ts` | payout generate/mark paid |
| `admin/(authed)/instructors/actions.ts` | teacher directory + Platform role fields |
| `admin/(authed)/invites/actions.ts` | marketing invite CRUD |
| `admin/(authed)/news/actions.ts` | news CRUD/publish |
| `admin/(authed)/orders/actions.ts` | finance-scoped mark/cancel/refund with evidence/audit |
| `admin/(authed)/paths/actions.ts` | path/item CRUD/reorder |
| `admin/(authed)/posts/actions.ts` | forum moderation |
| `admin/(authed)/products/actions.ts` | product/price/inventory CRUD |
| `admin/(authed)/qr/actions.ts` | batch/delete/duplicate/toggle/save |
| `admin/(authed)/qr/prompts/actions.ts` | template CRUD/restore/purge/reorder |
| `instructor/courses/actions.ts` | owner-scoped course CRUD |
| `instructors/apply/actions.ts` | teacher application submit |
| 归档独有 `org/actions.ts` | 16 个组织/成员/学员/校区/班级/指派/课包/课次/考勤操作全部共享 teaching SaaS |

## 6. 4 个 Metadata route

- `icon.tsx`、`apple-icon.tsx`：复用主站 icon。
- `robots.ts`、`sitemap.ts`：公开 Platform 路由进入主站 metadata；账户、订单、学习、搜索和 admin 页面 noindex。
- 公开共享页必须只有一个 canonical URL；Platform 壳深链按页面语义设置 canonical，避免重复索引。

## 7. 不迁移与不恢复

以下只影响历史数据或技术实现，不减少产品能力：

- 不导入 SQLite seed/demo、过期 OTP/session、旧 admin 密码、旧日志原文和原始行为回放。
- 不导入旧 timer history。
- 不恢复独立 `packages/platform` 前端、独立域名部署、SQLite 或双写。
- 不在生产恢复 `mockPay`，不允许无渠道凭据的随意“标记已付”。
- 不复制 teacher/forum/alg/timer/notifications/org/learn 的数据源。

## 8. 每项验收字段

机器 capability manifest 中每个 surface 必须记录：

`source`、`kind`、`target`、`strategy`、`canonicalOwner`、`readApi`、`writeApi`、`permission`、`sideEffects`、`metadata`、`emptyState`、`tests`、`implementationStatus`、`reviewStatus`。

只有全部字段齐全、测试通过并经产品/数据/代码 reviewer 复验后，`implementationStatus` 才能改为 `implemented`、`reviewStatus` 才能改为 `reviewed`。当前 42/42 capability 已达到这两个状态。
