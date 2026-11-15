# 文档结构整理记录（2026-11-15）

状态：`COMPLETED`，仅指本次目录、索引、引用与历史归档工作。源码/发布/真机/备案的验收仍以各专题证据为准。

## 归属与阅读流程

根 docs 原有 183 个平铺文件，整理后只保留 README 入口，资料归入 contributing、architecture、product、compliance、data、operations、design。原 core/docs 的 8 份手册已分配到小程序模块、支付、账号运维及移植专题。第三方 vendor/upstream、产品 `/docs` 路由保持其自身用途；research、solver、ops、job、script 的就近规则与入口仍有效。

[总入口](../../README.md)按任务给出 Agent 阅读顺序；专题 README 连接当前合同、源码事实源、历史依据和验收边界。新增 App UI、Desktop、Harmony 模块 README；Mobile 与小程序局部 docs 有独立导航。有效 AGENTS/contributing/skill 指令不当成历史归档。

## 合并与保留

- 会员的两份 6 月手册合并为历史记录；8 月总体方案原文另存历史。当前会员合同汇总现有网站、Play 内购与微信续费入口，保留托管收银台、渠道/provider 分离、服务端验单与不开隐式扣款等决策。
- 176 个只有跳转的历史标题已移除；旧深链接直接修到历史正文。另将 31 个按日期的 App 过程批次归入原主题历史，保留取舍、失败、版本及未验收边界。
- 公安/APP/小程序备案、Google Play 主体和交易者声明、商家收款不迁移的最新核验汇总归入 compliance；小程序与 App 入口链接同一汇总，不重复维护跨平台状态。
- 翻译原稿、版本、审校、检查点与哈希全部保留。JSON 中 source/translation 及其哈希未变，网站生成的 posts/logs/index 也未变。
- SQL migration 由部署脚本校验字节，6 份 migration 内的旧文档路径保持原文；本轮最终 SQL 与开始基线无差异。[迁移表](../../contributing/documentation-migrations.json)记录其新位置，不保留旧文件或运行时别名。

## 验证

- `node scripts/check-documentation.mjs`：归属、Markdown 相对文件/锚点、旧路径引用及路径/锚点迁移目标通过。该检查不联网验证外部网址，不把链接可达当成内容或产品验收。
- `core/` 下 `node scripts/check-architecture-boundaries.mjs`：229 项既有边界身份、252 次出现、38 项人工契约通过。
- `core/` 下 `pnpm --filter @cuberoot/shared build`：通过（共享源码中涉及文档引用的注释也同步了路径）。
- 本地文件生命周期检查及现有 4 项测试、upstream 同步契约 6 项测试通过；同步测试使用临时 fixture，没有执行真实上游更新。
- 提交钩子要求的 Recon 回归：16 文件通过，307 项通过、19 项跳过；没有把跳过项计为通过。第一次提交期间并发输入改变被钩子拒绝，随后用准确暂存快照重新验证并成功提交，没有绕过钩子。
- 翻译 logs/posts 原有只读 validate 均通过。迁移后两份 review 脚本的仓库根路径已修正；未执行会写翻译的 apply/import。

另两项现有检查未全通过，不能宣称全仓检查全绿：

1. generated-artifacts 检查有三项既有问题：助手 pages.json 生成快照不存在、account-avatar-gallery 缺许可登记、exact-puzzle 与 scramble 输出范围重叠。文档目录修改没有生成资产、补造许可或改变输出所有权。规则拆分后的检查改为同时读取根 AGENTS 与 contributing/architecture，继续验证同一事实源要求。
2. 2026-10-26 全量翻译 review 的旧 verify 对两篇后来新增公告报 reused disciplinary content mismatch：`expression-of-interest-for-2028-wca-continental-championships-2029-wca-world-championship` 与 `wca-asian-championship-2026-cancellation-october-2026`。相关翻译内容/哈希和网站数据本轮未改；旧轮审校不冒充后续新增内容的审校结果。

逐文件迁移与锚点映射在仓库中；本机迁移前快照、各批次差异和只读验证结果保存在 `.local-data/docs-organization-2026-11-15/`。其他会话持续提交产品代码，本轮按明确路径暂存，只提交文档、其引用与检查器改动；未推送或部署。
