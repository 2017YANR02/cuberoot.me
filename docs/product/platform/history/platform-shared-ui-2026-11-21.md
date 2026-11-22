# 学习产品统一外壳：路由盘点与本地验收（2026-11-21）

状态：本地实现与抽样验证，不代表已发布。以 [路由登记](../../../../core/packages/client/lib/platform-routes.ts) 为准。以下路径均相对于 `/zh/platform`，动态参数仅代表路由模式，并非虚构实际数据。

## 改造前路由盘点

- **新**：首页已使用四项文字导航、品牌、账号菜单。
- **旧**：原生旧页头（胶囊栏目、整行搜索或 Agent 输入、我的学习文字入口）。
- **专注**：原课程详情、课时、申请向导、讲师工作台的专用布局，尚无首页公共页头。
- **复用旧**：主站 canonical 页面复用旧 Platform 外壳（水合后）。
- **独立**：canonical 原主站布局，登记在 Platform 下但原来不挂公共外壳。
- **退役**：旧商店别名明确返回 404，保持主站商店唯一入口与原有访问控制。

本次所有有效模式统一至首页外壳；保留讲师侧栏、课时目录、播放器、各机构工作区。退役商店别名不恢复。路由模板总计 120 个（含三类课时分组）。

| 路径 | 改造前 | 访问类型 |
| --- | --- | --- |
| `/` | 新 | 公开 |
| `about` | 旧 | 公开 |
| `offline` | 旧 | 公开 |
| `login` | 独立 | 公开 |
| `account` | 独立 | 登录 |
| `membership` | 旧 | 公开 |
| `account/membership` | 旧 | 登录 |
| `notifications` | 独立 | 登录 |
| `timer` | 独立 | 公开 |
| `algorithms` | 独立 | 公开 |
| `algorithms/:id` | 独立 | 公开 |
| `courses` | 旧 | 公开 |
| `courses/:id` | 专注 | 公开 |
| `courses/:id/sections/introduction` | 专注 | 公开 |
| `courses/:id/sections/trial` | 专注 | 登录 |
| `courses/:id/sections/core` | 专注 | 公开 |
| `courses/:id/learn/:lessonId` | 专注 | 公开 |
| `teachers` | 旧 | 公开 |
| `teachers/edit` | 复用旧 | 登录 |
| `teachers/scripts` | 复用旧 | 公开 |
| `teachers/scripts/:rest*` | 复用旧 | 公开 |
| `teachers/live-guide` | 复用旧 | 公开 |
| `teachers/:id` | 旧 | 公开 |
| `teachers/apply` | 旧 | 登录 |
| `teachers/apply/start` | 专注 | 登录 |
| `community` | 复用旧 | 公开 |
| `community/feed` | 复用旧 | 公开 |
| `community/mine` | 复用旧 | 登录 |
| `community/search` | 复用旧 | 公开 |
| `community/review` | 复用旧 | 管理员 |
| `community/circles/:id` | 复用旧 | 公开 |
| `community/posts/new` | 复用旧 | 登录 |
| `community/posts/:id` | 复用旧 | 公开 |
| `search` | 旧 | 公开 |
| `leaderboard` | 旧 | 公开 |
| `paths` | 旧 | 公开 |
| `paths/:id` | 旧 | 公开 |
| `events` | 旧 | 公开 |
| `events/online` | 旧 | 公开 |
| `events/online/:id` | 旧 | 公开 |
| `events/preview` | 旧 | 公开 |
| `events/:id` | 旧 | 公开 |
| `news` | 旧 | 公开 |
| `news/:id` | 旧 | 公开 |
| `shop` | 退役 | 管理员 |
| `shop/cart` | 退役 | 管理员 |
| `shop/checkout` | 退役 | 管理员 |
| `shop/help` | 退役 | 管理员 |
| `shop/:id` | 退役 | 管理员 |
| `orders` | 旧 | 登录 |
| `orders/:id` | 旧 | 登录 |
| `progress` | 旧 | 登录 |
| `account/courses` | 旧 | 登录 |
| `account/badges` | 旧 | 登录 |
| `account/favorites` | 旧 | 登录 |
| `account/notes` | 旧 | 登录 |
| `account/wishlist` | 旧 | 登录 |
| `account/invites` | 旧 | 登录 |
| `account/privacy` | 旧 | 登录 |
| `account/shipping` | 旧 | 登录 |
| `instructor` | 专注 | 讲师 |
| `instructor/courses` | 专注 | 讲师 |
| `instructor/courses/new` | 专注 | 讲师 |
| `instructor/courses/:id` | 专注 | 讲师 |
| `instructor/courses/:id/lessons/new` | 专注 | 讲师 |
| `instructor/students` | 专注 | 讲师 |
| `instructor/earnings` | 专注 | 讲师 |
| `instructor/profile` | 专注 | 讲师 |
| `cert/:code` | 旧 | 公开 |
| `qr/:code` | 旧 | 公开 |
| `org` | 复用旧 | 登录 |
| `org/:orgSlug` | 复用旧 | 登录 |
| `org/:orgSlug/campuses` | 复用旧 | 登录 |
| `org/:orgSlug/classes` | 复用旧 | 登录 |
| `org/:orgSlug/classes/:groupId` | 复用旧 | 登录 |
| `org/:orgSlug/members` | 复用旧 | 登录 |
| `org/:orgSlug/packages` | 复用旧 | 登录 |
| `org/:orgSlug/schedule` | 复用旧 | 登录 |
| `org/:orgSlug/sessions/:sessionId` | 复用旧 | 登录 |
| `org/:orgSlug/students` | 复用旧 | 登录 |
| `org/:orgSlug/students/:studentId/credits` | 复用旧 | 登录 |
| `org/:orgSlug/students/:studentId/responsibilities` | 复用旧 | 登录 |
| `org/:orgSlug/:rest*` | 复用旧 | 登录 |
| `admin` | 旧 | 管理员 |
| `admin/homepage` | 旧 | 管理员 |
| `admin/algorithms` | 复用旧 | 管理员 |
| `admin/algorithms/new` | 复用旧 | 管理员 |
| `admin/algorithms/:id` | 复用旧 | 管理员 |
| `admin/teacher-applications/:id` | 旧 | 管理员 |
| `admin/teacher-applications` | 旧 | 管理员 |
| `admin/coupons` | 旧 | 管理员 |
| `admin/courses/new` | 旧 | 管理员 |
| `admin/courses/:id` | 旧 | 管理员 |
| `admin/courses` | 旧 | 管理员 |
| `admin/paths` | 旧 | 管理员 |
| `admin/events/new` | 旧 | 管理员 |
| `admin/events/:id` | 旧 | 管理员 |
| `admin/events` | 旧 | 管理员 |
| `admin/analytics` | 旧 | 管理员 |
| `admin/logs` | 旧 | 管理员 |
| `admin/payouts` | 旧 | 管理员 |
| `admin/teachers/new` | 旧 | 管理员 |
| `admin/teachers/:id` | 旧 | 管理员 |
| `admin/teachers` | 旧 | 管理员 |
| `admin/invites` | 旧 | 管理员 |
| `admin/news/new` | 旧 | 管理员 |
| `admin/news/:id` | 旧 | 管理员 |
| `admin/news` | 旧 | 管理员 |
| `admin/community` | 复用旧 | 管理员 |
| `admin/orders/:id` | 旧 | 管理员 |
| `admin/orders` | 旧 | 管理员 |
| `admin/reconcile` | 旧 | 管理员 |
| `admin/products/new` | 旧 | 管理员 |
| `admin/products/:id` | 旧 | 管理员 |
| `admin/products` | 旧 | 管理员 |
| `admin/qr/:code` | 旧 | 管理员 |
| `admin/qr/cards` | 旧 | 管理员 |
| `admin/qr/prompts` | 旧 | 管理员 |
| `admin/qr/stats` | 旧 | 管理员 |
| `admin/qr` | 旧 | 管理员 |

`org/:orgSlug/:rest*` 另覆盖实际主站子页：`audit`、`reports`、`reports/:reportId`、`sessions`、`students/:studentId`、`students/:studentId/packages`、`students/:studentId/messages`、`students/:studentId/messages/:conversationId`、`training`、`operations`、`training/assignments/:assignmentId`、`training/templates/:templateId`、`training/assignments/:assignmentId/students/:studentId`。`teachers/scripts/:rest*` 覆盖 `manage`、`edit`、`:scriptId`。这些仍使用各自原主站业务实现。

## 本地改造与证据范围

- 真实开发站：课程目录（已兑换 3% 进度）、详情、社区版块（16 个）、机构创建（无企业）、讲师目录（无公开讲师）、成为讲师首屏；每页检查 1440 / 768 / 375，未发现页面级横向滚动。课程详情和播放页保留原功能；公开引言播放页面三宽度检查发现 768 下原播放器工具栏拥挤，已调整平板断点。
- 改造前确实观察到课程目录、社区动态、讲师与机构页面三宽度截图；社区、讲师部分截图处于加载态，机构补拍加载完成态。改造后实际浏览器显示截图已在会话中展示；该浏览器截图接口未提供可写入工作区的文件路径，不能宣称已保存完整逐路由基线。
- 访客和已登录管理员两套浏览器页面分别对首页、动态、学习榜、消息、活动、资讯、关于、路径、兑换、讲师申请、机构等入口初始画面进行三宽度 DOM 检查。并非每个接口都已完成加载；不可等同于每个详情和每种状态的视觉验收。
- 吉祥物及其下方地球图标（环境切换管理工具）随公共助手入口收起。粉色翻译控件是浏览器扩展的 `immersive-translate-popup`，不改扩展设置或网站以外的权限。
- 无公开讲师时展示入驻提示与真实站点公告链接；未发现讲师上新订阅接口，不模拟消息订阅。课程路径关联现有的新手求助、进步日志、教程与指南、速拧综合讨论、视频分享、纪录视频版块，依据论坛种子定义。
- 课程进度直接读取 `/v1/platform/me/courses` 的全课 `progressBps`，按 100 basis points = 1% 显示；续学使用 `continueLessonId`，无课时记录时进入课程详情。不修改权益、支付、会话或课程服务。
- 机构创建使用现有企业名称、页面地址和时区字段；机构是教学工作区，企业为认证/收款主体；认证管理独立查询视图 `/platform/org?view=admin` 受现有管理员角色检查，后端授权仍独立。
- 尚需真实新注册账户、非管理员学习中账户、完整接口失败矩阵、每个实际动态实体与管理表单的视觉验收。未创建企业、未提交申请、未操作真实支付或更改账号角色。
- 代码检查：客户端 typecheck 通过；Platform、论坛及标题回归 28 个文件，290 项通过，1 项可选 Chromium 测试跳过。新增全路由外壳及已兑换课程进度回归。变更的应用/组件 ESLint 无错误；全包 ESLint 仍有 158 个错误、257 个警告（包括既有吉祥物脚本等不在本次范围的文件）。文档全仓检查有 136 条历史本地证据缺失记录，Platform 专题未出现错误。没有部署或提交。

## 产品待确认

1. 讲师/课程上新订阅是否新增通知偏好与通知触发；当前只链接真实公告，不声称订阅已实现。
2. 六个学习阶段的对应版块是否采用现有主题，或新增专门按目标秒数划分的版块。课程路径入口已只保留首页。
3. 企业主体名词是否继续保留在认证与财务流程；教学导航统一称机构，公开教学者称讲师，组织内成员角色需要与实际岗位对应。
4. 是否需要对平台别名中的独立计时器、公式库及特殊管理页额外设置沉浸模式；当前公共外壳统一，原专用控件保留。

