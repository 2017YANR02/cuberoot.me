# 教学平台前端统一计划

最后更新:2026-08-22

状态:机构教学前端统一与旧 Platform 产品能力的本地实施已经完成,独立前端已退役;P8 发布验收与至少 30 天观察尚未完成,旧 seed/demo 和计时历史按决策不迁移。后续执行以[Platform 产品能力与数据迁移跟踪](./platform-product-migration-tracker.md)为准。

## 决策

最终不保留独立 Platform 前端。教学系统作为主站的一部分运行:

- `core/packages/client` 是唯一 Web 前端,教职员工入口使用 `/org/*`,学员/监护人入口使用 `/learn/*`。
- `core/packages/server` 提供全部多机构教学 API,PostgreSQL 是教学业务唯一事实来源。
- `core/packages/shared` 保存前后端共享契约,不放第二套业务实现。
- `core/packages/platform` 只作为历史归档来源,停止新增、测试和部署产品能力;仅允许必要的数据导出与取证。
- `/timer`、`/predict`、`/alg`、`/sim` 始终复用主站实现,教学页面只生成带任务上下文的真链接。
- 旧 Platform 计时历史不迁移到新训练证据系统,原 SQLite 表和 migration 暂时保留,不主动删除数据。

统一指的是一个产品、一个账号和一套前端,不是把所有代码堆进同一个目录。教学域继续按机构、学员、课包、课堂、训练、反馈和审计拆分。

## 目标结构

| 领域 | 最终归属 | 说明 |
| --- | --- | --- |
| 公开站点与训练工具 | `packages/client` | 继续使用现有主站页面和组件 |
| 机构与教师后台 | `packages/client/app/[lang]/org` | 独立后台布局,仍属于主站应用 |
| 学员与监护人门户 | `packages/client/app/[lang]/learn` | 复用主站账号、教学 API 与中性教学组件 |
| 登录与账号 | 主站现有账号体系 | 不再保留 `cube_user` 独立 Cookie 或跨站身份桥接 |
| 教学 API | `packages/server` | 统一鉴权、租户权限、审计和幂等 |
| 教学数据 | PostgreSQL | 机构、课包、课堂、作业、证据和反馈均以此为准 |
| 共享契约 | `packages/shared` | DTO、权限、状态、严格 parser 与 registry |
| 旧 Platform SQLite | 离线归档 | 不迁移计时历史,不再承载教学业务或线上写入 |

主站路由沿用语言规范:英文使用 `/org/*`、`/learn/*`,中文使用 `/zh/org/*`、`/zh/learn/*`。`platform.cuberoot.me` 不提供页面也不跳转,退役 vhost 统一返回 HTTP 410。

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
- `/org/[orgSlug]/training/templates/[templateId]`:模板版本管理,工具配置只引用共享 registry。
- `/org/[orgSlug]/training/assignments/[assignmentId]`:任务编辑、发布、结束和目标学员。
- `/org/[orgSlug]/training/assignments/[assignmentId]/students/[studentId]`:证据明细和老师批改。
- `/training/[orgSlug]`:学员任务入口,真链接进入主站 `/timer`、`/predict` 或 `/alg`。
- `/account/student-binding`:学员登录后预览并确认一次性账号绑定邀请。
- `/account/guardian-binding`:监护人登录后预览并确认一次性账号绑定邀请。
- `/org/[orgSlug]/reports`:课堂反馈与周报。
- `/org/[orgSlug]/students/[studentId]/messages`:教职员工侧家校会话与回复。
- `/learn`:当前账号可访问的学员上下文。
- `/learn/[orgSlug]/students/[studentId]`:学员/监护人概览。
- `/learn/[orgSlug]/students/[studentId]/reports`、`/feedback`:已发布周报与对外课堂反馈。
- `/learn/[orgSlug]/students/[studentId]/messages`:学员/监护人侧家校会话与回复。
- `/org/[orgSlug]/audit`:审计日志搜索、结果筛选、分页和当前页 CSV 导出。
- `/org/[orgSlug]/settings`:机构设置与权限入口。

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
- [x] 补齐成员角色、班级详情、负责人和分班管理。

### 3. 迁移核心管理流程

按可独立验收的垂直切片迁移:

1. 机构、成员、学员、校区、班级和负责人。
2. 课包、余额、排课、出勤、消课、课时退款与冲正、异常流水和课堂历史。[已完成主站首版]
3. 账号绑定、训练模板、任务发布、学员训练入口、证据和批改。[已完成主站首版]
4. 批量导入和更完整的监护人管理工作台。
5. 课堂反馈和教师周报。[已完成主站首版]
6. 学员/监护人读取、通知和家校沟通。[已完成主站首版]
7. 经营报表、资金结算对账和更完整的异常工作台。
8. 机构审计日志检索和当前页导出。[已完成主站首版]

每个切片先确认主站是否已有等价能力。已有的直接链接或扩展,不得复制实现。

### 4. 数据与身份收口

- 新教学写入全部进入 PostgreSQL,禁止继续向 Platform SQLite 双写。
- 旧课程、订单、内容和上传逐域评估:主站已有则复用,其余逐行分类;只有仓库所有者明确批准的项才归档或销毁。
- 不迁移旧 `timer_solves` 及其派生排行榜和徽章;`study_checkins` 当前为零行表,只记录零值证据。
- 完成主站账号与 `student_profiles.account_user_id` 的绑定流程后,移除对独立 Platform 登录的依赖。

### 5. 切换与退役

- [x] 主站 `/org` 与 `/learn` 承担全部教学入口,首页和账号页均提供真链接。
- [x] Platform 域名改为 HTTP 410,不反代旧应用,也不跳转到主站。
- [x] 删除独立 deploy/test workflow 与仓库内 systemd unit,Web 运维部署同时确保旧服务和 `:3004` 监听停止。
- [x] 已知独立 Web 服务和部署链路的运行时写入已停止;其他进程、脚本、定时任务与回调是否仍可写入,须在产品迁移跟踪表 P1 中完成只读取证。保留 SQLite、uploads 与源码归档,不迁移旧计时历史。
- [ ] 仅在产品迁移跟踪表 P8 发布验收完成、至少 30 天观察结束且仓库所有者逐项批准后,才能删除旧目录、旧 GitHub 仓库和其余退役资源。

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
- 本次退役不删除 Platform 源码、SQLite 或上传文件;旧仓库只有在产品迁移跟踪表 P8 发布验收完成、至少 30 天观察结束且仓库所有者逐项批准后才能删除。

## 退役验证边界

- 已完成主站源码、共享契约接线、类型检查、静态回归和关键 PostgreSQL 并发夹具;训练工具仍只有主站一份实现。
- 已完成学员/监护人实时授权读取、绑定邀请、周报与反馈投影、站内消息、单调已读游标和事务内通知的源码闭环。
- 退役发布必须验证 Platform 的 HTTP 与 HTTPS 均不再返回页面、旧应用监听已停止、主站 `/org` 与 `/learn` 仍可访问。
- 旧 SQLite、uploads 和源码不属于本次删除范围;备份恢复与最终物理删除仍需单独确认。
