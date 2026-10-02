# CubeRoot 对外项目介绍

入口：中文 `/zh/overview`，英文 `/overview`。公开可阅读、noindex，不进入 sitemap；这不是访问控制，获得 URL 的人可以查看。原 `/partnership` 与 `/partnership/talking-points` 的管理员边界保持不变。

首屏提供项目、优势与请求的摘要；主线按圈外读者的顺序解释持续学习需求、竞争和切入点，再提供产品、规划和预算。右上角打印按钮使用浏览器打印，可选择保存为 PDF；没有另建 PDF 内容副本。

## 事实与规划

- 个人经历来自已有公开 `/about/ruimin`：南开数学与金融数学、物理学学士，乔治华盛顿大学数学硕士，2017 年起参加 WCA 比赛，课程/公式工作与著作。没有读取或公开 `.private/interview.json`。
- 产品入口来自现有路由：`/timer`、`/alg`、`/recon`、`/wca`、`/achievements`；开源与数据致谢链接 `/about`。
- 行业事实于 2026-10-02 查阅 WCA 官方：[2025 世界锦标赛 1,864 人](https://www.worldcubeassociation.org/competitions/WC2025)、[官方成绩导出](https://www.worldcubeassociation.org/export/results)。赛事人数不推导市场规模或本站用户数。
- 方向参考 `docs/teaching-saas-plan.md`、`docs/mobile-app-roadmap.md` 与现有合作提案。3 个月、3–12 个月、1–3 年是本页提出的推进节奏，不是已经确认的交付承诺。多端与机构功能不写成已全面发布。
- 不引用过时的 feature-roadmap 竞品判断，不宣称领先或垄断，不填未经确认的收入、粉丝/活跃用户数或估值。
- 所有者本轮确认自媒体合计约 50 万粉丝。`lib/creator-profile.ts` 的 `CREATOR_AUDIENCE` 同源供介绍页与个人履历使用，更新原公开履历的约 30 万旧口径。平台间未去重，不代表当前触达、本站用户、客户或收入。没有推导粉丝转化率。

## 竞品与定位证据（2026-10-02）

所有者确认两款关注竞品为 XC大师与 aicfop.com。按 benchmark-sites skill 核对以下八个产品的官方介绍，公开页重点讨论前两款，其他用于说明市场供给；这些是公开主打功能，不是逐项体验或性能比较，也不能据此断言某家没有某能力。

| 产品 | 官方证据 | 可支持的判断 |
| --- | --- | --- |
| XC大师 | [App Store](https://apps.apple.com/cn/app/id6758835520) | 智能训练、分析、公式练习与对战；介绍为免费 |
| AI_CFOP | [官网](https://aicfop.com/) | 智能训练、复盘、统计、AI 分析与多端介绍 |
| csTimer | [官网](https://cstimer.net/) | 计时与训练设置，含蓝牙/分阶段能力 |
| CubeSkills | [官网](https://www.cubeskills.com/) | 分水平教学内容 |
| J Perm | [官网](https://jperm.net/) | 教程与公式资源 |
| CubingApp | [官网](https://cubingapp.com/) | 排名与数据入口 |
| GAN CubeStation | [品牌官网](https://cubestation.com/zh/) | 智能训练与在线对战 |
| GiiKER Puzzle School | [开发者 Google Play 介绍](https://play.google.com/store/apps/details?id=com.GiTeam.PuzzleSchool&hl=en) | 入门教学、还原辅助与计时 |

定位是待验证的组合优势：内容触达基础、教学积累与现有工具相结合，先验证从内容到练习再到复练的路径。没有称粉丝、AI、跨端或公开 WCA 数据为独占壁垒；潜在长期壁垒来自有效教学内容、使用习惯、获授权的反馈与机构服务经验。竞品粉丝少、增长快是用户的交流背景，未取得同口径数据，未写成公开比较事实。

## 资金与成本

所有者明确全年资金目标人民币 20 万到 50 万元，并进一步明确：当前希望直接项目资助、非借贷，未来股权可能另谈。页面统一本轮性质，不再把资助和股权投资混作同一请求。保留 12 个月的 20 万、35 万、50 万三档建议分配；可选首期为基础档季度预算 5 万元，未获得用户对首期金额的最终确认，明确为可讨论建议而非既定报价。

`core/packages/client/lib/infrastructure-costs.ts` 为本介绍和 `/dev/infrastructure` 共用的费用与设备清单，原记录原样提取，没有再维护一套价格。总额按条目计算；美元沿用原页已披露的历史换算率，并不宣称为最新订阅报价或汇率。

设备金额包含个人通用设备、曾用设备、估价与基础机型起价，不表述为项目累计实付，不计入本轮预算。固定服务费用含 Codex Pro、服务器、Vercel 等；服务预算已包含该基线，不重复叠加。开发劳动报酬与必要协作在新预算中明确列出。

`overview/funding-plan.ts` 保存建议分配，各档合计从明细计算。实际净资金缺口还要扣除可用自有资金和落实回款，待确认。首个 90 天提出 3 个专题、30 位试用者、3 位老师/机构负责人访谈和四周复练报告，是建议目标，不是已有用户、签约客户或保证成果。

资助对应工具与教学试点，品牌赞助另约商业交付；未来股权独立讨论，不承诺自动取得股权或转换。本提案不是赠与或融资合同。如对方期待财务回报，应改谈明确的融资结构。核对[民法典赠与合同章节](https://www.court.gov.cn/zixun/xiangqing/233181.html)和[现行公司法](https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/fgs/art/2023/art_067c072db6ef4679a2e0180996be4cf8.html)时，仅用于避免把直接资助与股权混同，不对具体合同、主体或税务作结论。按[美国小企业管理局的商业计划说明](https://www.sba.gov/counseling/plan-your-business/#write-your-business-plan)组织资金需求、用途与业务验证材料，不适用其美国法律结构或融资政策。

内部 `/partnership/talking-points` 增加两分钟短会稿、竞品与粉丝转化问答，以及今晚发对外页面的附言。该页仍为管理员资料，不提供给外部读者。

## 配图

采用内置 imagegen 生成封面概念插画，页面明确标注 AI 生成。最终资源 `core/packages/client/public/images/overview/cubing-cover-v1.webp`，由 PNG 用 sharp 编码为 WebP，保留生成原件。版本化文件名配合长期缓存；更换时增加版本号。

最终生成提示词：

> Use case: stylized-concept. Asset type: wide editorial cover illustration for CubeRoot, a real speedcubing tools platform presented to potential sponsors. Create a sophisticated tactile paper and clay 3D still life: one physically accurate standard 3x3 cube with exactly 3 by 3 square stickers on each visible face, resting on a low warm ivory architectural plinth; a few restrained translucent arcs and small abstract data tiles evoke learning, practice and global connection. Terracotta, sage green, ivory, cube primary colors, soft natural light, generous negative space, elegant magazine art direction, wide landscape 1536x1024 composition. No letters, numbers, logos, charts pretending to be real data, screens, people, or watermark. Clearly conceptual artwork, not documentary photography.
