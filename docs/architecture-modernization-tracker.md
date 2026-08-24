# CubeRoot 架构现代化跟踪

最后更新：2026-08-23

Batch 1 取证基线：实施前仓库 `HEAD` 与 `origin/main` 均为 `3c6b7a8b838697e4adfc04156ca5769c3ed8da59`，工作树无未提交改动；本批文档、测试守卫及跟踪文件自身造成的前进不视为基线漂移。每个后续实施批次开始前仍必须重新记录当时的 `HEAD` 和工作树重叠情况。

状态：Platform P0-P8 技术迁移与发布验收已完成；P9 的陈旧测试守卫已修复，Test、Deploy Next、Deploy Core 全绿，线上角色态仍待验收。旧 Platform 运行时保持退役，归档资产观察至少持续至 2026-09-21。Batch 1、2 已提交发布并完成本地、CI、部署与线上 smoke 验收。Batch 3 已完成本地实现、三路独立复审、真实 CubeOpt 制品/daemon smoke 和不含 Client 源码的 Server bundle 隔离路由 smoke：四拼图无头 SVG 已收口到窄共享包，Server 已消除 Client 源码与 public 资产读取，CubeOpt 已改为 API 自有可校验原子制品，workflow 触发按真实 workspace 依赖闭包收窄；尚未提交发布，因此 BND-02/03/06 与 PKG-02 继续保持进行中，必须等真实 Test、Deploy Next、Deploy Core 和生产 smoke 后才能关闭。BND-04 仍待下一个独立 Codex 会话的项目 Hook 宿主实触发，BND-05 仍待公开 subpath 运行时属性登记。

> 状态校正：2026-08-22 重新打开的产品与数据迁移已按 [Platform 主站完整迁移跟踪](./platform-product-migration-tracker.md) 完成 P0-P8。P9 是迁移完成后的主站产品体验改版，不恢复独立 Platform app，也不改变本架构方案的长期边界。Batch 1 只改善入口、状态和生成物可发现性；后续源码实施仍须刷新依赖基线、完成新的独立复审并取得用户授权。

## 1. 用途

本文是架构现代化工作的唯一执行跟踪入口，用来回答四个问题：

1. 当前真实架构是什么。
2. 哪些决定已经确定，不再反复讨论。
3. 下一批允许做什么，验收条件是什么。
4. 哪些只是候选方向，尚未授权实施。

详细现状、证据与锐评见 [architecture-audit-2026-08.md](./architecture-audit-2026-08.md)。该文档是 2026-08-21 起形成的审计快照；Platform 当前状态以本文和专门迁移跟踪表为准。历史迁移文档只保存历史，不得用其中未勾选事项覆盖本文的当前状态。

## 2. 状态规则

| 状态 | 含义 |
| --- | --- |
| `待审核` | 已写入候选方案，等待独立复审 |
| `待授权` | 审核通过，但尚未得到实施授权 |
| `进行中` | 用户已授权，当前变更批次正在执行 |
| `阻塞` | 有具体且可验证的外部阻塞 |
| `观察中` | 实施和发布已完成，仍处于有明确截止时间的运行或资产观察窗口 |
| `完成` | 验收证据齐全，已记录提交或发布结果 |
| `取消` | 明确决定不做，并记录原因 |

状态只能在有证据时前进。源码存在、单测通过、部署成功和线上切换是不同层级，不得互相替代。

## 3. 已确认的当前事实

| 领域 | 当前事实 | 长期处理 |
| --- | --- | --- |
| 主 Web | `core/packages/client`，Next.js 16 + React 19 | 当前保持原位；是否迁到 `apps/web` 最后决定 |
| API | `core/packages/server`，Hono + PostgreSQL | 运行进程和部署产物已与 Web 分离；源码、资产和部署触发仍需解耦 |
| Mobile | `core/packages/mobile`，React + Capacitor | 当前只有 Android 原生工程；iOS 计划以后在 macOS 上加入并复用同一 React 应用，尚未落库 |
| 小程序 | `core/packages/miniprogram`，独立运行时 | 保持独立 app，不与 React DOM UI 强行共享 |
| Platform | 活跃产品已迁入 `client`、`server`、`shared` 并完成 P0-P8 发布验收；P9 的 Test 与两个部署 workflow 已全绿，线上角色态待验收。`core/packages/platform` 是 workspace 外历史归档，不测试、不部署、不新增产品功能 | 不建 `apps/platform-web`；P9 和旧资产观察独立跟踪，不阻塞无重叠的架构调查与规划 |
| 共享能力 | `shared`、`visualcube`、`stack-kernel` 等已有边界 | 先治理公开入口，再按真实边界信号决定是否拆包 |
| 离线任务 | 多个 builder 目前与应用一起位于 `core/packages` | 逻辑边界稳定后才考虑 `jobs/*` |
| 根脚本 | 根目录有统一入口和多个 PowerShell 实现脚本 | 先盘点调用者，再移动私有实现 |
| 大数据与 fork | `stats/`、`tools/` 与当前静态发布链耦合 | 本轮不迁仓、不重排 |

## 4. 已确定决策

以下决定除非出现新的运行时证据，否则不重新打开：

1. 不新建含义泛化的 `webapp/`。
2. 不把 Web 和 API 拆成两个仓库。
3. Web 与 API 已有独立进程和部署产物，但源码、构建、资产和部署触发仍需继续解耦；无需拆仓重做一次“前后端分离”。
4. Platform P0-P8 迁移已完成，不再作为架构迁移对象；不恢复独立 Platform app。P9 产品体验发布和旧资产观察按专门跟踪表处理。
5. Android 与未来 iOS 默认共用 Mobile 的 React 应用；只有转为两套原生 UI 后才重新评估拆分。
6. 微信小程序保持独立 app。
7. 跨平台优先共享事实、契约和纯规则，不强行共享各平台 UI。
8. 不因为两个文件相似就新建 package。
9. 不为目录观感进行一次性大搬家。
10. 不在本轮移动 `stats/`、`tools/`、`solver/` 或 `reconer/`。

## 5. App、package 和 job 的定义

- App：可独立启动、部署或发布，拥有自己的平台适配和运行时状态。
- Package：稳定的代码、构建或生命周期边界，不等于“复用了两次的目录”。
- Job：离线计算或生成流程，通过明确 artifact contract 输出数据或资产，不拥有在线业务运行时。

pnpm 把三者都称为 workspace package，不代表它们在人类维护语义上属于同一类。

## 6. 目标依赖规则

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

## 7. package 提取门槛

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

## 8. 工作包跟踪

### A. AI 与开发者可发现性

| ID | 任务 | 状态 | 验收 |
| --- | --- | --- | --- |
| DOC-01 | 在根 `AGENTS.md` 顶部增加一屏系统地图 | `完成` | 80 行以内说明路径、职责、事实源、新代码归属、禁止依赖、验证与部署影响；变更后独立复审 PASS |
| DOC-02 | 修正根 README 的真实工作目录和首条命令 | `完成` | 新环境按 README 进入 `core/` 后可执行安装与最小验证，不再从仓库根直接运行 pnpm；变更后独立复审 PASS |
| DOC-03 | 为 client、server、mobile、miniprogram 增加或校准极短局部说明 | `完成` | 每份只写局部差异，不复制根规则；AI 能在目标目录获得正确命令和边界；变更后独立复审 PASS |
| DOC-04 | 建立文档状态约定并标记 Platform 遗留目录 | `完成` | 活跃计划、已完成记录、历史文档和退役说明可被明确区分；归档入口不再把失效命令写成活跃开发入口；变更后独立复审 PASS |
| DOC-05 | 登记生成物 | `进行中` | 已建立 `REFERENCE / PARTIAL` 登记并纠正 PG facts 跨 clone 路径与 stack metadata 伪生成声明；vendored 矩阵、TNoodle i18n generator、migration 数据族 owner 尚未闭环，独立复审结论为 PARTIAL |

### B. 真实依赖边界

| ID | 任务 | 状态 | 验收 |
| --- | --- | --- | --- |
| BND-01 | 生成真实系统依赖基线 | `完成` | 当前登记 319 个精确旧债指纹、335 次出现和 13 条人工契约，覆盖静态 import、动态加载、路径读取、构建复制、非 workspace 原生工具、子进程、大表、环境变量覆盖和部署目标；Batch 3 相对旧基线净消除 7 个身份并经独立逐项复核 |
| BND-02 | 消除 API 对 Web 源码的 import | `进行中` | 本地源码边与 Server bundle 已通过；仅复制 `dist/server.bundle.js` 到不含 Client 源码的隔离目录后，健康检查及 SQ1、Megaminx、Pyraminx、Skewb 四条 iso SVG 路由均返回 200 和真实 SVG；待提交发布、Deploy Core 与生产四拼图路由 smoke 后关闭 |
| BND-03 | 消除 API 对 Web public 的运行时读取 | `进行中` | API 自有 CubeOpt manifest/校验和/原子晋级已用 972,840,960 字节真实表和 wasm/mjs 制品完成 prepare、promote、verify；真实 daemon 就绪并通过 `R` 的 1 HTM 请求；待真实部署制品清单及 `CUBEOPT_SOLVE_ENABLED=1` 的生产 manager 请求后关闭 |
| BND-04 | 按边类型增加跨 app 依赖守卫 | `进行中` | runtime、build、test、artifact 和 subprocess baseline 已进入 CI；任何新增、重复或陈旧基线都会失败，旧债减少必须经过审核并显式刷新 manifest；write adapter 已实测，项目 Hook 仍待下一个独立 Codex 会话宿主实触发 |
| BND-05 | 收口 package 公开 exports | `进行中` | 已冻结 `@cuberoot/shared` 裸根新增并按任意 workspace package 的 `exports` 拦私有 deep import；公开 subpath 运行时属性尚未全部登记，未来无 `exports["."]` 的 package 还须增加裸根拒绝验收 |
| BND-06 | 收窄部署触发边界 | `进行中` | Test 的 push/PR 与 Deploy Core/Next 已从 workspace package.json 依赖递归生成精确路径矩阵，本地契约测试通过，未来新增的直接或传递 workspace 依赖会自动进入闭包；待推送后用真实 workflow run 证明触发与排除两侧 |

### C. 多端 API 与领域契约

| ID | 任务 | 状态 | 验收 |
| --- | --- | --- | --- |
| CTR-01 | 建立 endpoint/transport 级真实消费者矩阵 | `待授权` | 登记生产者、Web、Mobile、小程序、发布节奏和版本要求；“当前未消费”也是有效结论 |
| CTR-02 | 以 `auth/web-session` 建立中性契约 subpath 试点 | `待授权` | 收敛三端重复 ticket、DTO 和 decoder；完整依赖闭包不含 React、DOM、Next、Capacitor、微信 API、Node-only 模块或 axios |
| CTR-03 | 建立运行时 schema 与稳定错误码 | `待授权` | 类型从 schema 推导；迁移期保留旧 `{ error }`，新增稳定 `{ code, message }`，默认只新增可选字段 |
| CTR-04 | 确定已发布客户端支持政策和跨版本 fixture | `待授权` | 先选版本或时间窗口；旧请求被新服务接受，新响应由受支持旧 decoder 真实解析，WebSocket 与离线 schema 也有兼容证据 |
| CTR-05 | 决定是否建立独立 contracts package | `待授权` | 当前默认不建；只有出现独立生命周期、原生代码生成或 shared 无法保持中性时才创建 |
| CTR-06 | 决定是否启用 codegen | `待授权` | 当前默认不启用；只有 Swift/Kotlin、对外 SDK 或 schema 已成唯一事实源时才增加，并配零漂移 CI |

契约发布顺序固定为：服务端先做兼容扩展，客户端逐步采用，支持窗口结束后再删除旧契约。`timer` 与 `smart-cube` 是已有正确共享范本，不重新提取。

### D. 共享逻辑治理

| ID | 任务 | 状态 | 验收 |
| --- | --- | --- | --- |
| PKG-01 | 形成候选模块清单 | `完成` | 每项已列出消费者、边界信号、运行时、依赖闭包、测试和不提取的替代方案；清单见 [`architecture-package-candidates.md`](architecture-package-candidates.md)，独立复审 PASS |
| PKG-02 | 优先提取纯记号、状态、验证或格式化逻辑 | `进行中（仅 Batch 3 最小切片）` | 本地已提取 `shared/alg-transform` 与四拼图窄无头 `puzzle-render-core`，未搬运 DOM、Worker 或交互层；待发布验证后关闭本切片，后续候选仍逐域审核 |
| PKG-03 | UI 共享采用显式例外 | `待授权` | 只有设计系统和交互契约一致时共享 React UI；小程序不套 React DOM 抽象 |

### E. 根目录 PowerShell 脚本

| ID | 任务 | 状态 | 验收 |
| --- | --- | --- | --- |
| PS1-01 | 盘点根脚本调用图和仓库外调用者 | `待授权` | workflow、文档、计划任务、快捷方式、生成标记和脚本互调均有记录；无法核验的外部调用明确标注未知 |
| PS1-02 | 统一 RepoRoot 与无副作用检查模式 | `待授权` | 从任意 cwd 解析到同一仓库；新增 `-ValidateOnly` 或等价模式，不联网、不 pull、不 stash、不生成、不写入 |
| PS1-03 | 冻结并测试公开 CLI 契约 | `待授权` | 记录根入口与各直调脚本的参数、退出码和调用方式；`-Only`、`-SkipPull`、`-DryRun` 均有兼容测试 |
| PS1-04 | 保留根入口并移动私有实现 | `待授权` | 严格在 PS1-01 → 02 → 03 后执行；根入口稳定，shim 原样转发 `@PSBoundParameters` 和显式 RepoRoot |

### F. 可选物理目录整理

| ID | 任务 | 状态 | 验收 |
| --- | --- | --- | --- |
| LYT-01 | 评估 `apps/* + packages/* + jobs/*` 收益 | `待授权` | 有实测搜索、CI、部署或协作收益，不以目录好看作为理由 |
| LYT-02 | 让工具链先做到路径可迁移 | `待授权` | 清点 workspace、Turbo 任务与真实产物、workflow filters/working-directory/sparse checkout/cache、Docker、standalone、运行时资源和外部部署根 |
| LYT-03 | 一次只移动一个 app 或 job | `待授权` | `git mv` 与必要路径配置原子提交，禁止业务逻辑变化；URL、API、schema 和运行逻辑不变 |
| LYT-04 | 验证路径迁移的触发、产物与运行 | `待授权` | 新路径真实触发正确 workflow；两个 Web 部署目标、代表性路由、静态资产和 API 连接均通过 smoke；配置可随提交整体回滚 |

Platform 不进入 F 阶段。

### G. Platform 退役与归档责任：不是产品迁移

| ID | 任务 | 状态 | 验收 |
| --- | --- | --- | --- |
| RET-01 | 建立旧运行责任清册 | `完成` | 已核对流量、写入、登录、API、回调、上传、身份桥、旧运行配置、域名、workflow、service 与恢复路径；仍保留的兼容和恢复资产已进入观察及逐项处置范围，证据见 Platform P8 与迁移记录 |
| RET-02 | 建立数据保管与恢复清册 | `观察中` | SQLite 加密不可变归档、隔离恢复和逐表处置已有证据；明文审计副本、媒体、凭据与最终保留期仍分别管理 |
| RET-03 | 退役独立 runtime、workflow 与 service | `完成` | 独立 test/deploy workflow 和仓库内 service unit 已删除，旧服务停用，旧域名保持 410；不等于永久删除归档 |
| RET-04 | 观察结束后决定旧资产处置 | `待授权` | 至少观察至 2026-09-21；旧目录、远端仓库、SQLite、媒体、旧身份桥凭据、`/etc/cube-platform.env` 等运行配置逐项列清单，由用户单独授权并走可恢复路径 |

G 阶段不再阻塞架构规划。RET-01/03 的完成只代表运行责任已盘点且独立 runtime 已退役；RET-02/04 仍禁止把代码回滚冒充数据恢复，也禁止在观察期结束和用户授权前删除任何旧资产。

## 9. 推荐实施批次

批次 1、2 已完成。用户随后明确要求提交并推送现有改动、继续渐进式重构并使用 Agent 复审，因此批次 3 已授权，基于 `44db0d1da7bc8515fc6221624f0aca6c4b00b0fd` 的干净基线执行；批次 4 至 7 仍按顺序推进，不以本授权扩大 Batch 3 范围。Batch 2 未扩张成业务源码、目录或部署改造。

### 批次 1：文档与入口

范围：DOC-01 至 DOC-05。

特点：不改运行逻辑，不移动目录。先解决 AI 进入仓库时的信息质量。

### 批次 2：依赖基线与机器守卫

范围：BND-01、BND-04、BND-05、PKG-01。

特点：先建立 baseline 和新增违规拦截，不在同一提交大规模修旧债。

约束：项目 PreToolUse Hook 只为新会话中的新增片段提供快速反馈，完整文件和既有绑定关系以 CI 扫描为权威。BND-05 只有在公开 subpath 的运行时属性完成登记后才能标记完成。

### 批次 3：API 与 Web 解耦

范围：BND-02、BND-03、BND-06，以及仅为这三项所必需的最小 PKG-02 切片。

特点：分别处理源码 import、运行时资产和部署触发；每一项都要求 API 在没有 Web 目录时从真实部署产物验证，不借机提取万能 package。

实施前审计结论：BND-02 只抽取 Server 实际使用的 SQ1、Megaminx、Pyraminx、Skewb 四种拼图无头 SVG 边界，完整 Web `World`、DOM、Worker、交互控制与其余拼图继续归 Client；`invertAlg` 保留 cubing.js 的交换子、共轭及非法输入语义并进入 Shared 明确 subpath。BND-03 采用带 manifest、校验和与原子晋级的 API 自有 CubeOpt 资产束，不把大表塞进常规部署。BND-06 必须在前两项真实依赖移除后才收窄，并用代表路径矩阵验证触发与不触发两侧。

### 批次 4：多端契约

范围：CTR-01 至 CTR-06。

特点：消费者矩阵 → `auth/web-session` 试点 → 跨版本 fixture → 再决定独立 package 和 codegen，不一次性重写全部 API。

### 批次 5：其余共享模块

范围：除批次 3 最小切片以外的 PKG 工作包。

特点：一次一个领域，不与业务功能或路径搬迁混合。

### 批次 6：PowerShell 整理

范围：PS1 工作包，严格按 01 → 02 → 03 → 04。

特点：先冻结调用者、路径和 CLI，再移动私有实现；现有 `-DryRun` 不作为无副作用验收。

### 批次 7：可选目录整理

范围：LYT 工作包。

特点：不是默认必做项。前六批已经解决大多数问题时，可以选择取消本批次。

Platform RET 不进入上述实施流水线。RET-01/03 的完成状态来自已单独执行并验收的 Platform 迁移与退役记录；RET-02 的观察和既有退役事实均不授权 RET-04 永久处置旧资产。

## 10. 停止条件

出现以下任一情况，当前批次停止扩大范围：

- 需要同时变更两个以上独立部署单元才能保持可运行。
- 发现未记录的跨 app 运行时文件依赖。
- 需要改变线上 URL、API shape、数据库 schema 或身份语义才能完成路径移动。
- 需要未经约束的双写、整站切换或不可恢复删除。
- API 契约会影响已发布客户端，但支持窗口和跨版本 fixture 尚未确定。
- 当前工作树的目标文件存在其他 AI 或用户的重叠改动。
- 验证只能证明 build 成功，不能证明目标边界成立。

## 11. 每批验收证据

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

## 12. Agent 独立审核记录

| 审核方向 | Reviewer | 状态 | 结论与必须修正项 |
| --- | --- | --- | --- |
| 架构边界与 package 判据 | `architecture_boundary_review` | `历史复验通过` | 仅审核 2026-08-21 的架构方向，不授权当前恢复实施；Platform 前提已被后续证据修正 |
| 多端 API、兼容与生成契约 | `multiclient_contract_review` | `历史复验通过` | 仅审核 2026-08-21 的多端方向；先做消费者矩阵与 `auth/web-session` 试点 |
| 迁移、CI、部署与退役风险 | `migration_risk_review` | `历史复验通过` | 仅审核 2026-08-21 的风险方案；Platform 产品迁移现由独立跟踪表重新审核 |
| Platform 当前状态与归档边界 | `platform_change_audit` | `当前复验通过` | 旧包未恢复；P0-P8 已完成；P9 Test 与部署全绿，线上角色态待验收；保留资产观察边界 |
| Platform 外工作树架构影响 | `worktree_arch_impact` | `当前复验通过` | Platform 外并行改动不影响 Web/API、package、多端、PS1 或部署结论；不要求改变工作包 |
| 跟踪表与当前仓库一致性 | `tracker_consistency_review` | `当前复验通过` | 必须刷新 Platform 状态和事实快照；旧 PASS 不得替代迁移后依赖基线与重新复审 |
| Batch 1 系统地图与边界事实 | `batch1_baseline` | `复审 PASS` | API 独立产物与现存 Web 耦合、活跃 app/package/job、Platform workspace 排除和宽部署触发均已准确表达；无 blocker/major/minor 遗留 |
| Batch 1 README/归档状态 | `batch1_doc_audit` | `复审 PASS` | client/server/mobile/miniprogram 局部入口、中央文档状态和 Platform 退役墓碑与当前仓库一致；DOC-03/04 通过 |
| Batch 1 生成物与 AI 可用性 | `batch1_generated_ai` | `复审 PARTIAL` | pgFacts 跨 clone 生成与 stack_meta 人工 source 重分类通过；vendored 矩阵、TNoodle i18n generator、migration 数据族 owner 仍是 DOC-05 blocker，EventIcon/DeskPet drift 守卫为后续 major |
| Batch 2 依赖扫描与精确旧债基线 | `batch1_baseline` | `复审 PASS` | occurrence 多重集、workspace 动态发现、TS import-equals、路径组合、子进程、schema 和完整 Nemesizer 产物链均有实证；326 个指纹、342 次出现、15 条人工契约通过 |
| Batch 2 package 与多端目录判断 | `batch1_generated_ai` | `复审 PASS` | 不建 `webapp/`、不拆仓、不立即迁 `apps/*`；Clock 为首个条件候选，bicube/sia222 先拆纯核心与 Web loader；当前 blocker 和 major 均为 0 |
| Batch 2 Hook 与 CI 闭环 | `batch1_doc_audit` | `复审 PARTIAL` | 共用扫描器、write adapter、CI 和定向测试通过；当前 Codex 宿主不会热加载新写入的 Hook 配置，因此不能在同一会话宣称项目级实触发完成 |
| Batch 2 项目 Hook 宿主探针 | `batch2_hook_probe` | `待新会话复验` | 同一线程树的独立 Agent 仍未加载新配置，违规探针未被宿主 deny；探针已移入回收站且工作树无残留，下一个独立 Codex 会话必须真实触发后才能关闭 BND-04 |
| Batch 3 Server→Client 源码闭包 | `batch1_baseline` | `实施前 HOLD` | 4 条直接源码边仍在；完整 renderer 闭包含 87 个 Client 文件和 DOM/Worker 分支，必须改为四拼图窄无头边界，不得整体搬运 Web `World` |
| Batch 3 CubeOpt 运行时资产 | `batch1_generated_ai` | `实施前 HOLD` | 当前 daemon 仍默认读取 Web public 与本机大表，且 opt5/opt6 声明漂移；必须建立 API 自有、manifest 驱动、可校验和原子晋级的资产束并完成真实请求 smoke |
| Batch 3 部署触发与 Hook 探针 | `batch2_hook_probe` | `实施前 HOLD` | Deploy Core 需在 BND-02/03 后按真实输入收窄并配路径矩阵；当前新会话 Agent 仍未被项目 Hook 宿主 deny，BND-04 继续保持进行中 |
| Batch 3 共享边界实施后复核 | `review_shared_boundaries` | `本地 PASS` | Server→Client 源码边已清零；Client/Server 复用 `puzzle-render-core/iso-svg`，旧 Client 路径均为薄 re-export；package build、Server bundle、类型检查、Node 四拼图 smoke 与 19 项定向测试通过。通用 `PuzzleImage` 的显式 sr fallback 仍属 Phase 5，不误记为全仓 renderer 已唯一化 |
| Batch 3 CubeOpt 与部署原子性复核 | `review_cubeopt_artifacts` | `本地 PASS，发布待验` | prepare/promote/verify 共用可导入实现，不以测试子进程制造新债；release symlink 原子切换、失败回滚、boot/solve 独立 timeout、严格 smoke 与 fsync 语义通过 23 项定向测试。随后用真实 opt5 大表与 wasm/mjs 制品完成 prepare/promote/verify 和 daemon 求解；尚缺生产部署制品清单与启用状态下的 manager smoke |
| Batch 3 workflow 与 tracker 复核 | `review_workflows_tracker` | `本地 PASS，发布待验` | workflow 契约 6/6、架构定向合计 14/14、边界审计 319/335/13 和 diff-check 通过；Test 两事件、nginx 触发、Platform 排除、workspace 依赖推导与 stack 已按实际输入核对。人工契约的 file+substring 仅作 reviewer evidence，不代替运行证明 |

审核要求：

1. Reviewer 必须用仓库当前证据反驳或确认计划，不能只评价文字。
2. 必须区分“建议优化”和“实施前阻断项”。
3. 不得恢复独立 Platform app；产品能力与数据迁移只按独立跟踪表处理。
4. 不得因追求目录标准化而忽略现有 workflow、构建产物和部署路径。
5. 审核只读，不编辑文件；由主 Agent 统一合并结论。

2026-08-21 的三名 Reviewer 曾确认当时的总体架构路线成立；随后 Platform 大迁移显著改变了依赖图，所以旧 PASS 只保留为历史审查证据，不能直接授权当前实施。2026-08-23 的 Batch 1 先做三路只读初审，再做变更后的定点复审：DOC-01 至 DOC-04 均 PASS，DOC-05 因三类已公开的不可复现缺口保持 PARTIAL。Batch 2 再以当前 workspace、workflow、exports、真实路径和子进程调用重建基线；机器守卫与 package 方案已复审通过，项目 Hook 的宿主级验收因配置不热加载明确留到下一独立会话。Batch 3 实施后再由三路 Agent 分别审核共享源码边界、CubeOpt 制品与原子部署、workflow 与跟踪一致性；当前本地阻断项已清零，但发布、生产功能和 BND-04/05、DOC-05 的保留项不因本地 PASS 提前关闭。

## 13. 变更记录

| 日期 | 变更 | 证据 |
| --- | --- | --- |
| 2026-08-23 | Batch 3 发布前真实制品与隔离产物验收通过；临时制品测试目录已移入回收站 | CubeOpt 真实 972,840,960 字节表加 wasm/mjs 完成 immutable prepare/promote/verify，daemon 返回 `R'`（1 HTM）；仅含 `dist/server.bundle.js` 的隔离目录中 `/v1/health` 与四拼图 iso SVG 均为 200，未读取 Client 源码 |
| 2026-08-23 | Batch 3 本地实现完成并经三路独立复核；保持渐进式交付，未把 SR Phase 5 或 Batch 4-7 混入本提交，也未提前标记发布完成 | 边界审计 319 identities/335 occurrences/13 contracts；workflow 与架构定向测试、四拼图 Node smoke、package/Server bundle、Client/Server typecheck、CubeOpt 23 项定向测试均通过。提交、Test/Deploy 实跑与生产 smoke 仍待执行 |
| 2026-08-23 | 用户明确要求提交并推送现有改动后继续渐进式重构；Batch 3 以 `44db0d1da7bc8515fc6221624f0aca6c4b00b0fd` 为干净基线启动，三路只读审计均给出带前置条件的 HOLD | Server→Client 完整 import 闭包、CubeOpt daemon/资产/部署闭包、Deploy Core/Next 路径与项目 Hook 宿主实触发审计；本行只登记授权与约束，不把实施前 HOLD 记为完成 |
| 2026-08-23 | Batch 2 以 `b52d27a514`、`5bca2cbdac` 提交并发布；建立依赖旧债多重集、JSON Schema、人工产物契约、共用 Hook/CI 扫描器与 package 候选清单，不移动源码、不改业务运行时 | `audit:boundaries` 通过：326 个精确旧债指纹、342 次出现、15 条人工契约；定向 Vitest 3 文件 29 测试、client typecheck、recon ground-truth 4 测试和 diff-check 通过；两路定点复审 PASS。首次 Test `32673128886` 暴露 sparse checkout 未检出 workflow 契约证据，修复后 Test `32673340650`、Deploy Next `32673128910`、Deploy Core `32673128957` 全绿；主页、`/zh/dev/guards`、`/zh/platform`、`/v1/health` 线上 smoke 均为 200，守卫页展示 326/342 基线；Hook 宿主实触发留待新会话 |
| 2026-08-23 | Batch 1 以 `ebf0240cb0`、`dc4f3e8d50` 提交并推送；系统地图、README/局部入口、文档状态、Platform 退役墓碑和生成物登记落地 | 三路变更后复审：DOC-01/02 PASS、DOC-03/04 PASS、DOC-05 PARTIAL；PG facts 实际重建 1/1、定向测试 7/7、client typecheck、LF 与 diff-check 通过；Test `32668704812`、Deploy Next `32668704815`、Deploy Core `32668704776` 全绿；主站、`/zh/platform`、`/v1/health` 线上 smoke 通过 |
| 2026-08-23 | 用户授权 Batch 1；以 `3c6b7a8b838697e4adfc04156ca5769c3ed8da59` 为干净基线开始系统地图、README、文档状态、Platform 墓碑和生成物登记 | `batch1_baseline`、`batch1_doc_audit`、`batch1_generated_ai` 三路只读初审 |
| 2026-08-23 | Platform P0-P8 完成发布验收后解除旧的全局阻塞；P9 产品体验待发布，旧资产继续观察；架构实施恢复为待授权 | `platform-product-migration-tracker.md`、workspace/workflow/旧 runtime 只读核对；三路当前审核 |
| 2026-08-22 | 因旧 Platform 非空业务数据和未迁产品能力被重新确认，暂停架构源码改造并改由独立跟踪表先行 | SQLite、旧路由与主站路由只读盘点；`platform-product-migration-tracker.md` |
| 2026-08-21 | 建立跟踪文档；当时确认 Platform 不属于未来独立 app 或 `apps/*` 计划 | 历史决定仍禁止恢复独立前端；“产品迁移完成”部分已于 2026-08-22 被新证据修正 |
| 2026-08-21 | 合并三路独立复审；校正 Mobile/iOS 事实、package 门槛、边类型、契约试点、PS1 顺序、部署 smoke 与 Platform 遗留责任边界 | 当前 package/workflow/脚本/跨 app 依赖的只读抽查；Reviewer 记录见第 12 节 |
| 2026-08-21 | 三路 Reviewer 对修订稿完成第二轮复验，结果均为 `PASS` | Reviewer 最终回执；本轮未授权任何实施改造 |
