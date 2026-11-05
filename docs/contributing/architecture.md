# 架构边界与模块归属

本文件承接根 [AGENTS.md](../../AGENTS.md) 中的对应细则（2026-11-05 整理），是当前维护规则，不是历史归档。涉及本主题时先读；当次用户指令优先。代码路径除明确标注外均相对仓库根目录，core 命令在 `core/` 执行。发布授权统一见[发布规则](release.md)。

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## 系统地图（先读）

仓库 `2017YANR02/cuberoot.me` 的活跃应用、共享能力和生成任务在同一个仓库管理，不等于同一个运行时或部署单元。

| 路径 | 责任与边界 |
| --- | --- |
| `core/packages/client` | 唯一 Web 前端，包含 `/platform/*` 产品入口及其复用的 `/org/*`、`/learn/*` 深链 |
| `core/apps/api` | Hono API + PostgreSQL，独立运行和部署；源码与运行时资产不依赖 Web 私有目录；既有解耦验收见架构跟踪表，禁止重新引入 |
| `core/packages/app-ui` | Android、iOS、HarmonyOS NEXT、Windows 和 macOS 唯一共享的 React 产品层；不调用原生 API，只通过宿主 capability adapter 使用系统能力 |
| `core/apps/mobile` | Android/iOS 共用的 Capacitor 薄宿主；业务 UI 从 `@cuberoot/app-ui` 消费 |
| `core/apps/desktop` | Windows/macOS 共用的单一 Tauri 薄宿主；构建、安装、BLE、签名与公证证据分平台记账 |
| `core/apps/harmony` | HarmonyOS NEXT 的 ArkTS + ArkWeb 薄宿主；当前实现与 HAP 构建证据见 `docs/mobile-app-roadmap.md` |
| `core/apps/miniprogram` | 微信小程序独立运行时，不复用 React DOM UI |
| `core/apps/fmc-solver` | vendored cubelib Cargo workspace 与独立 HTTP 服务；专用 workflow 构建部署，线上入口保持 `/v1/fmc/*` |
| `core/packages/shared` | 稳定契约、纯规则与跨端数据模型；公式数据以 PG `alg_sets/alg_cases` 为准 |
| `core/packages/visualcube` 等 | 有明确构建或运行时边界的共享 package |
| `core/jobs/*` | 离线 job，输出统计、数据或迁移生成物，不是在线 app |
| `core/packages/platform` | workspace 外的退役历史归档，不测试、不构建、不部署、不引入新功能 |
| `solver/` | workspace 外 Rust 求解引擎，产 native 分析器和 WASM；`target/`、`tables/`、`pkg-*` 仅本机有 |
| `research/reconer/` | workspace 外速拧视频自动复盘研发；进入前读 `research/reconer/AGENTS.md`、`roadmap.md`、`plan.md` 和 `human.md` |
| `tools/` / `stats/` | `static.cuberoot.me` 的 upstream/教学资源与本地生成数据；统计快照由 `wca-data-latest` Release 管理，不再提交 Git |
| `ops/` / `docs/` / `.github/workflows` | 运维、状态/设计记录和 CI/部署契约 |

事实源按优先级核对：`core/pnpm-workspace.yaml` 与各 `package.json` 定义 pnpm workspace/命令，Cargo app 由自身 `Cargo.toml` 定义；源码路由、shared schema 和 migration 定义运行契约；`.github/workflows` 与 `ops/` 定义发布边界；`docs/generated-artifacts.json` 定义生成物，`docs/generated-artifacts.md` 解释维护方式；`docs/architecture-modernization-tracker.md` 是当前架构执行入口，历史验收单独保存在 `docs/architecture-modernization-history.md`。架构建议须注明检查提交与具体源码/配置证据；路径和 package 身份复用现有 workspace resolver，部署路径合同从 manifest 依赖推导，文档不重复维护完整清单。

新代码归属：页面和平台适配留在所属 app；稳定、运行时中性且有真实多端消费者的契约/纯逻辑才进共享 package；只因两份文件相似不拆 package。

新的一般业务代码、统计/生成 job 和仓库自动化优先 TypeScript，求解器与大表生成优先 Rust；现存 Python 的迁移状态和必须保留的 Blender/研究/上游例外见 `docs/python-to-typescript-rust-tracker.md`。新增 Python 入口前先核对该跟踪表，避免把已经迁出的管道接回 Python。

仓库自有 PowerShell 脚本已迁为 TypeScript 或退役，清单和验证边界见 `docs/powershell-to-typescript-tracker.md`。新增自动化入口使用 TypeScript；调用方、CI、hook 配置和文档不得重新引入 `.ps1` 或把 `pwsh` 当作 TS 入口的依赖。

新增生产依赖禁止 `package -> app`、`app A -> app B 源码`、`server -> client/client public`、`miniprogram -> React DOM/Next`、跨包 deep import 和任何现役包对 `packages/platform` 的引用；已有违规在架构跟踪表里递减，不得扩大。

所有 core pnpm 命令先进入 `core/`；Cargo app 进入自身目录运行 `cargo`；验证使用目标单元的 `typecheck`/`test`/`build`；API 部署按真实输入路径触发；push 前以当前 workflow path filter 与产物步骤核对范围，不从历史文档推断。

## 模块归属(fork 不能改)

| 模块 | 路由 | 位置 | 来源 | 可改? |
|------|------|------|------|-------|
| Solver | `/solver` | 根目录静态(Vercel 走 `tools/[...slug]` 反代) | fork of or18/RubiksSolverDemo | ❌ |
| Alg Trainer | `/alg-trainers` | 同上 | fork of mihlefeld/Alg-Trainers | ❌ |
| csTimer | `/cstimer` | iframe → `/tools/cstimer/` | cs0x7f/cstimer | ❌ |
| BLDDB | `/blddb` | iframe → `/tools/blddb/`(next build 静态导出,统一入口 `cd core && pnpm upstream:sync --only blddb`) | nbwzx/blddb v2 | ❌ |
| 盲拧公式查询 | `/alg/3bld/lookup` | client,吃 `tools/blddb/data/*Manmade.json`(三阶六套) | 自有 UI + blddb 数据 | ✅ |
| WCA Stats | `/wca` | `jobs/stats-build` | jonatanklosko/wca_statistics TS 重写 | ⚠️ 管道重写,UI 自有 |
| Score Calculator | `/calc` | client `app/[lang]/calc/` | ported from carykh/hthgrapher | ✅ |
| 1v1 Battle | `/timer` 双人模式(旧 `/battle` 已退役,引擎在 `timer/_battle/`) | client | ported from MatteoColombo/cube_challenge_timer | ✅ |
| Recon | `/recon` | client | 自有 | ✅ |
| Trainer | `/alg`(公式库内,`/alg/:p/:s/select` + `/alg/{3bld,roux,skewb-trainer}`) | client | 自有 | ✅ |
| Recognize | `/recognize/pll` | client | 自有 | ✅ |
| Frame Count | `/frame-count` | client | 自有 | ✅ |
| Distribution | `/wca/viz` | client | 自有 | ✅ |
| Comp 比赛中心 | `/wca/comp` | client | 自有 | ✅ |
| Scramble | `/scramble/stats` | client + `stats/scramble/*.json` | 自有 | ✅ |
| Mosaic | `/mosaic` | client | ported from Roman-/mosaic | ✅ |
| Blog | blog.cuberoot.me | 独立 repo `cuberoot-blog` | 外部 | — |

改 upstream 模块先问用户;要改只改 fork 后新增/包装部分。
