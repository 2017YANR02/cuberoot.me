# CubeRoot 对外项目介绍

入口：中文 `/zh/overview`，英文 `/overview`。公开可阅读、noindex，不进入 sitemap；这不是访问控制，获得 URL 的人可以查看。原 `/partnership` 与 `/partnership/talking-points` 的管理员边界保持不变。

内容约八分钟阅读，包含创始人背景、行业背景、可体验产品、阶段规划、已有成本、资金需求、合作价值与分阶段验收。右上角打印按钮使用浏览器打印，可选择保存为 PDF；没有另建 PDF 内容副本。

## 事实与规划

- 个人经历来自已有公开 `/about/ruimin`：南开数学与金融数学、物理学学士，乔治华盛顿大学数学硕士，2017 年起参加 WCA 比赛，课程/公式工作与著作。没有读取或公开 `.private/interview.json`。
- 产品入口来自现有路由：`/timer`、`/alg`、`/recon`、`/wca`、`/achievements`；开源与数据致谢链接 `/about`。
- 行业事实于 2026-10-02 查阅 WCA 官方：[2025 世界锦标赛 1,864 人](https://www.worldcubeassociation.org/competitions/WC2025)、[官方成绩导出](https://www.worldcubeassociation.org/export/results)。赛事人数不推导市场规模或本站用户数。
- 方向参考 `docs/teaching-saas-plan.md`、`docs/mobile-app-roadmap.md` 与现有合作提案。3 个月、3–12 个月、1–3 年是本页提出的推进节奏，不是已经确认的交付承诺。多端与机构功能不写成已全面发布。
- 不引用过时的 feature-roadmap 竞品判断，不宣称领先或垄断，不填未经确认的收入、粉丝/活跃用户数或估值。

## 资金与成本

所有者明确本轮希望融资或赞助人民币 20 万到 50 万元。页面提出 12 个月的 20 万、35 万、50 万三档建议分配，不把尚未确认的分配、试点目标或融资条款写成事实。

`core/packages/client/lib/infrastructure-costs.ts` 为本介绍和 `/dev/infrastructure` 共用的费用与设备清单，原记录原样提取，没有再维护一套价格。总额按条目计算；美元沿用原页已披露的历史换算率，并不宣称为最新订阅报价或汇率。

设备金额包含个人通用设备、曾用设备、估价与基础机型起价，不表述为项目累计实付，不计入本轮预算。固定服务费用含 Codex Pro、服务器、Vercel 等；服务预算已包含该基线，不重复叠加。开发劳动报酬与必要协作在新预算中明确列出。

`overview/funding-plan.ts` 保存建议分配，各档合计从明细计算。实际净资金缺口还要扣除可用自有资金和落实回款，待确认。30 位试用者与 3 家教学伙伴是建议目标，不是已有用户、签约客户或保证成果。

融资以收入路径、成本与验证进展展开；赞助以展示、联合内容、活动和报告交付展开；项目资助以工具与教学试点展开。结构与权益另议，不假设股权比例、估值或收益。按[美国小企业管理局的商业计划说明](https://www.sba.gov/counseling/plan-your-business/#write-your-business-plan)组织资金需求、用途与业务验证材料，不适用其美国法律结构或融资政策。

## 配图

采用内置 imagegen 生成封面概念插画，页面明确标注 AI 生成。最终资源 `core/packages/client/public/images/overview/cubing-cover-v1.webp`，由 PNG 用 sharp 编码为 WebP，保留生成原件。版本化文件名配合长期缓存；更换时增加版本号。

最终生成提示词：

> Use case: stylized-concept. Asset type: wide editorial cover illustration for CubeRoot, a real speedcubing tools platform presented to potential sponsors. Create a sophisticated tactile paper and clay 3D still life: one physically accurate standard 3x3 cube with exactly 3 by 3 square stickers on each visible face, resting on a low warm ivory architectural plinth; a few restrained translucent arcs and small abstract data tiles evoke learning, practice and global connection. Terracotta, sage green, ivory, cube primary colors, soft natural light, generous negative space, elegant magazine art direction, wide landscape 1536x1024 composition. No letters, numbers, logos, charts pretending to be real data, screens, people, or watermark. Clearly conceptual artwork, not documentary photography.
