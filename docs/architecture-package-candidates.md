# CubeRoot package 候选清单

状态：`ACTIVE / Batch 2`。本清单只做候选判定，不授权移动源码。当前事实基线见 [`core/architecture-boundaries.json`](../core/architecture-boundaries.json)，机器扫描器见 [`core/scripts/check-architecture-boundaries.mjs`](../core/scripts/check-architecture-boundaries.mjs)。

## 结论

CubeRoot 需要收紧的是运行时和部署边界，不是把“看起来能复用”的每段代码都做成 package。当前最值得提取的只有两组：Web 与离线任务共同使用的纯求解器，以及 API 正在直接 import 的 headless 模拟器内核。其余多数情况应先用现有 package 的显式 subpath、领域内纯模块或 artifact contract 解决。

不新建 `webapp/`，不拆前后端仓库，也不立即把目录改成 `apps/*`。Web、API、Mobile（当前 Android，未来由同一 React 应用支持 iOS）和小程序属于不同运行边界；下一步是让它们只通过公开 package、API contract 和受管产物通信。

## 判定矩阵

| 候选 | 当前消费者与边界信号 | 依赖闭包与验证 | 决定 | 不提取时的替代方案 |
| --- | --- | --- | --- | --- |
| 纯 puzzle solver 家族，首个切片为 Clock | Web UI、Web 测试和 `scramble-stats-build` 都直接使用 `client/lib/clock-solver.ts`；离线任务目前跨 app 动态 import 私有源码 | Clock 是纯 TypeScript、无 DOM、无 React、无下载表；已有 solver、distribution、sim board 测试。bicube、sia222 等现有文件仍含 `statsUrl`/fetch 等 Web loader，不能整文件视为纯核心 | `优先候选`。未来 package 可用 `@cuberoot/puzzle-solvers`，只开放 `./clock` 等显式 subpath，不设根 barrel。Clock 先验证独立 build、Node import、浏览器消费和原 fixture；其他 solver 必须先拆开纯核心与 Web loader，再逐个评估。禁止一次搬完 20 个 solver | 保留 client 私有模块，但离线 job 的跨 app import 会继续成为登记旧债 |
| Headless simulator core | API 的 `engine_render.ts` 通过 server 的 `@/*` alias import 三个 Web 私有模块；Web 同时运行同一引擎 | 已有 Node headless gate 和渲染 smoke，但闭包约 90 个文件，仍需证明无 DOM、WebGL renderer、客户端 worker 和私有 `@/lib` 值依赖 | `Batch 3 条件候选`。只抽状态、几何、场景组装和 schematic SVG；交互、手势、人体、WebGL 生命周期留在 Web。先生成闭包清单再移动 | 暂时保留 3 条 alias 旧债；不能把 tsconfig alias 当长期公开 API |
| Cubeopt 模块、WASM 与大表 | API daemon 和离线统计读取 Web public 下的模块，同时读取 repo 外大表 | Node 子进程、WASM/JS 模块和约 972M 表具有独立部署生命周期；代码 package 不能自动解决产物归属 | `不是普通 TS package`。在 Batch 3 建 API 自有 artifact bundle、版本清单、环境覆盖和“无 Web 目录”smoke | 继续把关系登记为 runtime-file/subprocess 契约，但不得增加新的 Web public 读取者 |
| `invertAlg` 等小型纯 helper | API 当前只为一个 helper import `client/lib/cube3`；仓库内已有多个不同语义的同名实现 | 单函数不足以形成独立生命周期，且不同 puzzle/notation 的逆操作不能盲目合并 | `不建新 package`。先确认语义，再放入现有 `@cuberoot/shared` 的明确 notation subpath，并配 fixture | API 保留一条 client alias 旧债，直到 Batch 3 最小迁移 |
| Auth 与多端 DTO | Web、Mobile、小程序、API 会共享请求/响应和错误语义 | 必须保持无 React、DOM、Next、Capacitor、微信 API、Node-only 和 axios；还要有跨版本 decoder fixture | `先用 shared 显式 subpath`。以 `auth/web-session` 为试点；只有出现独立发布、原生 codegen 或 shared 无法中性化时才建 contracts package | 每端保留 adapter，但 schema 和稳定错误码仍必须单一来源 |
| 品牌图标生成 | Mobile 构建动态 import Web 图标生成器，并读取 Web public 图标 | 这是构建期单一品牌源，不是跨端运行时 UI | `暂不建 package`。第二个独立生成消费者出现时再提取 brand-assets build package | 保持已登记 build-import 契约和生成物 drift test |

## 明确排除

- 不把 Next 页面、导航、React 组件或 CSS 因“多处长得像”搬进跨端 package。
- 不让小程序依赖 React DOM，也不把 Capacitor 设备桥伪装成通用领域层。
- 不为图标、词汇表、测试 fixture 或单个 helper 单独造 workspace package。
- 不重做 `timer`、`smart-cube` 等已经通过 `@cuberoot/shared` 显式 subpath 共享的正确边界。
- 不把 cubeopt 大表、WASM、原生 daemon 当作普通源码 import；它们需要 artifact 和部署契约。

## 提取前门槛

任何候选进入 PKG-02 前必须同时给出：消费者清单、完整 import 闭包、浏览器/Node 运行时矩阵、公开 exports、原测试迁移方案、独立 build 或 smoke、构建体积影响和可回滚提交。若 package 不声明 `exports["."]`，机器守卫必须实测拒绝裸根 import；若提取后仍需要 import 某个 app 的源码或 public，候选直接退回。

推荐顺序：Clock solver 单切片 → API 的 `invertAlg` 最小 subpath → headless simulator core → 其余 solver 逐项评估。目录改名和批量移动不进入这条流水线。
