# CubeRoot 对外项目介绍

入口：中文 `/zh/overview`，英文 `/overview`。公开可阅读、noindex，不进入 sitemap；这不是访问控制，获得 URL 的人可以查看。原 `/partnership` 与 `/partnership/talking-points` 的管理员边界保持不变。

内容约五分钟阅读，包含创始人背景、行业背景、可体验产品、阶段规划、商业验证方向和合作用途。右上角打印按钮使用浏览器打印，可选择保存为 PDF；没有另建 PDF 内容副本。

## 事实与规划

- 个人经历来自已有公开 `/about/ruimin`：南开数学与金融数学、物理学学士，乔治华盛顿大学数学硕士，2017 年起参加 WCA 比赛，课程/公式工作与著作。没有读取或公开 `.private/interview.json`。
- 产品入口来自现有路由：`/timer`、`/alg`、`/recon`、`/wca`、`/achievements`；开源与数据致谢链接 `/about`。
- 行业事实于 2026-10-02 查阅 WCA 官方：[2025 世界锦标赛 1,864 人](https://www.worldcubeassociation.org/competitions/WC2025)、[官方成绩导出](https://www.worldcubeassociation.org/export/results)。赛事人数不推导市场规模或本站用户数。
- 方向参考 `docs/teaching-saas-plan.md`、`docs/mobile-app-roadmap.md` 与现有合作提案。3 个月、3–12 个月、1–3 年是本页提出的推进节奏，不是已经确认的交付承诺。多端与机构功能不写成已全面发布。
- 不引用过时的 feature-roadmap 竞品判断，不宣称领先或垄断，不填未经确认的融资金额、收入、粉丝/活跃用户数或估值。

合作对象、具体金额、预算、周期和可核对的经营数据，待所有者确定后按同一页面更新。

## 配图

采用内置 imagegen 生成封面概念插画，页面明确标注 AI 生成。最终资源 `core/packages/client/public/images/overview/cubing-cover-v1.webp`，由 PNG 用 sharp 编码为 WebP，保留生成原件。版本化文件名配合长期缓存；更换时增加版本号。

最终生成提示词：

> Use case: stylized-concept. Asset type: wide editorial cover illustration for CubeRoot, a real speedcubing tools platform presented to potential sponsors. Create a sophisticated tactile paper and clay 3D still life: one physically accurate standard 3x3 cube with exactly 3 by 3 square stickers on each visible face, resting on a low warm ivory architectural plinth; a few restrained translucent arcs and small abstract data tiles evoke learning, practice and global connection. Terracotta, sage green, ivory, cube primary colors, soft natural light, generous negative space, elegant magazine art direction, wide landscape 1536x1024 composition. No letters, numbers, logos, charts pretending to be real data, screens, people, or watermark. Clearly conceptual artwork, not documentary photography.
