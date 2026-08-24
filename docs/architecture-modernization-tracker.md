# CubeRoot 架构现代化跟踪

最后更新：2026-08-24

Batch 1 取证基线：实施前仓库 `HEAD` 与 `origin/main` 均为 `3c6b7a8b838697e4adfc04156ca5769c3ed8da59`，工作树无未提交改动；本批文档、测试守卫及跟踪文件自身造成的前进不视为基线漂移。每个后续实施批次开始前仍必须重新记录当时的 `HEAD` 和工作树重叠情况。

状态：Platform P0-P8 技术迁移与发布验收已完成；P9 的陈旧测试守卫已修复，Test、Deploy Next、Deploy Core 全绿，线上角色态仍待验收。旧 Platform 运行时保持退役，归档资产观察至少持续至 2026-09-21。Batch 1、2 已提交发布并完成本地、CI、部署与线上 smoke 验收。Batch 3 在两次生产前置校验安全暴露并修正 store provision 与 opt5/opt6 假设后，最终修正 `6756c599a1` 已由 Test `32692270145`、Deploy Next `32692270141`、Deploy Core `32692270167` 全绿发布。生产部署确认 `cubeopt-opt6-legacy-runtime-v1` 制品、启用态 manager 加载与 `R → R'`（1 HTM）真实请求通过，API 健康、启用/配置状态及 SQ1、Megaminx、Pyraminx、Skewb 四条 iso SVG 公网 smoke 均为 200；因此 BND-02、BND-03、BND-04、BND-06 和 Batch 3 的 PKG-02 最小切片已关闭。BND-04 的共用 AST 检测器置于写入钩子链首后，当前 Codex 宿主已真实拒绝违规跨 app import 且探针未落盘；BND-05 仍待公开 subpath 运行时属性登记。Batch 4 的 `auth/web-session` 中性契约试点、小程序真实构建依赖图和首次微信用户空昵称兼容已随 `ba22fd81e1` 发布；Test `32697884591`、Deploy Next `32697884578`、Deploy Core `32697884597` 全部成功，API 健康、缺失 WCA token、畸形票据、未登录取票和 Web 回调壳安全 smoke 均符合预期，CTR-02 已关闭。真实账号登录成功链路没有用生产凭据手工执行，其 producer/consumer 正向路径由可执行 route/session fixture 证明；CTR-03 的稳定错误码仍按后续兼容切片推进。Batch 5 的 Clock 窄切片已随 `1db7804111` 发布；隔离干净工作树、本地门槛与三路独立复核通过，Test `32710563280`、Deploy Next `32710563234`、Deploy Core `32710563241` 全部成功，API 健康及中英文 `/sim` 公网 smoke 为 200 且无模块解析错误，本切片已关闭。Batch 6 的根 PowerShell 治理已随 `b02005a50e` 发布；三路终审、本地与 Linux 合同、Test、Deploy Next、静态工具同步及五条公网 smoke 全绿，PS1-01 至 PS1-04 已关闭。

> BND-04 证据校正：仅把架构守卫移到链首仍会被多文件 patch 的逐文件一般守卫拖入 30 秒超时。最终实现先把同一 patch 的全部 writes 一次性交给架构检测器，再执行一般守卫；末尾才出现违规的真实五文件探针约 6 秒内被 deny，五文件均未落盘。
>
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
| `排队中` | 用户已授权，但必须等待前序批次验收或本批新鲜审计 |
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
| BND-01 | 生成真实系统依赖基线 | `完成` | 当前登记 314 个精确旧债指纹、330 次出现和 13 条人工契约，覆盖静态 import、动态加载、路径读取、构建复制、非 workspace 原生工具、子进程、大表、环境变量覆盖和部署目标；Batch 3 相对旧基线净消除 7 个身份，Batch 5 Clock 再消除 2 个跨 app 私有路径身份，本次统一转动记号演示再消除 3 个 Shared 裸根类型导入身份，均经精确守卫复核 |
| BND-02 | 消除 API 对 Web 源码的 import | `完成` | Server→Client 源码边清零，隔离 bundle 已证明不需要 Client 目录；Deploy Core `32692270167` 成功后，生产 API 健康与 SQ1、Megaminx、Pyraminx、Skewb 四条 iso SVG 公网路由均为 200 且返回真实 SVG |
| BND-03 | 消除 API 对 Web public 的运行时读取 | `完成` | API 自有 manifest/校验和/原子晋级支持 opt5/h5 与 opt6/h6；Deploy Core `32692270167` 确认生产 `cubeopt-opt6-legacy-runtime-v1`，启用态 manager 加载后完成 `R → R'`（1 HTM）真实 smoke，公网 readiness 同时确认 enabled/configured |
| BND-04 | 按边类型增加跨 app 依赖守卫 | `完成` | runtime、build、test、artifact 和 subprocess baseline 已进入 CI；任何新增、重复或陈旧基线都会失败。写入 adapter 先把同一 patch 的全部 writes 一次性交给架构检测器，再逐文件执行一般守卫；真实五文件 `tools.apply_patch` 探针在末尾放置跨 app import，宿主约 6 秒内 deny 且五文件均未落盘；CI 全文件扫描仍为权威兜底 |
| BND-05 | 收口 package 公开 exports | `进行中` | 已冻结 `@cuberoot/shared` 裸根新增并按任意 workspace package 的 `exports` 拦私有 deep import；公开 subpath 运行时属性尚未全部登记，未来无 `exports["."]` 的 package 还须增加裸根拒绝验收 |
| BND-06 | 收窄部署触发边界 | `完成` | Test 的 push/PR 与 Deploy Core/Next 由 workspace package.json 依赖递归生成精确路径矩阵；触发/排除矩阵定向测试通过，相关路径推送真实触发并通过 Test `32692270145`、Deploy Next `32692270141`、Deploy Core `32692270167` |

### C. 多端 API 与领域契约

| ID | 任务 | 状态 | 验收 |
| --- | --- | --- | --- |
| CTR-01 | 建立 endpoint/transport 级真实消费者矩阵 | `完成` | 已按 endpoint、认证传输、wire shape、真实消费者和发布节奏登记首个 auth 试点；Mobile 当前没有认证消费者，不造占位代码 |
| CTR-02 | 以 `auth/web-session` 建立中性契约 subpath 试点 | `完成` | Server、Web 与小程序复用显式 `@cuberoot/shared/auth/web-session` 的 ticket、DTO 和 decoder；边界审计验证该 subpath 的静态及动态运行时闭包不含 React、DOM、Next、Capacitor、微信 API、Node-only 模块或 axios。`ba22fd81e1` 的三条工作流全绿，生产边界 smoke 通过 |
| CTR-03 | 建立运行时 schema 与稳定错误码 | `进行中（schema 切片完成）` | wire schema 已接受服务端真实的首次微信用户空昵称，producer/consumer fixture 覆盖 required uid/avatar、opaque token 和 ticket；稳定错误码仍按兼容扩展新增 `{ code, message }`、迁移期保留旧 `{ error }`，不在试点里一次性改完全部 endpoint |
| CTR-04 | 确定已发布客户端支持政策和跨版本 fixture | `完成` | 当前小程序仍在 P0 上线阻塞期，Mobile 也尚无 auth 消费者，因此不存在可声称受支持的历史发布版；首个正式发布版才建立 v1 基线。此后支持当前版与上一正式版且不少于 90 天，服务端遵循 expand → migrate → contract；本批 fixture 锁定旧请求、新响应、额外字段和本地旧会话读取 |
| CTR-05 | 决定是否建立独立 contracts package | `完成` | 当前不建；现有 `@cuberoot/shared` 的显式中性 subpath 足够，只有出现独立生命周期、原生代码生成或 shared 无法保持中性时才重新立项 |
| CTR-06 | 决定是否启用 codegen | `完成` | 当前不启用；没有 Swift/Kotlin 消费者、对外 SDK 或 schema 单一事实源需求，手写窄 schema 与 fixture 的成本和可审查性更合适 |

首个 `auth/web-session` 试点矩阵：

| Endpoint | 传输与 wire shape | 真实消费者 | 发布/兼容要求 |
| --- | --- | --- | --- |
| `GET /v1/auth/me` | Bearer JWT → `WebSessionUserEnvelope` | Web 启动校验、小程序原生会话校验 | 服务端先兼容；required 字段由真实 producer fixture 锁定 |
| `POST /v1/auth/refresh` | Bearer JWT → `WebSession` | Web token 刷新 | Web 与 API 可近同步，但响应仍先过运行时 decoder |
| `POST /v1/auth/exchange` | WCA access token → `WebSession` | Web WCA callback | 必须落地服务端返回的 canonical user，不保留临时 WCA profile |
| `POST /v1/auth/wechat/miniprogram` | 微信一次性 code → `WebSession + isNew` | 小程序原生登录 | 空 `name` 是首次账号的合法 wire 值；额外 `isNew` 不改变基础 session decoder |
| `POST /v1/auth/web-session/ticket` | Bearer JWT → `WebSessionTicketEnvelope` | 小程序打开受控 web-view | 43 字符 base64url 单次 ticket，长期 JWT 不进入 URL |
| `POST /v1/auth/web-session/exchange` | 单次 ticket → `WebSession` | Web 小程序 handoff | ticket 原子核销；Web 只接受完整 canonical session |

邮箱、手机、Google 和国内三方登录仍由 Web 的 `account-api` 消费，并复用同一 `WebSession` 静态类型；带 `ok`、`identities` 的绑定、解绑与资料更新属于扩展 envelope，不伪装成基础 session endpoint。Mobile 当前没有 auth 调用方，等出现真实 Swift/Kotlin 消费者后再增加其 adapter 或 schema 生成，不预建占位层。

契约发布顺序固定为：服务端先做兼容扩展，客户端逐步采用，支持窗口结束后再删除旧契约。小程序首版发布前没有历史版本兼容承诺；首版之后任何删除或收紧都必须记录最低版本/能力信号和观察起止日期，不能只凭源码已升级判定旧端消失。`timer` 与 `smart-cube` 是已有正确共享范本，不重新提取。

### D. 共享逻辑治理

| ID | 任务 | 状态 | 验收 |
| --- | --- | --- | --- |
| PKG-01 | 形成候选模块清单 | `完成` | 每项已列出消费者、边界信号、运行时、依赖闭包、测试和不提取的替代方案；清单见 [`architecture-package-candidates.md`](architecture-package-candidates.md)，独立复审 PASS |
| PKG-02 | 优先提取纯记号、状态、验证或格式化逻辑 | `进行中（Batch 5 Clock 切片已关闭）` | `shared/alg-transform`、四拼图窄无头 `puzzle-render-core` 与只公开 `@cuberoot/puzzle-solvers/clock` 的 Clock 纯核心均已发布；Clock 不搬其他 solver，已通过隔离工作树、独立 oracle、Node/Worker/Browser bundle、analyzer、边界、CI、部署与生产 smoke，后续仍按单域窄切片继续 |
| PKG-03 | UI 共享采用显式例外 | `排队中` | 只有设计系统和交互契约一致时共享 React UI；小程序不套 React DOM 抽象 |

### E. 根目录 PowerShell 脚本

| ID | 任务 | 状态 | 验收 |
| --- | --- | --- | --- |
| PS1-01 | 盘点根脚本调用图和仓库外调用者 | `完成` | 7 个脚本、互调、文档、生成标记和仓库外 BLDDB 固定路径已登记；workflow、计划任务、快捷方式与 profile 的当前机器扫描均无调用，无法核验的外部调用保持未知 |
| PS1-02 | 统一 RepoRoot 与无副作用检查模式 | `完成` | 7 个入口均支持显式 `-RepoRoot` 与真正早返回的 `-ValidateOnly`；任意 cwd、默认/显式/旧根参数、非法根和缺失内部依赖均有无副作用实证 |
| PS1-03 | 冻结并测试公开 CLI 契约 | `完成` | 参数名称、类型、顺序、退出码与调用方式已冻结；`Only` 选择及每个子入口收到的 `RepoRoot`、`SkipPull`、`DryRun` 均有逐脚本行为测试 |
| PS1-04 | 保留根入口并移动私有实现 | `完成` | 根目录只保留统一入口与 BLDDB 兼容 shim；7 个私有实现统一进入 `scripts/upstream/`，默认根、显式参数、旧参数和失败退出均由跨平台合同锁定；本地、CI、部署与公网 smoke 均通过 |
| PS1-05 | 迁移仓外 BLDDB 调用并退役兼容 shim | `排队中` | 先把 `D:\cube\blddb` 的固定旧路径调用迁到统一入口并实跑，再删除 `_sync_blddb.ps1`；删除前不得牺牲已确认调用者来换目录观感 |

### F. 可选物理目录整理

| ID | 任务 | 状态 | 验收 |
| --- | --- | --- | --- |
| LYT-01 | 评估 `apps/* + packages/* + jobs/*` 收益 | `排队中` | 有实测搜索、CI、部署或协作收益，不以目录好看作为理由 |
| LYT-02 | 让工具链先做到路径可迁移 | `排队中` | 仅在 LYT-01 证明值得移动后启动；清点 workspace、Turbo 任务与真实产物、workflow filters/working-directory/sparse checkout/cache、Docker、standalone、运行时资源和外部部署根 |
| LYT-03 | 一次只移动一个 app 或 job | `排队中` | 仅在 LYT-01/02 通过后启动；`git mv` 与必要路径配置原子提交，禁止业务逻辑变化；URL、API、schema 和运行逻辑不变 |
| LYT-04 | 验证路径迁移的触发、产物与运行 | `排队中` | 仅在实际路径迁移发生时启动；新路径真实触发正确 workflow，两个 Web 部署目标、代表性路由、静态资产和 API 连接均通过 smoke，配置可随提交整体回滚 |

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

批次 1、2 已完成。用户随后明确要求提交并推送现有改动、继续渐进式重构并使用 Agent 复审；Batch 3 基于 `44db0d1da7bc8515fc6221624f0aca6c4b00b0fd` 的干净基线执行，Batch 4 至 7 的非破坏性审计与实施也已授权，但必须严格顺序推进、每批刷新基线并独立复审，不得用总体授权扩大当前批范围。RET-04 的永久资产处置仍未授权。Batch 2 未扩张成业务源码、目录或部署改造。

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

实施、复核与发布验收均已通过：Shared、Server、Web 和小程序共用显式 `@cuberoot/shared/auth/web-session` subpath；真实 producer、六端点 wire shape、WCA canonical session 覆盖与非法响应 fallback 均由可执行测试锁定。小程序从 esbuild metafile 派生完整输入图，构建状态包含新增 Shared auth 输入并拒绝 virtual 与任意 workspace package 的 `dist/.tmp` 生成目录。独立 Reviewer 复跑 Mini 25 文件 311 测试及真实 build、Client 2 文件 9 测试、Server 3 文件 9 测试、双方 typecheck、Shared build、Node 条件 export、边界审计、LF 与 diff-check，最终为 0 blocker、0 major、0 minor、0 nit。`ba22fd81e1` 的 Test、Deploy Next、Deploy Core 全绿；生产 API 健康与四条无凭据认证边界 smoke 通过，真实账号正向登录由可执行 route/session fixture 覆盖，未使用生产凭据重复手工登录。

### 批次 5：其余共享模块

范围：除批次 3 最小切片以外的 PKG 工作包。

特点：一次一个领域，不与业务功能或路径搬迁混合。

Clock 切片实施基线：2026-08-24 启动时 `HEAD=fc11613b29f2004908f75b6173fe16a6a992a498`、`origin/main=852c6f254952e22ce562a8fcb6d5df6b10f945d7`；恢复实施前本地 `HEAD` 又由并行任务前进到 `d941d80aa1881e3ad68d3e793edb00eb1bb8e49c`，仍未与 Clock 目标文件重叠。工作树另有 Page Notice、notation 等并行任务，必须字面 staging。实施边界只含 Clock 纯核心、13 个直接消费者、两条离线任务旧债、必要的 package/build/test/workflow 契约和陈旧路径说明；不含 bicube、sia222、其他 solver、业务功能、路由或目录标准化。

发布前硬门槛：新 package 只导出 `./clock`，禁止根 barrel 与通配导出；Node 读 `dist/clock.js`，Browser/Next 读 source；干净克隆下 CI、Client build 与离线 Clock 入口必须先构建 package。机器守卫必须同时验证显式 subpath 可导入、裸包根返回 `ERR_PACKAGE_PATH_NOT_EXPORTED`、Node Worker 真实加载、快速 solver/distribution 回归进入常规 CI、Deploy Next 触发且 solver-only 改动不触发 Deploy Core。旧 Client 源文件不留 forwarding shim，TNoodle SVG 公式表与 Sim 有符号动画 delta 保留独立语义，禁止为去重破坏 oracle 或动画契约。

实施与发布证据：Clock 源文件机械迁移到零运行时依赖的新 package，旧 Client 私有路径引用清零；package 快测 11/11、精确 `clock_solver` 独立 TNoodle oracle 18/18、Node 主线程与真实 Worker、Browser esbuild 输入白名单、analyzer 单/双线程及解答输出、Sim 快测、完整 Client typecheck、Knip、LF 与 diff-check 均通过。精确分布校验枚举 5,456,826 个 d≤3 move 元组并逐档去重，与理论状态数精确一致；边界基线从 319/335 降为 317/333，人工契约仍为 13。隔离干净工作树按 CI 顺序重建依赖后复验通过；`1db7804111` 的 Test `32710563280`、Deploy Next `32710563234`、Deploy Core `32710563241` 全部成功，API 健康和中英文 `/sim` 公网 smoke 均为 200 且无 Clock 模块解析错误。未来仅改 solver 源码时 Deploy Next 响应、Deploy Core 不响应；本批因根 lockfile 同步而按预期同时触发两条部署。

### 批次 6：PowerShell 整理

范围：PS1 工作包，严格按 01 → 02 → 03 → 04。

特点：先冻结调用者、路径和 CLI，再移动私有实现；现有 `-DryRun` 不作为无副作用验收。

PS1-01 事实快照（2026-08-24）：根目录共有 7 个 tracked `.ps1`、1,694 行；`sync_upstream.ps1` 是统一人工入口，其余 6 个是可直调实现。仓库内没有 workflow 或 package script 直接调用这些脚本；编排器调用全部 6 个实现，文档仍直调 BLDDB、RubiksSolverDemo 与 Alg-Trainers，生成标记仍写有 BLDDB 和 csTimer scramble 的旧根路径。

| 根脚本 | 当前参数 | 仓库内调用与路径契约 | 默认副作用摘要 |
| --- | --- | --- | --- |
| `sync_upstream.ps1` | `-Only`、`-SkipPull`、`-DryRun` | `ops/contests/README.md` 为规范入口；直接调度其余 6 个脚本 | 默认对外部 clone 执行 stash、pull、stash pop，再运行生成/同步；RecordRanks 可推 fork |
| `_sync_cstimer.ps1` | `-CstimerDir`、`-ProjectDir` | 仅编排器直接调用；`docs/generated-artifacts.md` 登记 | pull、构建并覆盖 `tools/cstimer` 与 Client public 产物 |
| `_sync_cstimer_scramble.ps1` | `-CstimerDir`、`-ProjectDir` | 编排器、生成物文档和 `tools/cstimer-scramble/UPSTREAM.txt` | pull、三方合并并写 `tools/cstimer-scramble` |
| `_sync_RubiksSolverDemo.ps1` | `-UpstreamDir`、`-LocalDir`、`-DryRun` | 编排器、`docs/development.md`；与 Alg-Trainers 共用 `.sync/sync_utils.ps1` | 同步并重写 Solver fork 静态产物；`DryRun` 只抑制仓库写入 |
| `sync_alg_trainers.ps1` | `-UpstreamDir`、`-LocalDir`、`-DryRun` | 编排器、`docs/development.md`；与 Solver 共用 `.sync/sync_utils.ps1` | 同步并重写 Alg-Trainers 静态产物；`DryRun` 只抑制仓库写入 |
| `_sync_blddb.ps1` | `-BlddbDir`、`-ProjectDir`、`-SkipPull`、`-SkipInstall` | 编排器、站内文档、`.sync/blddb_postprocess.mjs`、生成标记；仓库外 `D:\cube\blddb\AGENTS.md` 明确指向旧根路径 | pull/install、临时补丁、build、替换 `tools/blddb`、后处理 |
| `_sync_recordranks.ps1` | `-RecordRanksDir`、`-ProjectDir`、`-SkipPull`、`-DryRun`、`-SkipInstall` | 编排器和生成物文档 | 可 fetch/merge、安装/测试/build、推 fork，并更新部署 SHA；`DryRun` 仍会 fetch |

本机仓库外核查覆盖 221 个计划任务、223 个任务动作、4 个标准桌面/开始菜单根下递归发现的 432 个快捷方式和 2 个现存 PowerShell profile：未发现脚本名调用；`D:\cube` 文本扫描确认 `D:\cube\blddb\AGENTS.md` 是真实的旧根路径说明，因此 `_sync_blddb.ps1` 在迁移时必须保留兼容 shim。未挂载磁盘、其他机器、未纳入扫描的个人脚本和远端手工流程无法由仓库证明，继续标记为未知；六个子脚本的旧参数在 PS1-03 冻结，只有 BLDDB 有证据要求继续保留旧根路径，不为纯假设给其余 5 个实现保留长期 root shim。

PS1-03 前的 CI 事实：Test、Deploy Next、Deploy Core、sync toolkit 与 contest deploy 的 path filter 均不覆盖根 `*.ps1` 或未来 `scripts/upstream/**`；如果只移动文件，可能没有任何 CI 运行。PS1-03 因此先加入脚本 CLI/无副作用合同和 Test 触发路径，PS1-04 才获准移动。

PS1-02 实施证据（2026-08-24）：7 个入口统一解析显式 `RepoRoot`，Solver 与 Alg-Trainers 的旧 `LocalDir`、其余子入口的旧 `ProjectDir` 继续兼容；`ValidateOnly` 在任何 clone、git、安装、构建、临时补丁或产物写入前返回。编排器先统一处理 pull，再对两个 csTimer 子入口显式传 `SkipPull`；RecordRanks 的预览在 merge/push/部署 SHA 写入前返回。native 命令统一检查退出码，stash 仅恢复本轮创建且仍位于栈顶的提交。两套不同路径的有效仓库 fixture 已分别证明默认、显式和旧根参数确实生效，并对两套沙箱做前后 fingerprint。

PS1-03 实施证据（2026-08-24）：`scripts/upstream/tests/upstream-sync-contract.ps1` 以 PowerShell AST 严格冻结 7 个入口的参数名称、类型与顺序，并逐一覆盖现有 legacy/canonical 候选路径、任意 cwd、默认/显式/旧根参数、非法 `RepoRoot`、非法 `Only`、缺失子脚本、真实 git stash guard、native 失败、RecordRanks DryRun、子入口 flag 和编排器逐子脚本转发。Test workflow 已纳入根入口、`.sync/**` 与 `scripts/upstream/**` 触发及 sparse checkout；路径矩阵 7/7、Windows PowerShell 合同和 Linux Alpine PowerShell + git 合同均通过，两个独立 Reviewer 均给出 PS1-04 GO。

PS1-04 实施与发布证据（2026-08-24）：7 个私有实现以 `git mv` 进入 `scripts/upstream/`，canonical 默认根统一为脚本位置向上两级；仓库根仅保留参数兼容的 `sync_upstream.ps1` 与 `_sync_blddb.ps1` 两个 shim，后者继续兼容仓外已确认的旧 `ProjectDir` 调用。Test workflow 以根级 `*.ps1` 捕获任何新增或恢复的根脚本，并 sparse checkout 全部根 PS1，避免目录门禁被绕过；合同同时锁定根脚本精确集合、7 个 canonical 文件、旧私有路径消失、真实 shim 转发、任意 cwd、无副作用 fingerprint 和精确 native 退出码。本地 AST 10/10、Windows 完整合同、Linux PowerShell + git 合同、workflow 路径 7/7 与 diff check 均通过；`b02005a50e` 的 Test `32730444612`、Deploy Next `32730444571`、Sync static toolkit `32730444528` 全部成功，Deploy Core 未被本批路径触发。主域中英文首页、主域中英文 `/sim` 与 Next 直连入口均为 200，响应无模块解析或应用错误标记。三路终审最终均为 GO，PS1-04 关闭；`_sync_blddb.ps1` 的退役单列 PS1-05，以仓外调用迁移和实跑为删除门槛。

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
| Batch 3 首次生产资产迁移修正 | `review_cubeopt_artifacts`、`review_workflows_tracker` | `已发布，假设被生产证伪` | 首次 Deploy Core 在 release 切换前因启用态缺少新 `CUBEOPT_ARTIFACT_DIR` 安全失败，旧版本未被替换。部署期幂等 provision 经共用 prepare/promote/verify 原子登记持久 store；本地 31/31 与完整验证通过后以 `9c5690464b` 重发，但工具把遗留 module/WASM/table 写死为 opt5，未覆盖生产实际 opt6，因此不能再记为“无 major”或发布待验 |
| Batch 3 第二次生产资产迁移修正 | `review_cubeopt_artifacts` | `PASS，已发布验收` | Reviewer 最终结论为 0 blocker/major/minor/nit，并独立复跑 CubeOpt 44/44、Server 318/318、workflow 与架构 14/14、边界审计 319/335/13。`6756c599a1` 的三条工作流全绿；Deploy Core `32692270167` 确认 opt6 bundle、启用态 manager 与 1 HTM 请求，公网健康、readiness 和四拼图 iso SVG smoke 通过 |
| Batch 4 多端契约实施前审计 | `review_shared_boundaries`、`review_workflows_tracker` | `试点可实施` | 首个共享边界只覆盖 Server、Web 与小程序的 `auth/web-session`；Mobile 当前没有认证消费者，不建占位层，不新建万能 contracts package，不启用 codegen。审计确认首次微信用户的服务端真实 `name: ""` 会被小程序 decoder 错拒为 502，且小程序构建 fingerprint/watch 手工枚举 shared/smart_cube 会漏掉新增 auth 依赖；实施必须补 producer/consumer fixture，并由 esbuild resolved graph/metafile 派生构建依赖 |
| Batch 4 多端契约最终复核 | `batch4_final_review` | `PASS，已发布验收` | 初审先阻断伪造跨包路径 fixture 和 WCA callback 源码字符串自证；修正后真实 Hono `/auth/exchange`、Web decoder/`applySession`/localStorage fallback、首次微信 producer、小程序 resolved graph 与 freshness 均有可执行证据。Reviewer 最终结论为 0 blocker/major/minor/nit；`ba22fd81e1` 的三条工作流与生产边界 smoke 全绿，CTR-02 关闭，CTR-03 稳定错误码与 BND-05 不提前关闭 |
| Batch 5 Clock 边界与复用判据 | `batch5_clock_boundary_audit` | `GO，已发布验收` | 13 个直接消费者已统一到唯一 `./clock` 公开边界，旧路径引用与重复定义清零；package 仍为零 import 的运行时中性纯 TypeScript，TNoodle 独立公式 oracle 和 Sim 有符号动画语义未被错误合并；`1db7804111` 发布后中英文 `/sim` smoke 通过 |
| Batch 5 Clock 构建、导出与发布矩阵 | `batch5_clock_build_release_audit` | `GO，已发布验收` | Node `dist`、Browser/Next source、裸根拒绝、根 lock、PS1 预构建和 Test/Deploy 路径矩阵闭环；隔离工作树按干净 CI 顺序复验通过，Test `32710563280`、Deploy Next `32710563234`、Deploy Core `32710563241` 全部成功 |
| Batch 5 Clock 测试与运行时证明 | `batch5_clock_test_audit` | `GO，已发布验收` | 初审发现常规 CI 缺独立 oracle 后已阻断发布；精确加入 `test:solvers clock_solver` 并由 workflow 契约锁定，独立复跑 package/workflow 10/10 和 oracle 18/18 后转 GO；真实 Test 全绿，Browser Web Worker 不是当前消费者，不为测试制造假依赖 |
| Batch 6 根脚本职责与复用点 | `batch6_ps1_inventory_audit` | `PS1-01 PASS，移动 HOLD` | 7 个脚本与 `.sync/sync_utils.ps1` 均 AST 通过；脚本应进 `scripts/upstream` 而非 package，两个 csTimer 职责不同且不应强并；RepoRoot、ValidateOnly、CLI 测试完成前不得移动 |
| Batch 6 仓内外调用与发布触发 | `batch6_ps1_callers_audit` | `PS1-01 PASS，移动 HOLD` | 当前机器计划任务、快捷方式、profile 均无命中，只有 BLDDB 仓外文档确认依赖旧绝对路径；其他外部调用保持未知。现有 workflow 不覆盖根脚本或未来目录，PS1-03 必须补路径触发和契约测试 |
| Batch 6 CLI、副作用、拓扑与文档终审 | `batch6_ps1_cli_audit` | `GO PS1-04，0 Blocker / 0 Major / 0 Minor` | 根精确 2 个 shim、canonical 精确 7 个；两层 RepoRoot、`.sync` bootstrap、任意 cwd、BLDDB legacy、native 退出码、文档和 tracker 均一致。终审提出的 `.sync` 旧“根目录脚本”注释已修正 |
| Batch 6 CLI 契约与提交面终审 | `batch6_review_cli` | `GO PS1-04，0 Blocker / 0 Major / 0 Minor` | 参数顺序、三种根模式、真实 `pwsh -File`、子入口 flag 与编排转发通过；终审发现两个 shim 未入 index 后先阻断，显式纳入提交并再次完成 Windows 合同和 7/7 路径复验后转 GO |
| Batch 6 测试与 workflow 终审 | `batch6_review_tests` | `GO PS1-04，0 Blocker / 0 Major` | 先阻断全局 flag 子串、同值 root fixture、根脚本白名单触发和弱退出码断言；修为真实行为、双仓库、根级 `*.ps1` 触发、`/*.ps1` sparse 与精确“退出码 23”后，Windows、Linux 只读合同及路径矩阵 7/7 均通过 |
| Batch 7 BND-04 宿主探针 | `root`、`batch6_review_cli` | `GO，0 Blocker / 0 Major / 0 Minor` | 首次真实探针因逐文件串行一般守卫先耗尽 30 秒而 fail-open；修复后同一 patch 的全部 writes 先经单次架构扫描，再进入一般守卫。四个普通文件后追加跨 app import 的真实五文件探针约 6 秒内被 `cross-package-alias-import` deny，五文件均不存在；两文件定向测试 26/26、client typecheck、边界审计和 diff-check 通过 |

审核要求：

1. Reviewer 必须用仓库当前证据反驳或确认计划，不能只评价文字。
2. 必须区分“建议优化”和“实施前阻断项”。
3. 不得恢复独立 Platform app；产品能力与数据迁移只按独立跟踪表处理。
4. 不得因追求目录标准化而忽略现有 workflow、构建产物和部署路径。
5. 审核只读，不编辑文件；由主 Agent 统一合并结论。

2026-08-21 的三名 Reviewer 曾确认当时的总体架构路线成立；随后 Platform 大迁移显著改变了依赖图，所以旧 PASS 只保留为历史审查证据，不能直接授权当前实施。2026-08-23 的 Batch 1 先做三路只读初审，再做变更后的定点复审：DOC-01 至 DOC-04 均 PASS，DOC-05 因三类已公开的不可复现缺口保持 PARTIAL。Batch 2 再以当前 workspace、workflow、exports、真实路径和子进程调用重建基线；机器守卫与 package 方案已复审通过，项目 Hook 的宿主级验收因配置不热加载明确留到下一独立会话。Batch 3 实施后由三路 Agent 分别审核共享源码边界、CubeOpt 制品与原子部署、workflow 与跟踪一致性；两次生产前置校验暴露的 store 与 variant 假设均安全修正，最终独立复核与 `6756c599a1` 的三条工作流、生产 manager 及公网路由 smoke 已全部通过。Batch 4 实施后 Reviewer 先后阻断测试伪依赖和源码字符串自证；两项改为真实依赖图与可执行 route/session 回归后最终复核 PASS，`ba22fd81e1` 的三条工作流和生产安全边界 smoke 也已通过。Batch 5 开工前由三名 Reviewer 分别复核纯核心边界、条件导出和 workflow、测试与 Worker 运行证明；实施后测试 Reviewer 阻断了“同模型自证但独立 oracle 未进 CI”的缺口，改为常规 CI 精确执行 `clock_solver` 后三路代码复核均转 GO。`1db7804111` 随后通过隔离工作树、Test、Deploy Next、Deploy Core、API 健康和中英文 `/sim` 公网 smoke，Clock 切片正式关闭。Batch 6 的三路只读审计关闭 PS1-01；PS1-02/03 实施后先后堵住全局 flag 子串和同值 root fixture 两处假绿，PS1-04 终审再发现 shim 未入 index、Test 根脚本白名单和弱退出码断言三处问题。全部修正后，根目录精确双 shim、7 个 canonical 实现、Windows/Linux 只读合同和 workflow 路径矩阵均由三路 Reviewer 最终 GO。BND-04/05 与 DOC-05 的保留项不因 Batch 3/4/5/6 的局部推进而提前关闭。

> Batch 7 校正：上一段末尾“BND-04/05 保留”只适用于 Batch 6 结束时；本次真实多文件宿主探针与独立复核通过后，BND-04 已关闭，BND-05 与 DOC-05 继续保留。

## 13. 变更记录

| 日期 | 变更 | 证据 |
| --- | --- | --- |
| 2026-08-24 | Batch 7 BND-04 宿主级写入守卫关闭 | 首次违规探针在 30 秒后意外落盘，确认逐文件串行一般守卫耗尽超时；改为同一 patch 的全部 writes 先经单次架构扫描后，真实五文件探针在末尾放置违规仍约 6 秒内被 `cross-package-alias-import` deny，五文件均未落盘。两文件定向测试 26/26、client typecheck、边界审计 314/330/13 与 diff-check 通过 |
| 2026-08-24 | Batch 6 PS1-04 完成发布验收，PS1-01 至 PS1-04 关闭 | `b02005a50e`；根目录只保留统一入口和 BLDDB 兼容 shim，7 个私有实现进入 `scripts/upstream/`。三路 Reviewer 最终 GO；Test `32730444612`、Deploy Next `32730444571`、Sync static toolkit `32730444528` 全绿，五条公网 smoke 为 200 且无错误标记；兼容 shim 的有序退役进入 PS1-05 |
| 2026-08-24 | Batch 6 PS1-03 CLI 与 CI 契约关闭，PS1-04 获准按迁移门禁实施 | AST 严格冻结 7 个入口参数面；双仓库锁定三种根模式，编排 probe 逐子脚本锁定 `Only/RepoRoot/SkipPull/DryRun`。Test workflow 路径矩阵 7/7，Windows 与 Linux 完整合同通过；两名独立 Reviewer 最终 GO |
| 2026-08-24 | Batch 6 PS1-02 关闭，统一根解析、无副作用校验与失败退出 | 7 个入口支持 `RepoRoot`/`ValidateOnly`；不同路径的双仓库 fixture 锁定默认、显式与旧根参数，clone/git/install/build/write 均由副作用探针和 fingerprint 守卫；PowerShell AST 9/9 与完整 Windows 合同通过 |
| 2026-08-24 | Batch 6 PS1-01 调用图与仓外调用者调查关闭，PS1-04 继续 HOLD | 7 个根脚本、互调、文档、生成标记、221 个计划任务、223 个任务动作、432 个快捷方式与 2 个 profile 已登记；仅 BLDDB 仓外文档确认固定旧路径。三路 Reviewer 同时确认 RepoRoot、副作用、退出码和 CI 触发缺口必须先在 PS1-02/03 关闭 |
| 2026-08-24 | Batch 5 Clock 窄 package 完成发布验收，本切片关闭 | `1db7804111`；隔离干净工作树复验全绿，Test `32710563280`、Deploy Next `32710563234`、Deploy Core `32710563241` 均成功。API 健康为 200 且 DB connected，中英文 `/sim` 为 200，响应中无模块解析错误 |
| 2026-08-24 | Batch 5 Clock 窄 package 本地实施完成，三路代码复核转 GO，等待字面提交与发布验收 | 只公开 `@cuberoot/puzzle-solvers/clock`；13 个消费者与两条离线旧债已收口，独立 oracle 明确进入 CI。package 11/11、精确强测 18/18、package/workflow 10/10、analyzer、Sim、typecheck、Knip、分布重算和 317/333/13 边界审计通过；隔离工作树、真实 Test、Deploy Next、Deploy Core 与线上 smoke 尚待执行 |
| 2026-08-24 | Batch 5 以 Clock 为唯一切片恢复实施，跟踪文档先行并完成三路实施前独立审计 | 13 个直接消费者、2 条跨 app 私有路径旧债和纯 TypeScript 零依赖闭包已核对；方案只公开 `@cuberoot/puzzle-solvers/clock`，在干净克隆、快速 CI、Node/Worker/Browser、analyzer、裸包根拒绝和 workflow 矩阵闭环前保持发布 HOLD |
| 2026-08-23 | Batch 4 发布验收完成，关闭 CTR-02；按用户要求在此暂停后续批次 | `ba22fd81e1`；Test `32697884591`、Deploy Next `32697884578`、Deploy Core `32697884597` 均成功。生产 `/v1/health` 为 200 且 DB connected；缺失 WCA token 为 400，畸形 web-session ticket 与未登录取票均为 401/no-store，Web auth callback 壳为 200。正向真实账号登录未使用生产凭据手工执行，由可执行 route/session fixture 覆盖 |
| 2026-08-23 | Batch 4 本地实施与最终独立复核完成，等待提交发布 | Shared `auth/web-session` 中性 subpath、Server/Web/小程序真实 producer/consumer fixture、WCA canonical session 可执行回归和 esbuild resolved graph 构建状态完成；Mini 311/311 与真实 build、Client 9/9、Server 9/9、双方 typecheck、Shared build、Node export、边界审计、LF、diff-check 全绿。Reviewer 为 0 blocker/major/minor/nit |
| 2026-08-23 | Batch 3 最终修正发布验收完成，关闭 BND-02、BND-03、BND-06 与本批 PKG-02 最小切片 | `6756c599a1`；Test `32692270145`、Deploy Next `32692270141`、Deploy Core `32692270167` 均成功。生产识别并登记 `cubeopt-opt6-legacy-runtime-v1`，manager 返回 `R'`（1 HTM）后激活 release；公网 API health、enabled/configured readiness 与四种非三阶 iso SVG 均为 200 |
| 2026-08-23 | Batch 3 第一次迁移修正重发后暴露 opt5 假设错误；第二次修正改为严格支持 opt5/h5 与 opt6/h6，完整本地复验通过，等待最终独立复核与再次发布 | `9c5690464b` 的 Test `32689984414`、Deploy Next `32689984458` 成功；Deploy Core `32689984444` 在 release 切换前识别出生产遗留 module 为 opt6 并安全失败，旧生产 release 未切换。双 variant 修正新增 WASM 内嵌 variant 标记校验，避免改名重哈希伪通过；注册表查找拒绝原型链键名，current/manifest 拒绝符号链接或目录联接。CubeOpt 40/40、Server 全量 318/318、workflow 与架构定向 14/14、边界审计 319/335/13、Client/Server typecheck、bundle 和 diff-check 通过 |
| 2026-08-23 | Batch 3 首次发布暴露 CubeOpt 新 store 尚未 provision；前端部署成功，后端在切换 release 前安全失败。部署期一次性幂等迁移完成独立复核后重发 | 失败点为启用态 verify 缺少 store 参数/环境值；旧生产 release 未切换。`provision-cubeopt-artifact.mjs` 只在部署期读取旧制品路径，复用 prepare/promote/verify，成功后原子写 env；重发前 CubeOpt 定向 31/31、Server 全量 305/305、workflow 6/6、Client/Server typecheck、bundle、边界审计和 diff-check 通过 |
| 2026-08-23 | Batch 4 实施前审计完成，确认窄契约试点和两个必须先修的真实缺口 | `auth/web-session` 复用现有 Shared 显式 subpath，不建新万能 package或 codegen；首次微信用户空昵称需进入 wire schema/fixture，小程序构建 fingerprint/watch 需从 esbuild resolved graph/metafile 派生；Mobile 当前不消费认证契约 |
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
