# 代码精简与复用跟踪

状态：本轮优化已完成。2026-10-24 维护者追加授权，将本轮与其他贡献者的当前改动一起提交并推送；CI 与部署结果以该发布提交的实际记录为准。开始与完成日期：2026-10-24。

## 授权与目标

维护者先授权本地实施代码精简，要求多 Agent 并行、独立 review、必要回归验证，并报告实际减少的行数；优化交付后另行明确授权提交所有人的改动并推送。本文件中的代码量与验证结果仍仅属于精简任务，不混入随后一起发布的其他功能。

保持现有功能、公开 URL、数据格式、中英文内容和平台边界。优先合并已证实的重复逻辑与重复契约；不通过压缩排版、删除测试、转移文案格式或删除历史归档制造减行数字。大文件先核对职责与重复点，只有确实降低维护成本时才抽取。

## 基线与统计方法

- 起始提交：`547657f02f`，另有本轮开始前已存在的未提交修改。
- 起始源码和工作树状态快照：`/tmp/cuberoot-simplification-20261024/baseline.json`，仅供本机比较，不提交。
- 既有改动包括论坛搜索、hook、Reconer 与求解研究等，保留原状，不计入本轮成果。
- 最终以本轮文件清单对比快照，使用同版本 cloc 分别统计改前、改后；新公共模块和新增回归检查全部计入净值。
- cloc 2.10 使用 `--skip-uniqueness --by-file`，按每个实际文件计数，避免内容相同的转发入口被工具去重；统计值不与上次全仓默认去重口径混算。
- `pnpm-lock.yaml` 未包含在源码快照中，已确认起始状态干净，采用起始提交的文件内容作为改前基线。
- 分别报告 TypeScript 代码行、全部相关源码代码行、物理增删行，以及文档/测试成本。历史全仓约 99.5 万行不是本轮可比基线，不把他人并行修改计入收益。

## 工作项

| 编号 | 工作项 | 状态 | 实现与 review 边界 |
| --- | --- | --- | --- |
| S01 | 开发介绍页动画、目录导航与清理逻辑共享 | 完成 | 28 处使用 `intro-effects.ts`；逐页基线比较、3 项生命周期回归与 28 个入口的浏览器检查通过 |
| S02 | 数学 TeX 渲染副本统一到现有公共组件 | 已实现、已独立 review | 旧 client 入口兼容转发；原实现与公共实现逐 token 相同 |
| S03 | World Best Web/job 数据契约单一来源 | 已实现、已验证、已独立 review | `@cuberoot/shared/wb` 公开出口；shared build、WB job tsc 通过；原两份类型与共享类型等价 |
| S04A | 旧教程 HTML 解析复用 | 已实现、已验证、已独立 review | 两处 sanitizer 白名单保持；共享 chip、媒体与递归内链处理；7 项回归通过 |
| S04B | 统计页下载、分块与指标复用 | 已实现、已验证、已独立 review | Bic、SuperFloppy、Slide15 复用已有模块；6 项回归通过，3 页主体保持原样 |
| S05 | 教学 API 外层认证与错误处理共享 | 已实现、已验证、已独立 review | 95 段 handler 服务 97 个端点；路由与业务 AST 等价；恢复路径类型推断后 server typecheck、105 项相关回归通过 |
| S06 | 集成 review 与必要检查 | 完成 | client/server typecheck、shared build、WB tsc、191 项定向测试、架构边界检查与浏览器检查通过 |
| S07 | 最终差异审查、统计与交付 | 已统计、已独立复核 | 46 个 TS 文件净减 1884 代码行，计入新增测试与目录登记；另有 3 个配置文件及本 MD |

## 已审查但不合并的候选

- `app-ui/src/App.tsx` 已消费 timer-ui/shared。没有确认新的大段等价重复；只拆文件不会减少总量，本轮不改变主流程。
- `teaching_saas.ts` 的 SQL、权限、事务、幂等及各端点业务体保持；只合并确认相同的外层生命周期。
- document/paint 下载会 append/remove 元素并延迟 1000 ms，统计页下载不 append 且延迟 0 ms；不抹平已有行为差异。
- 图像出口虽有短下载片段，不让通用图像模块反向依赖统计领域模块。
- trainer marks / SRS 本地存储涉及迁移、墓碑和同步，未证实相同契约，不为少量相似代码强行合并。
- 求解器与预览的独立几何推导有交叉校验价值；第三方代码、生成数据与退役归档不计作可删除业务冗余。

## 验证原则

- 在 `core/` 运行目标单元命令；有 dev 服务时不运行 Next build。
- shared 源码变化后构建 shared；类型、包出口与运行时边界按影响范围验证。
- effect/observer 抽取针对重复挂载、卸载清理及事件行为做有上限的定向回归，不只检查文本形状。
- 不执行无关重型求解测试，不用删除或放宽断言消除失败。
- 不能承诺绝对没有 bug；以独立 review、必要验证和明确的验收边界降低回归风险。

## Review 与验收记录

| 审查者 | 范围 | 结果 |
| --- | --- | --- |
| audit_content 实现，audit_duplication 独立复审 | S01 | 28 页除目标 effect 与 import 外逐字保持；selector、stagger、颜色、阈值及 effect 条件/依赖均一致；覆盖并存、卸载、过期回调和重挂载 |
| audit_duplication 实现，audit_more 独立复审 | S02/S03 | TeX/client 边界与类型专用出口保持，Web/job 没有增加运行时依赖加载；原实现等价 |
| audit_more 实现，audit_duplication 独立复审 | S04A/S04B | 功能 review 通过；发现的三处常量说明注释误删已恢复；下载、编码、整块尾换行及 HTML 解析边界保持 |
| 主代理实现，api_review 独立复审并修复类型问题 | S05 | 97 个方法/路径/注册顺序和 95 个业务体比对通过；保留路由外层 `c` 的原路径类型，交给 `withActor(c, handler)`；已知参数仍为 string，未知参数仍可能 undefined；未用类型断言掩盖问题 |
| browser_review | S01 真实浏览器 | 28/28 入口与 4/4 客户端离开返回通过；pageerror/console.error 为 0；未发现本轮行为回归 |
| final_audit | 文件边界、遗漏与最终净值 | 无新增发现；所有未跟踪新模块、回归与目录登记已纳入显式文件清单，其他并行任务均排除 |

本机在首次执行 pnpm 命令时自动刷新现有依赖链接，使用缓存、没有下载新包；WB 目标离线安装曾因缺缓存元数据失败，随后已由现有链接与成功构建确认可用。没有引入外部新依赖。

## 验证结果与边界

- `pnpm --filter @cuberoot/shared build`：通过，刷新现有 dist。
- `pnpm --filter @cuberoot/wb-build exec tsc --noEmit`：通过。
- client 与 server 各自 `typecheck`：通过，API 类型修复后复验。
- API 的 teaching_saas、teaching_saas_repository、teaching_weekly_reports_schema、teaching_conversations_schema、teaching_learner_portal_schema：5 文件、105 项通过；最终运行外壳修改后重跑通过。
- client 的 dev-catalog-sync、dev-schema-api-drift、architecture-map、teaching-saas-api：4 文件、70 项通过。
- 新增 dev-intro-effects、tutorial-content-parser、scramble-dist-download：3 文件、16 项通过，覆盖实际生命周期、HTML 安全边界和分块字节边界。
- 合计 12 个相关测试文件、191 项通过；未运行无关重型求解测试。
- `pnpm audit:boundaries`：通过，227 个既有指纹、248 次出现、37 条人工合同；不据旧数量新增架构债务。
- 显式 50 文件清单的 `git diff --check`：通过。
- 没有运行 Next build、没有重启现有 dev、没有生产数据操作或发布；浏览器结果单独记录。

真实浏览器使用现有 localhost:3000 与已安装 Chrome，无头执行。25 个语言入口、CubingChina、WCA Site 以及代表共享异步壳的 Git 共 28 个入口通过正文、渐入、锚点位置与目录高亮检查；不是对所有 stack/llm 文章内容的全量验收。TS、Rust、WCA Site、Git 的客户端进入、离开、返回均通过：前三者监听数 11→0→11，Git 为 10→0→10；observer 与 RAF 均为 1→0→1，离开后帧计数停止。检查脚本对 CubingChina 的滚动方向假设和 Git 合并 chunk 的计数匹配已修正后复验，未因此修改产品源码。

浏览器证据：`/tmp/cuberoot-simplification-20261024/intro-browser-review-summary.json`。检查限桌面 Chromium；没有声称覆盖 Safari、移动端或全部中英文组合，既有语言偏好可能把裸入口切到 `/zh`。

额外只读检查发现 `/dev/auth` 指纹在任务开始前已不匹配：用基线快照替换纳管认证源码后，开始与当前指纹均为 `57a7eca7fec4a5364c835ce512f610b49af04f940e503733670a6b196858e0f5`，纳管源码本轮变化列表为空。本轮没有擅自刷新该指纹或改动其他任务的登录相关工作。教学 API 的认证外壳虽不在该文件名清单中，仍已单独审查调用顺序、错误响应、全部 97 个端点的认证前置及异步失败行为。

## 最终统计

| 范围 | 改前代码行 | 改后代码行 | 净减少 |
| --- | ---: | ---: | ---: |
| 生产 TypeScript，41 文件 | 40,580 | 38,403 | 2,177 |
| 回归测试，4 文件 | 1,353 | 1,622 | -269 |
| 工具目录登记，1 文件 | 626 | 650 | -24 |
| 全部任务 TypeScript，46 文件 | 42,559 | 40,675 | **1,884** |
| 再计入两个 manifest 与 lock，49 文件 | 53,347 | 51,472 | **1,875** |

生产代码分项净减少：介绍页 1,310 行；TeX 86 行；WB 类型 32 行；教程与统计下载 99 行；教学 API 650 行。

TypeScript 物理行新增 1,825、删除 4,078，净减少 2,253（包含空行与注释）；不把它冒充 cloc 代码行。MD 单独保留，不计入源码收益。未删任何测试，也没有更换正文格式、压缩换行或移除功能来扩大数字。

本机复算材料位于 `/tmp/cuberoot-simplification-20261024/`：`task-files.json` 是显式 50 文件清单；`final-count.mjs` 执行前后统计；`final-audit/{summary,per-file,work-items,manifest}.json` 保存汇总、逐文件明细、分项与基线来源，`before.cloc.json` / `after.cloc.json` 保存 cloc 原始输出。这些临时文件不提交，关键结果已记录于本 MD。

最终核对：本轮文件与起始未提交文件集合没有交集；最终统计后 49 个源码/配置文件内容没有继续变化。本轮结论不声称全仓已无可优化内容，也不将仅有相似外形、但行为不同的实现列作遗漏项。

## 本轮文件清单

```text
core/packages/client/app/[lang]/dev/language/bash/page.tsx
core/packages/client/app/[lang]/dev/language/c/page.tsx
core/packages/client/app/[lang]/dev/language/cpp/page.tsx
core/packages/client/app/[lang]/dev/language/csharp/page.tsx
core/packages/client/app/[lang]/dev/language/css/page.tsx
core/packages/client/app/[lang]/dev/language/go/page.tsx
core/packages/client/app/[lang]/dev/language/haskell/page.tsx
core/packages/client/app/[lang]/dev/language/html/page.tsx
core/packages/client/app/[lang]/dev/language/java/page.tsx
core/packages/client/app/[lang]/dev/language/javascript/page.tsx
core/packages/client/app/[lang]/dev/language/katex/page.tsx
core/packages/client/app/[lang]/dev/language/kotlin/page.tsx
core/packages/client/app/[lang]/dev/language/latex/page.tsx
core/packages/client/app/[lang]/dev/language/lua/page.tsx
core/packages/client/app/[lang]/dev/language/mojo/page.tsx
core/packages/client/app/[lang]/dev/language/php/page.tsx
core/packages/client/app/[lang]/dev/language/powershell/page.tsx
core/packages/client/app/[lang]/dev/language/python/page.tsx
core/packages/client/app/[lang]/dev/language/ruby/page.tsx
core/packages/client/app/[lang]/dev/language/rust/page.tsx
core/packages/client/app/[lang]/dev/language/sql/page.tsx
core/packages/client/app/[lang]/dev/language/swift/page.tsx
core/packages/client/app/[lang]/dev/language/ts/page.tsx
core/packages/client/app/[lang]/dev/language/wasm/page.tsx
core/packages/client/app/[lang]/dev/language/zig/page.tsx
core/packages/client/app/[lang]/dev/_shared/CodeToolIntroClient.tsx
core/packages/client/app/[lang]/dev/cubingchina/page.tsx
core/packages/client/app/[lang]/dev/wca-site/page.tsx
core/packages/client/app/[lang]/dev/_shared/intro-effects.ts
core/packages/client/app/[lang]/math/god/_components/Tex.tsx
core/packages/client/app/[lang]/wb/types.ts
core/jobs/wb-build/src/types.ts
core/packages/shared/src/wb.ts
core/packages/client/app/[lang]/tutorial-legacy/_components/CfopContent.tsx
core/packages/client/app/[lang]/tutorial-legacy/_components/TutorialContent.tsx
core/packages/client/app/[lang]/tutorial-legacy/_components/tutorial-content-parser.tsx
core/packages/client/lib/scramble-dist/download.ts
core/packages/client/app/[lang]/scramble/stats/_components/BicDistView.tsx
core/packages/client/app/[lang]/scramble/stats/_components/Slide15DistView.tsx
core/packages/client/app/[lang]/scramble/stats/_components/SuperFloppyDistView.tsx
core/apps/api/src/routes/teaching_saas.ts
core/packages/client/tests/dev-intro-effects.test.ts
core/packages/client/tests/tutorial-content-parser.test.ts
core/packages/client/tests/scramble-dist-download.test.ts
core/apps/api/tests/teaching_saas.test.ts
core/packages/client/app/[lang]/dev/utils/_catalog.tsx
core/jobs/wb-build/package.json
core/packages/shared/package.json
core/pnpm-lock.yaml
docs/code-simplification-tracker.md
```
