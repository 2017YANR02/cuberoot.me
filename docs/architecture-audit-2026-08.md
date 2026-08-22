# CubeRoot 架构与仓库规范审计

审计日期：2026-08-21

审计范围：仓库顶层、`core/` workspace、Web、API、Platform、Mobile、小程序、共享包、构建任务、上游同步脚本和已跟踪静态数据。本次只做静态审计，不修改实现，不以单个文件长度代替架构判断。

复审方式：主审后又做了三路独立反方复审，分别专查运行时与迁移切换、package 边界、仓库脚本与发布路径；再由主审逐条回查证据。以下建议因此刻意偏保守：逻辑边界是近期目标，物理目录只是条件成熟后的可选结果。

## 一句话结论

CubeRoot 不是“一坨没有架构的代码”。它是一个已经有清晰运行时、共享能力、测试和部署纪律，但从单 Web 产品快速长成多端平台后，源码边界和仓库物理布局没有完全收口的 monorepo。

更尖锐一点说：

> 功能密度、测试治理和产品完整度已经到了成熟项目的级别，目录命名、依赖方向和少数超大模块却还停在“先把功能做完”的阶段。它不是没有骨架，而是骨架旁边堆了太多仓库、管道和历史行李，外人第一眼确实容易把它看成屎山。

最需要修的不是“再建一个 `webapp/` 文件夹”，而是：

1. 消灭 API 对 Web 应用源码的反向依赖。
2. 把 `@cuberoot/shared` 从混合运行时入口收成真正的跨端边界。
3. 拆分教学 SaaS 等高变更、高耦合巨型模块。
4. 明确 deployable app、共享 library、离线 job、生成数据和上游产物的逻辑归属。
5. 只有路径迁移能带来可量化收益时，才逐个把应用迁到 `apps/`；不要把目录改名当成架构整改本身。

## 总评分

| 维度 | 评分 | 锐评 |
| --- | ---: | --- |
| 产品和运行时分层 | 7/10 | Web、API、统计管道、求解器和多端有明确职责，不是一个进程包打天下。 |
| package 依赖设计 | 6/10 | 总体是应用围绕共享包的健康结构，但 Server、离线 Job 和构建脚本仍有指向 Web 私有实现或资产的暗线。 |
| 跨端复用边界 | 5/10 | 纯算法和协议已经能复用，`shared` 根入口却混入 React、DOM、存储和 HTTP client。 |
| 模块内聚度 | 5/10 | 大量页面和领域代码合理，但少数高频业务文件已明显超过单文件可维护边界。 |
| 测试与防回归 | 8/10 | 测试量、CI ratchet、组件复用守卫和历史清理记录都很强，这是项目最不像屎山的地方。 |
| 仓库物理整洁度 | 4/10 | 源码、59,101 个统计文件、上游构建产物、脚本和本机忽略残留同时出现在根层级，观感和 Git 成本都差。 |
| 综合 | 6/10 | 是一座需要做边界治理的“大房子”，不是该推倒重写的废墟。 |

## 这部分不是屎山

### 1. 主站前后端实际上已经分离

主站 Web 是独立的 Next 应用 `core/packages/client`；业务 API 是独立的 Hono 应用 `core/packages/server`。两者有独立 package、开发命令、构建产物、进程、端口、部署流程和数据职责。Web 经 `apiUrl()` 访问 Hono API，Next 自带的少量 route handler 主要承担 sitemap、静态资源代理和 Web 边缘职责。

因此，朋友所说“前后端没有分离”并不准确。准确表述是：

> 主 Web 与 Hono API 已拥有独立部署产物、进程、端口和数据职责，因此属于运行时前后端分离；但 CI 触发图、构建依赖和文件资产仍未完全解耦，尚不能称为工程依赖完全分离。

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

### P0：API 反向穿透 Web 源码与资产

`core/packages/server/tsconfig.json` 把 `@/*` 映射到 `../client/*`，并为了类型检查 Web 源码给 Node 服务加入 DOM lib。生产代码中至少有以下穿透：

- `server/src/routes/engine_render.ts` 直接导入 Web `/sim` 下的 `World`、SVG exporter 和图片工具。
- `server/src/routes/cube.ts` 从 Web `lib/cube3` 导入 `invertAlg`。
- `server/src/cubeopt/solve-daemon.mjs` 的默认求解模块路径指向 Web `public/cubeopt/cube48opt5.mjs`。即使该功能可由环境变量覆盖、默认未必在线启用，这仍是源码 import 之外的隐藏文件资产耦合。
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
apps/api ──────┴──> 一个经验证的无 UI 窄内核或明确发布的共享构建产物
```

短期先建立守卫，冻结现有例外，禁止新增 `server -> client` import、动态加载和文件路径读取；然后先移动小而纯的 `invertAlg`，再审计服务端渲染所需代码的完整 import closure。现有 `World` 会继续带入具体谜题、DOM、Worker 和 Web alias，并不是现成的 headless core；更现实的方案可能是只抽 API 当前所需谜题的窄 `puzzle-render-core`，而不是预建一个包住整个 `/sim` 的 `sim-core`。新内核的硬门槛是不得包含 `@/`、React、DOM、Worker、CSS 或 Web app 路径。

CubeOpt 模块也应成为 API 自有部署资产或有明确生成、版本和复制契约的共享构建产物，不能继续靠默认路径读取 Web `public/`。这里的验收不能只 grep 静态 import，还要检查动态加载、默认文件路径和静态资产读取。

### P1：离线 Job 和 Mobile 构建也在穿透 Web 私有实现

`core/packages/scramble-stats-build` 至少有 9 个源码文件直接引用 Client 路径，包括 STM solver、多种谜题 solver 和 CubeOpt 资产；其中一个采样构建文件就直接加载十余个 Web solver。该 Job 的 manifest 又未声明对 Client 的依赖，因此 workspace graph 同样看不见真实闭包。

这类复用本身不一定错：统计构建理应和线上求解结果一致。错的是复用入口位于 Web 应用私有目录。风险低于 API 运行时反向依赖，却会让未来任何 `client -> apps/web` 路径迁移变成全仓手术。

Mobile 的 Android 图标生成脚本也直接导入 Web 图标生成器并读取 Web `public/icons`。这是构建期关系，不应与生产运行时依赖同罪处理，但必须二选一：抽出共享品牌资产生成器与规范源，或登记为窄而明确的 build-time 例外。

建议规则是：

- Job 的计算逻辑只能 import 领域 package；尚未抽取前可登记为 Web-owned tooling，但不得伪装成独立 Job。
- Job 可以向 app 生成产物，但输出目录、格式、版本和所有者必须通过显式 artifact contract 声明，不能反向 import app 内部实现。
- 不因看到第二个消费者就预建“万能 solver 包”；先抽当前消费者真正共同需要的最小纯核。

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
3. React 组件、OAuth hook、browser storage 和浏览器 API client 默认回到 Web；迁移期如需兼容，`shared` 只保留带弃用说明的窄 re-export，不把 `shared/browser/*` 建成新的长期杂物层。
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

- 当前产品应用：client、server、mobile、miniprogram；`platform` 目录和部署定义属于已完成迁移后的历史兼容与退役清理范围，不是未来继续建设的新应用。
- 共享库：shared、visualcube、stack-kernel、vendor-sr-puzzlegen。
- 离线任务：alg-build、stats-build、scramble-stats-build、wb-build。

pnpm 视角下它们当然都是 workspace package，但人类语义已经不够清楚。`apps/ + packages/ + jobs/` 比含义模糊的 `webapp/` 更适合作为条件成熟后的候选布局，不过它不是近期必须完成的目标。当前 `packages/client` 虽然命名不理想，技术上仍是合法 workspace package；先用文档、边界守卫和 package manifest 表达所有权，已经能获得大部分收益。

物理迁移会同时触碰 `pnpm-workspace.yaml`、Turbo graph、workflow 的 paths 与 working-directory、Dockerfile、standalone 产物路径、本地 stats/tools 回退路径，以及仓库外的部署项目配置。只有逻辑边界已经解耦、工具链先做到路径可配置，并且迁移收益高于这些风险时，才逐个 app 或 job 迁移。已完成产品迁移的 Platform 不进入 `apps/*` 物理整理任务，也不为它新建 `platform-compat`。

### P1 快速修复项：README 给出的第一条开发命令当前就会失败

根目录没有 `package.json`、`pnpm-workspace.yaml` 或 `pnpm-lock.yaml`，真实 pnpm workspace 在 `core/`；但根 [README.md](../README.md) 的 Local development 直接从 `pnpm install` 开始，没有先进入 `core/`。新人按 README 在仓库根执行，必然得到缺少 package manifest 的错误。

这比“根目录有几个 PS1”更伤项目观感，因为它让最公开的开发入口立即失信。应把 `cd core` 或 PowerShell 的 `Set-Location core` 写进代码块，并让一个最小文档 smoke test 验证 README 中声明的工作目录和 package manifest。它是低风险、应最先修的门面问题。

### P2：根目录 PowerShell 脚本应该收，但先消除“脚本位置就是仓库根”的契约

根目录当前有 7 个 tracked `.ps1`，合计约 1,694 行。好消息是已经存在统一入口 `sync_upstream.ps1`；坏消息是它仍直接调度 6 个根级实现脚本，部分文档也仍指导用户直接运行私有脚本。

长期建议结构：

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
      ...                         # .sync 稳定后再分批迁移
    postprocess/
      blddb.mjs
  data-build/
    ...                           # 现 2x2、pyraminx 数据生成与验证脚本
```

不能直接照这个树 `git mv`。多个脚本把 `$PSScriptRoot` 当仓库根，另一些又硬编码本机绝对路径；现在移动会把输出写到错误目录、找不到 `.sync`，或者只在作者机器上碰巧成功。

最低风险顺序是：

1. 先统一显式 `RepoRoot`，由稳定根入口传入，并断言 `.git`、`core`、`tools`、`ops` 等哨兵路径。
2. 新增真正无副作用的路径校验模式；现有 `-DryRun` 若未同时 `-SkipPull`，仍可能对外部上游执行 stash、pull、stash pop，不能当迁移验收。
3. 单独提交，只移动私有 PS1；根 `sync_upstream.ps1` 长期作为普通 wrapper 保留，并以 `@PSBoundParameters` 转发相同参数。
4. `.sync` 仍先留在原位。运行时库、配置、模板和 Node 后处理器以后按类别分别迁移，每次只改变一个路径维度。

当前未发现 GitHub workflow 直接调用这些根级私有脚本，但仓库 grep 无法证明 Windows 任务计划、桌面快捷方式、PowerShell profile 或个人脚本没有使用旧路径。移动前应审计仓库外入口；有真实调用时，旧名 shim 至少保留一个发布周期。

### P2：大文件很多，但不能按行数机械拆

Client 有大量数据即代码、几何算法、求解器和复杂交互，单纯出现 1,000 行文件不等于架构失败。`place-zh.ts`、puzzle geometry 或求解表与 `teaching_saas.ts` 的风险完全不同。

应该用以下四个信号决定是否拆分：

1. 是否同时承担 UI、状态、I/O、校验和领域规则。
2. 是否是近期高频改动和冲突热点。
3. 是否存在可命名、可独测的稳定子能力。
4. 拆分后依赖方向是否更清楚，而不是新增 `utils.ts` 和参数传递链。

可以建立增量 ratchet：禁止新增超大文件；现有文件 allowlist；只有高变更、高耦合文件进入拆分 backlog。不要制定“一律不超过 300 行”之类会逼出碎片化代码的规则。

## 到底什么应该放 package

package 是稳定的依赖或构建边界，不是“被复用两次的文件夹”。满足以下任一条件才值得建：多个真实消费者需要稳定接口；它有独立发布或生成产物；它需要 WASM、原生编译等特殊工具链；它有与应用不同的运行时或验证生命周期。两个消费者是常见信号，不是硬门槛，`stack-kernel` 这类单消费者但有独立 WASM 构建边界的 package 完全合理。

| 内容 | 推荐归属 |
| --- | --- |
| 单页面使用的组件和逻辑 | 页面附近 `_components/`、`_lib/` |
| 同一 Web 应用多个页面复用 | `apps/web/components`、`hooks`、`lib` |
| 两个以上 app 共用的纯业务规则 | 先放 `shared/<domain>`；具备独立构建和变更边界后再建领域 package |
| API DTO、错误码、枚举、运行时校验 schema | 跟随所属领域；只有稳定的全局契约真实存在时才建通用 `contracts` |
| Web 与 API 共用的无 DOM 引擎 | 完整依赖闭包确认无 UI 后，才建窄 headless package；不要默认搬整个 `World` |
| React DOM 组件和 CSS | 默认留 Web；只有两个相同 React runtime 和设计系统的真实 app 都消费时才建 UI package |
| Web Storage、微信存储、原生文件系统 | 各 app 的 adapter |
| 蓝牙协议和包解析 | domain/shared |
| Web Bluetooth、微信 BLE、Capacitor bridge | 各 app adapter |
| 构建器和数据生成器 | 逻辑上标为 Job 或 Tool；是否物理迁 `jobs/` 取决于路径解耦收益 |
| “常用函数大全” | 不建立万能 utils package |

只在 Web 内复用的东西搬进 workspace package，通常是在增加发布、构建、测试和依赖成本，而不是改善架构。

## 前后端和多端的长期规范：先定规则，后定目录

不建议新增含义泛化的 `webapp/`。当前也不必为了显得规范，立刻把 `packages/client` 改名。若逻辑边界已经稳定，且路径迁移能明确降低工具链或协作成本，候选终局才是：

```text
core/
  apps/                  # 可独立运行或部署的应用
    web/                 # 现 packages/client
    api/                 # 现 packages/server
    mobile/              # 一份 Capacitor app，含 Android 与未来 iOS 原生壳
    miniprogram/         # 微信小程序壳

  packages/              # 稳定依赖、特殊构建或发布边界
    shared/              # 过渡期按领域 subpath 收口
    visualcube/
    stack-kernel/
    vendor-sr-puzzlegen/
    <new-domain-core>/    # 只有满足本文 package 判据后才新增

  jobs/                  # 路径已解耦后才考虑迁移的离线程序
    alg-build/
    stats-build/
    scramble-stats-build/
    wb-build/
```

这张树是候选布局，不是迁移任务单。特别是不要预建 `sim-core`、`timer-core`、`teaching-domain`，也不要把已完成迁移的 Platform 搬进未来 `apps/*`。没有合格依赖闭包或稳定消费者时，空目录和新 package 只会增加样板。

### Platform 已完成迁移，不再列为架构迁移阶段

仓库所有者于 2026-08-21 确认 Platform 已完全迁移。`/org/*`、`/learn/*` 和对应教学 API 的最终归属已经是主站 `packages/client`、`packages/server` 与 PostgreSQL；因此 Platform 既不是待迁移应用，也不是未来新端的共享后端，更不应再花一轮工程做“前后端分离”或移动到 `apps/platform-web`。

`packages/platform`、SQLite 和 uploads 现在只作为历史归档保留；Platform test/deploy workflow 与 systemd unit 已删除，旧域名只返回 410。它们不能反向推导产品迁移尚未完成。

最终删除归档前仍需一张只读清单：

1. 确认页面、API、支付回调、上传和静态 URL 已无活动职责或已有最终去向。
2. 确认 SQLite、uploads、历史凭据和恢复包已有保留或销毁决定，不把删除源码误当成数据迁移。
3. 确认退役发布全绿、旧服务与监听停止后,再由仓库所有者执行可恢复的归档或删除。

在完成这张清理清单前，遗留目录保持原位即可；不要为了目录观感把退役代码搬进长期 `apps/*`。架构图只画当前事实源和当前消费者，历史实现放在迁移记录中。

### iOS 与 Android 是否分别建 app

当前不需要。Capacitor 的合理形态是一份 `apps/mobile` React 应用，内部有 `android/` 和未来 `ios/` 原生壳。平台差异通过 adapter 和 capability 接口处理。

只有满足以下条件时才考虑拆成 `apps/ios` 与 `apps/android`：

- 已确定转为 SwiftUI 与 Kotlin/Compose 两套原生 UI。
- 两端产品流程和发布节奏长期独立。
- 共享 UI 的收益已经低于平台定制成本。

小程序则应保持独立 app，因为它不是 React DOM runtime。跨端共享业务规则、协议、DTO 和状态机，不强行共享页面。

### 多端真正需要统一的是 API 兼容契约

Web 可以和 API 接近同步上线，但 Android、未来 iOS 和小程序不会原子升级；商店审核、用户滞留旧版本和小程序发布节奏都意味着旧客户端会长期存在。当前小程序有构建与检查，不等于已有自动发布工作流，架构方案不能假设所有客户端能同时切换。

因此多端规范的重点不是把目录排整齐，而是：

- API 变更遵循 expand → migrate → contract：先增加向后兼容字段或端点，等各端迁移和观察完成后才删除旧契约。
- DTO 之外还要有运行时 schema、错误码和能力探测；共享 TypeScript 类型不能保护已发布的旧二进制。
- 明确最低支持版本、弃用窗口、客户端版本或 feature capability，并保持旧 token、登录票据和刷新流程在窗口内可用。
- 为 Web、Mobile、小程序分别建立关键鉴权与数据流的契约测试；API 先兼容发布，各端后迁移，最后才清旧字段和旧端点。

### 推荐依赖规则

```text
deployable app 生产源码      -> package
offline job 计算源码         -> package
app A 生产源码               -X-> app B 内部源码
package                     -X-> app
API 生产源码                 -X-> Web 私有源码或 public 资产
runtime-neutral core         -X-> DOM/浏览器存储/平台 API
miniprogram                  -X-> React DOM modules
```

计划提供给 Web、Mobile 和小程序共同使用的服务端权威数据、账号能力和写操作必须 API-first。不能把这类唯一实现藏在 Next Server Action、浏览器 localStorage 或 Platform SQLite 后面，再让其他端抓页面或复制逻辑。纯计算、状态机和记号解析应 package-first，由各端本地复用。

跨 app 的契约测试应逐步迁入明确的 integration suite；构建脚本若确有跨 app 复用需求，应提取公共生成器或登记窄例外。Job 向 app 写生成产物时走显式 artifact contract。守卫要区分生产运行时、离线计算、测试和构建阶段，不能把已声明关系与隐藏反向依赖混为一谈。

## 推荐执行顺序

### 阶段 0：先立边界，不搬目录

- 先修根 README 的工作目录，让公开开发入口与真实 `core/` workspace 一致；这是独立的低风险文档改动。
- 写一页短 ADR，确定 deployable app 生产源码的 `app -> package` 方向、Job artifact contract 和窄例外；规则不依赖目录是否已经叫 `apps/`。
- 同时写明多客户端的 API 兼容、最低版本和弃用策略，后续服务端变更按 expand → migrate → contract 发布。
- 用现有 `ts-morph` 或 dependency graph 脚本加 CI 守卫。
- 分别 allowlist 当前 Server → Client 静态 import、动态加载与资产路径，以及 Job/Mobile 的 build-time 穿透；禁止数量增长，避免用一张模糊白名单永久合法化。
- 禁止新增裸 `@cuberoot/shared` import。
- 为现有超大文件建 ratchet，不把生成数据和 vendored code 算进去。

验收：新增未声明的反向 import 或文件路径耦合会在提交前或 CI 失败，当前行为不变；关键 API 契约至少覆盖一个旧客户端 fixture。

### 阶段 1A：修真实边界漏洞

- 把 `invertAlg` 移入纯领域模块。
- 审计 Server renderer 的完整 import closure，只抽 API 真正需要、且无 `@/`、React、DOM、Worker 和 CSS 的最小 `puzzle-render-core`；若做不到，先保留并缩窄 seam，不强造 `sim-core`。
- 把 CubeOpt 默认模块改为 API 自有部署资产或有版本的共享构建产物。
- 将统计 Job 复用的 solver 逐类提取到窄领域模块，或在抽取前明确标为 Web-owned tooling；Mobile 图标生成器同理处理为共享工具或 build-time 例外。
- Server tsconfig 删除指向整个 client 树的 alias 和 DOM 妥协。

验收：Server 对 Client 的静态 import、动态加载、默认路径和静态资产读取均为 0，server manifest 能完整描述真实依赖；抽出的窄内核通过 Node 环境测试证明无浏览器副作用。

### 阶段 1B：并行拆教学巨型模块

- 按行为不变原则，把 `teaching_saas.ts` 逐个垂直业务 slice 迁移。
- 先迁测试最稳、事务边界最清楚的 slice，不依赖 shared 收口完成。
- 再按变更频率和冲突记录决定是否处理 Sim、Timer、WCA 大页面。

验收：路由装配、领域编排和 SQL 所有权清晰；定向测试仍锁住事务与权限边界。

### 阶段 2A：收口 shared、打包策略和测试所有权

- 根 barrel 冻结并逐步移除 browser-only 导出。
- 合并两份 `WcaPersonPicker` 的消费者到 Web 规范实现。
- Shared 的纯模块测试回到 shared，Server 测试回到 server；跨包契约测试放明确的 integration suite。
- 单独盘点 exports、Turbo 依赖和所有消费者后，再统一 shared 的 source/dist 消费策略。
- 按真实稳定领域拆 package，不追求 package 数量。

验收：标为 runtime-neutral 的 core 不接触 DOM、浏览器存储和平台 API；若未来存在 React UI package，必须显式声明 React runtime，不能冒充 universal。每个可运行 app 和源码库具有与其形态相称的明确验证契约，可能是 build、typecheck、unit 或 smoke，不为满足表面规范制造空测试脚本。

### 阶段 2B：关闭 Platform 文档漂移

- 将 Platform 跟踪文档明确标成“迁移已完成，正文为历史记录”，禁止 AI 从旧的未勾选计划反推当前状态。
- 盘点残留 workflow、服务、SQLite、uploads、回调和域名职责；只记录仍需保留或清理的运维项，不再创建产品迁移 backlog。
- 不把退役清理和 `apps/*` 目录整理放进同一变更。

验收：当前架构文档只把主站 Web、Core API 和 PostgreSQL 列为教学系统运行单元；历史文档不会再把已完成迁移描述成待办。

### 阶段 3A：安全收根目录 PS1

- 先统一显式 `RepoRoot`、路径断言和真正无副作用的路径校验模式。
- 根统一入口负责传参；另用 `-DryRun -SkipPull` 验证现有流程，不把普通 `-DryRun` 误认为无副作用。
- 下一次独立提交只 `git mv` 私有 PS1，根入口不动；`.sync` 再按库、配置和后处理分批迁移。
- 移动前盘点仓库外任务计划、快捷方式和个人脚本，必要时保留旧名 shim 一个发布周期。

验收：从任意工作目录执行路径校验都解析到同一 RepoRoot；移动提交不改同步逻辑，产物路径与移动前一致。

### 阶段 3B：有收益时才逐个整理 app 或 job 目录

- 先让 workspace pattern、workflow paths、working-directory、Dockerfile、standalone 入口和脚本路径可配置或已盘点。
- 检查仓库外部署项目的根目录设置，但不在没有证据时假定其当前值。
- 一次只移动一个 app 或 job，先迁低耦合目标；保持 URL、域名、API、schema 和运行逻辑不变。
- `packages/platform` 不迁入 `apps/*`；其历史清理与 `stats/`、`tools/`、`.sync` 及其他 app 路径迁移分开处理。

验收：每次都是纯路径提交，相关应用的 build/typecheck/smoke 与部署 dry-run 通过；路径迁移没有夹带业务重构。

### 阶段 4：再决定是否拆数据仓

- 先记录 Git 和 CI 实测成本。
- 若 `stats/` 已成为 checkout、存储或发布瓶颈，再设计带版本清单、校验和、影子发布、失败回滚和双写对账的独立数据发布链。
- `tools/` 是公开静态树，BLDDB 等还把路径写入构建结果；只能按可重建且有固定上游版本的子树逐个评估，不能整树搬。

验收：部署和回滚能力不低于现在，主站不依赖开发机临时状态。

## 明确不建议做的事

- 不要推倒重写。现有业务规则、测试和部署知识远比目录美观值钱。
- 不要为了“前后端分离”把每个 Next 服务端能力都改成远程 API。
- 不要创建一个同时放 Web、Mobile、小程序 UI 的万能 `ui` package。
- 不要因为两个文件相似就建 package；先确认它们有相同语义和相同运行时。
- 不要按行数批量切文件，制造几十个无业务名字的 `helpers.ts`。
- 不要先做 `packages/client -> webapp` 的巨大重命名，再假装架构已经改善。
- 不要同时移动 Web、API、Mobile 和 Job；当前 workspace、workflow、容器与发布路径都把位置当契约。
- 不要把整个模拟器 `World` 搬进新 package 后就称为 headless core。
- 不要第一步迁走 `stats/` 和 `tools/`，破坏当前部署与回滚链。
- 不要因遗留 Platform 目录仍存在，就把已经完成的产品迁移重新列为待办。

## 最终评价

朋友的评价抓到了“外观脏”和“少数边界真脏”，但把它概括成“代码就是一坨”过于粗糙。

CubeRoot 的真实状态是：

- 不是前后端没分离，而是运行时已经分离，源码、资产和 CI 依赖还没有完全解耦。
- 不是完全没有复用，而是已经有大量正确复用，同时 `shared` 入口需要从万能箱收口。
- 不是所有大文件都该拆，但教学 API 已经到了必须治理的规模。
- 不是根目录出现 PS1 就不专业，而是它们先要摆脱对脚本位置和本机路径的依赖，再下沉实现、保留稳定入口。
- 不是必须建 `webapp/`；`apps/ + packages/ + jobs/` 只是边界稳定且收益明确后的候选布局。
- 多平台最先要统一的不是页面目录，而是向后兼容的 API、身份、错误码和状态机契约。

一句收尾锐评：

> 这是“治理速度落后于产品增长速度”，不是“没有工程能力”。先修依赖方向和所有权，再整理门牌；否则只是在给屎山换目录名。
