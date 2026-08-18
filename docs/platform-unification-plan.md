# 教学平台前端统一计划

最后更新:2026-08-18

状态:架构决策已确认,主站第一批机构管理界面实施中。

## 决策

最终不保留独立 Platform 前端。教学系统作为主站的一部分运行:

- `core/packages/client` 是唯一 Web 前端,教学管理入口使用 `/org/*`。
- `core/packages/server` 提供全部多机构教学 API,PostgreSQL 是教学业务唯一事实来源。
- `core/packages/shared` 保存前后端共享契约,不放第二套业务实现。
- `core/packages/platform` 只作为迁移期来源,停止新增产品能力;仅允许安全修复、迁移辅助和必要的数据导出。
- `/timer`、`/predict`、`/alg`、`/sim` 始终复用主站实现,教学页面只生成带任务上下文的真链接。
- 旧 Platform 计时历史不迁移到新训练证据系统,原 SQLite 表和 migration 暂时保留,不主动删除数据。

统一指的是一个产品、一个账号和一套前端,不是把所有代码堆进同一个目录。教学域继续按机构、学员、课包、课堂、训练、反馈和审计拆分。

## 目标结构

| 领域 | 最终归属 | 说明 |
| --- | --- | --- |
| 公开站点与训练工具 | `packages/client` | 继续使用现有主站页面和组件 |
| 机构与教师后台 | `packages/client/app/[lang]/org` | 独立后台布局,仍属于主站应用 |
| 登录与账号 | 主站现有账号体系 | 不再保留 `cube_user` 独立 Cookie 或跨站身份桥接 |
| 教学 API | `packages/server` | 统一鉴权、租户权限、审计和幂等 |
| 教学数据 | PostgreSQL | 机构、课包、课堂、作业、证据和反馈均以此为准 |
| 共享契约 | `packages/shared` | DTO、权限、状态、严格 parser 与 registry |
| 旧 Platform SQLite | 迁移期只读 | 按功能决定归档或迁移,不再承载新增教学业务 |

主站路由沿用语言规范:英文裸路径 `/org/*`,中文 `/zh/org/*`。`platform.cuberoot.me` 在最终切换后只做 308 跳转到主站对应入口,不再返回第二套页面。

## 功能路由

首版统一到以下主站区域:

- `/org`:机构选择与创建。
- `/org/[orgSlug]`:机构概览。
- `/org/[orgSlug]/members`:成员和角色。
- `/org/[orgSlug]/students`:学员、监护人和负责人。
- `/org/[orgSlug]/campuses`、`/classes`:校区、班级和分班。
- `/org/[orgSlug]/packages`:课包、余额、流水和异常处理。
- `/org/[orgSlug]/sessions`:排课、出勤、消课、请假和补课。
- `/org/[orgSlug]/training`:模板、任务、训练日历和完成情况。
- `/org/[orgSlug]/reports`:课堂反馈、周报和经营报表。
- `/org/[orgSlug]/settings`:机构设置、权限与审计入口。

页面只消费 Core API。不得从主站直接读取 Platform SQLite,也不得从 `packages/client` 跨目录引用 `packages/platform/app` 或其页面组件。

## 实施顺序

### 1. 冻结独立前端

- `packages/platform` 不再增加新页面、训练器、账号体系或数据库表。
- 盘点其中仍有价值的页面、组件和文案,分为迁移、主站已有、归档三类。
- 为主站 `/org` 建立页面清单、权限矩阵和 Core endpoint 对照表。

### 2. 建立主站教学外壳

- [x] 在 `packages/client` 建 `/org` 路由组、后台布局、机构入口和按权限生成的真链接导航。
- [x] 直接使用主站登录态调用 Core,不再经过 Platform HMAC bridge。
- [x] 复用主站 AppLink、i18n、分页、空状态和响应式样式。
- [x] 首批接入机构概览、学员、校区和班级列表与创建流程。
- [ ] 补齐成员角色、班级详情、负责人和分班管理。

### 3. 迁移核心管理流程

按可独立验收的垂直切片迁移:

1. 机构、成员、学员、校区、班级和负责人。
2. 课包、余额、排课、出勤、消课和课堂历史。
3. 账号绑定、训练模板、任务发布、训练日历、证据和批改。
4. 监护人、批量导入、请假补课、退款撤销和异常对账。
5. 课堂反馈、周报、通知、家校沟通和经营报表。

每个切片先确认主站是否已有等价能力。已有的直接链接或扩展,不得复制实现。

### 4. 数据与身份收口

- 新教学写入全部进入 PostgreSQL,禁止继续向 Platform SQLite 双写。
- 旧课程、订单、内容和上传逐域评估:主站已有则复用,仍有业务价值才设计一次性迁移,无价值则归档。
- 不迁移旧 `timer_solves`、`study_checkins` 或由它们派生的榜单、徽章和打卡数据。
- 完成主站账号与 `student_profiles.account_user_id` 的绑定流程后,移除对独立 Platform 登录的依赖。

### 5. 切换与退役

- 主站 `/org` 完成多角色、多机构、桌面端与窄屏验收。
- 完成老师布置任务、学员进入主站工具、证据回传、老师批改的完整浏览器流程。
- 先部署 Core migration/API,再部署主站,观察稳定后将 Platform 域名 308 到主站。
- 停止 Platform workflow、systemd 服务和运行时写入,但在观察期内保留可恢复包、SQLite 和 uploads 备份。
- 达到删除门槛后,由仓库所有者删除旧目录、旧 GitHub 仓库和退役运行资源。

## 验收门槛

- 主站是唯一可操作教学前端,不存在双写或两套账号。
- owner、admin、teacher、assistant、finance、viewer 的菜单和 API 权限一致。
- 两个机构夹具无法互读互写,拒绝事件留下安全审计。
- 所有内部跳转是真链接,动态列表关闭无意义预取,窄屏小于 480px 可完成核心流程。
- 训练工具普通访问不上传证据;只有合法任务上下文才进入本地队列并提交。
- 课时账本、训练证据、批改和审计保持只追加或受控匿名化。
- 生产备份可读,迁移和失败恢复步骤已实测。
- 主站 CI、Core CI、线上 migration 和登录态 smoke 全部通过。

## 明确不做

- 不在主站重写 timer、predict、alg 或 sim。
- 不把 Platform 页面整目录复制进主站。
- 不保留长期跨站 HMAC 登录桥接。
- 不把旧 SQLite 直接当作新教学系统数据库。
- 不为旧计时历史建立迁移项目。
- 不在验证完成前删除 Platform 源码、数据库、上传文件或旧仓库。
