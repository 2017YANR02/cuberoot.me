# Platform 产品 surface 处置账本

基线日期：2026-08-22
权威源码：退役前只读副本 `D:\cube\cube-platform\app`
目标原则：不建立独立 Platform 前端，不建立 `/platform` 产品壳；已有能力复用主站，seed/demo 和零数据能力不重建。

## 1. 守恒结论

| Surface | 来源数量 | 已归属 | 未归属 |
| --- | ---: | ---: | ---: |
| 页面 | 83 | 83 | 0 |
| Route Handler | 13 | 13 | 0 |
| Server Action 文件 | 33 | 33 | 0 |
| Metadata route | 4 | 4 | 0 |

主仓归档源码比退役前副本多出的 12 个 `/org` 页面，属于后来接入的机构教学前端历史，不属于这 83 个旧产品页面；它们已经由主站 `/org` 和 `/learn` 承接。

两份源码树的完整差分为：退役前权威副本 `83 / 13 / 33 / 4`，主仓归档源码 `95 / 13 / 32 / 4`（页面 / Route Handler / Server Action 文件 / Metadata route）。Handler 与 metadata 清单完全一致；归档源码只多 12 个 `/org` 页面和 `org/actions.ts`，权威副本只多 `actions/timer.ts` 与 `admin/(authed)/algorithms/actions.ts`。这些差异都在下方逐项归属，不再存在“待生成差分”。

## 2. 83 个页面

路径按旧 Platform 根路径书写；同一行中的所有路径共享处置结果。

| 来源路径 | 数量 | 最终处置 | 主站入口或理由 |
| --- | ---: | --- | --- |
| `/`、`/about`、`/progress` | 3 | 合并后归档 | 复用主站 `/`、`/about`、`/achievements`；不导入旧营销数字 |
| `/login`、`/me`、`/offline` | 3 | 直接复用 | `/account` 与主站 PWA；不迁 OTP、session 或 seed 账号 |
| `/me/badges`、`/me/favorites`、`/me/notes`、`/me/wishlist`、`/me/invite` | 5 | 取消 | 对应生产表均为零行或 seed；不造空壳 |
| `/me/courses`、`/me/membership`、`/membership` | 3 | 归档旧语义 | 生产课程权益和会员均为零；不得冒充主站支持型 `/membership` |
| `/notifications` | 1 | 直接复用 | 主站 `/notifications`，生产源为零行 |
| `/timer`、`/leaderboard` | 2 | 直接复用并取消历史迁移 | 主站 `/timer`；用户明确不迁 timer history 和派生榜单 |
| `/algorithms`、`/algorithms/[id]` | 2 | 合并且不写入 | 主站 `/alg` 已覆盖 35 条等价 seed；4 条不可靠记录拒绝导入 |
| `/courses`、`/courses/[id]`、`/courses/[id]/learn/[lessonId]` | 3 | 直接复用，源内容归档 | 主站 `/courses`；生产 6 门课程均为 seed，课时和学习进度均为零 |
| `/paths`、`/paths/[id]` | 2 | 源内容归档 | 3 条路径和 9 条条目只引用上述 6 门 seed 课程，不创建第二套课程路径 |
| `/instructors`、`/instructors/[id]`、`/instructors/apply` | 3 | 直接复用，旧申请取消 | 主站 `/teachers` 和 `/teachers/edit`；5 位讲师为 seed，申请表为零 |
| `/instructor`、`/instructor/courses`、`/instructor/courses/[id]`、`/instructor/students`、`/instructor/earnings` | 5 | 取消旧控制台 | 无真实课程权益、学生或结算数据；不复制 dashboard |
| `/community`、`/community/circle/[id]`、`/community/posts/[id]`、`/community/posts/new` | 4 | 直接复用，seed 归档 | 主站 `/forum`；帖子、评论和点赞均为固定 seed |
| `/events`、`/events/[id]` | 2 | 取消 | 5 条商业活动为 seed，0 条报名关系；不得冒充 `/calendar` 或 WCA 比赛 |
| `/news`、`/news/[id]` | 2 | 取消 | 5 条新闻为 seed；真实公告继续使用主站论坛公告能力 |
| `/shop`、`/shop/[id]` | 2 | 取消 | 6 件商品为 seed，生产订单为零；不建立空商城 |
| `/orders`、`/orders/[id]` | 2 | 取消 | 生产订单为零；不建立空订单或伪造权益 |
| `/qr/[code]` | 1 | 取消 | 2 个二维码只指向 demo 页面；卡面仅随加密归档保留 |
| `/cert/[code]` | 1 | 取消 | 生产证书为零行 |
| `/search` | 1 | 以主站组件重建入口 | 主站 `/search?q=`，复用 `LandingSearch` 与 `useSiteSearch` 唯一索引 |
| `/admin/login`、`/admin/(authed)` | 2 | 取消 | 不保留旧总后台和独立管理员认证 |
| `/admin/(authed)/algorithms`、`/[id]`、`/new` | 3 | 取消旧后台 | 主站公式库已有自己的权限和管理契约 |
| `/admin/(authed)/applications`、`/[id]` | 2 | 取消 | 申请表零行；不让教师目录编辑器冒充审核流 |
| `/admin/(authed)/coupons` | 1 | 取消 | 零行且没有继续商城产品 |
| `/admin/(authed)/courses`、`/[id]`、`/new`、`/paths` | 4 | 取消旧后台 | seed 课程和路径归档，主站课程保持唯一实现 |
| `/admin/(authed)/events`、`/[id]`、`/new` | 3 | 取消 | seed-only 商业活动不重建 |
| `/admin/(authed)/events-track`、`/logs` | 2 | 取消产品入口 | 原始遥测只留受限加密归档，不进入产品库 |
| `/admin/(authed)/instructor-payouts`、`/instructors`、`/instructors/[id]`、`/instructors/new` | 4 | 取消旧后台 | payout 和申请零行；主站教师目录独立运作 |
| `/admin/(authed)/invites` | 1 | 取消 | 邀请码零行；不可混入 `/org` 绑定邀请 |
| `/admin/(authed)/news`、`/[id]`、`/new`、`/posts` | 4 | 取消旧后台 | seed 内容不导入；主站论坛继续使用自己的管理能力 |
| `/admin/(authed)/orders`、`/reconcile` | 2 | 取消 | 生产订单和支付日志均为零，不造对账假闭环 |
| `/admin/(authed)/products`、`/[id]`、`/new` | 3 | 取消 | seed 商品归档，不建商城 |
| `/admin/(authed)/qr`、`/[code]`、`/cards`、`/prompts`、`/stats` | 5 | 取消 | QR、模板和统计均为 demo/seed；无稳定真实目标 |

合计：83。

## 3. 13 个 Route Handler

| 来源 Handler | 最终处置 |
| --- | --- |
| `api/auth/send-otp`、`api/auth/verify-otp`、`api/auth/logout` | 取消；复用主站账号认证，旧 OTP/session 永不迁移 |
| `api/upload` | 取消；生产 uploads 无业务文件，未来媒体继续走主站上传契约 |
| `api/track` | 取消；960 条原始遥测不进入产品数据库 |
| `api/orders/[id]/status`、`api/payments/[provider]/callback` | 取消；生产订单、支付日志和权益均为零，不重放回调 |
| `api/lessons/[id]/video` | 取消；生产 lesson 为零，旧外部样例视频不作为耐久资产 |
| `api/qr/[code]/svg`、`api/qr/[code]/card` | 取消；二维码为 demo，输出资产随源归档保留 |
| `cert/[code]/image` | 取消；证书零行 |
| `icons/[size]`、`og` | 取消旧实现；主站已有 icon 与 metadata 体系 |

## 4. 33 个 Server Action 文件

| 来源 Action 文件 | 导出写操作 | 最终处置 |
| --- | --- | --- |
| `actions/cert.ts` | 签发证书 | 取消，生产证书零行 |
| `actions/checkin.ts` | 学习签到 | 取消，生产签到零行 |
| `actions/circle.ts` | 加入、退出圈子 | 取消，生产圈子成员零行 |
| `actions/community.ts` | 发帖、点赞、评论 | 取消旧写链，seed 社区内容不导入主站论坛 |
| `actions/favorites.ts` | 收藏、取消收藏课程 | 取消，生产收藏零行 |
| `actions/notes.ts` | 新增、更新、删除课时笔记 | 取消，生产笔记零行 |
| `actions/notifications.ts` | 标记单条或全部通知已读 | 取消旧写链，复用主站通知；生产通知零行 |
| `actions/order.ts` | 下单、优惠预览、启动支付、mock 支付、取消订单 | 取消；生产订单和支付日志零行，禁止重放 mock 支付 |
| `actions/progress.ts` | 更新课程学习进度 | 取消，生产学习进度零行 |
| `actions/quiz.ts` | 提交测验 | 取消，生产测验与答题记录零行 |
| `actions/refund.ts` | 退款 | 取消，生产订单零行，不建立空退款链 |
| `actions/reviews.ts` | 提交课程评价 | 取消，生产评价零行 |
| `actions/timer.ts` | 保存计时、改 penalty、删除计时 | 取消旧写链；复用主站 `/timer`，用户明确不迁历史 |
| `admin/actions.ts` | 管理员登录、登出 | 取消旧认证 |
| `admin/(authed)/algorithms/actions.ts` | 保存、删除、排序公式 | 取消旧后台，复用主站公式域 |
| `admin/(authed)/applications/actions.ts` | 通过、拒绝讲师申请 | 取消，生产申请零行 |
| `admin/(authed)/coupons/actions.ts` | 创建、删除优惠券 | 取消，生产零行 |
| `admin/(authed)/courses/actions.ts` | 保存、删除课程 | 取消 seed 内容后台 |
| `admin/(authed)/courses/lessons-actions.ts` | 课时增删改与排序 | 取消 seed 课程后台，生产课时零行 |
| `admin/(authed)/courses/quiz-actions.ts` | 测验增删改 | 取消 seed 课程后台，生产测验零行 |
| `admin/(authed)/events/actions.ts` | 保存、删除活动 | 取消 seed 活动后台 |
| `admin/(authed)/instructor-payouts/actions.ts` | 生成结算、标记已付 | 取消，生产结算零行 |
| `admin/(authed)/instructors/actions.ts` | 保存、删除讲师 | 取消旧后台，复用教师目录 |
| `admin/(authed)/invites/actions.ts` | 创建、删除邀请码 | 取消，生产零行 |
| `admin/(authed)/news/actions.ts` | 保存、删除新闻 | 取消 seed 新闻后台 |
| `admin/(authed)/orders/actions.ts` | 管理员标记已付、取消订单 | 取消，禁止无渠道证据改支付状态 |
| `admin/(authed)/paths/actions.ts` | 路径增删改、条目增删排序 | 取消 seed 路径后台 |
| `admin/(authed)/posts/actions.ts` | 删除帖子 | 取消旧后台，主站论坛独立管理 |
| `admin/(authed)/products/actions.ts` | 保存、删除商品 | 取消 seed 商品后台 |
| `admin/(authed)/qr/actions.ts` | 批量创建、删除、复制、启停、保存二维码 | 取消 demo QR 产品 |
| `admin/(authed)/qr/prompts/actions.ts` | 模板增删改、恢复、清除、排序 | 取消 89 条固定 seed 模板 |
| `instructor/courses/actions.ts` | 讲师保存自有课程 | 取消，无真实课程 owner 数据 |
| `instructors/apply/actions.ts` | 提交讲师申请 | 取消，主站教师目录继续走既有公开与编辑契约 |

## 5. 4 个 Metadata route

`icon.tsx`、`apple-icon.tsx`、`robots.ts`、`sitemap.ts` 全部取消旧实现；主站现有 metadata、icon、robots 和 sitemap 是唯一来源。

## 6. 最终公开入口

- 公共学习与内容：`/courses`、`/teachers`、`/teachers/scripts`、`/forum`、`/alg`。
- 个人与支持能力：`/account`、`/notifications`、`/membership`、`/timer`。
- 教学业务：`/org`、`/learn`，不接收旧商城购买者语义。
- 站点发现：主页真链接和 `/search?q=`。
- 历史与说明：`/about`、`/achievements`。

明确不存在：`/platform`、`/shop`、`/activities`、`/news`、`/account/orders`、`/account/courses`、`/qr/[code]` 和旧总后台。它们没有真实生产数据或持续产品需求，重建只会把 demo 误装成产品。
