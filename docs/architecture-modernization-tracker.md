# CubeRoot 架构现代化跟踪

状态：`ACTIVE`。最后核对：2026-10-22。

核对基线：`5e6af29d96fa4a3f2d625900c9071aae562df768` 及本轮本地文档修改。工作树另有 UI、规则内容与求解器研究改动，本轮未改动它们。此次核对配置、入口和专题记录，不代表重新执行历史测试、生产部署或真机验收。

## 1. 当前入口与事实源

本文只维护当前边界、开放事项和证据入口。完整批次及审核记录已移至[历史验收记录](./architecture-modernization-history.md)，历史审计见[2026-08 审计快照](./architecture-audit-2026-08.md)。已关闭问题只有出现新的源码或运行证据时才重开。

| 内容 | 唯一事实源与读取方式 |
| --- | --- |
| 活跃 workspace、包名、职责和命令 | [pnpm workspace](../core/pnpm-workspace.yaml) 与各包 `package.json`；清单复用 [activePackages()](../core/scripts/check-architecture-boundaries.mjs)，单包路径复用 [resolveWorkspacePath()](../core/scripts/resolve-workspace-path.mjs) |
| 独立 Cargo app | [FMC Cargo.toml](../core/apps/fmc-solver/Cargo.toml) 与其专用 workflow；不计入 pnpm 包数量 |
| 依赖与旧债 | [架构基线](../core/architecture-boundaries.json) 与同一个边界扫描器；在 `core/` 执行 `pnpm audit:boundaries`，不从旧文档抄数量 |
| 发布触发与产物 | [workflows](../.github/workflows/) 与 [ops](../ops/)；[现有路径合同](../core/packages/client/tests/workflow-path-contract.test.ts)从 manifest 依赖闭包推导预期范围并校验 workflow，文档不维护第二份路径矩阵 |
| 生成物 | [结构化清册](./generated-artifacts.json) 与[维护说明](./generated-artifacts.md) |
| 文档状态 | [文档索引](./README.md)；源码、schema、manifest、workflow 优先于文字摘要 |

查单包路径可在 `core/` 运行 `node scripts/resolve-workspace-path.mjs @cuberoot/server`。查完整清单可运行：

```bash
node --input-type=module -e 'import { activePackages } from "./scripts/check-architecture-boundaries.mjs"; console.table(activePackages().map(p => ({ name: p.name, path: p.workspacePath, kind: p.cuberoot?.kind })))'
```

此命令直接读取配置，不生成另一份需要手工同步的清单。workflow 的 YAML 仍是实际触发源，依赖闭包合同不等于自动改写 YAML。

## 2. 当前架构边界

| 领域 | 当前事实与边界 |
| --- | --- |
| Web | `core/packages/client` 是唯一 Web 前端，包名 `@cuberoot/client`；尚未迁往 `apps/web` |
| API | `core/apps/api`，包名仍为 `@cuberoot/server`；API→Web 源码依赖、Web public 运行时读取与宽泛部署触发已按 BND-02/03/06 关闭，见下方提交证据。不得把这些历史问题重新写成现存债务 |
| 已安装客户端 | `core/packages/app-ui` 是 Android、iOS、HarmonyOS NEXT、Windows、macOS 的共享 React 产品层；Mobile、Desktop、Harmony 薄宿主通过 capability adapter 提供平台能力；各端构建、设备与发布状态见[路线图](./mobile-app-roadmap.md) |
| 小程序 | `core/apps/miniprogram` 是独立运行时，不引入 React DOM/Next |
| FMC | `core/apps/fmc-solver` 独立构建部署，线上入口保持 `/v1/fmc/*` |
| Platform | 正式能力属于主站，不新建独立产品 app；`core/packages/platform` 是 workspace 外归档。产品缺口与验收以[完整移植跟踪](./platform-completion-tracker.md)为准；旧站临时对照与资产处置见各自专题，不沿用历史“始终 410”描述 |
| 离线任务与资产 | job 归属以 workspace 配置为准；`stats/`、`tools/`、`solver/` 保持各自数据、静态资源和引擎边界 |
| 自动化 | 新入口优先 TypeScript；PowerShell 迁移结果见[专门跟踪表](./powershell-to-typescript-tracker.md)，历史 PS1 验收不是现役命令 |

既定决策继续有效：不拆分 Web/API 仓库，不新建含义泛化的 `webapp/`，不恢复独立 Platform 产品运行时；目录迁移按单元渐进进行，不为目录观感一次搬家。跨端共享须有真实消费者，平台适配留在宿主。

## 3. 当前未完成事项与条件候选

这里只登记未关闭的工作；专题中的状态不再复制为另一份验收账本。存在历史授权不意味着本次文档维护会自动执行代码迁移或发布。

| 事项 | 当前边界 / 下一步 | 权威跟踪 |
| --- | --- | --- |
| LAY2-09 API 目录迁移验收 | 源码已迁移；原专题仍标记“待发布验收”，后续须补对应提交与 workflow 证据，本轮不据目录存在关闭 | [目录迁移方案](./core-workspace-layout-migration-plan.md) |
| LAY2-10 Web 目录迁移 | 路径仍为 `core/packages/client`；原计划为“已授权，待前置”，继续前刷新基线并核对仓外 Web 配置与发布窗口 | [目录迁移方案](./core-workspace-layout-migration-plan.md) |
| LAY2-11 旧路径兼容清理 | 等 Web 迁移及发布合同验收后再清理，不能因看到旧路径就直接删除兼容项 | 同上 |
| LAY2-12 Web/API npm 身份改名 | 保持 `@cuberoot/client` / `@cuberoot/server`，与物理迁移分批实施 | 同上 |
| Platform 产品与人工验收 | 后续缺口按完整移植跟踪逐项处理；旧 P0-P8 技术验收不能代表完整产品验收 | [完整移植跟踪](./platform-completion-tracker.md) |
| 五端设备、签名和发布 | 按平台分别保留证据，不能拿一个平台通过替代其他平台 | [App 路线图](./mobile-app-roadmap.md) |
| 旧资产与仓库处置 | 按清册保管，仓库删除仍由所有者执行 | [数据处置清册](./platform-data-disposition-ledger.md) |
| 进一步提取共享模块 | 条件候选，不是待执行队列：新增真实消费者、旧债阻塞独立运行或用户指定领域时重新核对 | [候选历史快照与重开门槛](./architecture-package-candidates.md) |

## 4. 已关闭事项的证据入口

下表描述既有关闭证据，不代表本轮重新发布或复验。完整日志、失败修正和验收限制保留在历史记录中。

| 事项 | 提交 / 证据 | 后续维护边界 |
| --- | --- | --- |
| BND-02 API→Web 源码依赖、BND-03 Web public 运行时读取、BND-06 部署触发 | 提交 `6756c599a1`；[历史 Batch 3](./architecture-modernization-history.md#批次-3api-与-web-解耦)含 Test / Deploy Next / Deploy Core 运行编号及启用态 smoke | 用当前依赖扫描、API 资产合同与 workflow 判定是否回归 |
| 中性认证契约试点 | 提交 `ba22fd81e1`；[历史 Batch 4](./architecture-modernization-history.md#批次-4多端契约) | 试点关闭不等于全部 API 已迁移，也不证明今天的真实登录链路 |
| Clock 共享核心 | 提交 `1db7804111`；[历史 Batch 5](./architecture-modernization-history.md#批次-5其余共享模块) | 复用公开出口，其他 solver 按真实消费者逐域判断 |
| 文档入口、边界守卫、公开 exports、生成物清册、退役责任 | [原工作包逐项验收](./architecture-modernization-history.md#8-工作包跟踪)及[历史变更记录](./architecture-modernization-history.md#13-变更记录) | 历史包数量与基线数量只代表验收时点；现值从配置读取 |

## 5. 维护规则

- 架构诊断先记录检查日期、提交 SHA、相关未提交修改和具体源码/配置路径；旧审计只能作为线索，提出“仍有问题”前必须核对当前实现。
- 入口文档只保留短系统地图、稳定约束和权威链接，不重复包总数、完整部署路径列表及各平台验收状态。
- 修改路径、package 身份、运行时边界或 workflow 时，同批更新对应当前入口；完成事项从开放清单移出，验收追加到历史记录并保留提交、验证范围与未验证项。
- 本地实现、验证、提交、推送、CI、部署、真机及人工验收分别记录；没有证据的阶段写“未验证”，不由其他阶段代替。
- 不改写历史验收数字。历史结论失效时在当前入口说明替代关系，保留原始证据。
- 仍遵守根 AGENTS.md 的当前任务范围与发布授权；历史批次中的 worktree、审批或并行审查安排不是本轮默认流程。

## 6. App、package 和 job 的定义

- App：可独立启动、部署或发布，拥有自己的平台适配和运行时状态。
- Package：稳定的代码、构建或生命周期边界，不等于“复用了两次的目录”。
- Job：离线计算或生成流程，通过明确 artifact contract 输出数据或资产，不拥有在线业务运行时。

pnpm 把三者都称为 workspace package，不代表它们在人类维护语义上属于同一类。

## 7. 目标依赖规则

允许的长期方向：

```text
app / job ─────> 与自身运行时兼容、公开边界明确的 package

跨 Web、Mobile、小程序、API 或 job 共享的核心 ──> runtime-neutral package
```

生产运行时源码禁止的长期方向：

```text
package ─X─> app
app A   ─X─> app B 源码
API     ─X─> Web 源码或 Web public
小程序  ─X─> React DOM / Next 模块
```

依赖守卫必须先区分以下边类型，不得把所有路径引用当成同一种违规：

| 边类型 | 规则 |
| --- | --- |
| 生产运行时源码 | App 只能依赖与自身运行时兼容、公开边界明确的 package，禁止未声明的 app 反向依赖；跨运行时核心必须保持中性 |
| 构建期工具 | 临时跨 app 关系必须登记 owner、输入、输出和替代计划，不得伪装成生产依赖 |
| 测试与集成 | 只允许验证明确契约；测试不得成为长期复用另一 app 私有实现的入口 |
| 生成物 | 必须登记 source、output、生成命令、schema/version 和 drift check |
| 运行时文件或子进程 | 必须登记部署所有者、版本、环境变量覆盖、真实产物位置和启用后的 smoke |

构建子进程按实际入口区分：包顶层 `scripts/` 中由本包 `package.json` 的 `build` / `build:*` 直接以 `node` 或 `tsx` 启动的 CLI，以该声明作为构建期契约，不要求运行时子进程登记；生产代码不得导入该 CLI。此规则不豁免整个 scripts、测试或 job 目录，跨包源码和文件依赖检查保持。测试中的纯路径字符串是样本数据；实际 import、路径构造、文件或进程调用仍建立依赖边。2026-10-22 删除了 10 条此类误报基线，当前为 192 个指纹、206 次出现及 34 条人工契约。

允许共享的内容：

- 请求、响应、错误码和严格 schema。
- 纯领域状态机、验证规则和数据转换。
- 与运行时无关的魔方记号、状态和计算逻辑。
- 权威静态数据及平台侧 adapter。

默认不共享的内容：

- Next 页面、布局和导航。
- Capacitor 设备接入。
- 微信登录、微信组件和小程序存储。
- 只因视觉相似而语义不同的 UI。

## 8. package 提取门槛

新 package 必须同时满足：

- 不依赖某个 app 的目录、全局状态或构建产物。
- 有稳定且可命名的领域职责。
- 有明确公开入口，消费者不需要 deep import。
- 能独立验证，例如 fixture、contract test、unit test、build 或 artifact/runtime smoke 至少一种。
- 提取后依赖图更简单，而不是只增加配置文件。

此外至少满足一项边界信号：

- 至少有两个独立应用、任务或运行时消费者。
- 有独立 WASM、原生编译或特殊工具链。
- 有独立生成物、发布或缓存生命周期。
- 有明确且需要机器守卫的运行时隔离要求。

“两个消费者”是最常见信号，不是硬门槛。`stack-kernel` 这类单消费者但拥有独立 WASM 构建边界的 package 是合理例外。不满足以上门槛时，优先在现有领域目录中提取纯模块，不创建新 workspace package。

## 9. 停止条件

出现以下任一情况，当前批次停止扩大范围：

- 需要同时变更两个以上独立部署单元才能保持可运行。
- 发现未记录的跨 app 运行时文件依赖。
- 需要改变线上 URL、API shape、数据库 schema 或身份语义才能完成路径移动。
- 需要未经约束的双写、整站切换或不可恢复删除。
- API 契约会影响已发布客户端，但支持窗口和跨版本 fixture 尚未确定。
- 当前工作树的目标文件存在其他 AI 或用户的重叠改动。
- 验证只能证明 build 成功，不能证明目标边界成立。

## 10. 每批验收证据

每个实施批次至少记录：

- 变更文件的字面清单。
- 修改前后的依赖或目录证据。
- 定向测试、typecheck、build 或 smoke 中与风险相称的结果。
- 未验证项和原因。
- 是否触发部署，以及部署后验证结果。
- workflow 实际触发记录和真实部署产物清单。
- 功能开启状态下的代表性 runtime smoke；按变更面覆盖路由、资产、API 或子进程，不能只测首页或主进程启动。
- 代码、配置和数据三类回滚能力分别说明；没有数据回滚时不得声称“可完整回滚”。
- 提交 SHA；默认不 push。
- 回滚方式。

纯文档、注释和 CSS 按仓库规则不运行 typecheck，但仍运行 `git diff --check`。
