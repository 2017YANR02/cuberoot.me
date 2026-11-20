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

- `/platform/instructor` 使用独立五项工作台导航，课程、学员、收入和 `/platform/instructor/profile` 均留在同一工作台。资料页只有实际 active 讲师才能查看本人讲师身份及名录资料，并保留独立的入驻流程。
- 用户入口 `/platform/teachers/apply` 随最新申请及实际讲师权限切换表单、待审核、撤回、拒绝重提、通过及暂停状态；管理员入口 `/platform/admin/teacher-applications` 默认显示待审核，按状态和申请人搜索，查看申请快照及历史，并仅对待审核记录作决定。
- `platform_instructor_applications` 保存不可由用户直接修改的申请快照及审核结果；`platform_instructors` 的 active 状态是课程讲师权限真源。拒绝须填写原因。撤回及审核在事务内验证状态与归属，审批通过时关联唯一可匹配的本人公开资料；无对应资料时，讲师完成主页后选择关联。`teacher_directory_entries.is_visible` 保留公开/隐藏设置，审核联系信息不自动发布。
- 归档后的讲师可以重新申请；审批通过恢复原讲师记录及身份，不自动启用此前停用的课程归属。暂停状态只能由管理员解除。历史申请通过不等于当前讲师权限；旧版只返回申请记录时，客户端通过受保护的本人课程列表确认实际 active 权限，不因历史审批授予权限。
- 审核结果写入现有站内通知；申请及讲师编号仅用于内部查询、关联和链接，不作为用户可见标题。实现入口为 API `platform/catalog/instructor-routes.ts`、Web `components/platform/PlatformInstructorApplication.tsx`。2026-11 本地验证使用隔离前端阶段快照与 API fixture；未执行真实账号登录、实库事务验收或生产部署，不将模拟截图视为线上验收。

## 历史依据

按需追溯决策、失败及验收限制；旧待办、状态和授权只适用于记录时点。

- [两级导航本地预览设计与验收](history/platform-navigation-preview-2026-11-17.md)
- [Platform 完整移植与复用跟踪](history/platform-completion-tracker.md)
- [Cube Platform 迁移跟踪](history/platform-migration.md)
- [Platform 主站完整迁移跟踪](history/platform-product-migration-tracker.md)
- [Platform 产品 surface 守恒账本](history/platform-product-surface-ledger.md)
- [教学平台前端统一计划](history/platform-unification-plan.md)
