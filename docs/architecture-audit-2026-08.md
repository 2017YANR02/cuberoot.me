# CubeRoot 架构与仓库规范审计

审计日期：2026-08-21

审计范围：仓库顶层、`core/` workspace、Web、API、Platform、Mobile、小程序、共享包、构建任务、上游同步脚本和已跟踪静态数据。本次只做静态审计，不修改实现，不以单个文件长度代替架构判断。

## 一句话结论

CubeRoot 不是“一坨没有架构的代码”。它是一个已经有清晰运行时、共享能力、测试和部署纪律，但从单 Web 产品快速长成多端平台后，源码边界和仓库物理布局没有完全收口的 monorepo。

更尖锐一点说：

> 功能密度、测试治理和产品完整度已经到了成熟项目的级别，目录命名、依赖方向和少数超大模块却还停在“先把功能做完”的阶段。它不是没有骨架，而是骨架旁边堆了太多仓库、管道和历史行李，外人第一眼确实容易把它看成屎山。

最需要修的不是“再建一个 `webapp/` 文件夹”，而是：

1. 消灭 API 对 Web 应用源码的反向依赖。
2. 把 `@cuberoot/shared` 从混合运行时入口收成真正的跨端边界。
3. 拆分教学 SaaS 等高变更、高耦合巨型模块。
4. 明确 deployable app、共享 library、离线 job、生成数据和上游产物的物理归属。
5. 边界稳定以后，再把 `packages/client` 等应用迁到 `apps/`，不要先做纯改名大搬家。

## 总评分

| 维度 | 评分 | 锐评 |
| --- | ---: | --- |
| 产品和运行时分层 | 7/10 | Web、API、统计管道、求解器和多端有明确职责，不是一个进程包打天下。 |
| package 依赖设计 | 6/10 | 总体是应用围绕共享包的健康结构，但存在 `server -> client` 暗线。 |
| 跨端复用边界 | 5/10 | 纯算法和协议已经能复用，`shared` 根入口却混入 React、DOM、存储和 HTTP client。 |
| 模块内聚度 | 5/10 | 大量页面和领域代码合理，但少数高频业务文件已明显超过单文件可维护边界。 |
| 测试与防回归 | 8/10 | 测试量、CI ratchet、组件复用守卫和历史清理记录都很强，这是项目最不像屎山的地方。 |
| 仓库物理整洁度 | 4/10 | 源码、59,101 个统计文件、上游构建产物、脚本和本机忽略残留同时出现在根层级，观感和 Git 成本都差。 |
| 综合 | 6/10 | 是一座需要做边界治理的“大房子”，不是该推倒重写的废墟。 |

## 这部分不是屎山

### 1. 主站前后端实际上已经分离

主站 Web 是独立的 Next 应用 `core/packages/client`；业务 API 是独立的 Hono 应用 `core/packages/server`。两者有独立 package、开发命令、构建产物、进程、端口、部署流程和数据职责。Web 经 `apiUrl()` 访问 Hono API，Next 自带的少量 route handler 主要承担 sitemap、静态资源代理和 Web 边缘职责。

因此，朋友所说“前后端没有分离”并不准确。准确表述是：

> 运行时和部署已经分离，但源码依赖方向还有一处明显穿透。

使用 Next route handler、Server Component 或 Server Action 也不自动等于“前后端没分离”。应判断的是数据所有权、部署边界和依赖方向，而不是仓库里是否同时出现 `.tsx` 与 SQL。

### 2. workspace 总体依赖图是健康的

`client`、`server`、`platform`、`mobile`、`miniprogram` 和多个 builder 都依赖 `@cuberoot/shared`，`visualcube`、`stack-kernel` 和 `vendor-sr-puzzlegen` 也已有独立边界。这是典型的应用围绕共享能力的 hub-and-spoke 结构。

`@cuberoot/visualcube` 是当前最好的 package 范本：有明确职责、有多个真实消费者、有独立构建边界，调用方不需要知道它的内部目录。

### 3. 项目确实在治理重复，而不是放任复制

[cleanup-audit.md](./cleanup-audit.md) 记录了多次有证据的收敛：分布页、求解器页、复盘播放器、WCA 选择器、IP 读取等真实重复被合并；同时也拒绝过仅因“长得像”就强行抽象的 WCA 表格。这种“复用契约，而不是追求零重复”的判断是正确的。

项目现有组件目录、catalog、CI ratchet、hook 和数百个 client 测试，也说明维护规则并非口头约定。真正的屎山通常没有这些主动防回归设施。

### 4. 多端路线已经有正确雏形

Mobile 使用 React、Vite 和 Capacitor，适合由同一份应用代码承载 Android 与未来 iOS；小程序由于 WXML、WXSS、微信登录、BLE 生命周期等运行时差异，单独成 app 是正确的。计时逻辑和智能魔方协议按 subpath 进入共享层，而平台桥接留在各端，这就是应该继续采用的模式。

## 真问题，按优先级排序

### P0：API 反向穿透 Web 源码

`core/packages/server/tsconfig.json` 把 `@/*` 映射到 `../client/*`，并为了类型检查 Web 源码给 Node 服务加入 DOM lib。生产代码中至少有以下穿透：

- `server/src/routes/engine_render.ts` 直接导入 Web `/sim` 下的 `World`、SVG exporter 和图片工具。
- `server/src/routes/cube.ts` 从 Web `lib/cube3` 导入 `invertAlg`。
- `@cuberoot/server` 的 `package.json` 又没有声明对 `@cuberoot/client` 的依赖，package graph 看不见真实关系。

这条路径不是随手乱接，它解决了前后端渲染一致性，也有 headless 防线；但它仍是当前最严重的架构问题：

- Web 内部重构可能让 API 构建失败。
- 浏览器依赖可能沿传递关系进入 Node bundle。
- Server typecheck 被迫引入 DOM 类型，并跟随 `/sim` 相关的 Web 源码依赖子图。
- Turbo 无法正确表达、缓存和排序这条依赖。
- Mobile 和小程序将来无法从 Web 页面目录正常复用这套引擎。

目标依赖应改为：

```text
apps/web ──────┐
apps/api ──────┴──> packages/sim-core ──> 相关纯领域 subpath
```

短期先建立守卫，冻结现有例外，禁止新增 `server -> client` import；然后先移动小而纯的 `invertAlg`，再沿已有 headless seam 抽出 `sim-core` 或 `puzzle-render`。不要一次搬走整个 `/sim`。

### P1 高风险维护债：教学 API 已成为巨型模块

`core/packages/server/src/routes/teaching_saas.ts` 当前约 11,485 行，包含约 99 个路由注册、145 个函数、45 个类型和 301 处 SQL tagged expression。虽然它已经有 repository interface、依赖注入、权限、事务和幂等设计，不是“11,000 行乱写”；但路由、输入解析、鉴权、查询、事务和领域编排全在一个编译单元里，已经超过合理维护边界。

这类文件的问题不是看起来丑，而是：

- 改一个课包规则时需要加载整个教学域的上下文。
- 多人或多 agent 修改时冲突概率极高。
- 测试很难对应到明确所有者。
- 一个循环依赖或通用 helper 很容易继续扩大中心文件。

建议按业务能力垂直拆，而不是按 `controllers/services/utils` 横切成新的杂物层：

```text
server/src/domains/teaching/
  organizations/
  roster/
  packages-and-credit/
  sessions-and-attendance/
  training/
  reports-and-conversations/
  shared/
  routes.ts
```

每个 slice 自己拥有输入校验、repository 操作、事务边界和路由装配；真正跨 slice 的权限、审计、幂等和错误契约才进入 `shared/`。先按现有测试覆盖最稳定的 slice 拆，不要重写业务逻辑。

### P1：`@cuberoot/shared` 的内容大体合理，根入口已经像杂物箱

当前 `@cuberoot/shared` 整个 package 同时包含：

- 纯类型、记号、计时、算法和教学契约，其中不少通过明确 subpath 暴露。
- HTTP API client。
- 使用 `localStorage`、`sessionStorage` 和 `window` 的 OAuth hook。
- React `WcaPersonPicker`、Portal 和 CSS。

其中根 `shared/src/index.ts` 已直接混合导出 HTTP client、OAuth hook、React picker 和一部分纯领域能力；计时与多数记号模块则主要从 subpath 进入。

此外 Web 自己还有另一份 `WcaPersonPicker`，两者都在被消费，已经产生“谁是规范实现”的歧义。`shared` 的 subpath export 又混用“Node 读取 `dist`，默认环境读取 `src`”，不同运行时可能使用不同形态的产物。

这不意味着应该立刻把 `shared` 炸成十几个包。正确顺序是：

1. 禁止新增裸 `@cuberoot/shared` import，只从明确 subpath 进入。
2. 根 barrel 只保留兼容，不再新增导出。
3. React 组件、OAuth hook、browser storage 和浏览器 API client 回到 Web，或暂时归到明确的 `shared/browser/*`。
4. DTO、错误码、运行时 schema、状态机和序列化规则先按领域归入明确 subpath，不先建新的万能 `contracts` 或 `domain`。
5. 把共享模块测试迁回其所有者；当前 client 和 server 测试都存在直接读取另一 app 源码的情况，测试归属也在泄漏。
6. 只有消费者、运行时和变更节奏都稳定以后，才把 `timer-core`、`smart-cube-core`、`teaching-domain` 等拆成独立 package。

### P1：仓库同时扮演源码仓、数据仓和上游产物仓

当前约有 66,604 个 tracked 文件，其中：

| 目录 | tracked 文件 | 工作树体积约值 | 性质 |
| --- | ---: | ---: | --- |
| `stats/` | 59,101 | 1,078 MiB | 生成统计数据 |
| `core/` | 5,746 | 147 MiB | 主要产品源码与资产 |
| `tools/` | 1,205 | 172 MiB | 混合 vendored 产物与自有包装、资产的静态部署树 |

表中 MiB 是当前 tracked 工作树文件体积，不等于压缩后的 Git pack 或实际网络 clone 大小。

`stats/` 一棵树就占 tracked 文件数约 89%。这不是代码质量问题，却会直接造成 clone、索引、diff、搜索、CI checkout 和新人第一印象的问题。顶层再同时出现 solver、reconer、ops、同步脚本和本机 ignored 调试残留，视觉上自然像“一切都堆在根目录”。

不建议第一步就把 `stats/` 搬出仓库。它与当前静态域名、生成 workflow 和部署路径耦合较深，贸然拆分的上线风险远高于收益。应先做三层治理：

1. 在顶层文档中明确标注 `source`、`generated`、`vendored`、`runtime` 四类所有权。
2. 给 `stats/` 加生成清单和“禁止手改”守卫；给 `tools/` 按子树登记 owner、source、update command，只对 generated 或 vendored 子树禁止手改。
3. 实测 Git checkout、CI、增量刷新和存储成本；只有成本确实成为瓶颈，再把统计数据迁到独立数据仓、artifact 存储或专用发布分支。

不要用 Git LFS 机械处理数万个小 JSON，也不要为了根目录好看先破坏现有静态部署链。

### P1：应用、库和离线任务都叫 package

当前 `core/packages/` 同时包含：

- 可部署应用：client、server、platform、mobile、miniprogram。
- 共享库：shared、visualcube、stack-kernel、vendor-sr-puzzlegen。
- 离线任务：alg-build、stats-build、scramble-stats-build、wb-build。

pnpm 视角下它们当然都是 workspace package，但人类语义已经不够清楚。随着 iOS、Android、小程序和更多平台继续增加，建议最终整理为 `apps/ + packages/ + jobs/`。这是真正有意义的目录升级，比新建一个 `webapp/` 更清晰。

### P1 快速修复项：README 给出的第一条开发命令当前就会失败

根目录没有 `package.json`、`pnpm-workspace.yaml` 或 `pnpm-lock.yaml`，真实 pnpm workspace 在 `core/`；但根 [README.md](../README.md) 的 Local development 直接从 `pnpm install` 开始，没有先进入 `core/`。新人按 README 在仓库根执行，必然得到缺少 package manifest 的错误。

这比“根目录有几个 PS1”更伤项目观感，因为它让最公开的开发入口立即失信。应把 `cd core` 或 PowerShell 的 `Set-Location core` 写进代码块，并让一个最小文档 smoke test 验证 README 中声明的工作目录和 package manifest。它是低风险、应最先修的门面问题。

### P2：根目录 PowerShell 脚本应该收，但保留一个入口

根目录当前有 7 个 tracked `.ps1`，合计约 1,694 行。好消息是已经存在统一入口 `sync_upstream.ps1`；坏消息是它仍直接调度 6 个根级实现脚本，部分文档也仍指导用户直接运行私有脚本。

建议结构：

```text
sync_upstream.ps1                 # 根目录唯一入口，做薄 wrapper

scripts/
  upstream/
    sync-all.ps1                  # 现统一编排主体
    sync-cstimer.ps1
    sync-cstimer-scramble.ps1
    sync-rubiks-solver-demo.ps1
    sync-alg-trainers.ps1
    sync-blddb.ps1
    sync-recordranks.ps1
    lib/
      sync-utils.ps1
    config/
      ...                         # 现 .sync 配置和模板
    postprocess/
      blddb.mjs                   # 现 .sync/blddb_postprocess.mjs
  data-build/
    ...                           # 现 2x2、pyraminx 数据生成与验证脚本
```

保留 `sync_upstream.ps1` 的命令和参数，是为了可发现性、日常一键运行和公开入口兼容；私有实现脚本不应继续污染根目录。迁移时检索并更新所有实际引用、相对路径、文档和生成提示。当前未发现 GitHub workflow 直接调用这些根级私有脚本；只有确认仓库外仍有定时任务或快捷方式依赖旧名时，才临时保留旧名 shim。

### P2：大文件很多，但不能按行数机械拆

Client 有大量数据即代码、几何算法、求解器和复杂交互，单纯出现 1,000 行文件不等于架构失败。`place-zh.ts`、puzzle geometry 或求解表与 `teaching_saas.ts` 的风险完全不同。

应该用以下四个信号决定是否拆分：

1. 是否同时承担 UI、状态、I/O、校验和领域规则。
2. 是否是近期高频改动和冲突热点。
3. 是否存在可命名、可独测的稳定子能力。
4. 拆分后依赖方向是否更清楚，而不是新增 `utils.ts` 和参数传递链。

可以建立增量 ratchet：禁止新增超大文件；现有文件 allowlist；只有高变更、高耦合文件进入拆分 backlog。不要制定“一律不超过 300 行”之类会逼出碎片化代码的规则。

## 到底什么应该放 package

package 是稳定的跨应用依赖和构建边界，不是“被复用两次的文件夹”。

| 内容 | 推荐归属 |
| --- | --- |
| 单页面使用的组件和逻辑 | 页面附近 `_components/`、`_lib/` |
| 同一 Web 应用多个页面复用 | `apps/web/components`、`hooks`、`lib` |
| 两个以上 app 共用的纯业务规则 | 先放 `shared/<domain>`；具备独立构建和变更边界后再建领域 package |
| API DTO、错误码、枚举、运行时校验 schema | 跟随所属领域；只有稳定的全局契约真实存在时才建通用 `contracts` |
| Web 与 API 共用的无 DOM 引擎 | 独立 headless package，例如 `sim-core` |
| React DOM 组件和 CSS | 默认留 Web；只有两个相同 React runtime 和设计系统的真实 app 都消费时才建 UI package |
| Web Storage、微信存储、原生文件系统 | 各 app 的 adapter |
| 蓝牙协议和包解析 | domain/shared |
| Web Bluetooth、微信 BLE、Capacitor bridge | 各 app adapter |
| 构建器和数据生成器 | `jobs/` 或 `tools/`，不进 shared |
| “常用函数大全” | 不建立万能 utils package |

只在 Web 内复用的东西搬进 workspace package，通常是在增加发布、构建、测试和依赖成本，而不是改善架构。

## 前后端和多端的长期目标结构

不建议新增泛化的 `webapp/`。如果决定整理，使用 `apps/web`：

```text
core/
  apps/
    web/                 # 现 packages/client，主站 Next
    api/                 # 现 packages/server，Hono + PostgreSQL
    mobile/              # React + Capacitor，内部包含 android/ 和未来 ios/
    miniprogram/         # 微信小程序壳和平台能力
    platform-compat/     # 仍在线的迁移兼容应用；完成全部退役门槛后才移出 apps

  packages/
    shared/              # 过渡期按明确领域 subpath 收口
    teaching-domain/     # 仅在多 app 真实消费并形成稳定边界后拆出
    timer-core/
    smart-cube-core/
    sim-core/            # 无 DOM 的模拟器/服务端渲染内核
    visualcube/
    stack-kernel/
    vendor-sr-puzzlegen/

  jobs/
    alg-build/
    stats-build/
    scramble-stats-build/
    wb-build/

```

`packages/platform` 目前是 Next 全栈应用，这种形式本身没有问题；但现有 [platform-migration.md](./platform-migration.md) 已明确 `/org/*`、`/learn/*` 最终统一进主站，Platform 是迁移来源和历史兼容。因此不要再花一轮工程把它“前后端分离”，也不要把它当未来新端的共享后端。

不过，完成机构和教学 SaaS 迁移不等于整个 Platform 已可退役。它当前仍有独立 workflow，并继续承载 SQLite 上的内容、商店、订单、支付、上传和后台兼容能力。移动到 `legacy/` 或停止部署前，必须逐项决定这些能力是迁入 Web + Hono、保留为独立在线应用，还是明确下线归档；门槛未完成时仍应留在 `apps/`。最终应避免 SQLite Platform 与 Hono 教学域长期形成两个教学事实源。

### iOS 与 Android 是否分别建 app

当前不需要。Capacitor 的合理形态是一份 `apps/mobile` React 应用，内部有 `android/` 和未来 `ios/` 原生壳。平台差异通过 adapter 和 capability 接口处理。

只有满足以下条件时才考虑拆成 `apps/ios` 与 `apps/android`：

- 已确定转为 SwiftUI 与 Kotlin/Compose 两套原生 UI。
- 两端产品流程和发布节奏长期独立。
- 共享 UI 的收益已经低于平台定制成本。

小程序则应保持独立 app，因为它不是 React DOM runtime。跨端共享业务规则、协议、DTO 和状态机，不强行共享页面。

### 推荐依赖规则

```text
apps/* 生产源码         -> packages/*
jobs/*                  -> packages/*
apps/A 生产源码         -X-> apps/B 内部源码
packages/*              -X-> apps/*
api 生产源码            -X-> web/*
runtime-neutral core    -X-> DOM/浏览器存储/平台 API
miniprogram             -X-> React DOM modules
```

计划提供给 Web、Mobile 和小程序共同使用的服务端权威数据、账号能力和写操作必须 API-first。不能把这类唯一实现藏在 Next Server Action、浏览器 localStorage 或 Platform SQLite 后面，再让其他端抓页面或复制逻辑。纯计算、状态机和记号解析应 package-first，由各端本地复用。

跨 app 的契约测试应逐步迁入明确的 integration suite；构建脚本若确有跨 app 复用需求，应提取公共生成器或登记窄例外。守卫只拦 deployable app 的生产源码反向依赖，不能误伤测试和构建阶段的已声明关系。

## 推荐执行顺序

### 阶段 0：先立边界，不搬目录

- 写一页短 ADR，确定 deployable app 生产源码的 `apps -> packages` 方向和窄例外。
- 用现有 `ts-morph` 或 dependency graph 脚本加 CI 守卫。
- 暂时 allowlist 当前 4 条 `server -> client` import，禁止数量增长。
- 禁止新增裸 `@cuberoot/shared` import。
- 为现有超大文件建 ratchet，不把生成数据和 vendored code 算进去。

验收：新增反向 import 会在提交前或 CI 失败，当前行为不变。

### 阶段 1A：修真实边界漏洞

- 把 `invertAlg` 移入纯领域模块。
- 抽取 `sim-core` 或 `puzzle-render`，让 Web 和 API 成为同级消费者。
- Server tsconfig 删除指向整个 client 树的 alias 和 DOM 妥协。

验收：Server 生产代码对 Client 源码 import 为 0，server manifest 能完整描述真实依赖。

### 阶段 1B：并行拆教学巨型模块

- 按行为不变原则，把 `teaching_saas.ts` 逐个垂直业务 slice 迁移。
- 先迁测试最稳、事务边界最清楚的 slice，不依赖 shared 收口完成。
- 再按变更频率和冲突记录决定是否处理 Sim、Timer、WCA 大页面。

验收：路由装配、领域编排和 SQL 所有权清晰；定向测试仍锁住事务与权限边界。

### 阶段 2：收口 shared、打包策略和测试所有权

- 根 barrel 冻结并逐步移除 browser-only 导出。
- 合并两份 `WcaPersonPicker` 的消费者到 Web 规范实现。
- Shared 的纯模块测试回到 shared，Server 测试回到 server；跨包契约测试放明确的 integration suite。
- 单独盘点 exports、Turbo 依赖和所有消费者后，再统一 shared 的 source/dist 消费策略。
- 按真实稳定领域拆 package，不追求 package 数量。

验收：标为 runtime-neutral 的 core 不接触 DOM、浏览器存储和平台 API；若未来存在 React UI package，必须显式声明 React runtime，不能冒充 universal。每个 package 能独立 typecheck/test。

### 阶段 3：整理物理目录

- 把 deployable runtime 迁到 `apps/`，离线程序迁到 `jobs/`。
- 根 PS1 收进 `scripts/upstream/`，保留一个兼容入口。
- Platform 按既定迁移门槛归档或退役。
- 更新 Turbo、workspace、workflow、tsconfig、文档和部署路径。

验收：纯路径迁移与逻辑重构分开提交；所有应用仍能独立 build/typecheck/test。

### 阶段 4：再决定是否拆数据仓

- 先记录 Git 和 CI 实测成本。
- 若 `stats/` 已成为 checkout、存储或发布瓶颈，再设计独立数据发布链。
- `tools/` 的上游产物也只在能保留固定版本、可复现构建和静态回滚时拆出。

验收：部署和回滚能力不低于现在，主站不依赖开发机临时状态。

## 明确不建议做的事

- 不要推倒重写。现有业务规则、测试和部署知识远比目录美观值钱。
- 不要为了“前后端分离”把每个 Next 服务端能力都改成远程 API。
- 不要创建一个同时放 Web、Mobile、小程序 UI 的万能 `ui` package。
- 不要因为两个文件相似就建 package；先确认它们有相同语义和相同运行时。
- 不要按行数批量切文件，制造几十个无业务名字的 `helpers.ts`。
- 不要先做 `packages/client -> webapp` 的巨大重命名，再假装架构已经改善。
- 不要第一步迁走 `stats/` 和 `tools/`，破坏当前部署与回滚链。
- 不要把 Platform 的教学能力继续双向开发；按既定统一计划收口。

## 最终评价

朋友的评价抓到了“外观脏”和“少数边界真脏”，但把它概括成“代码就是一坨”过于粗糙。

CubeRoot 的真实状态是：

- 不是前后端没分离，而是有一条后端穿透 Web 的隐藏依赖。
- 不是完全没有复用，而是已经有大量正确复用，同时 `shared` 入口需要从万能箱收口。
- 不是所有大文件都该拆，但教学 API 已经到了必须治理的规模。
- 不是根目录出现 PS1 就不专业，而是实现脚本应该下沉，只留一个稳定入口。
- 不是必须建 `webapp/`，而是多端时代应该最终采用 `apps/ + packages/ + jobs/`。

一句收尾锐评：

> 这是“治理速度落后于产品增长速度”，不是“没有工程能力”。先修依赖方向和所有权，再整理门牌；否则只是在给屎山换目录名。
