# AGENTS.md

这里只保留全仓必要规则和任务入口。开始工作时，按下表读取相关细则及目录内的 `AGENTS.md`；不必加载无关文档。细则是有效指令，不是历史归档。当次用户明确指令优先。

## 按任务读取

| 任务 | 必读入口 |
| --- | --- |
| 模块归属、依赖、架构、upstream / fork | [架构边界与模块归属](docs/contributing/architecture.md)；当前状态见[架构跟踪表](docs/architecture-modernization-tracker.md) |
| 本地启动、预览域名、工作树、构建/测试、代码量、流量排查、智能魔方验证 | [开发与验证](docs/contributing/development.md)；安装见[本地开发环境](docs/development.md) |
| commit / push / PR、CI、部署、数据库迁移 | [发布授权与部署契约](docs/contributing/release.md) |
| React、CSS、组件、弹窗、菜单、图标、身份展示、主题、图片与导航 | [前端组件与交互规范](docs/contributing/frontend.md) |
| URL、路由迁移、SSR/SSG、metadata/SEO、API 地址/缓存、nuqs | [网址与渲染契约](docs/contributing/routing.md) |
| 文案、多语言、WCA 翻译、规则引用、违禁词 | [多语言与翻译](docs/contributing/localization.md) |
| 战队导入、WCA 统计、登录流程同步、指法、Space/Blender、论坛视频限制 | [业务专项规则与入口](docs/contributing/domains.md) |
| 本地求解、建表、基准、长期/批量计算、打乱统计、求解器 loop | [计算保护与求解器规则](docs/contributing/compute.md)，启动前全文读取 |

相关技能按 catalog 的 trigger 使用，路径按 root alias 展开，不凭记忆或猜路径；新 UI 文案用 `i18n`，颜色/材质用 `theme-tokens`，路由/标题/SEO 用 `document-title` 及其 SEO 契约。

双机同时开发与交接读取[双机开发流程](docs/contributing/multi-machine.md)；代码通过 Git 同步，发布由一个会话顺序整合两机，不镜像工作区或运行状态。

## 系统边界

- `core/packages/client` 是唯一 Web 前端；`core/apps/api` 是独立 Hono API + PG，禁止依赖 Web 私有源码或运行时资产。
- `core/packages/app-ui` 是已安装客户端的共享 React 产品层，通过 capability adapter 调用系统能力；`core/apps/{mobile,desktop,harmony}` 是薄宿主。小程序独立运行，不复用 React DOM；FMC 是独立 Cargo/HTTP 服务。
- `core/packages/shared` 仅承载有真实跨端消费者的稳定契约、纯规则与模型；页面和适配留在所属 app。`core/jobs/*` 是离线任务；`core/packages/platform` 已退役，不测试、不构建、不部署、不新增依赖。
- 新依赖禁止 `package → app`、`app → 其他 app 源码`、`server → client/public`、`miniprogram → React DOM/Next`、跨包 deep import 和现役包引用退役 platform；既有违规不得扩大。
- 事实源：workspace/package manifest、源码路由/schema/migration、workflow/ops、[生成物清单](docs/generated-artifacts.json)。架构判断注明当前提交及源码/配置证据，不重复维护完整清单。
- 一般业务、job、自动化优先 TypeScript，求解器/大表优先 Rust；新增 Python 先查[迁移跟踪表](docs/python-to-typescript-rust-tracker.md)，不得重新引入已退役 `.ps1` / `pwsh` 依赖。
- upstream/fork 受保护部分先按模块归属核对并询问用户，只改获准的新增/包装部分。进入 `research/reconer/` 先读其 `AGENTS.md`、`roadmap.md`、`plan.md`、`human.md`。

## 工作与验证

- **临时目录约束**：`.tmp/`、`tmp/` 只存可丢弃中间物。运行必需的表、冻结版本、证据、断点、待提交结果和唯一源码禁止放入临时目录；持久本地数据用 `.local-data/`，源码进入所属模块。新增临时文件只用 `.tmp/{png,scratch,cache}/`；正式入口不得依赖它们。迁移映射、逐行例外及双机同步见 [本地文件生命周期](docs/local-artifact-lifecycle.md)。不以修改例外、关闭 Hook 或移动回 `.tmp` 绕过检查。

- 维护者要求（2026-11-11）：所有项目不创建、不使用 Git worktree，也不自动切换到已有工作树。始终在现有本地 checkout 开发、验证、提交和推送；遇到未提交修改或同步冲突，先备份、在当前目录合并并保留其他任务的修改，不以隔离为由创建工作树。
- 新功能先搜索并复用已有组件、数据、工具、资源和契约；可共用内嵌逻辑先抽到合适公共模块，禁止复制改名或增加无必要的层/package。
- 先定位根因再做最小实现；性能、502、OOM 先取证。无实证不宣称修好，未证实标为假设；本地验证、提交、推送、部署和真机验收分别报告。
- 展示/本地化值不得替代计算、校验、保存或 API 的无损原值；登录/管理员态不得改变公开内容语义。UI 保持紧凑可读，避免多余装饰。
- 文案只留事实与必要操作；删掉不影响理解或操作的句子一律不写，尤其是显然的操作提示、页面自我介绍和维护说明。
- core pnpm 命令先进入 `core/`，使用仓库指定版本（当前 pnpm 12.6.0）；Cargo 命令在所属目录执行；含 `[lang]` 的 shell 路径用单引号。
- dev 前探测 `http://127.0.0.1:3000/`，已有服务则复用，不擅停/重启他人服务。**dev 运行时禁止本地 `next build`**，验证用目标单元 typecheck。
- 改 `shared/src/**` 后必须在 `core/` 运行 `pnpm --filter @cuberoot/shared build`；改小程序 `src/` 后必须运行 `pnpm --filter @cuberoot/miniprogram build`，改 WXML 后关闭并重开开发者工具干净编译。“不用检查”不跳过必要构建。
- 非必要不新增或运行测试；按风险做最小检查，不为简单可逆改动凑测试。单文件用 `pnpm --filter @cuberoot/client exec vitest run <path>`，禁 `test -- <path>`；禁对根 references-only tsconfig 跑 `tsc --noEmit` 冒充检查。
- 默认 dev API 反代线上，不是隔离数据库；本地数据预览按文档限定域。磁盘不足先 `df -h` 报告，不静默换方案。

## 部署

- 默认只改本地，不自动 commit/push；小改动积累后集中提交，明确要求立即提交除外。分析/评审不自动变成修改与发布。
- 用户要求发布时，可用已授权账号直接 commit → push main，无需强制 PR 或重复审批；当次“仅本地/只建 PR/不部署”等限制优先。不得强推、删除主分支或夹带他人改动，不扩大账号权限。
- push 前同步最新 main、解决冲突、完成必要验证并核对 workflow 触发范围；之后确认对应 CI/部署，**不等待或跟进 CodeQL**，不重复已通过检查。纯文档不制造无关部署。
- **发布验证不得扩大范围**：用户说“全部 push / 全绿”是确认本次受影响的必要 CI 与部署，不是启动所有平台全量构建。手动触发前核对 `workflow_dispatch` 的实际 jobs；网页发布不得因此附带无关原生打包，细则见[发布验证范围](docs/contributing/release.md#发布验证范围)。
- Skill 常规发布步骤不新增审批门槛；终端凭据缺失时先核对已授权 GitHub 连接器。完整授权、平台限制与部署流程见发布文档。
- **网址移动/改名后旧 URL 默认直接 HTTP 404**，不加 redirect、兼容页或别名，除非用户明确要求；同步入口、metadata、sitemap 和文档。

## 本地计算内存与交换保护

- 本机求解/建表/批量计算前读[完整规则](docs/contributing/compute.md)。没有系统级防换出机制的大内存任务不得启动，只有文档明确的 H10、Opt1–9、Opt10/AUF 等限定授权按各自 guard 与监控例外执行；不得套用例外或擅改系统 swap，监控不等于禁止 swap。
- 一般 H11 建表、加载/映射、查表、求解及基准仍禁止；仅 2026-11-10 用户指定的、按物理总内存选中 64G 档的日常 Egg Solver 统计可复用已验收 h11 表受保护求解，按计算规则执行。此项不授权重建表、Nissy H11 或其他研究。
- 长期计算须保存断点、同一进程和只读表跨批次常驻；资源保护触发即停，不自动重启或重设运行基线。日常 Opt10 新任务的专用基线规则不扩大到其他任务。
- `pnpm stats:scramble` 包含计算后的线上 PG/Release/分片发布，要求运行日常入口即授权本轮统计发布；仅本地用 `stats:scramble:local`，只读计划加 `--plan`。

## 文档维护

专题细则写入对应文档/skill，根文件只保留跨任务约束和必要入口；已有入口能覆盖时不再增加。迁移保留限定条件、例外、日期和替代关系，修复相对链接，不以精简为由删内容或改变授权。
