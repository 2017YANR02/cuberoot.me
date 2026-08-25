# CubeRoot package 候选清单

状态：`COMPLETE / Batch 8 snapshot`。本清单冻结已验证的代表性提取、条件候选和重开门槛；它不是“把所有相似文件搬进 package”的永久 backlog。当前事实基线见 [`core/architecture-boundaries.json`](../core/architecture-boundaries.json)，机器扫描器见 [`core/scripts/check-architecture-boundaries.mjs`](../core/scripts/check-architecture-boundaries.mjs)。

## 结论

CubeRoot 需要收紧的是运行时和部署边界，不是把“看起来能复用”的每段代码都做成 package。`shared/alg-transform`、`shared/auth/web-session`、四拼图窄 `puzzle-render-core` 以及 `puzzle-solvers` 的 Clock/SQ2 已证明这套判据可执行；其余多数情况继续用现有 package 的显式 subpath、领域内纯模块或 artifact contract 解决。

不新建 `webapp/`，不拆前后端仓库，也不立即把目录改成 `apps/*`。Web、API、Mobile（当前 Android，未来由同一 React 应用支持 iOS）和小程序属于不同运行边界；下一步是让它们只通过公开 package、API contract 和受管产物通信。

## 判定矩阵

| 候选 | 当前消费者与边界信号 | 依赖闭包与验证 | 决定 | 不提取时的替代方案 |
| --- | --- | --- | --- | --- |
| 纯 puzzle solver 家族，已落地 Clock 与 SQ2 窄切片 | Web UI、Web 测试和离线任务统一使用公开入口 `@cuberoot/puzzle-solvers/clock`；SQ2 的 Web UI、SVG 与 sampled builder 使用 `@cuberoot/puzzle-solvers/sq2`，不再由 build 跨 app 加载私有源码 | 两者均为纯 TypeScript、无 DOM、无 React、无下载表；package oracle 覆盖 Node/浏览器公开出口，Clock 另有 Worker/analyzer，SQ2 保留独立 cstimer oracle，并以临时输出目录执行 N=1 sampled smoke | `完成 / Batch 5 + Batch 8`。package 只开放 `./clock` 与 `./sq2`，不设根 barrel、wildcard 或 shim；这两个代表性切片与 BND-04 的递减守卫足以关闭当前治理任务 | 其他 solver 继续留在 client 私有模块；只有命中下方重开条件时才逐域提取 |
| Headless simulator core | API 与 Web 曾共享四种拼图的状态和 schematic SVG | 完整 Web 闭包含 DOM、WebGL、Worker 和交互；真正中性的四拼图窄闭包已具 Node smoke 与渲染 fixture | `已按窄边界完成`。复用 `@cuberoot/puzzle-render-core`，不搬完整 Web `World` | 交互、手势、人体和 WebGL 生命周期留在 Web |
| Cubeopt 模块、WASM 与大表 | API daemon、离线统计与本机大表具有独立部署生命周期 | 代码 package 不能表达大表、校验和、原子晋级和启用态验证 | `不是普通 TS package，已由 artifact contract 完成治理`。API 自有 bundle、manifest、环境覆盖和无 Web 目录 smoke 已落地 | 关系继续登记为 runtime-file/subprocess 契约 |
| `invertAlg` 等小型纯 helper | 多端需要相同但明确的记号语义，仓库内也存在不同 puzzle 的近似实现 | 单函数不足以形成独立 package 生命周期，盲目合并会混淆语义 | `已用现有 shared 明确 subpath 处理`。`alg-transform` 是范本，不建 helper package | 新 helper 先确认语义，再进入已有领域 subpath 并配 fixture |
| Auth 与多端 DTO | Web、小程序与 API 共享 session/error 语义；Mobile 当前没有认证消费者 | 中性 schema 保持无 React、DOM、Next、Capacitor、微信 API、Node-only 和 axios，并有 producer/consumer fixture | `试点完成`。复用 `shared/auth/web-session`；只有独立发布、原生 codegen 或 shared 无法中性化时才建 contracts package | 每端保留 adapter，schema 和稳定错误码保持单一来源 |
| 品牌图标生成 | Mobile 构建动态 import Web 图标生成器，并读取 Web public 图标 | 这是构建期单一品牌源，不是跨端运行时 UI | `暂不建 package`。第二个独立生成消费者出现时再提取 brand-assets build package | 保持已登记 build-import 契约和生成物 drift test |

## 明确排除

- 不把 Next 页面、导航、React 组件或 CSS 因“多处长得像”搬进跨端 package。
- 不让小程序依赖 React DOM，也不把 Capacitor 设备桥伪装成通用领域层。
- 不为图标、词汇表、测试 fixture 或单个 helper 单独造 workspace package。
- 不重做 `timer`、`smart-cube` 等已经通过 `@cuberoot/shared` 显式 subpath 共享的正确边界。
- 不把 cubeopt 大表、WASM、原生 daemon 当作普通源码 import；它们需要 artifact 和部署契约。

## 提取前门槛

任何候选进入 PKG-02 前必须同时给出：消费者清单、完整 import 闭包、浏览器/Node 运行时矩阵、公开 exports、原测试迁移方案、独立 build 或 smoke、构建体积影响和可回滚提交。若 package 不声明 `exports["."]`，机器守卫必须实测拒绝裸根 import；若提取后仍需要 import 某个 app 的源码或 public，候选直接退回。

## Solver 后续候选快照

| 分类 | 候选 | 当前结论与最低前置动作 |
| --- | --- | --- |
| 条件可提取 | `ssq1`、`cuboid233`、`cuboid336`、`cuboid337`、`bsq`、`cm3`、`heli`、`helicv`、`ctico` | 当前源码是零宿主 import 的纯 TS，并有 Web 与 sampled builder 消费者；本轮只登记，不实施。未来选中时每个 puzzle 独立迁 source、oracle 和直接消费者，并复用 SQ2 的 Node、Browser、N=1 与边界门禁 |
| 先拆宿主配置 | `cuboid334`、`cuboid335` | `process`、`window` 或环境探测仍在 solver 内；先把调参与环境读取改成注入 adapter，再谈纯 core |
| 先拆 Web loader | `bicube`、`sia123`、`sia222` | fetch、`statsUrl`、Blob/Response/解压或 PDB loader 仍与纯状态逻辑混合；先拆纯 core/codec/consts 与 browser loader |
| 先建立中性依赖 | `crz3a` | 仍依赖 Client 私有 Kociemba 模块；先建立公开的中性 Kociemba core 边界 |
| 先决定生成任务归属 | `stm` | 当前 PDB 脚本未进入 package、workflow 或文档契约，且入口不能作为干净 Node 任务直接运行；先决定退役或修成受管生成任务 |

PKG-02 关闭后只在以下情况重开：新增或变更真实跨 app 消费者；现有旧债开始阻塞构建、部署或独立运行；用户明确授权某个 solver 域。普通文件相似、目录观感或“以后也许会复用”不构成重开理由。目录改名和批量移动不进入这条流水线。
