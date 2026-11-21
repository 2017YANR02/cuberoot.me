# 机构教学与 Platform

当前产品任务从 modernization 进入，数据处置先查 ledger；旧迁移的保留与不迁移决定只在 history 中解释。

事实源：core/packages/client 的 platform/org/learn 页面；API 路由和 migrations；capability manifest。

开始：[本专题入口](platform-modernization-2026-11.md)。

## 文档与登记

- [学习空间首页推荐与栏目搜索](platform-homepage.md)

- [platform-capability-manifest.json](platform-capability-manifest.json)
- [platform-data-audit-sidecar.json](platform-data-audit-sidecar.json)
- [Platform 权威数据与处置账本](platform-data-disposition-ledger.md)
- [Platform 模块化与产品验收跟踪](platform-modernization-2026-11.md)
- [多机构教学 SaaS 设计](teaching-saas-plan.md)

## 讲师入驻与审批

- `/platform/instructor` 是唯一讲师工作台入口，不再显示讲师选项栏。首页展示真实课程与学员统计、最近有记录月份的分币种净收入及最多四条近期交易摘要，并以任务卡片进入课程、学员、收入与结算、讲师资料；子页返回工作台，课程列表保留课程内搜索。收入子页集中展示完整月度分成、结算、收款提现和订单，不重复工作台教学概览。资料页仅实际 active 讲师可编辑本人资料；直接复用原名录完整个人主页编辑器及其保存接口，保留照片、联系方式与公开设置。已有讲师身份但主页关联缺失时，进入资料页自动补齐唯一明确的本人历史关联，或在没有任何可能历史资料时初始化隐藏主页（`POST /v1/platform/instructor/profile`），在事务中同时关联讲师身份；不会复制私密申请信息或创建重复资料，多份或跨账号资料仍由管理员处理。
- 用户入口 `/platform/teachers/apply` 随最新申请及实际讲师权限切换表单、待审核、撤回、拒绝重提、通过及暂停状态；管理员入口 `/platform/admin/teacher-applications` 默认显示待审核，按状态和申请人搜索，查看申请快照及历史，并仅对待审核记录作决定。
- `platform_instructor_applications` 保存不可由用户直接修改的申请快照及审核结果；`platform_instructors` 的 active 状态是课程讲师权限真源。申请时同时填写公开姓名、教学简介、公开设置及私密审核信息。拒绝须填写原因。审批通过在同一事务内关联唯一可信的历史资料或建立新资料，保留原讲师 UUID；多份或跨账号历史资料要求管理员明确确认。审核联系方式和私密教学经历不自动发布。
- `teacher_directory_entries` 是统一讲师公开资料真源，`/teachers` 与 `/platform/teachers` 共用名录；公开讲师必须既是 active 又选择公开。隐藏仅影响名录及其公开链接，发布课程中的作者姓名仍使用讲师资料。普通用户不能通过名录绕过审核创建讲师；机构条目独立保留。历史未认证资料保留在本人及管理员名录，不自动授予讲师权限。迁移 0348 对唯一明确的账号资料自动关联；无法确定归属的记录留待管理员处理，正式讲师没有任何候选资料时建立隐藏草稿。
- active 讲师可以在入驻状态页确认注销本人身份（`POST /v1/platform/instructor/archive`），与管理员归档共用事务逻辑：身份归档、课程归属权限停用、公开名录不再展示，课程、申请、学员和收益历史保留。注销前提醒先处理未结算收益。归档后的讲师可以重新申请；审批通过恢复原讲师记录及身份，不自动启用此前停用的课程归属。暂停状态只能由管理员解除。历史申请通过不等于当前讲师权限；旧版只返回申请记录时，客户端通过受保护的本人课程列表确认实际 active 权限，不因历史审批授予权限。
- 审核结果写入现有站内通知；申请及讲师编号仅用于内部查询、关联和链接，不作为用户可见标题。实现入口为 API `platform/catalog/instructor-routes.ts`、Web `components/platform/PlatformInstructorApplication.tsx`。2026-11 本地验证使用隔离前端阶段快照与 API fixture；未执行真实账号登录、实库事务验收或生产部署，不将模拟截图视为线上验收。

## 讲师课程发布与试听

- 工作台质量规范：课程管理卡片使用单一详情入口，归档课程不提供新增课时快捷入口；学员列表显示真实课时进度及证书状态，签发重试复用操作标识，服务端验证有效学员并避免重复生成相同证书。收入与结算区分加载、空状态、提交成功与后续读取失败，金额按真实币种展示，不在读取失败时推断余额。个人主页编辑器和界面样式由讲师名录及工作台共同引用。

- 学习空间功能导航右侧（含讲师入驻状态页）固定提供唯一的 active 讲师工作台入口 `/platform/instructor`；注销后即时刷新该入口。工作台内创建、管理、上传分别进入 `/platform/instructor/courses/new`、`/platform/instructor/courses/[id]`、`/platform/instructor/courses/[id]/lessons/new`。
- 课程创建分七步并保存设备本地草稿。上传复用 Drive 分片协议，专用接口 `/v1/platform/instructor/courses/:courseId/lesson-uploads` 仅允许已授权课程的私有目录；单视频限制 1 GiB，使用 Drive 共享配额。课时关联媒体后保留独立存储路径，源文件永久删除时仍占用共享配额；未关联的失败写入清理文件。课时自动追加顺序由服务端在课程事务内确定。
- 课程信息可选择多个试听课时，保存时在课程事务内更新本课程非引言课时的访问权限。旧课程保留既有标题、slug 分类与引言权限；课程与课时都发布后，通用课程目录和播放器展示公开内容，正式课仍须权益。课时内容不缓存；短期媒体签名在有效期内仍可使用。

## 历史依据

按需追溯决策、失败及验收限制；旧待办、状态和授权只适用于记录时点。

- [两级导航本地预览设计与验收](history/platform-navigation-preview-2026-11-17.md)
- [Platform 完整移植与复用跟踪](history/platform-completion-tracker.md)
- [Cube Platform 迁移跟踪](history/platform-migration.md)
- [Platform 主站完整迁移跟踪](history/platform-product-migration-tracker.md)
- [Platform 产品 surface 守恒账本](history/platform-product-surface-ledger.md)
- [教学平台前端统一计划](history/platform-unification-plan.md)
