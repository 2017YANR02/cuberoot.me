# 全站背景与玻璃 路由审核附录

扫描日期：2026-09-10。此附录来自当前工作区源码与本地数据，允许存在其他 AI 的未提交改动；后续实施或路由变更后须重新核对集合。

本文件保存静态全量枚举；实施已开始，真实浏览证据另见 site-glass-rollout.md 及三个审核记录。下方“候选”分类与尚未更新的逐页状态均不能视为视觉通过。

## 计数与 URL 规则

- 页面源码模板 335 个：语言树 330 个，非语言认证回调 5 个。
- 业务动态参数模板 62 个，未把语言参数计入；layout 318 个。
- iframe 页面 16 个，错误/加载等特殊呈现文件 4 个，非页面 route handler 9 个。
- Platform 注册表 103 项，canonical rewrite 22 项；身份分布 public 34，account 28，instructor 5，admin 36。
- 本地 stats/index.json 共 63 项：排除明确退役 ID 后 63 项，重复有效 ID 0 个。这是本地索引快照，不代表线上文件均存在。
- 语言树表格使用英语裸 URL 模板（如 /alg），中文对应 /zh/alg；主页分别为 / 与 /zh。/auth/* 不加语言前缀。
- [id]、[slug]、[...segments] 和 :id 均为模板占位，不能直接当验收 URL；需记录真实有效参数与必要身份。
- 404、加载失败、登录提示、权限不足只能作为相应异常态证据，不能代替该业务页正常态通过。
- Platform 和 WCA 展开表是页面模板的补充维度，不应直接与源码模板数量相加宣称独立页面总数。

## 审核方法与边界

- 每个页面记录实际 URL、有效参数、身份、桌面/窄屏、明暗/自动/无背景、菜单/全屏/滚动状态、截图路径、审核 Agent、结果和阻塞原因；截图放项目 .tmp/png/。
- 初始页、长页底部、固定工具栏、弹窗/Portal、下拉、拖动手柄分别检查；表格检查横滚与吸顶表头。
- 画布、视频、魔方贴纸、颜色样本、绘图导出和数据图表保留自身语义；统一外围 UI 材质不等于给每个像素加玻璃。
- iframe 外壳和内部文档分开记账；全局 CSS 不能穿透 iframe。/contests 是外部独立应用，其余本地工具仍需核对所有权；AGENTS.md 禁改的 upstream 内容只审核自己的包装层，内部另记未覆盖原因。
- 账户、组织、讲师、管理页必须用相应授权身份和实际数据验证；匿名页看见登录门不算正常内容通过。
- 主题规则以现行源码为准；根 globals.css 有部分暗锁页面，自动背景需匹配生效主题。技能文档中的旧路径或锁定描述不得直接作当前事实。
- 本轮已授权实施样式；附录继续保留待验收项，不提交。

## 页面分类计数

| 第一段路径 | 模板数 |
| --- | ---: |
| 2x2x2 | 1 |
| about | 2 |
| account | 3 |
| achievements | 1 |
| admin | 2 |
| alg | 47 |
| alg-trainers | 1 |
| algTrainer | 1 |
| appearance | 1 |
| auth | 5 |
| blddb | 1 |
| calc | 1 |
| calc-about | 1 |
| calendar | 2 |
| color-test | 3 |
| comp-sim | 1 |
| contact | 1 |
| contests | 1 |
| courses | 1 |
| cross_trainer | 1 |
| cstimer | 1 |
| dev | 62 |
| docs | 2 |
| documentation | 1 |
| drive | 1 |
| eocross_trainer | 1 |
| feedback | 2 |
| ffmpeg-poc | 1 |
| forum | 7 |
| frame-count | 1 |
| frame-count-about | 1 |
| friends | 1 |
| gallery | 1 |
| icon | 1 |
| jsonEditor | 1 |
| learn | 8 |
| math | 10 |
| meet | 1 |
| membership | 3 |
| memo | 3 |
| mosaic | 1 |
| mosaic-about | 1 |
| music | 2 |
| nemesizer | 1 |
| nemesizer-about | 1 |
| notation | 1 |
| notifications | 1 |
| org | 22 |
| paint | 1 |
| pairing_trainer | 1 |
| platform | 2 |
| predict | 1 |
| privacy | 1 |
| pseudo_pairing_trainer | 1 |
| pseudo_xcross_trainer | 1 |
| quiz | 4 |
| recognize | 2 |
| recon | 11 |
| recon-about | 1 |
| regulation | 18 |
| scramble | 14 |
| search | 1 |
| sheets | 2 |
| sim | 2 |
| site | 1 |
| solver | 1 |
| space | 1 |
| sq1 | 2 |
| stroop | 1 |
| support | 1 |
| teachers | 6 |
| timer | 2 |
| timezone | 1 |
| training | 1 |
| tutorial | 2 |
| tutorial-legacy | 3 |
| vault | 1 |
| wb | 1 |
| wca | 26 |
| why-cube | 1 |
| wiki | 1 |
| xcross_pairing_trainer | 1 |
| xcross_trainer | 1 |
| xxcross_trainer | 1 |
| 主页 | 1 |

## 全量页面源码模板

| 源码 | 英语路由模板 | 静态分类 | 浏览审核状态 |
| --- | --- | --- | --- |
| [core/packages/client/app/[lang]/2x2x2/page.tsx](<../core/packages/client/app/[lang]/2x2x2/page.tsx>) | `/2x2x2` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/about/page.tsx](<../core/packages/client/app/[lang]/about/page.tsx>) | `/about` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/about/ruimin/page.tsx](<../core/packages/client/app/[lang]/about/ruimin/page.tsx>) | `/about/ruimin` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/account/guardian-binding/page.tsx](<../core/packages/client/app/[lang]/account/guardian-binding/page.tsx>) | `/account/guardian-binding` | 账户/权限工作区（候选） | 待浏览 |
| [core/packages/client/app/[lang]/account/page.tsx](<../core/packages/client/app/[lang]/account/page.tsx>) | `/account` | 账户/权限工作区（候选） | 待浏览 |
| [core/packages/client/app/[lang]/account/student-binding/page.tsx](<../core/packages/client/app/[lang]/account/student-binding/page.tsx>) | `/account/student-binding` | 账户/权限工作区（候选） | 待浏览 |
| [core/packages/client/app/[lang]/achievements/page.tsx](<../core/packages/client/app/[lang]/achievements/page.tsx>) | `/achievements` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/admin/page.tsx](<../core/packages/client/app/[lang]/admin/page.tsx>) | `/admin` | 账户/权限工作区（候选） | 待浏览 |
| [core/packages/client/app/[lang]/admin/users/page.tsx](<../core/packages/client/app/[lang]/admin/users/page.tsx>) | `/admin/users` | 账户/权限工作区（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg-trainers/page.tsx](<../core/packages/client/app/[lang]/alg-trainers/page.tsx>) | `/alg-trainers` | 本地工具 iframe 壳（核对 upstream 边界） | 待浏览 |
| [core/packages/client/app/[lang]/alg/3bld/2c2c/page.tsx](<../core/packages/client/app/[lang]/alg/3bld/2c2c/page.tsx>) | `/alg/3bld/2c2c` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/3bld/2e2e/page.tsx](<../core/packages/client/app/[lang]/alg/3bld/2e2e/page.tsx>) | `/alg/3bld/2e2e` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/3bld/comm/page.tsx](<../core/packages/client/app/[lang]/alg/3bld/comm/page.tsx>) | `/alg/3bld/comm` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/3bld/corner-float/page.tsx](<../core/packages/client/app/[lang]/alg/3bld/corner-float/page.tsx>) | `/alg/3bld/corner-float` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/3bld/corner/page.tsx](<../core/packages/client/app/[lang]/alg/3bld/corner/page.tsx>) | `/alg/3bld/corner` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/3bld/edge-float/page.tsx](<../core/packages/client/app/[lang]/alg/3bld/edge-float/page.tsx>) | `/alg/3bld/edge-float` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/3bld/edge/page.tsx](<../core/packages/client/app/[lang]/alg/3bld/edge/page.tsx>) | `/alg/3bld/edge` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/3bld/flip/page.tsx](<../core/packages/client/app/[lang]/alg/3bld/flip/page.tsx>) | `/alg/3bld/flip` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/3bld/helper/page.tsx](<../core/packages/client/app/[lang]/alg/3bld/helper/page.tsx>) | `/alg/3bld/helper` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/3bld/lookup/page.tsx](<../core/packages/client/app/[lang]/alg/3bld/lookup/page.tsx>) | `/alg/3bld/lookup` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/3bld/ltct/page.tsx](<../core/packages/client/app/[lang]/alg/3bld/ltct/page.tsx>) | `/alg/3bld/ltct` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/3bld/memo/page.tsx](<../core/packages/client/app/[lang]/alg/3bld/memo/page.tsx>) | `/alg/3bld/memo` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/3bld/page.tsx](<../core/packages/client/app/[lang]/alg/3bld/page.tsx>) | `/alg/3bld` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/3bld/parity/page.tsx](<../core/packages/client/app/[lang]/alg/3bld/parity/page.tsx>) | `/alg/3bld/parity` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/3bld/readme/page.tsx](<../core/packages/client/app/[lang]/alg/3bld/readme/page.tsx>) | `/alg/3bld/readme` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/3bld/resources/page.tsx](<../core/packages/client/app/[lang]/alg/3bld/resources/page.tsx>) | `/alg/3bld/resources` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/3bld/sheets/page.tsx](<../core/packages/client/app/[lang]/alg/3bld/sheets/page.tsx>) | `/alg/3bld/sheets` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/3bld/tables/page.tsx](<../core/packages/client/app/[lang]/alg/3bld/tables/page.tsx>) | `/alg/3bld/tables` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/3bld/timer/page.tsx](<../core/packages/client/app/[lang]/alg/3bld/timer/page.tsx>) | `/alg/3bld/timer` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/3bld/twist/page.tsx](<../core/packages/client/app/[lang]/alg/3bld/twist/page.tsx>) | `/alg/3bld/twist` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/3x3/cross/page.tsx](<../core/packages/client/app/[lang]/alg/3x3/cross/page.tsx>) | `/alg/3x3/cross` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/[puzzle]/[set]/[subgroup]/page.tsx](<../core/packages/client/app/[lang]/alg/[puzzle]/[set]/[subgroup]/page.tsx>) | `/alg/[puzzle]/[set]/[subgroup]` | 公式/训练/求解工具（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/alg/[puzzle]/[set]/page.tsx](<../core/packages/client/app/[lang]/alg/[puzzle]/[set]/page.tsx>) | `/alg/[puzzle]/[set]` | 公式/训练/求解工具（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/alg/[puzzle]/[set]/run/page.tsx](<../core/packages/client/app/[lang]/alg/[puzzle]/[set]/run/page.tsx>) | `/alg/[puzzle]/[set]/run` | 公式/训练/求解工具（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/alg/[puzzle]/[set]/select/page.tsx](<../core/packages/client/app/[lang]/alg/[puzzle]/[set]/select/page.tsx>) | `/alg/[puzzle]/[set]/select` | 公式/训练/求解工具（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/alg/[puzzle]/[set]/simple/page.tsx](<../core/packages/client/app/[lang]/alg/[puzzle]/[set]/simple/page.tsx>) | `/alg/[puzzle]/[set]/simple` | 公式/训练/求解工具（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/alg/[puzzle]/page.tsx](<../core/packages/client/app/[lang]/alg/[puzzle]/page.tsx>) | `/alg/[puzzle]` | 公式/训练/求解工具（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/alg/commutator/page.tsx](<../core/packages/client/app/[lang]/alg/commutator/page.tsx>) | `/alg/commutator` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/fto/notation/page.tsx](<../core/packages/client/app/[lang]/alg/fto/notation/page.tsx>) | `/alg/fto/notation` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/lsll/[group]/page.tsx](<../core/packages/client/app/[lang]/alg/lsll/[group]/page.tsx>) | `/alg/lsll/[group]` | 公式/训练/求解工具（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/alg/lsll/case/page.tsx](<../core/packages/client/app/[lang]/alg/lsll/case/page.tsx>) | `/alg/lsll/case` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/lsll/page.tsx](<../core/packages/client/app/[lang]/alg/lsll/page.tsx>) | `/alg/lsll` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/lsll/route/page.tsx](<../core/packages/client/app/[lang]/alg/lsll/route/page.tsx>) | `/alg/lsll/route` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/progress/cases/page.tsx](<../core/packages/client/app/[lang]/alg/progress/cases/page.tsx>) | `/alg/progress/cases` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/progress/page.tsx](<../core/packages/client/app/[lang]/alg/progress/page.tsx>) | `/alg/progress` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/roux/page.tsx](<../core/packages/client/app/[lang]/alg/roux/page.tsx>) | `/alg/roux` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/skewb-trainer/page.tsx](<../core/packages/client/app/[lang]/alg/skewb-trainer/page.tsx>) | `/alg/skewb-trainer` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/sq1/algorithm-trainer/page.tsx](<../core/packages/client/app/[lang]/alg/sq1/algorithm-trainer/page.tsx>) | `/alg/sq1/algorithm-trainer` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/sq1/count/page.tsx](<../core/packages/client/app/[lang]/alg/sq1/count/page.tsx>) | `/alg/sq1/count` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/sq1/import/page.tsx](<../core/packages/client/app/[lang]/alg/sq1/import/page.tsx>) | `/alg/sq1/import` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/sq1/inspect/page.tsx](<../core/packages/client/app/[lang]/alg/sq1/inspect/page.tsx>) | `/alg/sq1/inspect` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/sq1/karnaukh-notation/page.tsx](<../core/packages/client/app/[lang]/alg/sq1/karnaukh-notation/page.tsx>) | `/alg/sq1/karnaukh-notation` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/sq1/parity-game/page.tsx](<../core/packages/client/app/[lang]/alg/sq1/parity-game/page.tsx>) | `/alg/sq1/parity-game` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/sq1/pbl-finder/page.tsx](<../core/packages/client/app/[lang]/alg/sq1/pbl-finder/page.tsx>) | `/alg/sq1/pbl-finder` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/sq1/train/page.tsx](<../core/packages/client/app/[lang]/alg/sq1/train/page.tsx>) | `/alg/sq1/train` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/sq1/visualize/page.tsx](<../core/packages/client/app/[lang]/alg/sq1/visualize/page.tsx>) | `/alg/sq1/visualize` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/alg/time-attack/page.tsx](<../core/packages/client/app/[lang]/alg/time-attack/page.tsx>) | `/alg/time-attack` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/algTrainer/page.tsx](<../core/packages/client/app/[lang]/algTrainer/page.tsx>) | `/algTrainer` | 本地工具 iframe 壳（核对 upstream 边界） | 待浏览 |
| [core/packages/client/app/[lang]/appearance/page.tsx](<../core/packages/client/app/[lang]/appearance/page.tsx>) | `/appearance` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/blddb/page.tsx](<../core/packages/client/app/[lang]/blddb/page.tsx>) | `/blddb` | 本地工具 iframe 壳（核对 upstream 边界） | 待浏览 |
| [core/packages/client/app/[lang]/calc-about/page.tsx](<../core/packages/client/app/[lang]/calc-about/page.tsx>) | `/calc-about` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/calc/page.tsx](<../core/packages/client/app/[lang]/calc/page.tsx>) | `/calc` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/calendar/page.tsx](<../core/packages/client/app/[lang]/calendar/page.tsx>) | `/calendar` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/calendar/s/[token]/page.tsx](<../core/packages/client/app/[lang]/calendar/s/[token]/page.tsx>) | `/calendar/s/[token]` | 其他产品页（待确认表面） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/color-test/page.tsx](<../core/packages/client/app/[lang]/color-test/page.tsx>) | `/color-test` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/color-test/positions/page.tsx](<../core/packages/client/app/[lang]/color-test/positions/page.tsx>) | `/color-test/positions` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/color-test/relations/page.tsx](<../core/packages/client/app/[lang]/color-test/relations/page.tsx>) | `/color-test/relations` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/comp-sim/page.tsx](<../core/packages/client/app/[lang]/comp-sim/page.tsx>) | `/comp-sim` | 画布/媒体/沉浸工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/contact/page.tsx](<../core/packages/client/app/[lang]/contact/page.tsx>) | `/contact` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/contests/page.tsx](<../core/packages/client/app/[lang]/contests/page.tsx>) | `/contests` | 外部 iframe 壳 | 待浏览 |
| [core/packages/client/app/[lang]/courses/page.tsx](<../core/packages/client/app/[lang]/courses/page.tsx>) | `/courses` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/cross_trainer/page.tsx](<../core/packages/client/app/[lang]/cross_trainer/page.tsx>) | `/cross_trainer` | 本地工具 iframe 壳（核对 upstream 边界） | 待浏览 |
| [core/packages/client/app/[lang]/cstimer/page.tsx](<../core/packages/client/app/[lang]/cstimer/page.tsx>) | `/cstimer` | 本地工具 iframe 壳（核对 upstream 边界） | 待浏览 |
| [core/packages/client/app/[lang]/dev/algorithms/cfop-std-solver/page.tsx](<../core/packages/client/app/[lang]/dev/algorithms/cfop-std-solver/page.tsx>) | `/dev/algorithms/cfop-std-solver` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/algorithms/gan-ble/page.tsx](<../core/packages/client/app/[lang]/dev/algorithms/gan-ble/page.tsx>) | `/dev/algorithms/gan-ble` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/algorithms/ida-star/page.tsx](<../core/packages/client/app/[lang]/dev/algorithms/ida-star/page.tsx>) | `/dev/algorithms/ida-star` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/algorithms/kociemba/page.tsx](<../core/packages/client/app/[lang]/dev/algorithms/kociemba/page.tsx>) | `/dev/algorithms/kociemba` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/algorithms/min2phase/page.tsx](<../core/packages/client/app/[lang]/dev/algorithms/min2phase/page.tsx>) | `/dev/algorithms/min2phase` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/algorithms/page.tsx](<../core/packages/client/app/[lang]/dev/algorithms/page.tsx>) | `/dev/algorithms` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/algorithms/webcodecs/page.tsx](<../core/packages/client/app/[lang]/dev/algorithms/webcodecs/page.tsx>) | `/dev/algorithms/webcodecs` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/api/page.tsx](<../core/packages/client/app/[lang]/dev/api/page.tsx>) | `/dev/api` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/architecture/decisions/page.tsx](<../core/packages/client/app/[lang]/dev/architecture/decisions/page.tsx>) | `/dev/architecture/decisions` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/architecture/flow/page.tsx](<../core/packages/client/app/[lang]/dev/architecture/flow/page.tsx>) | `/dev/architecture/flow` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/architecture/history/page.tsx](<../core/packages/client/app/[lang]/dev/architecture/history/page.tsx>) | `/dev/architecture/history` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/architecture/page.tsx](<../core/packages/client/app/[lang]/dev/architecture/page.tsx>) | `/dev/architecture` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/components/page.tsx](<../core/packages/client/app/[lang]/dev/components/page.tsx>) | `/dev/components` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/cubingchina/page.tsx](<../core/packages/client/app/[lang]/dev/cubingchina/page.tsx>) | `/dev/cubingchina` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/dead-code/page.tsx](<../core/packages/client/app/[lang]/dev/dead-code/page.tsx>) | `/dev/dead-code` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/fonts/page.tsx](<../core/packages/client/app/[lang]/dev/fonts/page.tsx>) | `/dev/fonts` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/guards/page.tsx](<../core/packages/client/app/[lang]/dev/guards/page.tsx>) | `/dev/guards` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/infrastructure/page.tsx](<../core/packages/client/app/[lang]/dev/infrastructure/page.tsx>) | `/dev/infrastructure` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/bash/page.tsx](<../core/packages/client/app/[lang]/dev/language/bash/page.tsx>) | `/dev/language/bash` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/c/page.tsx](<../core/packages/client/app/[lang]/dev/language/c/page.tsx>) | `/dev/language/c` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/compare/page.tsx](<../core/packages/client/app/[lang]/dev/language/compare/page.tsx>) | `/dev/language/compare` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/cpp/page.tsx](<../core/packages/client/app/[lang]/dev/language/cpp/page.tsx>) | `/dev/language/cpp` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/csharp/page.tsx](<../core/packages/client/app/[lang]/dev/language/csharp/page.tsx>) | `/dev/language/csharp` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/css/page.tsx](<../core/packages/client/app/[lang]/dev/language/css/page.tsx>) | `/dev/language/css` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/go/page.tsx](<../core/packages/client/app/[lang]/dev/language/go/page.tsx>) | `/dev/language/go` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/haskell/page.tsx](<../core/packages/client/app/[lang]/dev/language/haskell/page.tsx>) | `/dev/language/haskell` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/html/page.tsx](<../core/packages/client/app/[lang]/dev/language/html/page.tsx>) | `/dev/language/html` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/java/page.tsx](<../core/packages/client/app/[lang]/dev/language/java/page.tsx>) | `/dev/language/java` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/javascript/page.tsx](<../core/packages/client/app/[lang]/dev/language/javascript/page.tsx>) | `/dev/language/javascript` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/katex/page.tsx](<../core/packages/client/app/[lang]/dev/language/katex/page.tsx>) | `/dev/language/katex` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/kotlin/page.tsx](<../core/packages/client/app/[lang]/dev/language/kotlin/page.tsx>) | `/dev/language/kotlin` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/latex/page.tsx](<../core/packages/client/app/[lang]/dev/language/latex/page.tsx>) | `/dev/language/latex` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/lua/page.tsx](<../core/packages/client/app/[lang]/dev/language/lua/page.tsx>) | `/dev/language/lua` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/mojo/page.tsx](<../core/packages/client/app/[lang]/dev/language/mojo/page.tsx>) | `/dev/language/mojo` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/page.tsx](<../core/packages/client/app/[lang]/dev/language/page.tsx>) | `/dev/language` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/php/page.tsx](<../core/packages/client/app/[lang]/dev/language/php/page.tsx>) | `/dev/language/php` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/powershell/page.tsx](<../core/packages/client/app/[lang]/dev/language/powershell/page.tsx>) | `/dev/language/powershell` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/python/page.tsx](<../core/packages/client/app/[lang]/dev/language/python/page.tsx>) | `/dev/language/python` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/ruby/page.tsx](<../core/packages/client/app/[lang]/dev/language/ruby/page.tsx>) | `/dev/language/ruby` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/rust/page.tsx](<../core/packages/client/app/[lang]/dev/language/rust/page.tsx>) | `/dev/language/rust` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/scramble/page.tsx](<../core/packages/client/app/[lang]/dev/language/scramble/page.tsx>) | `/dev/language/scramble` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/sql/page.tsx](<../core/packages/client/app/[lang]/dev/language/sql/page.tsx>) | `/dev/language/sql` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/swift/page.tsx](<../core/packages/client/app/[lang]/dev/language/swift/page.tsx>) | `/dev/language/swift` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/ts/page.tsx](<../core/packages/client/app/[lang]/dev/language/ts/page.tsx>) | `/dev/language/ts` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/wasm/page.tsx](<../core/packages/client/app/[lang]/dev/language/wasm/page.tsx>) | `/dev/language/wasm` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/language/zig/page.tsx](<../core/packages/client/app/[lang]/dev/language/zig/page.tsx>) | `/dev/language/zig` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/llm/[slug]/page.tsx](<../core/packages/client/app/[lang]/dev/llm/[slug]/page.tsx>) | `/dev/llm/[slug]` | 文档/内容/演示（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/dev/llm/fable/page.tsx](<../core/packages/client/app/[lang]/dev/llm/fable/page.tsx>) | `/dev/llm/fable` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/llm/page.tsx](<../core/packages/client/app/[lang]/dev/llm/page.tsx>) | `/dev/llm` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/llm/sonnet-5/page.tsx](<../core/packages/client/app/[lang]/dev/llm/sonnet-5/page.tsx>) | `/dev/llm/sonnet-5` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/ops/page.tsx](<../core/packages/client/app/[lang]/dev/ops/page.tsx>) | `/dev/ops` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/page.tsx](<../core/packages/client/app/[lang]/dev/page.tsx>) | `/dev` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/schema/page.tsx](<../core/packages/client/app/[lang]/dev/schema/page.tsx>) | `/dev/schema` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/solvers/page.tsx](<../core/packages/client/app/[lang]/dev/solvers/page.tsx>) | `/dev/solvers` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/stack/[slug]/page.tsx](<../core/packages/client/app/[lang]/dev/stack/[slug]/page.tsx>) | `/dev/stack/[slug]` | 文档/内容/演示（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/dev/stack/page.tsx](<../core/packages/client/app/[lang]/dev/stack/page.tsx>) | `/dev/stack` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/tokens/page.tsx](<../core/packages/client/app/[lang]/dev/tokens/page.tsx>) | `/dev/tokens` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/utils/page.tsx](<../core/packages/client/app/[lang]/dev/utils/page.tsx>) | `/dev/utils` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/wca-export/page.tsx](<../core/packages/client/app/[lang]/dev/wca-export/page.tsx>) | `/dev/wca-export` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/wca-rest-api/page.tsx](<../core/packages/client/app/[lang]/dev/wca-rest-api/page.tsx>) | `/dev/wca-rest-api` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/wca-site/page.tsx](<../core/packages/client/app/[lang]/dev/wca-site/page.tsx>) | `/dev/wca-site` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/dev/wcif/page.tsx](<../core/packages/client/app/[lang]/dev/wcif/page.tsx>) | `/dev/wcif` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/docs/edit/page.tsx](<../core/packages/client/app/[lang]/docs/edit/page.tsx>) | `/docs/edit` | 文档/表格/文件工作区（候选） | 待浏览 |
| [core/packages/client/app/[lang]/docs/page.tsx](<../core/packages/client/app/[lang]/docs/page.tsx>) | `/docs` | 文档/表格/文件工作区（候选） | 待浏览 |
| [core/packages/client/app/[lang]/documentation/page.tsx](<../core/packages/client/app/[lang]/documentation/page.tsx>) | `/documentation` | 本地工具 iframe 壳（核对 upstream 边界） | 待浏览 |
| [core/packages/client/app/[lang]/drive/page.tsx](<../core/packages/client/app/[lang]/drive/page.tsx>) | `/drive` | 文档/表格/文件工作区（候选） | 待浏览 |
| [core/packages/client/app/[lang]/eocross_trainer/page.tsx](<../core/packages/client/app/[lang]/eocross_trainer/page.tsx>) | `/eocross_trainer` | 本地工具 iframe 壳（核对 upstream 边界） | 待浏览 |
| [core/packages/client/app/[lang]/feedback/admin/page.tsx](<../core/packages/client/app/[lang]/feedback/admin/page.tsx>) | `/feedback/admin` | 社区/消息（候选） | 待浏览 |
| [core/packages/client/app/[lang]/feedback/page.tsx](<../core/packages/client/app/[lang]/feedback/page.tsx>) | `/feedback` | 社区/消息（候选） | 待浏览 |
| [core/packages/client/app/[lang]/ffmpeg-poc/page.tsx](<../core/packages/client/app/[lang]/ffmpeg-poc/page.tsx>) | `/ffmpeg-poc` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/forum/f/[slug]/page.tsx](<../core/packages/client/app/[lang]/forum/f/[slug]/page.tsx>) | `/forum/f/[slug]` | 社区/消息（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/forum/feed/page.tsx](<../core/packages/client/app/[lang]/forum/feed/page.tsx>) | `/forum/feed` | 社区/消息（候选） | 待浏览 |
| [core/packages/client/app/[lang]/forum/new/page.tsx](<../core/packages/client/app/[lang]/forum/new/page.tsx>) | `/forum/new` | 社区/消息（候选） | 待浏览 |
| [core/packages/client/app/[lang]/forum/page.tsx](<../core/packages/client/app/[lang]/forum/page.tsx>) | `/forum` | 社区/消息（候选） | 待浏览 |
| [core/packages/client/app/[lang]/forum/review/page.tsx](<../core/packages/client/app/[lang]/forum/review/page.tsx>) | `/forum/review` | 社区/消息（候选） | 待浏览 |
| [core/packages/client/app/[lang]/forum/search/page.tsx](<../core/packages/client/app/[lang]/forum/search/page.tsx>) | `/forum/search` | 社区/消息（候选） | 待浏览 |
| [core/packages/client/app/[lang]/forum/t/[id]/page.tsx](<../core/packages/client/app/[lang]/forum/t/[id]/page.tsx>) | `/forum/t/[id]` | 社区/消息（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/frame-count-about/page.tsx](<../core/packages/client/app/[lang]/frame-count-about/page.tsx>) | `/frame-count-about` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/frame-count/page.tsx](<../core/packages/client/app/[lang]/frame-count/page.tsx>) | `/frame-count` | 画布/媒体/沉浸工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/friends/page.tsx](<../core/packages/client/app/[lang]/friends/page.tsx>) | `/friends` | 社区/消息（候选） | 待浏览 |
| [core/packages/client/app/[lang]/gallery/page.tsx](<../core/packages/client/app/[lang]/gallery/page.tsx>) | `/gallery` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/icon/page.tsx](<../core/packages/client/app/[lang]/icon/page.tsx>) | `/icon` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/jsonEditor/page.tsx](<../core/packages/client/app/[lang]/jsonEditor/page.tsx>) | `/jsonEditor` | 本地工具 iframe 壳（核对 upstream 边界） | 待浏览 |
| [core/packages/client/app/[lang]/learn/[orgSlug]/students/[studentId]/feedback/page.tsx](<../core/packages/client/app/[lang]/learn/[orgSlug]/students/[studentId]/feedback/page.tsx>) | `/learn/[orgSlug]/students/[studentId]/feedback` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/learn/[orgSlug]/students/[studentId]/messages/[conversationId]/page.tsx](<../core/packages/client/app/[lang]/learn/[orgSlug]/students/[studentId]/messages/[conversationId]/page.tsx>) | `/learn/[orgSlug]/students/[studentId]/messages/[conversationId]` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/learn/[orgSlug]/students/[studentId]/messages/page.tsx](<../core/packages/client/app/[lang]/learn/[orgSlug]/students/[studentId]/messages/page.tsx>) | `/learn/[orgSlug]/students/[studentId]/messages` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/learn/[orgSlug]/students/[studentId]/page.tsx](<../core/packages/client/app/[lang]/learn/[orgSlug]/students/[studentId]/page.tsx>) | `/learn/[orgSlug]/students/[studentId]` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/learn/[orgSlug]/students/[studentId]/reports/[reportId]/page.tsx](<../core/packages/client/app/[lang]/learn/[orgSlug]/students/[studentId]/reports/[reportId]/page.tsx>) | `/learn/[orgSlug]/students/[studentId]/reports/[reportId]` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/learn/[orgSlug]/students/[studentId]/reports/page.tsx](<../core/packages/client/app/[lang]/learn/[orgSlug]/students/[studentId]/reports/page.tsx>) | `/learn/[orgSlug]/students/[studentId]/reports` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/learn/[orgSlug]/students/[studentId]/sessions/page.tsx](<../core/packages/client/app/[lang]/learn/[orgSlug]/students/[studentId]/sessions/page.tsx>) | `/learn/[orgSlug]/students/[studentId]/sessions` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/learn/page.tsx](<../core/packages/client/app/[lang]/learn/page.tsx>) | `/learn` | 账户/权限工作区（候选） | 待浏览 |
| [core/packages/client/app/[lang]/math/demigod/page.tsx](<../core/packages/client/app/[lang]/math/demigod/page.tsx>) | `/math/demigod` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/math/god/page.tsx](<../core/packages/client/app/[lang]/math/god/page.tsx>) | `/math/god` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/math/group/[slug]/page.tsx](<../core/packages/client/app/[lang]/math/group/[slug]/page.tsx>) | `/math/group/[slug]` | 文档/内容/演示（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/math/group/page.tsx](<../core/packages/client/app/[lang]/math/group/page.tsx>) | `/math/group` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/math/kernel/page.tsx](<../core/packages/client/app/[lang]/math/kernel/page.tsx>) | `/math/kernel` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/math/lsll/page.tsx](<../core/packages/client/app/[lang]/math/lsll/page.tsx>) | `/math/lsll` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/math/navier-stokes/page.tsx](<../core/packages/client/app/[lang]/math/navier-stokes/page.tsx>) | `/math/navier-stokes` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/math/page.tsx](<../core/packages/client/app/[lang]/math/page.tsx>) | `/math` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/math/probability/page.tsx](<../core/packages/client/app/[lang]/math/probability/page.tsx>) | `/math/probability` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/math/unit-distance/page.tsx](<../core/packages/client/app/[lang]/math/unit-distance/page.tsx>) | `/math/unit-distance` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/meet/page.tsx](<../core/packages/client/app/[lang]/meet/page.tsx>) | `/meet` | 画布/媒体/沉浸工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/membership/page.tsx](<../core/packages/client/app/[lang]/membership/page.tsx>) | `/membership` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/membership/renewal-terms/page.tsx](<../core/packages/client/app/[lang]/membership/renewal-terms/page.tsx>) | `/membership/renewal-terms` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/membership/subscription/page.tsx](<../core/packages/client/app/[lang]/membership/subscription/page.tsx>) | `/membership/subscription` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/memo/colpi/[pair]/page.tsx](<../core/packages/client/app/[lang]/memo/colpi/[pair]/page.tsx>) | `/memo/colpi/[pair]` | 公式/训练/求解工具（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/memo/colpi/page.tsx](<../core/packages/client/app/[lang]/memo/colpi/page.tsx>) | `/memo/colpi` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/memo/page.tsx](<../core/packages/client/app/[lang]/memo/page.tsx>) | `/memo` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/mosaic-about/page.tsx](<../core/packages/client/app/[lang]/mosaic-about/page.tsx>) | `/mosaic-about` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/mosaic/page.tsx](<../core/packages/client/app/[lang]/mosaic/page.tsx>) | `/mosaic` | 画布/媒体/沉浸工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/music/manage/page.tsx](<../core/packages/client/app/[lang]/music/manage/page.tsx>) | `/music/manage` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/music/page.tsx](<../core/packages/client/app/[lang]/music/page.tsx>) | `/music` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/nemesizer-about/page.tsx](<../core/packages/client/app/[lang]/nemesizer-about/page.tsx>) | `/nemesizer-about` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/nemesizer/page.tsx](<../core/packages/client/app/[lang]/nemesizer/page.tsx>) | `/nemesizer` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/notation/page.tsx](<../core/packages/client/app/[lang]/notation/page.tsx>) | `/notation` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/notifications/page.tsx](<../core/packages/client/app/[lang]/notifications/page.tsx>) | `/notifications` | 社区/消息（候选） | 待浏览 |
| [core/packages/client/app/[lang]/org/[orgSlug]/audit/page.tsx](<../core/packages/client/app/[lang]/org/[orgSlug]/audit/page.tsx>) | `/org/[orgSlug]/audit` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/org/[orgSlug]/campuses/page.tsx](<../core/packages/client/app/[lang]/org/[orgSlug]/campuses/page.tsx>) | `/org/[orgSlug]/campuses` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/org/[orgSlug]/classes/[groupId]/page.tsx](<../core/packages/client/app/[lang]/org/[orgSlug]/classes/[groupId]/page.tsx>) | `/org/[orgSlug]/classes/[groupId]` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/org/[orgSlug]/classes/page.tsx](<../core/packages/client/app/[lang]/org/[orgSlug]/classes/page.tsx>) | `/org/[orgSlug]/classes` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/org/[orgSlug]/members/page.tsx](<../core/packages/client/app/[lang]/org/[orgSlug]/members/page.tsx>) | `/org/[orgSlug]/members` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/org/[orgSlug]/operations/page.tsx](<../core/packages/client/app/[lang]/org/[orgSlug]/operations/page.tsx>) | `/org/[orgSlug]/operations` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/org/[orgSlug]/packages/page.tsx](<../core/packages/client/app/[lang]/org/[orgSlug]/packages/page.tsx>) | `/org/[orgSlug]/packages` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/org/[orgSlug]/page.tsx](<../core/packages/client/app/[lang]/org/[orgSlug]/page.tsx>) | `/org/[orgSlug]` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/org/[orgSlug]/reports/[reportId]/page.tsx](<../core/packages/client/app/[lang]/org/[orgSlug]/reports/[reportId]/page.tsx>) | `/org/[orgSlug]/reports/[reportId]` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/org/[orgSlug]/reports/page.tsx](<../core/packages/client/app/[lang]/org/[orgSlug]/reports/page.tsx>) | `/org/[orgSlug]/reports` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/org/[orgSlug]/sessions/[sessionId]/page.tsx](<../core/packages/client/app/[lang]/org/[orgSlug]/sessions/[sessionId]/page.tsx>) | `/org/[orgSlug]/sessions/[sessionId]` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/org/[orgSlug]/sessions/page.tsx](<../core/packages/client/app/[lang]/org/[orgSlug]/sessions/page.tsx>) | `/org/[orgSlug]/sessions` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/org/[orgSlug]/students/[studentId]/messages/[conversationId]/page.tsx](<../core/packages/client/app/[lang]/org/[orgSlug]/students/[studentId]/messages/[conversationId]/page.tsx>) | `/org/[orgSlug]/students/[studentId]/messages/[conversationId]` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/org/[orgSlug]/students/[studentId]/messages/page.tsx](<../core/packages/client/app/[lang]/org/[orgSlug]/students/[studentId]/messages/page.tsx>) | `/org/[orgSlug]/students/[studentId]/messages` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/org/[orgSlug]/students/[studentId]/packages/page.tsx](<../core/packages/client/app/[lang]/org/[orgSlug]/students/[studentId]/packages/page.tsx>) | `/org/[orgSlug]/students/[studentId]/packages` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/org/[orgSlug]/students/[studentId]/page.tsx](<../core/packages/client/app/[lang]/org/[orgSlug]/students/[studentId]/page.tsx>) | `/org/[orgSlug]/students/[studentId]` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/org/[orgSlug]/students/page.tsx](<../core/packages/client/app/[lang]/org/[orgSlug]/students/page.tsx>) | `/org/[orgSlug]/students` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/org/[orgSlug]/training/assignments/[assignmentId]/page.tsx](<../core/packages/client/app/[lang]/org/[orgSlug]/training/assignments/[assignmentId]/page.tsx>) | `/org/[orgSlug]/training/assignments/[assignmentId]` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/org/[orgSlug]/training/assignments/[assignmentId]/students/[studentId]/page.tsx](<../core/packages/client/app/[lang]/org/[orgSlug]/training/assignments/[assignmentId]/students/[studentId]/page.tsx>) | `/org/[orgSlug]/training/assignments/[assignmentId]/students/[studentId]` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/org/[orgSlug]/training/page.tsx](<../core/packages/client/app/[lang]/org/[orgSlug]/training/page.tsx>) | `/org/[orgSlug]/training` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/org/[orgSlug]/training/templates/[templateId]/page.tsx](<../core/packages/client/app/[lang]/org/[orgSlug]/training/templates/[templateId]/page.tsx>) | `/org/[orgSlug]/training/templates/[templateId]` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/org/page.tsx](<../core/packages/client/app/[lang]/org/page.tsx>) | `/org` | 账户/权限工作区（候选） | 待浏览 |
| [core/packages/client/app/[lang]/page.tsx](<../core/packages/client/app/[lang]/page.tsx>) | `/` | 主页 | 待浏览 |
| [core/packages/client/app/[lang]/paint/page.tsx](<../core/packages/client/app/[lang]/paint/page.tsx>) | `/paint` | 画布/媒体/沉浸工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/pairing_trainer/page.tsx](<../core/packages/client/app/[lang]/pairing_trainer/page.tsx>) | `/pairing_trainer` | 本地工具 iframe 壳（核对 upstream 边界） | 待浏览 |
| [core/packages/client/app/[lang]/platform/[...segments]/page.tsx](<../core/packages/client/app/[lang]/platform/[...segments]/page.tsx>) | `/platform/[...segments]` | Platform 注册表入口 | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/platform/page.tsx](<../core/packages/client/app/[lang]/platform/page.tsx>) | `/platform` | Platform 注册表入口 | 待浏览 |
| [core/packages/client/app/[lang]/predict/page.tsx](<../core/packages/client/app/[lang]/predict/page.tsx>) | `/predict` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/privacy/page.tsx](<../core/packages/client/app/[lang]/privacy/page.tsx>) | `/privacy` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/pseudo_pairing_trainer/page.tsx](<../core/packages/client/app/[lang]/pseudo_pairing_trainer/page.tsx>) | `/pseudo_pairing_trainer` | 本地工具 iframe 壳（核对 upstream 边界） | 待浏览 |
| [core/packages/client/app/[lang]/pseudo_xcross_trainer/page.tsx](<../core/packages/client/app/[lang]/pseudo_xcross_trainer/page.tsx>) | `/pseudo_xcross_trainer` | 本地工具 iframe 壳（核对 upstream 边界） | 待浏览 |
| [core/packages/client/app/[lang]/quiz/manage/page.tsx](<../core/packages/client/app/[lang]/quiz/manage/page.tsx>) | `/quiz/manage` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/quiz/mine/page.tsx](<../core/packages/client/app/[lang]/quiz/mine/page.tsx>) | `/quiz/mine` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/quiz/new/page.tsx](<../core/packages/client/app/[lang]/quiz/new/page.tsx>) | `/quiz/new` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/quiz/page.tsx](<../core/packages/client/app/[lang]/quiz/page.tsx>) | `/quiz` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/recognize/[algSetId]/guide/page.tsx](<../core/packages/client/app/[lang]/recognize/[algSetId]/guide/page.tsx>) | `/recognize/[algSetId]/guide` | 公式/训练/求解工具（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/recognize/[algSetId]/page.tsx](<../core/packages/client/app/[lang]/recognize/[algSetId]/page.tsx>) | `/recognize/[algSetId]` | 公式/训练/求解工具（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/recon-about/page.tsx](<../core/packages/client/app/[lang]/recon-about/page.tsx>) | `/recon-about` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/recon/[id]/alt/[altIdx]/edit/page.tsx](<../core/packages/client/app/[lang]/recon/[id]/alt/[altIdx]/edit/page.tsx>) | `/recon/[id]/alt/[altIdx]/edit` | 其他产品页（待确认表面） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/recon/[id]/alt/[altIdx]/page.tsx](<../core/packages/client/app/[lang]/recon/[id]/alt/[altIdx]/page.tsx>) | `/recon/[id]/alt/[altIdx]` | 其他产品页（待确认表面） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/recon/[id]/alt/new/page.tsx](<../core/packages/client/app/[lang]/recon/[id]/alt/new/page.tsx>) | `/recon/[id]/alt/new` | 其他产品页（待确认表面） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/recon/[id]/alt/page.tsx](<../core/packages/client/app/[lang]/recon/[id]/alt/page.tsx>) | `/recon/[id]/alt` | 其他产品页（待确认表面） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/recon/[id]/page.tsx](<../core/packages/client/app/[lang]/recon/[id]/page.tsx>) | `/recon/[id]` | 其他产品页（待确认表面） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/recon/ground-truth/page.tsx](<../core/packages/client/app/[lang]/recon/ground-truth/page.tsx>) | `/recon/ground-truth` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/recon/page.tsx](<../core/packages/client/app/[lang]/recon/page.tsx>) | `/recon` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/recon/person/[wcaId]/page.tsx](<../core/packages/client/app/[lang]/recon/person/[wcaId]/page.tsx>) | `/recon/person/[wcaId]` | 其他产品页（待确认表面） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/recon/submit-sketch/page.tsx](<../core/packages/client/app/[lang]/recon/submit-sketch/page.tsx>) | `/recon/submit-sketch` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/recon/submit/[editId]/page.tsx](<../core/packages/client/app/[lang]/recon/submit/[editId]/page.tsx>) | `/recon/submit/[editId]` | 其他产品页（待确认表面） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/recon/submit/page.tsx](<../core/packages/client/app/[lang]/recon/submit/page.tsx>) | `/recon/submit` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/regulation/blindfolded/page.tsx](<../core/packages/client/app/[lang]/regulation/blindfolded/page.tsx>) | `/regulation/blindfolded` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/regulation/competitors/page.tsx](<../core/packages/client/app/[lang]/regulation/competitors/page.tsx>) | `/regulation/competitors` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/regulation/defects/page.tsx](<../core/packages/client/app/[lang]/regulation/defects/page.tsx>) | `/regulation/defects` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/regulation/environment/page.tsx](<../core/packages/client/app/[lang]/regulation/environment/page.tsx>) | `/regulation/environment` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/regulation/events/page.tsx](<../core/packages/client/app/[lang]/regulation/events/page.tsx>) | `/regulation/events` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/regulation/fewest-moves/page.tsx](<../core/packages/client/app/[lang]/regulation/fewest-moves/page.tsx>) | `/regulation/fewest-moves` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/regulation/full/page.tsx](<../core/packages/client/app/[lang]/regulation/full/page.tsx>) | `/regulation/full` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/regulation/head-to-head/page.tsx](<../core/packages/client/app/[lang]/regulation/head-to-head/page.tsx>) | `/regulation/head-to-head` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/regulation/incidents/page.tsx](<../core/packages/client/app/[lang]/regulation/incidents/page.tsx>) | `/regulation/incidents` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/regulation/multi-blind/page.tsx](<../core/packages/client/app/[lang]/regulation/multi-blind/page.tsx>) | `/regulation/multi-blind` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/regulation/news/page.tsx](<../core/packages/client/app/[lang]/regulation/news/page.tsx>) | `/regulation/news` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/regulation/officials/page.tsx](<../core/packages/client/app/[lang]/regulation/officials/page.tsx>) | `/regulation/officials` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/regulation/one-handed/page.tsx](<../core/packages/client/app/[lang]/regulation/one-handed/page.tsx>) | `/regulation/one-handed` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/regulation/page.tsx](<../core/packages/client/app/[lang]/regulation/page.tsx>) | `/regulation` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/regulation/puzzles/page.tsx](<../core/packages/client/app/[lang]/regulation/puzzles/page.tsx>) | `/regulation/puzzles` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/regulation/scrambling/page.tsx](<../core/packages/client/app/[lang]/regulation/scrambling/page.tsx>) | `/regulation/scrambling` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/regulation/solved-state/page.tsx](<../core/packages/client/app/[lang]/regulation/solved-state/page.tsx>) | `/regulation/solved-state` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/regulation/speed-solving/page.tsx](<../core/packages/client/app/[lang]/regulation/speed-solving/page.tsx>) | `/regulation/speed-solving` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/scramble/555-about/page.tsx](<../core/packages/client/app/[lang]/scramble/555-about/page.tsx>) | `/scramble/555-about` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/scramble/analyzer/page.tsx](<../core/packages/client/app/[lang]/scramble/analyzer/page.tsx>) | `/scramble/analyzer` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/scramble/batch-solver/page.tsx](<../core/packages/client/app/[lang]/scramble/batch-solver/page.tsx>) | `/scramble/batch-solver` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/scramble/gen-about/page.tsx](<../core/packages/client/app/[lang]/scramble/gen-about/page.tsx>) | `/scramble/gen-about` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/scramble/gen/page.tsx](<../core/packages/client/app/[lang]/scramble/gen/page.tsx>) | `/scramble/gen` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/scramble/hardest/page.tsx](<../core/packages/client/app/[lang]/scramble/hardest/page.tsx>) | `/scramble/hardest` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/scramble/mcc/page.tsx](<../core/packages/client/app/[lang]/scramble/mcc/page.tsx>) | `/scramble/mcc` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/scramble/page.tsx](<../core/packages/client/app/[lang]/scramble/page.tsx>) | `/scramble` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/scramble/pattern/page.tsx](<../core/packages/client/app/[lang]/scramble/pattern/page.tsx>) | `/scramble/pattern` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/scramble/pattern/search/page.tsx](<../core/packages/client/app/[lang]/scramble/pattern/search/page.tsx>) | `/scramble/pattern/search` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/scramble/solver/page.tsx](<../core/packages/client/app/[lang]/scramble/solver/page.tsx>) | `/scramble/solver` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/scramble/stats/page.tsx](<../core/packages/client/app/[lang]/scramble/stats/page.tsx>) | `/scramble/stats` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/scramble/sub-solver/page.tsx](<../core/packages/client/app/[lang]/scramble/sub-solver/page.tsx>) | `/scramble/sub-solver` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/scramble/symmetry/page.tsx](<../core/packages/client/app/[lang]/scramble/symmetry/page.tsx>) | `/scramble/symmetry` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/search/page.tsx](<../core/packages/client/app/[lang]/search/page.tsx>) | `/search` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/sheets/edit/page.tsx](<../core/packages/client/app/[lang]/sheets/edit/page.tsx>) | `/sheets/edit` | 文档/表格/文件工作区（候选） | 待浏览 |
| [core/packages/client/app/[lang]/sheets/page.tsx](<../core/packages/client/app/[lang]/sheets/page.tsx>) | `/sheets` | 文档/表格/文件工作区（候选） | 待浏览 |
| [core/packages/client/app/[lang]/sim/page.tsx](<../core/packages/client/app/[lang]/sim/page.tsx>) | `/sim` | 画布/媒体/沉浸工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/sim/stages/page.tsx](<../core/packages/client/app/[lang]/sim/stages/page.tsx>) | `/sim/stages` | 画布/媒体/沉浸工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/site/page.tsx](<../core/packages/client/app/[lang]/site/page.tsx>) | `/site` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/solver/page.tsx](<../core/packages/client/app/[lang]/solver/page.tsx>) | `/solver` | 本地工具 iframe 壳（核对 upstream 边界） | 待浏览 |
| [core/packages/client/app/[lang]/space/page.tsx](<../core/packages/client/app/[lang]/space/page.tsx>) | `/space` | 画布/媒体/沉浸工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/sq1/cs/name/page.tsx](<../core/packages/client/app/[lang]/sq1/cs/name/page.tsx>) | `/sq1/cs/name` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/sq1/cs/name/train/page.tsx](<../core/packages/client/app/[lang]/sq1/cs/name/train/page.tsx>) | `/sq1/cs/name/train` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/stroop/page.tsx](<../core/packages/client/app/[lang]/stroop/page.tsx>) | `/stroop` | 公式/训练/求解工具（候选） | 待浏览 |
| [core/packages/client/app/[lang]/support/page.tsx](<../core/packages/client/app/[lang]/support/page.tsx>) | `/support` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/teachers/edit/page.tsx](<../core/packages/client/app/[lang]/teachers/edit/page.tsx>) | `/teachers/edit` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/teachers/page.tsx](<../core/packages/client/app/[lang]/teachers/page.tsx>) | `/teachers` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/teachers/scripts/[scriptId]/page.tsx](<../core/packages/client/app/[lang]/teachers/scripts/[scriptId]/page.tsx>) | `/teachers/scripts/[scriptId]` | 其他产品页（待确认表面） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/teachers/scripts/edit/page.tsx](<../core/packages/client/app/[lang]/teachers/scripts/edit/page.tsx>) | `/teachers/scripts/edit` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/teachers/scripts/manage/page.tsx](<../core/packages/client/app/[lang]/teachers/scripts/manage/page.tsx>) | `/teachers/scripts/manage` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/teachers/scripts/page.tsx](<../core/packages/client/app/[lang]/teachers/scripts/page.tsx>) | `/teachers/scripts` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/timer/marks/page.tsx](<../core/packages/client/app/[lang]/timer/marks/page.tsx>) | `/timer/marks` | 计时器与多面板 | 待浏览 |
| [core/packages/client/app/[lang]/timer/page.tsx](<../core/packages/client/app/[lang]/timer/page.tsx>) | `/timer` | 计时器与多面板 | 待浏览 |
| [core/packages/client/app/[lang]/timezone/page.tsx](<../core/packages/client/app/[lang]/timezone/page.tsx>) | `/timezone` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/training/[orgSlug]/page.tsx](<../core/packages/client/app/[lang]/training/[orgSlug]/page.tsx>) | `/training/[orgSlug]` | 账户/权限工作区（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/tutorial-legacy/[slug]/page.tsx](<../core/packages/client/app/[lang]/tutorial-legacy/[slug]/page.tsx>) | `/tutorial-legacy/[slug]` | 文档/内容/演示（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/tutorial-legacy/c/[cat]/page.tsx](<../core/packages/client/app/[lang]/tutorial-legacy/c/[cat]/page.tsx>) | `/tutorial-legacy/c/[cat]` | 文档/内容/演示（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/tutorial-legacy/page.tsx](<../core/packages/client/app/[lang]/tutorial-legacy/page.tsx>) | `/tutorial-legacy` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/tutorial/lbl/page.tsx](<../core/packages/client/app/[lang]/tutorial/lbl/page.tsx>) | `/tutorial/lbl` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/tutorial/page.tsx](<../core/packages/client/app/[lang]/tutorial/page.tsx>) | `/tutorial` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/vault/page.tsx](<../core/packages/client/app/[lang]/vault/page.tsx>) | `/vault` | 账户/权限工作区（候选） | 待浏览 |
| [core/packages/client/app/[lang]/wb/page.tsx](<../core/packages/client/app/[lang]/wb/page.tsx>) | `/wb` | 其他产品页（待确认表面） | 待浏览 |
| [core/packages/client/app/[lang]/wca/[statId]/page.tsx](<../core/packages/client/app/[lang]/wca/[statId]/page.tsx>) | `/wca/[statId]` | 统计/数据/图表（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/wca/about/[id]/page.tsx](<../core/packages/client/app/[lang]/wca/about/[id]/page.tsx>) | `/wca/about/[id]` | 统计/数据/图表（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/wca/achievements/page.tsx](<../core/packages/client/app/[lang]/wca/achievements/page.tsx>) | `/wca/achievements` | 统计/数据/图表（候选） | 待浏览 |
| [core/packages/client/app/[lang]/wca/all-events-done/page.tsx](<../core/packages/client/app/[lang]/wca/all-events-done/page.tsx>) | `/wca/all-events-done` | 统计/数据/图表（候选） | 待浏览 |
| [core/packages/client/app/[lang]/wca/cohort-ranks/page.tsx](<../core/packages/client/app/[lang]/wca/cohort-ranks/page.tsx>) | `/wca/cohort-ranks` | 统计/数据/图表（候选） | 待浏览 |
| [core/packages/client/app/[lang]/wca/comp-about/page.tsx](<../core/packages/client/app/[lang]/wca/comp-about/page.tsx>) | `/wca/comp-about` | 统计/数据/图表（候选） | 待浏览 |
| [core/packages/client/app/[lang]/wca/comp/[slug]/page.tsx](<../core/packages/client/app/[lang]/wca/comp/[slug]/page.tsx>) | `/wca/comp/[slug]` | 统计/数据/图表（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/wca/comp/page.tsx](<../core/packages/client/app/[lang]/wca/comp/page.tsx>) | `/wca/comp` | 统计/数据/图表（候选） | 待浏览 |
| [core/packages/client/app/[lang]/wca/comp/sources/page.tsx](<../core/packages/client/app/[lang]/wca/comp/sources/page.tsx>) | `/wca/comp/sources` | 统计/数据/图表（候选） | 待浏览 |
| [core/packages/client/app/[lang]/wca/comp/stats/page.tsx](<../core/packages/client/app/[lang]/wca/comp/stats/page.tsx>) | `/wca/comp/stats` | 统计/数据/图表（候选） | 待浏览 |
| [core/packages/client/app/[lang]/wca/fun-stats/page.tsx](<../core/packages/client/app/[lang]/wca/fun-stats/page.tsx>) | `/wca/fun-stats` | 统计/数据/图表（候选） | 待浏览 |
| [core/packages/client/app/[lang]/wca/globe-about/page.tsx](<../core/packages/client/app/[lang]/wca/globe-about/page.tsx>) | `/wca/globe-about` | 统计/数据/图表（候选） | 待浏览 |
| [core/packages/client/app/[lang]/wca/grand-slam/page.tsx](<../core/packages/client/app/[lang]/wca/grand-slam/page.tsx>) | `/wca/grand-slam` | 统计/数据/图表（候选） | 待浏览 |
| [core/packages/client/app/[lang]/wca/kinch/page.tsx](<../core/packages/client/app/[lang]/wca/kinch/page.tsx>) | `/wca/kinch` | 统计/数据/图表（候选） | 待浏览 |
| [core/packages/client/app/[lang]/wca/page.tsx](<../core/packages/client/app/[lang]/wca/page.tsx>) | `/wca` | 统计/数据/图表（候选） | 待浏览 |
| [core/packages/client/app/[lang]/wca/persons/[wcaId]/page.tsx](<../core/packages/client/app/[lang]/wca/persons/[wcaId]/page.tsx>) | `/wca/persons/[wcaId]` | 统计/数据/图表（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/wca/persons/[wcaId]/students/page.tsx](<../core/packages/client/app/[lang]/wca/persons/[wcaId]/students/page.tsx>) | `/wca/persons/[wcaId]/students` | 统计/数据/图表（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/wca/prediction-about/page.tsx](<../core/packages/client/app/[lang]/wca/prediction-about/page.tsx>) | `/wca/prediction-about` | 统计/数据/图表（候选） | 待浏览 |
| [core/packages/client/app/[lang]/wca/prediction/333/[sectionId]/page.tsx](<../core/packages/client/app/[lang]/wca/prediction/333/[sectionId]/page.tsx>) | `/wca/prediction/333/[sectionId]` | 统计/数据/图表（候选） | 待浏览：先配有效参数/身份 |
| [core/packages/client/app/[lang]/wca/prediction/333/page.tsx](<../core/packages/client/app/[lang]/wca/prediction/333/page.tsx>) | `/wca/prediction/333` | 统计/数据/图表（候选） | 待浏览 |
| [core/packages/client/app/[lang]/wca/prediction/lucky/page.tsx](<../core/packages/client/app/[lang]/wca/prediction/lucky/page.tsx>) | `/wca/prediction/lucky` | 统计/数据/图表（候选） | 待浏览 |
| [core/packages/client/app/[lang]/wca/prediction/page.tsx](<../core/packages/client/app/[lang]/wca/prediction/page.tsx>) | `/wca/prediction` | 统计/数据/图表（候选） | 待浏览 |
| [core/packages/client/app/[lang]/wca/records/page.tsx](<../core/packages/client/app/[lang]/wca/records/page.tsx>) | `/wca/records` | 统计/数据/图表（候选） | 待浏览 |
| [core/packages/client/app/[lang]/wca/result-watch/page.tsx](<../core/packages/client/app/[lang]/wca/result-watch/page.tsx>) | `/wca/result-watch` | 统计/数据/图表（候选） | 待浏览 |
| [core/packages/client/app/[lang]/wca/results/page.tsx](<../core/packages/client/app/[lang]/wca/results/page.tsx>) | `/wca/results` | 统计/数据/图表（候选） | 待浏览 |
| [core/packages/client/app/[lang]/wca/success-rate/page.tsx](<../core/packages/client/app/[lang]/wca/success-rate/page.tsx>) | `/wca/success-rate` | 统计/数据/图表（候选） | 待浏览 |
| [core/packages/client/app/[lang]/why-cube/page.tsx](<../core/packages/client/app/[lang]/why-cube/page.tsx>) | `/why-cube` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/wiki/page.tsx](<../core/packages/client/app/[lang]/wiki/page.tsx>) | `/wiki` | 文档/内容/演示（候选） | 待浏览 |
| [core/packages/client/app/[lang]/xcross_pairing_trainer/page.tsx](<../core/packages/client/app/[lang]/xcross_pairing_trainer/page.tsx>) | `/xcross_pairing_trainer` | 本地工具 iframe 壳（核对 upstream 边界） | 待浏览 |
| [core/packages/client/app/[lang]/xcross_trainer/page.tsx](<../core/packages/client/app/[lang]/xcross_trainer/page.tsx>) | `/xcross_trainer` | 本地工具 iframe 壳（核对 upstream 边界） | 待浏览 |
| [core/packages/client/app/[lang]/xxcross_trainer/page.tsx](<../core/packages/client/app/[lang]/xxcross_trainer/page.tsx>) | `/xxcross_trainer` | 本地工具 iframe 壳（核对 upstream 边界） | 待浏览 |
| [core/packages/client/app/auth/callback/page.tsx](<../core/packages/client/app/auth/callback/page.tsx>) | `/auth/callback` | 认证回调壳 | 待浏览 |
| [core/packages/client/app/auth/miniprogram/page.tsx](<../core/packages/client/app/auth/miniprogram/page.tsx>) | `/auth/miniprogram` | 认证回调壳 | 待浏览 |
| [core/packages/client/app/auth/mobile/page.tsx](<../core/packages/client/app/auth/mobile/page.tsx>) | `/auth/mobile` | 认证回调壳 | 待浏览 |
| [core/packages/client/app/auth/social/callback/page.tsx](<../core/packages/client/app/auth/social/callback/page.tsx>) | `/auth/social/callback` | 认证回调壳 | 待浏览 |
| [core/packages/client/app/auth/wechat/mobile/page.tsx](<../core/packages/client/app/auth/wechat/mobile/page.tsx>) | `/auth/wechat/mobile` | 认证回调壳 | 待浏览 |

## Platform 全量注册项

来源：[core/packages/client/lib/platform-routes.ts](<../core/packages/client/lib/platform-routes.ts>)。kind 为 canonical 的项会内部 rewrite 到现有主站 UI，浏览器仍保留 Platform URL；其他 canonicalHref 只是进入完整源 UI 的链接，不能误记成 rewrite。

| 注册 ID | 英语路径模板 | 身份 | 种类 | UI 归属/完整源 UI | 浏览审核状态 |
| --- | --- | --- | --- | --- | --- |
| `home` | `/platform` | public | landing | Platform UI | 待浏览 |
| `about` | `/platform/about` | public | landing | Platform UI | 待浏览 |
| `offline` | `/platform/offline` | public | landing | Platform UI | 待浏览 |
| `login` | `/platform/login` | public | canonical | 内部 rewrite → `/account`（复用源 UI） | 待浏览 |
| `account` | `/platform/account` | account | canonical | 内部 rewrite → `/account`（复用源 UI） | 待浏览及相应身份 |
| `membership` | `/platform/membership` | public | collection | Platform UI | 待浏览 |
| `me-membership` | `/platform/account/membership` | account | dashboard | Platform UI | 待浏览及相应身份 |
| `notifications` | `/platform/notifications` | account | collection | Platform UI；完整源 UI 链接 `/notifications` | 待浏览及相应身份 |
| `timer` | `/platform/timer` | public | canonical | 内部 rewrite → `/timer`（复用源 UI） | 待浏览 |
| `algorithms` | `/platform/algorithms` | public | canonical | 内部 rewrite → `/alg/3x3`（复用源 UI） | 待浏览 |
| `algorithm-detail` | `/platform/algorithms/:id` | public | canonical | 内部 rewrite → `/alg/3x3`（复用源 UI） | 待浏览：需有效参数 |
| `courses` | `/platform/courses` | public | collection | Platform UI | 待浏览 |
| `course-detail` | `/platform/courses/:id` | public | detail | Platform UI | 待浏览：需有效参数 |
| `course-section-introduction` | `/platform/courses/:id/sections/introduction` | public | detail | Platform UI | 待浏览：需有效参数 |
| `course-section-trial` | `/platform/courses/:id/sections/trial` | public | detail | Platform UI | 待浏览：需有效参数 |
| `course-section-core` | `/platform/courses/:id/sections/core` | public | detail | Platform UI | 待浏览：需有效参数 |
| `course-lesson` | `/platform/courses/:id/learn/:lessonId` | public | detail | Platform UI | 待浏览：需有效参数 |
| `teachers` | `/platform/teachers` | public | collection | Platform UI；完整源 UI 链接 `/teachers` | 待浏览 |
| `teacher-detail` | `/platform/teachers/:id` | public | detail | Platform UI；完整源 UI 链接 `/teachers` | 待浏览：需有效参数 |
| `teacher-apply` | `/platform/teachers/apply` | account | form | Platform UI | 待浏览及相应身份 |
| `community` | `/platform/community` | public | collection | Platform UI；完整源 UI 链接 `/forum` | 待浏览 |
| `community-circle` | `/platform/community/circles/:id` | public | collection | Platform UI；完整源 UI 链接 `/forum/f/:id` | 待浏览：需有效参数 |
| `community-post-new` | `/platform/community/posts/new` | account | canonical | 内部 rewrite → `/forum/new`（复用源 UI） | 待浏览及相应身份 |
| `community-post` | `/platform/community/posts/:id` | public | detail | Platform UI；完整源 UI 链接 `/forum/t/:id` | 待浏览：需有效参数 |
| `search` | `/platform/search` | public | collection | Platform UI | 待浏览 |
| `leaderboard` | `/platform/leaderboard` | public | collection | Platform UI | 待浏览 |
| `paths` | `/platform/paths` | public | collection | Platform UI | 待浏览 |
| `path-detail` | `/platform/paths/:id` | public | detail | Platform UI | 待浏览：需有效参数 |
| `events` | `/platform/events` | public | collection | Platform UI | 待浏览 |
| `online-competitions` | `/platform/events/online` | public | landing | Platform UI | 待浏览 |
| `online-competition` | `/platform/events/online/:id` | public | landing | Platform UI | 待浏览：需有效参数 |
| `online-competition-preview` | `/platform/events/preview` | public | landing | Platform UI | 待浏览 |
| `event-detail` | `/platform/events/:id` | public | detail | Platform UI | 待浏览：需有效参数 |
| `news` | `/platform/news` | public | collection | Platform UI | 待浏览 |
| `news-detail` | `/platform/news/:id` | public | detail | Platform UI | 待浏览：需有效参数 |
| `shop` | `/platform/shop` | public | collection | Platform UI | 待浏览 |
| `product-detail` | `/platform/shop/:id` | public | detail | Platform UI | 待浏览：需有效参数 |
| `orders` | `/platform/orders` | account | collection | Platform UI | 待浏览及相应身份 |
| `order-detail` | `/platform/orders/:id` | account | detail | Platform UI | 待浏览：需有效参数及相应身份 |
| `progress` | `/platform/progress` | account | dashboard | Platform UI | 待浏览及相应身份 |
| `account-courses` | `/platform/account/courses` | account | collection | Platform UI | 待浏览及相应身份 |
| `account-badges` | `/platform/account/badges` | account | collection | Platform UI | 待浏览及相应身份 |
| `account-favorites` | `/platform/account/favorites` | account | collection | Platform UI | 待浏览及相应身份 |
| `account-notes` | `/platform/account/notes` | account | collection | Platform UI | 待浏览及相应身份 |
| `account-wishlist` | `/platform/account/wishlist` | account | collection | Platform UI | 待浏览及相应身份 |
| `account-invites` | `/platform/account/invites` | account | collection | Platform UI | 待浏览及相应身份 |
| `account-privacy` | `/platform/account/privacy` | account | form | Platform UI | 待浏览及相应身份 |
| `account-shipping` | `/platform/account/shipping` | account | collection | Platform UI | 待浏览及相应身份 |
| `instructor` | `/platform/instructor` | instructor | dashboard | Platform UI | 待浏览及相应身份 |
| `instructor-courses` | `/platform/instructor/courses` | instructor | collection | Platform UI | 待浏览及相应身份 |
| `instructor-course` | `/platform/instructor/courses/:id` | instructor | detail | Platform UI | 待浏览：需有效参数及相应身份 |
| `instructor-students` | `/platform/instructor/students` | instructor | collection | Platform UI | 待浏览及相应身份 |
| `instructor-earnings` | `/platform/instructor/earnings` | instructor | dashboard | Platform UI | 待浏览及相应身份 |
| `certificate` | `/platform/cert/:code` | public | detail | Platform UI | 待浏览：需有效参数 |
| `qr` | `/platform/qr/:code` | public | detail | Platform UI | 待浏览：需有效参数 |
| `org` | `/platform/org` | account | canonical | 内部 rewrite → `/org`（复用源 UI） | 待浏览及相应身份 |
| `org-home` | `/platform/org/:orgSlug` | account | canonical | 内部 rewrite → `/org/:orgSlug`（复用源 UI） | 待浏览：需有效参数及相应身份 |
| `org-campuses` | `/platform/org/:orgSlug/campuses` | account | canonical | 内部 rewrite → `/org/:orgSlug/campuses`（复用源 UI） | 待浏览：需有效参数及相应身份 |
| `org-classes` | `/platform/org/:orgSlug/classes` | account | canonical | 内部 rewrite → `/org/:orgSlug/classes`（复用源 UI） | 待浏览：需有效参数及相应身份 |
| `org-class` | `/platform/org/:orgSlug/classes/:groupId` | account | canonical | 内部 rewrite → `/org/:orgSlug/classes/:groupId`（复用源 UI） | 待浏览：需有效参数及相应身份 |
| `org-members` | `/platform/org/:orgSlug/members` | account | canonical | 内部 rewrite → `/org/:orgSlug/members`（复用源 UI） | 待浏览：需有效参数及相应身份 |
| `org-packages` | `/platform/org/:orgSlug/packages` | account | canonical | 内部 rewrite → `/org/:orgSlug/packages`（复用源 UI） | 待浏览：需有效参数及相应身份 |
| `org-schedule` | `/platform/org/:orgSlug/schedule` | account | canonical | 内部 rewrite → `/org/:orgSlug/sessions`（复用源 UI） | 待浏览：需有效参数及相应身份 |
| `org-session` | `/platform/org/:orgSlug/sessions/:sessionId` | account | canonical | 内部 rewrite → `/org/:orgSlug/sessions/:sessionId`（复用源 UI） | 待浏览：需有效参数及相应身份 |
| `org-students` | `/platform/org/:orgSlug/students` | account | canonical | 内部 rewrite → `/org/:orgSlug/students`（复用源 UI） | 待浏览：需有效参数及相应身份 |
| `org-student-credits` | `/platform/org/:orgSlug/students/:studentId/credits` | account | canonical | 内部 rewrite → `/org/:orgSlug/students/:studentId/packages`（复用源 UI） | 待浏览：需有效参数及相应身份 |
| `org-student-responsibilities` | `/platform/org/:orgSlug/students/:studentId/responsibilities` | account | canonical | 内部 rewrite → `/org/:orgSlug/students/:studentId`（复用源 UI） | 待浏览：需有效参数及相应身份 |
| `admin` | `/platform/admin` | admin | dashboard | Platform UI | 待浏览及相应身份 |
| `admin-algorithms` | `/platform/admin/algorithms` | admin | canonical | 内部 rewrite → `/alg/3x3`（复用源 UI） | 待浏览及相应身份 |
| `admin-algorithm-new` | `/platform/admin/algorithms/new` | admin | canonical | 内部 rewrite → `/alg/3x3`（复用源 UI） | 待浏览及相应身份 |
| `admin-algorithm-detail` | `/platform/admin/algorithms/:id` | admin | canonical | 内部 rewrite → `/alg/3x3`（复用源 UI） | 待浏览：需有效参数及相应身份 |
| `admin-application` | `/platform/admin/teacher-applications/:id` | admin | detail | Platform UI | 待浏览：需有效参数及相应身份 |
| `admin-applications` | `/platform/admin/teacher-applications` | admin | collection | Platform UI | 待浏览及相应身份 |
| `admin-coupons` | `/platform/admin/coupons` | admin | collection | Platform UI | 待浏览及相应身份 |
| `admin-course-new` | `/platform/admin/courses/new` | admin | form | Platform UI | 待浏览及相应身份 |
| `admin-course` | `/platform/admin/courses/:id` | admin | detail | Platform UI | 待浏览：需有效参数及相应身份 |
| `admin-courses` | `/platform/admin/courses` | admin | collection | Platform UI | 待浏览及相应身份 |
| `admin-paths` | `/platform/admin/paths` | admin | collection | Platform UI | 待浏览及相应身份 |
| `admin-event-new` | `/platform/admin/events/new` | admin | form | Platform UI | 待浏览及相应身份 |
| `admin-event` | `/platform/admin/events/:id` | admin | detail | Platform UI | 待浏览：需有效参数及相应身份 |
| `admin-events` | `/platform/admin/events` | admin | collection | Platform UI | 待浏览及相应身份 |
| `admin-event-analytics` | `/platform/admin/analytics` | admin | dashboard | Platform UI | 待浏览及相应身份 |
| `admin-logs` | `/platform/admin/logs` | admin | collection | Platform UI | 待浏览及相应身份 |
| `admin-payouts` | `/platform/admin/payouts` | admin | collection | Platform UI | 待浏览及相应身份 |
| `admin-teacher-new` | `/platform/admin/teachers/new` | admin | form | Platform UI | 待浏览及相应身份 |
| `admin-teacher` | `/platform/admin/teachers/:id` | admin | detail | Platform UI | 待浏览：需有效参数及相应身份 |
| `admin-teachers` | `/platform/admin/teachers` | admin | collection | Platform UI | 待浏览及相应身份 |
| `admin-invites` | `/platform/admin/invites` | admin | collection | Platform UI | 待浏览及相应身份 |
| `admin-news-new` | `/platform/admin/news/new` | admin | form | Platform UI | 待浏览及相应身份 |
| `admin-news-detail` | `/platform/admin/news/:id` | admin | detail | Platform UI | 待浏览：需有效参数及相应身份 |
| `admin-news` | `/platform/admin/news` | admin | collection | Platform UI | 待浏览及相应身份 |
| `admin-community` | `/platform/admin/community` | admin | canonical | 内部 rewrite → `/forum/review`（复用源 UI） | 待浏览及相应身份 |
| `admin-order` | `/platform/admin/orders/:id` | admin | detail | Platform UI | 待浏览：需有效参数及相应身份 |
| `admin-orders` | `/platform/admin/orders` | admin | collection | Platform UI | 待浏览及相应身份 |
| `admin-reconcile` | `/platform/admin/reconcile` | admin | dashboard | Platform UI | 待浏览及相应身份 |
| `admin-product-new` | `/platform/admin/products/new` | admin | form | Platform UI | 待浏览及相应身份 |
| `admin-product` | `/platform/admin/products/:id` | admin | detail | Platform UI | 待浏览：需有效参数及相应身份 |
| `admin-products` | `/platform/admin/products` | admin | collection | Platform UI | 待浏览及相应身份 |
| `admin-qr-detail` | `/platform/admin/qr/:code` | admin | detail | Platform UI | 待浏览：需有效参数及相应身份 |
| `admin-qr-cards` | `/platform/admin/qr/cards` | admin | collection | Platform UI | 待浏览及相应身份 |
| `admin-qr-prompts` | `/platform/admin/qr/prompts` | admin | collection | Platform UI | 待浏览及相应身份 |
| `admin-qr-stats` | `/platform/admin/qr/stats` | admin | dashboard | Platform UI | 待浏览及相应身份 |
| `admin-qr` | `/platform/admin/qr` | admin | collection | Platform UI | 待浏览及相应身份 |

## WCA 本地统计索引全量有效项

来源：[stats/index.json](<../stats/index.json>)；模板：[core/packages/client/app/[lang]/wca/[statId]/page.tsx](<../core/packages/client/app/[lang]/wca/[statId]/page.tsx>)。每项指标均列出，实际 tab/query 映射由渲染器确认；文件存在不等于页面渲染通过。明确退役 ID 为 name_stats、all-results、wr_metric，本地索引命中 0 项。

| statId | 英语路径 | 分类/标题 | 指标 ID（完整） | 本地同名 JSON | 浏览审核状态 |
| --- | --- | --- | --- | --- | --- |
| `wr_aoxr` | `/wca/wr_aoxr` | 世界纪录分析 / AoXR | ao1r, ao2r, ao3r, ao4r | 存在 | 待浏览 |
| `wr_dominance` | `/wca/wr_dominance` | 世界纪录分析 / 屠榜 | single, average | 存在 | 待浏览 |
| `round_top3_sum` | `/wca/round_top3_sum` | 世界纪录分析 / 轮次前三成绩和 | single, average | 存在 | 待浏览 |
| `wr_non_pr` | `/wca/wr_non_pr` | 世界纪录分析 / 非 PR | single, average | 存在 | 待浏览 |
| `wr_newcomer` | `/wca/wr_newcomer` | 世界纪录分析 / 新人首个世界纪录 | single, average | 存在 | 待浏览 |
| `average_of` | `/wca/average_of` | 世界纪录分析 / 滚动平均 | ao3, ao5, ao12, ao25, ao50, ao100, ao1000 | 存在 | 待浏览 |
| `consecutive_sub_5_average` | `/wca/consecutive_sub_5_average` | 世界纪录分析 / 三阶最多连续 sub-5 平均 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `best_potential_fmc_mean` | `/wca/best_potential_fmc_mean` | 成绩与纪录 / 理论最佳 FMC 平均 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `best_round` | `/wca/best_round` | 成绩与纪录 / 最佳轮次 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `keatoned_records` | `/wca/keatoned_records` | 成绩与纪录 / 日掩纪录 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `most_frequent_results` | `/wca/most_frequent_results` | 成绩与纪录 / 最常出现的成绩 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `moving_average` | `/wca/moving_average` | 成绩与纪录 / 移动平均 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `date_match_pr` | `/wca/date_match_pr` | 成绩与纪录 / 日期匹配 PR | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `smallest_diff_between_single_and_average` | `/wca/smallest_diff_between_single_and_average` | 成绩与纪录 / 单次与平均差距最小 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `yearly_rankings` | `/wca/yearly_rankings` | 成绩与纪录 / 年度排名 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `best_result_off_podium` | `/wca/best_result_off_podium` | 领奖台与荣誉 / 无缘领奖台的最佳成绩 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `complete_competition_winners` | `/wca/complete_competition_winners` | 领奖台与荣誉 / 单场包揽全项冠军 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `tied_podium_results` | `/wca/tied_podium_results` | 领奖台与荣誉 / 同轮前三名同分 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `most_4th_places` | `/wca/most_4th_places` | 领奖台与荣誉 / 最多第四名 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `most_competitions_before_winning` | `/wca/most_competitions_before_winning` | 领奖台与荣誉 / 首冠前参赛最多 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `most_finals` | `/wca/most_finals` | 领奖台与荣誉 / 决赛次数最多 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `most_podiums_at_single_competition` | `/wca/most_podiums_at_single_competition` | 领奖台与荣誉 / 单场比赛登台最多 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `most_podiums_together` | `/wca/most_podiums_together` | 领奖台与荣誉 / 同台登奖次数最多 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `worst_result_on_podium` | `/wca/worst_result_on_podium` | 领奖台与荣誉 / 登上领奖台的最差成绩 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `competitions_per_year_by_person` | `/wca/competitions_per_year_by_person` | 选手经历 / 选手每年参赛数 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `longest_competitions_path` | `/wca/longest_competitions_path` | 选手经历 / 最长连续参赛路径 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `longest_streak_of_competitions_in_own_country` | `/wca/longest_streak_of_competitions_in_own_country` | 选手经历 / 在本国最长连续参赛 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `longest_streak_of_personal_records` | `/wca/longest_streak_of_personal_records` | 选手经历 / 连续取得个人纪录的最多参赛场数 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `longest_streak_of_podiums` | `/wca/longest_streak_of_podiums` | 选手经历 / 最长连续登台 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `longest_time_to_sub_10` | `/wca/longest_time_to_sub_10` | 选手经历 / 达到三阶 sub-10 用时最长 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `most_attended_competitions_in_single_month` | `/wca/most_attended_competitions_in_single_month` | 选手经历 / 单月参赛最多 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `most_attended_competitions_in_single_week` | `/wca/most_attended_competitions_in_single_week` | 选手经历 / 单周参赛最多 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `most_competitions_abroad` | `/wca/most_competitions_abroad` | 选手经历 / 海外参赛最多 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `most_completed_solves` | `/wca/most_completed_solves` | 选手经历 / 累计完成还原数最多 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `most_distinct_dates_competed_on` | `/wca/most_distinct_dates_competed_on` | 选手经历 / 累计参赛日数最多 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `most_solves_before_bld_success` | `/wca/most_solves_before_bld_success` | 选手经历 / 首次盲拧成功前尝试最多 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `most_visited_continents` | `/wca/most_visited_continents` | 选手经历 / 参赛大洲最多 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `most_visited_countries` | `/wca/most_visited_countries` | 选手经历 / 参赛国家最多 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `shortest_time_to_reach_milestone_in_comps_count` | `/wca/shortest_time_to_reach_milestone_in_comps_count` | 选手经历 / 最快达到参赛数里程碑 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `shortest_time_to_get_all_singles` | `/wca/shortest_time_to_get_all_singles` | 选手经历 / 最快集齐所有项目单次 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `shortest_time_to_get_all_singles_and_averages` | `/wca/shortest_time_to_get_all_singles_and_averages` | 选手经历 / 最快集齐所有项目单次与平均 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `average_event_count_by_competition` | `/wca/average_event_count_by_competition` | 赛事统计 / 每场比赛平均项目数 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `competition_days_count_by_region` | `/wca/competition_days_count_by_region` | 赛事统计 / 各地区比赛天数 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `competitions_count_by_week` | `/wca/competitions_count_by_week` | 赛事统计 / 每周比赛数 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `competitions_per_year_by_country` | `/wca/competitions_per_year_by_country` | 赛事统计 / 各国每年比赛数 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `dnf_rate_by_event` | `/wca/dnf_rate_by_event` | 赛事统计 / 各项目 DNF 率 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `most_records_at_single_competition` | `/wca/most_records_at_single_competition` | 赛事统计 / 单场比赛最多纪录 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `best_medal_collection_from_abroad_by_country` | `/wca/best_medal_collection_from_abroad_by_country` | 纪录与国家 / 各国海外奖牌榜最佳 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `best_medal_collection_from_abroad_by_person` | `/wca/best_medal_collection_from_abroad_by_person` | 纪录与国家 / 选手海外奖牌榜最佳 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `current_world_records_by_country` | `/wca/current_world_records_by_country` | 纪录与国家 / 各国当前世界纪录数 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `delegated_competition_per_year` | `/wca/delegated_competition_per_year` | 纪录与国家 / 每年执裁比赛数（WCA Delegate） | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `first_r_is_wr` | `/wca/first_r_is_wr` | 纪录与国家 / 首破纪录即为世界纪录 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `longest_standing_records` | `/wca/longest_standing_records` | 纪录与国家 / 保持最久的世界纪录 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `longest_streak_of_world_records` | `/wca/longest_streak_of_world_records` | 纪录与国家 / 同项目同类型最长连续世界纪录 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `most_delegated_competitions` | `/wca/most_delegated_competitions` | 纪录与国家 / 执裁比赛最多（WCA Delegate） | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `potentially_seen_world_records` | `/wca/potentially_seen_world_records` | 纪录与国家 / 可能现场见证的世界纪录 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `records_in_most_events` | `/wca/records_in_most_events` | 纪录与国家 / 打破纪录项目数最多 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `winned_week_count` | `/wca/winned_week_count` | 纪录与国家 / 登顶周数统计 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `world_championship_podiums_by_country` | `/wca/world_championship_podiums_by_country` | 纪录与国家 / 各国世锦赛登台数 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `world_championship_podiums_by_person` | `/wca/world_championship_podiums_by_person` | 纪录与国家 / 选手世锦赛登台数 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `world_championship_records` | `/wca/world_championship_records` | 纪录与国家 / 世锦赛纪录 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `world_records_by_country` | `/wca/world_records_by_country` | 纪录与国家 / 各国世界纪录数 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |
| `world_records_by_person` | `/wca/world_records_by_person` | 纪录与国家 / 选手世界纪录数 | 无索引级 metrics；检查实际视图 | 存在 | 待浏览 |

## 特殊呈现与响应处理器

错误/加载文件需要主动触发对应状态审核；不要为了截图破坏服务或真实数据。当前树没有独立 not-found.tsx/default.tsx，但框架 404 与其他组件内空态仍需按页面审核。

| 特殊呈现源码 | 所属路由范围 | 状态 |
| --- | --- | --- |
| [core/packages/client/app/[lang]/error.tsx](<../core/packages/client/app/[lang]/error.tsx>) | `/` | 待触发/浏览 |
| [core/packages/client/app/[lang]/platform/error.tsx](<../core/packages/client/app/[lang]/platform/error.tsx>) | `/platform` | 待触发/浏览 |
| [core/packages/client/app/[lang]/platform/loading.tsx](<../core/packages/client/app/[lang]/platform/loading.tsx>) | `/platform` | 待触发/浏览 |
| [core/packages/client/app/global-error.tsx](<../core/packages/client/app/global-error.tsx>) | `/` | 待触发/浏览 |

以下 route handler 返回数据、资源或文本，不套用页面玻璃；只核对修改没有影响响应契约。

| handler 源码 | 路径模板 | 状态 |
| --- | --- | --- |
| [core/packages/client/app/api/comp/[slug]/route.ts](<../core/packages/client/app/api/comp/[slug]/route.ts>) | `/api/comp/[slug]` | 非视觉页面；不计玻璃通过 |
| [core/packages/client/app/api/google-verify/route.ts](<../core/packages/client/app/api/google-verify/route.ts>) | `/api/google-verify` | 非视觉页面；不计玻璃通过 |
| [core/packages/client/app/cubing-chunks/[...slug]/route.ts](<../core/packages/client/app/cubing-chunks/[...slug]/route.ts>) | `/cubing-chunks/[...slug]` | 非视觉页面；不计玻璃通过 |
| [core/packages/client/app/llms.txt/route.ts](<../core/packages/client/app/llms.txt/route.ts>) | `/llms.txt` | 非视觉页面；不计玻璃通过 |
| [core/packages/client/app/music/library/[...slug]/route.ts](<../core/packages/client/app/music/library/[...slug]/route.ts>) | `/music/library/[...slug]` | 非视觉页面；不计玻璃通过 |
| [core/packages/client/app/recon-sitemap.xml/route.ts](<../core/packages/client/app/recon-sitemap.xml/route.ts>) | `/recon-sitemap.xml` | 非视觉页面；不计玻璃通过 |
| [core/packages/client/app/stats/[...slug]/route.ts](<../core/packages/client/app/stats/[...slug]/route.ts>) | `/stats/[...slug]` | 非视觉页面；不计玻璃通过 |
| [core/packages/client/app/tools/[...slug]/route.ts](<../core/packages/client/app/tools/[...slug]/route.ts>) | `/tools/[...slug]` | 非视觉页面；不计玻璃通过 |
| [core/packages/client/app/tutorial-sitemap.xml/route.ts](<../core/packages/client/app/tutorial-sitemap.xml/route.ts>) | `/tutorial-sitemap.xml` | 非视觉页面；不计玻璃通过 |

## 集合核对记录

2026-09-10 生成后重新从文件系统枚举并与表格源码链接集合逐项比较：页面 335/335、特殊呈现 4/4、handler 9/9，无漏项、无重复。Platform 注册 ID 103/103，有效 statId 63/63。文件使用 UTF-8、LF。此处仅为静态集合核对结果。
