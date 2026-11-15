# CubeRoot Core

pnpm + Turbo monorepo，承载现役产品 app、共享 package 和离线 job；`apps/fmc-solver` 是同目录下独立部署的 Cargo app，不属于 pnpm workspace。Core 外的 `solver/` 与 `research/reconer/` 有独立生命周期。

本文的所有 pnpm 命令都从 `core/` 执行；现役 pnpm 应用以 `pnpm-workspace.yaml` 与各 manifest 为准；Web 位于 `packages/client`，另有 Cargo app `apps/fmc-solver`。`packages/platform` 只是 workspace 外归档。

## 工作区

```
core/apps/
├── api/             # Hono + PostgreSQL 13(WCA OAuth + recon + alg + 训练数据)
├── mobile/          # Capacitor Android/iOS 薄宿主
├── desktop/         # Tauri Windows/macOS 薄宿主
├── harmony/         # HarmonyOS NEXT ArkTS + ArkWeb 薄宿主
├── miniprogram/     # 微信 / 抖音小程序独立运行时
└── fmc-solver/      # cubelib Rust 服务，独立 Cargo workspace 与部署

core/packages/
├── client/          # React 19 + Next.js 16 主站训练 / 工具前端，待迁 apps/web
├── platform/        # 已退役的 Platform 源码与 SQLite migration 归档
├── app-ui/          # 五端共用 React 产品层
├── shared/          # 共享类型与通用数据
└── visualcube/      # 自有 NxN SVG 渲染器

core/jobs/
├── alg-build/      # 公式数据与 SQL 生成 job
├── scramble-stats-build/ # 打乱分析生成 job
├── stats-build/    # WCA 统计与数据库装载 job
└── wb-build/       # 非官方世界最好成绩数据 job
```

目录图只用于定位主要模块；完整包清单、命令与公开出口以 manifest 为准。

## 详细文档

| 主题 | 文档 |
|---|---|
| 本地开发(PostgreSQL API / WCA 导出数据 / dev server / upstream sync) | [../docs/contributing/local-setup.md](../docs/contributing/local-setup.md) |
| 统计管线用法 | [../docs/data/wca/stats-pipeline.md](../docs/data/wca/stats-pipeline.md) |
| Recon API contract | [../docs/product/recon/recon-api.md](../docs/product/recon/recon-api.md) |
| 部署与运维 | [workflows](../.github/workflows/) / [nginx](../ops/nginx/README.md) / [故障排除](../docs/troubleshooting.md) |
| AI 行为指引 | [../AGENTS.md](../AGENTS.md) |
| 文档状态与事实源 | [../docs/README.md](../docs/README.md) |
| 生成物所有权 | [../docs/data/artifacts/generated-artifacts.md](../docs/data/artifacts/generated-artifacts.md) |

## 快速命令

```bash
pnpm install
pnpm --filter @cuberoot/client dev          # 前端 dev,127.0.0.1:3000
pnpm --filter @cuberoot/client typecheck     # tsgo
pnpm --filter @cuberoot/client build        # dev 停止后执行
pnpm --filter @cuberoot/server typecheck
pnpm stats:scramble                          # 跑打乱统计，完成后自动发布
pnpm stats:scramble:local                    # 只生成本地统计

cd apps/fmc-solver
cargo test -p cubelib-server
```

> Recon API 通过 Next rewrites 转到 `api.cuberoot.me`,**本地不需要起 Hono 后端**。
