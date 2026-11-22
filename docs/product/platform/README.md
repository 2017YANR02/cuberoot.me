# 机构教学与 Platform

当前产品任务从 modernization 进入，数据处置先查 ledger；旧迁移的保留与不迁移决定只在 history 中解释。

事实源：core/packages/client 的 platform/org/learn 页面；API 路由和 migrations；capability manifest。

开始：[本专题入口](platform-modernization-2026-11.md)。

## 文档与登记

- [学习空间首页推荐与统一导航](platform-homepage.md)

- [platform-capability-manifest.json](platform-capability-manifest.json)
- [platform-data-audit-sidecar.json](platform-data-audit-sidecar.json)
- [Platform 权威数据与处置账本](platform-data-disposition-ledger.md)
- [Platform 模块化与产品验收跟踪](platform-modernization-2026-11.md)
- [多机构教学 SaaS 设计](teaching-saas-plan.md)

## 讲师入驻与审批

- 讲师工作台分页统一默认每页 5 条，可选 10、20 条；内容不足一屏时分页位于视口底部，超出一屏时随内容排在列表末尾。

- `/platform/instructor` 是唯一讲师工作台入口。桌面端采用可折叠侧栏（概览、课程、学员、收入、个人主页），移动端采用概览任务卡片与子页返回；使用学习产品公共页头和页脚，创建课程和课时编辑保留专用编辑布局。概览展示真实课程与有效学员统计、本月分币种净收入（上海账本时区）、与提现接口同口径的可提现金额，以及最多四门近期非归档课程和四条近期交易。收入页通过 `earningsView` 区分收入概览、分页交易明细和收款结算，按币种展示趋势与完整月度记录；不重复教学概览。资料页仅实际 active 讲师可编辑本人资料；直接复用原名录完整个人主页编辑器及其保存接口，保留照片、联系方式与公开设置。已有讲师身份但主页关联缺失时，进入资料页自动补齐唯一明确的本人历史关联，或在没有任何可能历史资料时初始化隐藏主页（`POST /v1/platform/instructor/profile`），在事务中同时关联讲师身份；不会复制私密申请信息或创建重复资料，多份或跨账号资料仍由管理员处理。
- 用户入口 `/platform/teachers/apply` 为入驻介绍与状态页：未申请用户先了解讲师权益、审核流程，在首屏通过「申请成为讲师」进入独立申请向导 `/platform/teachers/apply/start`；游客登录后进入向导。向导复用现有表单和魔方项目选择器，分基本资料、教学能力、公开主页、确认提交四步；擅长方向按项目与教学方向组合。第三步复用完整名录主页编辑器，包含照片、中英文介绍和公开联系信息，也可选择以后再设置；此时保留公开作者姓名并在审批后建立或保留隐藏主页，工作台中继续编辑。仅最终确认写入申请快照，审批后同事务同步公开资料；照片归属在提交及审批时校验，不把私密审核联系方式或经历复制到公开主页或浏览器持久存储。公开擅长方向限制为名录支持的 8 项、每项 50 字；仅线下授课（含线上及线下）需填写城市。旧 API 未支持完整主页快照时禁止提交以避免资料丢失。页面随最新申请及实际讲师权限切换待审核、撤回、拒绝重提、通过及暂停状态；重提仍回填已有资料。管理员入口 `/platform/admin/teacher-applications` 默认显示待审核，按状态和申请人搜索，查看申请快照及历史，并仅对待审核记录作决定。
- `platform_instructor_applications` 保存不可由用户直接修改的申请快照及审核结果；`platform_instructors` 的 active 状态是课程讲师权限真源。申请时同时填写公开姓名、教学简介、公开设置及私密审核信息。拒绝须填写原因。审批通过在同一事务内关联唯一可信的历史资料或建立新资料，保留原讲师 UUID；多份或跨账号历史资料要求管理员明确确认。审核联系方式和私密教学经历不自动发布。
- `teacher_directory_entries` 是统一讲师公开资料真源，`/teachers` 与 `/platform/teachers` 共用名录组件与数据源；Platform 列表和详情是原生路由，首屏即使用 Platform 样式及公开目录筛选，不再通过水合后切换旧名录界面；保留原 canonical SEO 目标。公开讲师必须既是 active 又选择公开。隐藏仅影响名录及其公开链接，发布课程中的作者姓名仍使用讲师资料。普通用户不能通过名录绕过审核创建讲师；机构条目独立保留。历史未认证资料保留在本人及管理员名录，不自动授予讲师权限。迁移 0348 对唯一明确的账号资料自动关联；无法确定归属的记录留待管理员处理，正式讲师没有任何候选资料时建立隐藏草稿。
- active 讲师可以在入驻状态页确认注销本人身份（`POST /v1/platform/instructor/archive`），与管理员归档共用事务逻辑：身份归档、课程归属权限停用、公开名录不再展示，课程、申请、学员和收益历史保留。注销前提醒先处理未结算收益。归档后的讲师可以重新申请；审批通过恢复原讲师记录及身份，不自动启用此前停用的课程归属。暂停状态只能由管理员解除。历史申请通过不等于当前讲师权限；旧版只返回申请记录时，客户端通过受保护的本人课程列表确认实际 active 权限，不因历史审批授予权限。
- 审核结果写入现有站内通知；申请及讲师编号仅用于内部查询、关联和链接，不作为用户可见标题。实现入口为 API `platform/catalog/instructor-routes.ts`、Web `components/platform/PlatformInstructorApplication.tsx`。2026-11 本地验证使用隔离前端阶段快照与 API fixture；未执行真实账号登录、实库事务验收或生产部署，不将模拟截图视为线上验收。

## 讲师课程发布与试听

- 工作台质量规范：课程管理卡片使用单一详情入口，归档课程不提供新增课时快捷入口；学员列表显示真实课时进度及证书状态，签发重试复用操作标识，服务端验证有效学员并避免重复生成相同证书。收入与结算区分加载、空状态、提交成功与后续读取失败，金额按真实币种展示，不在读取失败时推断余额。个人主页编辑器和界面样式由讲师名录及工作台共同引用。

- 学习空间功能导航右侧（含讲师入驻状态页）固定提供唯一的 active 讲师工作台入口 `/platform/instructor`；注销后即时刷新该入口。工作台内创建、管理、上传分别进入 `/platform/instructor/courses/new`、`/platform/instructor/courses/[id]`、`/platform/instructor/courses/[id]/lessons/new`。
- 课程创建分七步并保存设备本地草稿。上传复用 Drive 分片协议，专用接口 `/v1/platform/instructor/courses/:courseId/lesson-uploads` 仅允许已授权课程的私有目录；单视频限制 1 GiB，使用 Drive 共享配额。课时关联媒体后保留独立存储路径，源文件永久删除时仍占用共享配额；未关联的失败写入清理文件。课时自动追加顺序由服务端在课程事务内确定。
- 讲师可以直接创建草稿，公开或不公开列出的课程发布、图文及视频课时发布均须管理员审批。管理员在课程管理 `/platform/admin/courses` 审阅候选版本并批准或驳回；既有线上版本在审核期间保持不变，讲师可以撤回申请、修改或根据审核意见重新提交。
- 课程信息可选择多个试听课时，保存时在课程事务内更新本课程非引言课时的访问权限。旧课程保留既有标题、slug 分类与引言权限；课程与课时都发布后，通用课程目录和播放器展示公开内容，正式课仍须权益。课时内容不缓存；短期媒体签名在有效期内仍可使用。

## 历史依据

按需追溯决策、失败及验收限制；旧待办、状态和授权只适用于记录时点。

- [两级导航本地预览设计与验收](history/platform-navigation-preview-2026-11-17.md)
- [学习产品统一外壳路由盘点与本地验收](history/platform-shared-ui-2026-11-21.md)
- [Platform 完整移植与复用跟踪](history/platform-completion-tracker.md)
- [Cube Platform 迁移跟踪](history/platform-migration.md)
- [Platform 主站完整迁移跟踪](history/platform-product-migration-tracker.md)
- [Platform 产品 surface 守恒账本](history/platform-product-surface-ledger.md)
- [教学平台前端统一计划](history/platform-unification-plan.md)
