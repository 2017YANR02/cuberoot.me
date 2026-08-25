# Core 工作区目录迁移方案

最后更新：2026-08-25

状态：`待授权`。本文已经建立，但尚未移动任何源码目录。

主执行入口：[架构现代化跟踪](./architecture-modernization-tracker.md)。

## 1. 结论

CubeRoot 采用 `core/apps/* + core/packages/* + core/jobs/*` 的物理分层，但必须渐进迁移，禁止一次搬完。

这次迁移解决的是长期多端开发和 AI 导航时的归属不清，不改变产品功能、运行时、网址、API、数据库、npm package 名称或远端部署目录。它本身不会改善依赖边界；边界改善只能由公开 exports、依赖声明和消除私有源码引用来证明。旧 Platform 归档不在范围内，由仓库所有者自行处理。

这不是所有公司的唯一标准，而是适合当前 CubeRoot 的常见 monorepo 结构：仓库已经真实存在四个 app、六个 library 和四个离线 job，目录应直接表达这三类不同生命周期。

## 2. 为什么重开旧决定

Batch 7 曾基于 14 个 workspace、357 处部署敏感路径匹配和 8 个 workflow，得出“不为目录观感搬家”的结论。该历史结论在当时成立，继续保留。

2026-08-25，仓库所有者增加了两个明确的长期目标：

1. Web、API、Android/iOS 和微信小程序将长期并行发展。
2. 代码结构要方便人和 AI 直接判断“这是产品、共享能力还是离线任务”。

这构成了新的长期收益，但没有消除旧审计发现的迁移风险。因此新决定是：可以改，但只允许可审核、可回滚的渐进迁移。

## 3. 目标目录

```text
core/
├── apps/
│   ├── web/                 # Next.js 主站
│   ├── api/                 # Hono API
│   ├── mobile/              # Capacitor，共用 Android 与未来 iOS
│   └── miniprogram/         # 微信小程序独立运行时
├── packages/
│   ├── shared/
│   ├── puzzle-render-core/
│   ├── puzzle-solvers/
│   ├── stack-kernel/
│   ├── vendor-sr-puzzlegen/
│   ├── visualcube/
│   └── platform/            # workspace 外退役归档；本方案不移动、不删除
└── jobs/
    ├── alg-build/
    ├── scramble-stats-build/
    ├── stats-build/
    └── wb-build/
```

### 精确映射

| 当前路径 | 目标路径 | 类型 | package 名称 |
| --- | --- | --- | --- |
| `core/packages/client` | `core/apps/web` | app | 暂时保留 `@cuberoot/client` |
| `core/packages/server` | `core/apps/api` | app | 暂时保留 `@cuberoot/server` |
| `core/packages/mobile` | `core/apps/mobile` | app | 保留原名 |
| `core/packages/miniprogram` | `core/apps/miniprogram` | app | 保留原名 |
| `core/packages/alg-build` | `core/jobs/alg-build` | job | 保留原名 |
| `core/packages/scramble-stats-build` | `core/jobs/scramble-stats-build` | job | 保留原名 |
| `core/packages/stats-build` | `core/jobs/stats-build` | job | 保留原名 |
| `core/packages/wb-build` | `core/jobs/wb-build` | job | 保留原名 |
| 六个 `kind=library` workspace | 继续留在 `core/packages/*` | package | 不变 |

目录名和 npm package 名不是一回事。本轮不同时把 `@cuberoot/client` 改为 `@cuberoot/web`，也不把 `@cuberoot/server` 改为 `@cuberoot/api`。否则路径、依赖身份和发布配置三种迁移会叠在一起。是否改 package 名，待目录迁移全部稳定后另案评估。

不建含义模糊的 `webapp/`。`apps/web`、`apps/api`、`apps/mobile` 和 `apps/miniprogram` 分别表达四个产品运行时；Android 与未来 iOS 继续共用同一个 Mobile React 应用，小程序不与 React DOM UI 强行合并。

## 4. 不做什么

1. 不拆多个 Git 仓库。
2. 不重写业务代码，不改变 URL、API、数据库、认证或部署拓扑。
3. 不新建万能 UI package；真实出现两个 React app 的稳定共同消费者后再评估。
4. 不移动根目录的 `solver/`、`reconer/`、`tools/`、`stats/`、`ops/`。
5. 不移动、删除或恢复 `core/packages/platform`。
6. 不在目录迁移提交里夹带命名、格式化或业务重构。
7. 不运行正式统计重算；job 只做最小 dry run 和临时输出验证。

## 5. 必须先解决的风险

### 5.1 先支持新旧两种布局

当前 workspace 只发现 `packages/*`。第一批先让工具链同时接受：

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'jobs/*'
  - '!packages/platform'
```

迁移期间新旧目录可以并存，但 14 个活跃 workspace 必须始终各出现一次。lockfile 只让 pnpm 生成，禁止手改 importer。

### 5.2 CI 和部署路径是合同

Next、API、stats、Android 以及 workflow path-contract 都硬编码了旧路径。任何单元移动前，其 workflow 必须先同时接受旧路径和新路径；全部稳定后再单独删除旧 filter。

仓外构建平台的 Root Directory、Build Command 和 Ignored Build Step 也要记录旧值与回切值，不能假设仓库内配置代表全部事实。远端运行目录和服务名保持不变，减少无关风险。

### 5.3 架构守卫不能换目录后失明

架构审计、结构化边界清单和多个写入钩子仍按 `packages/client`、`packages/server` 判断 owner。先建立不依赖物理路径的 workspace registry，以 package name、`cuberoot.kind` 和 root 为身份，再搬源码。

当前 legacy baseline 也把 file/target 写成路径。迁移前必须用 old→new 映射证明现有 313 个 identity、329 个 occurrence 和 13 个 manual contract 在语义上相同或递减，不能用一次盲目的 snapshot 把漏检或新增债务合法化。

迁移后的机器约束：

- `apps/*` 必须声明 `kind=app`。
- `jobs/*` 必须声明 `kind=job`。
- 活跃的 `packages/*` 必须声明 `kind=library`。
- `packages/platform` 只能作为显式排除的 archive。
- app 和 job 只能依赖已声明、已公开且与调用运行时兼容的 library。
- 禁止 library package 反向读取 app 源码。
- 禁止 app 读取另一个 app 的私有源码。
- 禁止 job 读取 app 私有源码。
- 禁止跨 workspace 相对引用和 `src/*` 私有 deep import。
- 跨 workspace import 必须经过公开 exports。
- 源码导入 workspace library 时必须在 importer 的 `package.json` 声明：运行时 import 放 `dependencies`，仅测试或构建使用可放 `devDependencies`。
- `shared` 裸根 import 和 vendored wildcard 只保留有 owner 的既有预算，禁止新增。

守卫改完要真实触发一次违规写入，证明新路径仍会被拒绝。

### 5.4 先拆掉三类错误耦合

不能把旧耦合原样改成更长的相对路径。

| 当前耦合 | 正确处理 | 移动门槛 |
| --- | --- | --- |
| Mobile 调用 Web 的图标生成脚本 | 提取唯一的中性品牌资产生成入口，Web 和 Mobile 共同调用 | 未完成前不移动 Mobile |
| `scramble-stats-build` 动态导入 Web 私有 solver | 将已证明为纯逻辑的 solver core 逐个移入 `puzzle-solvers` 并公开 export | 未完成前不移动该 job |
| Web 测试读取 API 私有源码和 fixture | 纯 API 测试归 API；真正的消费合同使用中性 fixture 或公开契约；不复制测试 | 未分类完成前不移动 API/Web |

`alg-build → API migrations` 是允许的生成物边，只更新生成物清册和目标路径，不伪装成运行时依赖。

## 6. 执行原则

1. 一次只移动一个 app 或 job。
2. 每批只做“移动该单元 + 修复它的路径合同”。
3. 每批一个可独立 `git revert` 的提交，不用 reset、符号链接或 junction 回滚。
4. 每批前记录 HEAD、工作树重叠、目标路径引用和 workflow 基线。
5. 每批先定向验证，再独立审核；只有用户明确要求 push 才发布。
6. 如果 push，当前批的 Test/Deploy 和实际产物全绿后才进入下一批。

## 7. 批次跟踪

| ID | 批次 | 工作 | 状态 | 完成门槛 |
| --- | --- | --- | --- | --- |
| LAY2-00 | 决策与基线 | 建立本文，保存旧裁决与新决策，刷新路径、workflow、仓外配置和依赖清单 | `待授权` | 三路审核入表，blocker 有明确 owner |
| LAY2-01 | 双布局基础 | workspace 同时接受 apps/packages/jobs；建立 path-independent registry；边界审计、钩子、Knip、生成物 checker 改为按 manifest 识别；补 `workspace-undeclared-import` | `待授权` | 14 个 workspace 唯一；313/329/13 语义同集或递减；真实违规和未声明依赖探针均拒绝 |
| LAY2-02 | 双路径发布合同 | workflow、path-contract 和仓外构建配置先接受旧/新路径，不移动 app | `待授权` | 新旧路径触发合同可执行，回切值已记录 |
| LAY2-03 | `wb-build` | 移至 `jobs/wb-build` | `待授权` | package 解析、最小 dry run、边界和生成物检查通过 |
| LAY2-04 | `alg-build` | 移至 `jobs/alg-build` | `待授权` | migration 输出、API 消费和清册一致，不改正式 DB |
| LAY2-05 | `stats-build` | 移至 `jobs/stats-build` | `待授权` | build/upload/load 三段合同一致，不重算正式统计 |
| LAY2-06 | solver 边界与 `scramble-stats-build` | 先消除 Web 私有 solver import，再移至 jobs | `待授权` | job 只依赖公开 package，最小 fixture/dry run 通过 |
| LAY2-07 | Miniprogram | 移至 `apps/miniprogram` | `待授权` | 独立构建、shared 合同、Web 路由合同通过，无 React DOM 依赖 |
| LAY2-08 | 资产边界与 Mobile | 先提取图标生成入口，再移至 `apps/mobile` | `待授权` | typecheck/build、Android 资产和原生路径通过 |
| LAY2-09 | 测试归属与 API | 先处理 Web→API 私有测试读取，再移至 `apps/api` | `待授权` | API typecheck/test/bundle、migration 和部署制品通过 |
| LAY2-10 | Web | 移至 `apps/web` | `待授权` | typecheck、隔离 Next build、standalone 启动和关键路由 smoke 通过 |
| LAY2-11 | 收尾 | 删除旧路径兼容，刷新文档、清册和历史 allowlist | `待授权` | 旧活动引用归零，4 app/6 package/4 job 唯一归类 |

默认不交换顺序。确需调整时，先证明目标批不依赖未完成的前置项，并把理由写入本文。

## 8. 每批固定流程

1. 取证：记录基线、他人改动和所有目标路径引用。
2. 判边界：列出非法路径、跨单元私有 import、生成物和部署产物。
3. 移动：使用 `git mv`，只移动本批单元。
4. 修合同：同步 workspace、lockfile、import、workflow、checker、生成物清册和文档。
5. 清旧引用：只允许迁移历史、明确 archive 或解释性文档保留旧路径。
6. 定向验证：不无目的地跑重计算或测试全集。
7. 独立复审：普通批至少一人，Web/API/部署批三路复审。
8. 原子提交：只提交本批文件。
9. 发布验收：只在明确授权 push 后执行；全绿和 smoke 后再开下一批。

## 9. 验证矩阵

所有批次必须证明：

- 活跃 workspace 仍为 14 个，无重复和漏项。
- `pnpm --filter <原 package 名>` 能解析新位置。
- lockfile 只改变目标单元的 importer 路径，依赖版本和依赖图不漂移。
- Node/Next 条件 exports 在新位置全部可解析；所有跨 workspace import 都有 manifest 声明。
- old→new 路径归一化后的边界 findings 与迁移前同集或递减。
- 架构边界、生成物清册和 workflow path-contract 检查通过。
- 被移动单元的旧活动路径引用归零。
- 目标 package 的最小 typecheck/test/build 通过。

特殊批次额外要求：

- Job：fixture 或临时目录 dry run，不覆盖正式生成物，不启动大计算。
- Miniprogram：跑真实小程序构建，不只做 TypeScript 检查。
- Mobile：验证资产解耦、Capacitor build 和 Android 原生路径；未建立 iOS 工程时不宣称 iOS 已验证。
- API：验证 bundle、migration、source map 和运行时文件清单。
- Web：本机 dev 运行时禁止共用 `.next` 做 production build；用隔离干净 worktree 或 CI 检查 standalone 并启动 smoke。
- 发布：workflow 要覆盖“新路径正确触发、旧路径收尾后不触发、非消费者不误触发”三类矩阵；源码 CI、Deploy Next、Deploy Core 和仓外构建分别记录，不能互相替代。

## 10. 停止和回滚

出现任一情况立即停止当前批：

1. 必须改变业务行为、URL、API、DB 或认证才能移动。
2. 发现未登记的 app→app 或 job→app 私有源码依赖。
3. workflow 无法证明新路径会触发正确部署。
4. 构建制品、migration、静态资源或生成物目的地不一致。
5. lockfile 无法稳定生成，或活跃 workspace 不是恰好 14 个。
6. 他人改动与本批目标文件重叠。
7. 必须移动或删除 Platform 才能继续。
8. 仓外配置没有旧值或不能可靠回切。

回滚单位是本批完整提交：源码路径、workflow、checker、lockfile 和文档一起 `git revert`。已发布批次还要同步回切仓外配置。禁止留下长期半迁状态。

## 11. AI 友好的完成标准

1. `package.json.cuberoot.kind` 是 app/library/job 分类事实源，目录是它的物理表现。
2. `pnpm-workspace.yaml` 是 workspace 发现事实源，不另造手工 package 清单。
3. 根 `AGENTS.md` 保存唯一完整系统地图；`core/README.md` 和 docs 索引只做短说明并链接事实源。`core/apps`、`core/packages`、`core/jobs` 各放一份极短的 scoped `AGENTS.md`，只写归属、禁止边和验证命令，不复制根规则；同步修正 API README 中已经过时的 Web 耦合描述。
4. 架构清单记录允许的非标准边，AI 不必猜相对路径。
5. 生成物清单记录每个 job 的输入、输出、owner 和生命周期。
6. 所有单元可通过 package 名运行命令，不要求 AI 记住 cwd。
7. CI 拒绝目录类型与 kind 不符、app 读取 app 私有源码、job 读取 app 私有源码。
8. 旧路径只允许出现在明确标注的历史记录中，避免 AI 复制过期命令。
9. 使用不继承历史上下文的新 AI 会话做四个导航探针，确认它能正确回答“功能放哪、能否共享、运行哪个命令、由哪个 workflow 发布”。

## 12. 最终验收

- `core/apps` 恰好四个现役 app。
- `core/packages` 恰好六个活跃 library，另有显式排除且未触碰的 Platform archive。
- `core/jobs` 恰好四个 job。
- 14 个 workspace 各发现一次，package 名和依赖图稳定。
- 活跃源码没有 app→app、job→app 私有源码导入。
- CI、部署、生成物和仓外构建均使用新路径，旧兼容已删除。
- 每个 app 和 job 都有与风险匹配的验证证据。
- 每批都有审核、提交、回滚点和发布状态记录。
- Platform 没有被本方案移动或删除。

## 13. 审核记录

| 日期 | 审核方向 | 结论 | 处理 |
| --- | --- | --- | --- |
| 2026-08-25 | CI、部署、PowerShell 和路径调用方 | `HOLD：禁止一步到位` | 已采纳：双布局先行、单单元原子迁移、旧新 workflow filter 过渡、仓外配置回切、正式统计不重算 |
| 2026-08-25 | workspace 归类和目标树 | `GO：分类无歧义；立即执行 HOLD` | 已采纳：4 app、6 library、4 job；Platform 留在原地并排除；`wb-build` 首迁，Web 末迁 |
| 2026-08-25 | package 边界、跨 app 依赖和 AI 可读性 | `条件 GO：先补 3 个 blocker` | 已采纳：path-independent registry 与旧新基线同集证明、workflow 正负触发矩阵、未声明 workspace import 守卫；采用 `apps/web`、`apps/api` 并暂时保留 package 名 |

这里的 `HOLD` 只否决“一步到位执行”，不否决渐进方案。未解决的 blocker 必须成为对应批次的前置门槛，不能靠口头承诺跳过。
